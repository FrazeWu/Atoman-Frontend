import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installStaleViteChunkRecovery, recoverStaleViteChunk } from '../../../src/utils/staleViteChunkRecovery'

describe('staleViteChunkRecovery', () => {
  const originalLocation = window.location
  const replace = vi.fn()
  const reload = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    replace.mockReset()
    reload.mockReset()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'https://www.atoman.org',
        href: 'https://www.atoman.org/music',
        pathname: '/music',
        search: '',
        hash: '',
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

  it('matches Firefox disallowed MIME type errors and triggers recovery with _cc_refresh', () => {
    const firefoxError = new TypeError(
      'Loading module from “https://www.atoman.org/assets/IconX-Bgoh_hMf.js” was blocked because of a disallowed MIME type (“text/html”).'
    )

    const recovered = recoverStaleViteChunk(firefoxError)
    expect(recovered).toBe(true)
    expect(replace).toHaveBeenCalled()
    const targetUrl = replace.mock.calls[0][0]
    expect(targetUrl).toContain('/music')
    expect(targetUrl).toContain('_cc_refresh=')
  })

  it('matches standard dynamic import errors and network errors', () => {
    expect(recoverStaleViteChunk('Failed to fetch dynamically imported module')).toBe(true)
    expect(recoverStaleViteChunk('Failed to fetch dynamically imported module')).toBe(false) // second call in cooldown window is throttled
    sessionStorage.clear()
    expect(recoverStaleViteChunk(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true)
  })

  it('ignores unrelated application errors', () => {
    sessionStorage.clear()
    expect(recoverStaleViteChunk(new Error('User profile could not be loaded'))).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('installs vite:preloadError listener and intercepts events', () => {
    sessionStorage.clear()
    installStaleViteChunkRecovery()

    const event = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(replace).toHaveBeenCalled()
  })
})
