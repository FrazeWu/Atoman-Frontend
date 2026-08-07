import type { Router } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installChunkLoadRecovery, isChunkLoadError } from '@/router/chunkLoadRecovery'

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

  beforeEach(() => {
    sessionStorage.clear()
    replace.mockReset()
    reload.mockReset()
    onError.mockReset()
    routerAfterEach.mockReset()
    reportError.mockReset()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'http://localhost',
        href: 'http://localhost/forum',
        replace,
        reload,
      },
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
