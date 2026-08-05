import type { Router } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installChunkLoadRecovery, isChunkLoadError } from '@/router/chunkLoadRecovery'

const { reportError } = vi.hoisted(() => ({
  reportError: vi.fn(),
}))

vi.mock('@/utils/logger', () => ({ reportError }))

describe('chunk load recovery', () => {
  const originalLocation = window.location
  const assign = vi.fn()
  const onError = vi.fn()
  const routerAfterEach = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    assign.mockReset()
    onError.mockReset()
    routerAfterEach.mockReset()
    reportError.mockReset()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign },
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

  it('recognizes browser and Vite chunk loading errors', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/Forum.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/Forum.css'))).toBe(true)
    expect(isChunkLoadError(new Error('API request failed'))).toBe(false)
  })

  it('opens the target route as a full navigation when an old chunk is unavailable', () => {
    const { errorHandler } = install()
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/Forum-old.js')

    errorHandler(error, { fullPath: '/forum?tab=latest' })

    expect(reportError).toHaveBeenCalledWith(error, '路由加载失败')
    expect(sessionStorage.getItem('atoman_chunk_load_recovery')).toBe('/forum?tab=latest')
    expect(assign).toHaveBeenCalledWith('/forum?tab=latest')
  })

  it('does not repeatedly reload the same failing target', () => {
    sessionStorage.setItem('atoman_chunk_load_recovery', '/forum')
    const { errorHandler } = install()

    errorHandler(new TypeError('error loading dynamically imported module'), { fullPath: '/forum' })

    expect(assign).not.toHaveBeenCalled()
  })

  it('clears the recovery marker after a successful navigation', () => {
    sessionStorage.setItem('atoman_chunk_load_recovery', '/forum')
    const { afterEachHandler } = install()

    afterEachHandler({}, {}, undefined)

    expect(sessionStorage.getItem('atoman_chunk_load_recovery')).toBeNull()
  })
})
