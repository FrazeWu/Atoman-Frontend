import { afterEach, describe, expect, it, vi } from 'vitest'

import { waitForInitialPaint } from '@/utils/waitForInitialPaint'

describe('waitForInitialPaint', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for the next animation frame while the portal prerender is present', async () => {
    let frameCallback: FrameRequestCallback | undefined
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback
      return 1
    })
    vi.stubGlobal('document', {
      documentElement: { hasAttribute: () => true },
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)

    const result = waitForInitialPaint()

    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    frameCallback?.(0)
    await expect(result).resolves.toBeUndefined()
  })

  it('continues immediately when the portal prerender is absent', async () => {
    const requestAnimationFrame = vi.fn()
    vi.stubGlobal('document', {
      documentElement: { hasAttribute: () => false },
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)

    await expect(waitForInitialPaint()).resolves.toBeUndefined()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })
})
