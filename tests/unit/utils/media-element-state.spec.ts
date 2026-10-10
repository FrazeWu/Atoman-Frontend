import { describe, expect, it, vi } from 'vitest'

import { subscribeToMediaElement } from '@/utils/mediaElementState'

describe('media element state', () => {
  it('subscribes and removes the shared native media event set', () => {
    const media = document.createElement('video')
    const listener = vi.fn()
    const remove = subscribeToMediaElement(media, listener)

    media.dispatchEvent(new Event('playing'))
    expect(listener).toHaveBeenCalledOnce()

    remove()
    media.dispatchEvent(new Event('playing'))
    expect(listener).toHaveBeenCalledOnce()
  })
})
