import type { Router } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupRefreshParam, installChunkLoadRecovery, isAppChunkElement, isChunkLoadError } from '@/router/chunkLoadRecovery'

const { reportError } = vi.hoisted(() => ({
  reportError: vi.fn(),
}))

vi.mock('@/utils/logger', () => ({ reportError }))

describe('chunk load recovery', () => {
  const originalLocation = window.location
  const replace = vi.fn()
  const reload = vi.fn()
  const onError = vi.fn()
  const routerAfterEach = vi.fn()
  const replaceState = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    replace.mockReset()
    reload.mockReset()
    onError.mockReset()
    routerAfterEach.mockReset()
    reportError.mockReset()
    replaceState.mockReset()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'http://localhost',
        href: 'http://localhost/forum',
        pathname: '/forum',
        search: '',
        hash: '',
        replace,
        reload,
      },
    })

    Object.defineProperty(window.history, 'replaceState', {
      configurable: true,
      value: replaceState,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  function install() {
    installChunkLoadRecovery({
      onError,
      afterEach: routerAfterEach,
    } as unknown as Router)
    return {
      errorHandler: onError.mock.calls[0]?.[0],
      afterEachHandler: routerAfterEach.mock.calls[0]?.[0],
    }
  }

  it('recognizes Firefox, Chrome, and Vite chunk loading errors', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/Forum.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/Forum.css'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Loading module from “http://localhost/assets/DiscoverView-a1b2.js” was blocked because of a disallowed MIME type (“text/html”).'))).toBe(true)
    expect(isChunkLoadError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true)
    expect(isChunkLoadError(new Error('API request failed'))).toBe(false)
  })

  it('correctly identifies app chunk elements vs Cloudflare or third-party scripts', () => {
    const appScript = document.createElement('script')
    appScript.src = 'http://localhost/assets/index-BE_SCnlJ.js'

    const cfScript = document.createElement('script')
    cfScript.src = 'http://localhost/cdn-cgi/challenge-platform/scripts/jsd/main.js'

    const cfRum = document.createElement('script')
    cfRum.src = 'http://localhost/cdn-cgi/rum?foo=bar'

    const img = document.createElement('img')
    img.src = 'http://localhost/favicon.png'

    expect(isAppChunkElement(appScript)).toBe(true)
    expect(isAppChunkElement(cfScript)).toBe(false)
    expect(isAppChunkElement(cfRum)).toBe(false)
    expect(isAppChunkElement(img as unknown as HTMLElement)).toBe(false)
  })

  it('cleans up _cc_refresh param from URL without reloading page', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'http://localhost',
        href: 'http://localhost/forum?_cc_refresh=1786071485201',
        pathname: '/forum',
        search: '?_cc_refresh=1786071485201',
        hash: '',
        replace,
        reload,
      },
    })

    cleanupRefreshParam()

    expect(replaceState).toHaveBeenCalledWith(window.history.state, '', '/forum')
  })

  it('replaces location with cache-busting timestamp when a chunk is unavailable', () => {
    const { errorHandler } = install()
    const error = new TypeError('Loading module from “/assets/Forum-old.js” was blocked because of a disallowed MIME type')

    errorHandler(error, { fullPath: '/forum?tab=latest' })

    expect(reportError).toHaveBeenCalledWith(error, '路由或Chunk资源加载失败')
    expect(replace).toHaveBeenCalled()
    const replaceUrl = replace.mock.calls[0][0]
    expect(replaceUrl).toContain('/forum?tab=latest')
    expect(replaceUrl).toContain('_cc_refresh=')
  })

  it('does not repeatedly reload within cooldown window', () => {
    sessionStorage.setItem('atoman_chunk_load_recovery_time', String(Date.now()))
    const { errorHandler } = install()

    errorHandler(new TypeError('error loading dynamically imported module'), { fullPath: '/forum' })

    expect(replace).not.toHaveBeenCalled()
  })

  it('clears recovery marker after navigation when cooldown period passes', () => {
    sessionStorage.setItem('atoman_chunk_load_recovery_time', String(Date.now() - 20000))
    const { afterEachHandler } = install()

    afterEachHandler({}, {}, undefined)

    expect(sessionStorage.getItem('atoman_chunk_load_recovery_time')).toBeNull()
  })
})
