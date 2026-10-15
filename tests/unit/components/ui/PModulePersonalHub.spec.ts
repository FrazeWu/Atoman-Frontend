import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PModulePersonalHub from '@/components/ui/PModulePersonalHub.vue'

describe('PModulePersonalHub', () => {
  it('renders unauthenticated empty state when authenticated is false', () => {
    const wrapper = mount(PModulePersonalHub, {
      props: {
        authenticated: false,
        unauthTitle: '请登录',
        unauthDescription: '登录后查看个人中心',
      },
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PEmpty: { props: ['title', 'description'], template: '<div class="empty">{{ title }} - {{ description }}<slot name="action" /></div>' },
          PButton: { template: '<button><slot /></button>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    expect(wrapper.text()).toContain('请登录 - 登录后查看个人中心')
    expect(wrapper.find('.p-hub__stats').exists()).toBe(false)
  })

  it('renders statistics and quick links when authenticated', () => {
    const wrapper = mount(PModulePersonalHub, {
      props: {
        authenticated: true,
        stats: [
          { label: '发起的辩题', value: 5 },
          { label: '参与的表态', value: 12 },
        ],
        links: [
          { label: '规则', to: '/debate/rules' },
          { label: '设置', to: '/settings' },
        ],
      },
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PEmpty: true,
          PButton: true,
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    })

    expect(wrapper.find('.p-hub__stats').exists()).toBe(true)
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('发起的辩题')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('参与的表态')

    const links = wrapper.findAll('.p-hub__link')
    expect(links).toHaveLength(2)
    expect(links[0].text()).toContain('规则')
    expect(links[1].text()).toContain('设置')
  })
})
