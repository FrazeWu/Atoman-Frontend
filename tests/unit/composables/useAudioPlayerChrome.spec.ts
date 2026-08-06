import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAudioPlayerChrome } from '@/composables/useAudioPlayerChrome'

describe('useAudioPlayerChrome', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.playerActive
    delete document.documentElement.dataset.playerPinned
  })

  it('auto-hides when unpinned and stays visible after pinning', async () => {
    const pinned = ref(false)
    let chrome!: ReturnType<typeof useAudioPlayerChrome>
    const wrapper = mount(defineComponent({
      setup() {
        chrome = useAudioPlayerChrome(pinned, () => { pinned.value = !pinned.value })
        return () => h('div')
      },
    }))

    chrome.scheduleAutoHide()
    vi.advanceTimersByTime(500)
    expect(chrome.playerHovered.value).toBe(false)

    chrome.revealPlayer()
    chrome.togglePlayerPin()
    await nextTick()
    chrome.scheduleAutoHide()
    vi.advanceTimersByTime(500)

    expect(chrome.effectivePinned.value).toBe(true)
    expect(chrome.playerHovered.value).toBe(true)
    expect(document.documentElement.dataset.playerPinned).toBe('true')
    wrapper.unmount()
    expect(document.documentElement.dataset.playerActive).toBeUndefined()
  })
})
