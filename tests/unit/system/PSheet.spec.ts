import { mount, config } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, it, expect } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import PSheet from '@/components/ui/PSheet.vue'

config.global.plugins = [createTestingPinia({ stubActions: false })]

describe('PSheet.vue', () => {
  it('renders body content and bookmark tab, but no default title bar', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, title: 'TEST TITLE' },
      slots: {
        default: '<p>Sheet body</p>'
      }
    })
    expect(wrapper.find('.p-sheet-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sheet body')
    expect(wrapper.text()).toContain('TEST TITLE')
    expect(wrapper.find('.sheet-header').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'PSheetTab' }).exists()).toBe(true)
  })

  it('renders custom header content when header slot is provided', () => {
    const wrapper = mount(PSheet, {
      props: { show: true },
      slots: {
        header: '<strong>Custom header</strong>'
      }
    })
    expect(wrapper.text()).toContain('Custom header')
    expect(wrapper.find('.sheet-header').exists()).toBe(true)
  })

  it('renders header bar when using header close type', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, closeType: 'header', title: 'Inspect' }
    })
    expect(wrapper.find('.sheet-header').exists()).toBe(true)
    expect(wrapper.find('.header-close-btn').exists()).toBe(true)
  })

  it('applies shifted class when isShifted prop is true', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, isShifted: true }
    })
    expect(wrapper.find('.p-sheet-panel').classes()).toContain('is-shifted')
  })

  it('accepts custom width via prop', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, width: '900px' }
    })
    const panel = wrapper.find('.p-sheet-panel').element as HTMLElement
    expect(panel.style.width).toBe('900px')
  })

  it('applies custom panel class and bottom-sheet height', () => {
    const wrapper = mount(PSheet, {
      props: {
        show: true,
        side: 'bottom',
        panelClass: 'directory-sheet',
        height: '400px',
      },
    })

    const panel = wrapper.get('.p-sheet-panel')
    expect(panel.classes()).toContain('directory-sheet')
    expect((panel.element as HTMLElement).style.height).toBe('400px')
  })

  it('uses compact content spacing when there is no header bar', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, title: 'VIEW' }
    })
    expect(wrapper.find('.sheet-content').classes()).toContain('sheet-content--compact')
  })

  it('keeps regular content spacing when header bar is rendered', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, closeType: 'header', title: 'Inspect' }
    })
    expect(wrapper.find('.sheet-content').classes()).not.toContain('sheet-content--compact')
  })

  it('uses a header close affordance for bottom sheets by default', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true, side: 'bottom', title: 'MORE' },
      slots: {
        default: '<div>content</div>'
      }
    })

    const panel = wrapper.get('.p-sheet-panel')
    expect(panel.classes()).toContain('is-bottom')
    expect(wrapper.find('.sheet-header').exists()).toBe(true)
    expect(wrapper.find('.header-close-btn').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PSheetTab' }).exists()).toBe(false)
    expect(wrapper.find('.sheet-content').classes()).not.toContain('sheet-content--compact')

    await wrapper.find('.header-close-btn').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('close')
  })

  it('emits close event when backdrop is clicked', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true }
    })
    await wrapper.find('.p-sheet-backdrop').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('close')
  })

  it('emits close event when header close button is clicked', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true, closeType: 'header' }
    })
    await wrapper.find('.header-close-btn').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('close')
  })

  it('emits close event when tab is clicked', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true, closeType: 'bookmark' }
    })
    // PSheetTab is a component, we can find it by component or by its expected class if we know it
    // From PSheet.vue: <PSheetTab ... class="sheet-tab-position" ... />
    await wrapper.findComponent({ name: 'PSheetTab' }).trigger('click')
    expect(wrapper.emitted()).toHaveProperty('close')
  })

  it('calculates dynamic offsets based on index prop', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, index: 1 }
    })
    const panel = wrapper.find('.p-sheet-panel').element as HTMLElement
    expect(panel.style.left).toBe('64px')
    expect(panel.style.width).toBe('calc(100% - 64px)')

    const tab = wrapper.findComponent({ name: 'PSheetTab' }).element as HTMLElement
    expect(tab.style.top).toBe('88px')
  })

  it('defaults to index 0 styles', () => {
    const wrapper = mount(PSheet, {
      props: { show: true }
    })
    const panel = wrapper.find('.p-sheet-panel').element as HTMLElement
    expect(panel.style.left).toBe('32px')
    expect(panel.style.width).toBe('calc(100% - 32px)')

    const tab = wrapper.findComponent({ name: 'PSheetTab' }).element as HTMLElement
    expect(tab.style.top).toBe('32px')
  })

  it('uses modal dialog semantics and closes with Escape', async () => {
    const wrapper = mount(PSheet, {
      props: { show: true, closeType: 'header', title: 'Inspect' },
      slots: { default: '<button class="sheet-action">操作</button>' },
      global: { stubs: { Teleport: true } },
    })
    document.body.appendChild(wrapper.element)
    await nextTick()

    const panel = wrapper.get('.p-sheet-panel')
    expect(panel.attributes('aria-modal')).toBe('true')
    expect(panel.attributes('tabindex')).toBe('-1')
    await panel.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
  })

  it('traps Tab focus and restores the previous focus on unmount', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mount(PSheet, {
      props: { show: true, closeType: 'header' },
      slots: { default: '<button class="sheet-action">操作</button>' },
      global: { stubs: { Teleport: true } },
    })
    document.body.appendChild(wrapper.element)
    await nextTick()

    const focusable = Array.from(document.querySelectorAll('.p-sheet-panel button')) as HTMLElement[]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    last.focus()
    await wrapper.get('.p-sheet-panel').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    wrapper.unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
