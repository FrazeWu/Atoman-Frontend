import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installStaleViteChunkRecovery } from '../../../src/utils/staleViteChunkRecovery'

describe('stale Vite chunk recovery', () => {
  const originalLocation = window.location
  const reload = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    })
    reload.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('reloads once when a deployed chunk is no longer available', () => {
    installStaleViteChunkRecovery()
    const event = new Event('vite:preloadError', { cancelable: true })

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not loop when the refreshed page has the same chunk failure', () => {
    installStaleViteChunkRecovery()

    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
    const repeatedEvent = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(repeatedEvent)

    expect(reload).toHaveBeenCalledOnce()
    expect(repeatedEvent.defaultPrevented).toBe(false)
  })
})
