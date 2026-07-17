import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import PModal from '@/components/ui/PModal.vue'

describe('PModal accessibility', () => {
  it('labels the close action and closes with Escape', async () => {
    const wrapper = mount(PModal, {
      props: { show: true, title: '确认操作' },
      slots: { default: '<button class="modal-action">继续</button>' },
      global: { stubs: { Teleport: true } },
    })
    document.body.appendChild(wrapper.element)
    await nextTick()

    const dialog = document.querySelector('.p-modal') as HTMLElement
    expect(dialog.getAttribute('tabindex')).toBe('-1')
    expect(document.querySelector('.p-modal-close')?.getAttribute('aria-label')).toBe('关闭')

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('traps Tab focus and restores focus when removed', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mount(PModal, {
      props: { show: true, title: '确认操作' },
      slots: { default: '<button class="modal-action">继续</button>' },
      global: { stubs: { Teleport: true } },
    })
    document.body.appendChild(wrapper.element)
    await nextTick()

    const dialog = document.querySelector('.p-modal') as HTMLElement
    const focusable = Array.from(dialog.querySelectorAll('button')) as HTMLElement[]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    last.focus()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)

    wrapper.unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
