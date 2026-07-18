import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

const TestIcon = {
  name: 'TestIcon',
  render: () => h('svg', { 'data-testid': 'test-icon', viewBox: '0 0 16 16' }),
}

describe('PSidebarItem', () => {
  it('renders a component icon inside the sidebar icon slot for links', () => {
    const wrapper = mount(PSidebarItem, {
      props: { to: '/', index: 1, icon: TestIcon },
      slots: { default: '订阅' },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    const icon = wrapper.find('[data-testid="test-icon"]')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('p-sidebar-item-svg')
    const iconWrapper = wrapper.find('.p-sidebar-item-icon')
    expect(iconWrapper.exists()).toBe(true)
    expect(iconWrapper.classes()).toContain('is-component-icon')
    expect(iconWrapper.classes()).not.toContain('is-char-icon')
    expect(wrapper.find('.p-sidebar-item-num').exists()).toBe(false)
    expect(wrapper.text()).toContain('订阅')
  })

  it('preserves iconChar rendering for button items', () => {
    const wrapper = mount(PSidebarItem, {
      props: { active: true, index: 2, iconChar: '探' },
      slots: { default: '探索' },
    })

    const iconWrapper = wrapper.find('.p-sidebar-item-icon')
    expect(iconWrapper.text()).toBe('探')
    expect(iconWrapper.classes()).toContain('is-char-icon')
    expect(iconWrapper.classes()).not.toContain('is-component-icon')
    expect(wrapper.find('.p-sidebar-item-num').exists()).toBe(false)
    expect(wrapper.text()).toContain('探索')
  })

  it('places icon before the label content in DOM order for expanded sidebars', () => {
    const wrapper = mount(PSidebarItem, {
      props: { active: true, index: 1, icon: TestIcon },
      slots: { default: '订阅' },
    })

    const itemHtml = wrapper.html()
    const labelIndex = itemHtml.indexOf('p-sidebar-item-label')
    const iconIndex = itemHtml.indexOf('p-sidebar-item-icon')

    expect(labelIndex).toBeGreaterThanOrEqual(0)
    expect(iconIndex).toBeGreaterThanOrEqual(0)
    expect(wrapper.find('.p-sidebar-item-num').exists()).toBe(false)
    expect(iconIndex).toBeLessThan(labelIndex)
  })

  it('places icon before the label content in DOM order for RouterLink items', () => {
    const wrapper = mount(PSidebarItem, {
      props: { to: '/', index: 1, icon: TestIcon },
      slots: { default: '订阅' },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
        },
      },
    })

    const itemHtml = wrapper.html()
    const labelIndex = itemHtml.indexOf('p-sidebar-item-label')
    const iconIndex = itemHtml.indexOf('p-sidebar-item-icon')

    expect(labelIndex).toBeGreaterThanOrEqual(0)
    expect(iconIndex).toBeGreaterThanOrEqual(0)
    expect(wrapper.find('.p-sidebar-item-num').exists()).toBe(false)
    expect(iconIndex).toBeLessThan(labelIndex)
  })
})
