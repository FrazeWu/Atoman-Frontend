import { mount, config } from '@vue/test-utils'
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

  it('exposes one 32px edge for each sheet above the current layer', () => {
    const wrapper = mount(PSheet, {
      props: {
        show: true,
        width: '900px',
        isShifted: true,
        layerIndex: 0,
        stackSize: 3,
      },
    })

    expect(wrapper.get('.p-sheet-panel').attributes('style')).toContain('--a-sheet-shift: 64px')
  })

  it('reserves the full stack edge for every custom-width layer', () => {
    const bottom = mount(PSheet, {
      props: {
        show: true,
        width: '900px',
        layerIndex: 0,
        stackSize: 3,
      },
    })
    const top = mount(PSheet, {
      props: {
        show: true,
        width: '900px',
        layerIndex: 2,
        stackSize: 3,
      },
    })

    for (const wrapper of [bottom, top]) {
      const style = wrapper.get('.p-sheet-panel').attributes('style')
      expect(style).toContain('--a-sheet-stack-edge: 64px')
      expect(style).toContain('max-width: calc(100vw - var(--a-sidebar-width) - 16px - var(--a-sheet-stack-edge))')
    }
  })

  it('accepts custom width via prop', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, width: '900px' }
    })
    const panel = wrapper.find('.p-sheet-panel').element as HTMLElement
    expect(panel.style.width).toBe('900px')
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
    expect(panel.style.left).toBe('calc(var(--a-sidebar-width) + 64px)')
    expect(panel.style.width).toBe('calc(100% - var(--a-sidebar-width) - 64px)')

    const tab = wrapper.findComponent({ name: 'PSheetTab' }).element as HTMLElement
    expect(tab.style.top).toBe('88px')
  })

  it('defaults to index 0 styles', () => {
    const wrapper = mount(PSheet, {
      props: { show: true }
    })
    const panel = wrapper.find('.p-sheet-panel').element as HTMLElement
    expect(panel.style.left).toBe('calc(var(--a-sidebar-width) + 32px)')
    expect(panel.style.width).toBe('calc(100% - var(--a-sidebar-width) - 32px)')

    const tab = wrapper.findComponent({ name: 'PSheetTab' }).element as HTMLElement
    expect(tab.style.top).toBe('32px')
  })

  it('exposes only the top layer as a modal dialog', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, title: '专辑详情', isTopLayer: true, layerIndex: 2 },
    })
    const panel = wrapper.get('.p-sheet-panel')
    expect(panel.attributes('role')).toBe('dialog')
    expect(panel.attributes('aria-modal')).toBe('true')
    expect(panel.attributes('aria-label')).toBe('专辑详情')
    expect(panel.attributes('data-layer-index')).toBe('2')
  })

  it('only lets the top layer close with Escape', async () => {
    const top = mount(PSheet, { props: { show: true, isTopLayer: true } })
    const shifted = mount(PSheet, { props: { show: true, isTopLayer: false } })
    await top.get('.p-sheet-panel').trigger('keydown', { key: 'Escape' })
    await shifted.get('.p-sheet-panel').trigger('keydown', { key: 'Escape' })
    expect(top.emitted('close')).toHaveLength(1)
    expect(shifted.emitted('close')).toBeUndefined()
  })

  it('uses a labelled icon close control', () => {
    const wrapper = mount(PSheet, {
      props: { show: true, title: '历史记录', closeType: 'header' },
    })
    expect(wrapper.get('[aria-label="关闭历史记录"]')).toBeTruthy()
    expect(wrapper.text()).not.toContain('CLOSE')
  })

})
