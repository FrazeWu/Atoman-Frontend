import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import PaperSheet from '@/components/ui/PaperSheet.vue'

describe('PaperSheet.vue', () => {
  it('renders content when show prop is true', () => {
    const wrapper = mount(PaperSheet, {
      props: { show: true, title: 'TEST TITLE' }
    })
    expect(wrapper.find('.paper-sheet-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('TEST TITLE')
  })

  it('applies shifted class when isShifted prop is true', () => {
    const wrapper = mount(PaperSheet, {
      props: { show: true, isShifted: true }
    })
    expect(wrapper.find('.paper-sheet-panel').classes()).toContain('is-shifted')
  })

  it('accepts custom width via prop', () => {
    const wrapper = mount(PaperSheet, {
      props: { show: true, width: '900px' }
    })
    const panel = wrapper.find('.paper-sheet-panel').element as HTMLElement
    expect(panel.style.width).toBe('900px')
  })

  it('emits close event when backdrop is clicked', async () => {
    const wrapper = mount(PaperSheet, {
      props: { show: true }
    })
    await wrapper.find('.paper-sheet-backdrop').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('close')
  })

  it('emits close event when header close button is clicked', async () => {
    const wrapper = mount(PaperSheet, {
      props: { show: true, closeType: 'header' }
    })
    await wrapper.find('.header-close-btn').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('close')
  })

  it('emits close event when tab is clicked', async () => {
    const wrapper = mount(PaperSheet, {
      props: { show: true, closeType: 'bookmark' }
    })
    // PaperSheetTab is a component, we can find it by component or by its expected class if we know it
    // From PaperSheet.vue: <PaperSheetTab ... class="sheet-tab-position" ... />
    await wrapper.findComponent({ name: 'PaperSheetTab' }).trigger('click')
    expect(wrapper.emitted()).toHaveProperty('close')
  })
})
