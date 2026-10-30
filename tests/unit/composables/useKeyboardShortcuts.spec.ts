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

  it('blocks page-level shortcuts when a modal dialog is active unless allowInDialog is true', async () => {
    const normalHandler = vi.fn()
    const dialogHandler = vi.fn()

    const wrapper = mount(defineComponent({
      setup() {
        useKeyboardShortcuts([
          { key: 'n', handler: normalHandler, description: '新建' },
          { key: 'Escape', handler: dialogHandler, description: '关闭', allowInDialog: true },
        ])
        return () => h('div')
      },
    }))

    // 模拟存在打开的模态框
    const modal = document.createElement('div')
    modal.className = 'p-modal'
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)

    const normalEvent = new KeyboardEvent('keydown', { key: 'n', cancelable: true })
    window.dispatchEvent(normalEvent)
    expect(normalHandler).not.toHaveBeenCalled()

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    window.dispatchEvent(escapeEvent)
    expect(dialogHandler).toHaveBeenCalledOnce()

    modal.remove()
    wrapper.unmount()
  })

  it('blocks shortcuts when typing in rich text editors or contenteditable', async () => {
    const handler = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'b', handler, description: '加粗' }])
        return () => h('div', { class: 'p-editor' }, [h('p', 'hello')])
      },
    }))

    const p = wrapper.get('p').element
    const event = new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true })
    p.dispatchEvent(event)

    expect(handler).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

