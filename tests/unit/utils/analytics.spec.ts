import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { scheduleGoogleAnalytics } from '@/utils/analytics'

describe('Google Analytics loader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.head.querySelectorAll('script[data-atoman-analytics]').forEach((script) => script.remove())
    delete window.gtag
    delete window.dataLayer
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not add the analytics script during the initial render window', () => {
    scheduleGoogleAnalytics()

    expect(document.head.querySelector('script[data-atoman-analytics]')).toBeNull()
  })

  it('keeps analytics out of the initial performance window', async () => {
    scheduleGoogleAnalytics()

    await vi.advanceTimersByTimeAsync(5000)

    expect(document.head.querySelector('script[data-atoman-analytics]')).toBeNull()
  })

  it('loads analytics after the delayed start', async () => {
    scheduleGoogleAnalytics()

    await vi.advanceTimersByTimeAsync(10000)

    const script = document.head.querySelector<HTMLScriptElement>('script[data-atoman-analytics]')
    expect(script?.async).toBe(true)
    expect(script?.src).toContain('googletagmanager.com/gtag/js?id=G-1FLNTZ469W')
    expect(window.dataLayer).toBeDefined()
    expect(window.gtag).toBeTypeOf('function')
  })
})
