import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  it('runs a matching shortcut and prevents the browser default', async () => {
    const handler = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'k', ctrl: true, handler, description: '搜索' }])
        return () => h('div')
      },
    }))

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    await nextTick()

    expect(handler).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('does not consume shortcuts while editing and removes the listener on unmount', async () => {
    const handler = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'k', handler, description: '搜索' }])
        return () => h('input')
      },
    }))

    const input = wrapper.get('input').element
    const editingEvent = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true })
    input.dispatchEvent(editingEvent)
    expect(handler).not.toHaveBeenCalled()
    expect(editingEvent.defaultPrevented).toBe(false)

    wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', cancelable: true }))
    await nextTick()
    expect(handler).not.toHaveBeenCalled()
  })
})
