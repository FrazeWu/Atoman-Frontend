import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DebateLayout from '@/views/debate/DebateLayout.vue'

const mountLayout = () => mount(DebateLayout, {
  global: {
    mocks: {
      $route: { query: {} },
    },
    stubs: {
      RouterView: true,
      PSidebar: { template: '<aside><slot /></aside>' },
      PSidebarItem: {
        props: ['to', 'index', 'icon', 'active', 'exact'],
        template: '<a class="debate-sidebar-item" :data-to="to"><slot /></a>',
      },
    },
  },
})

describe('DebateLayout', () => {
  it('only exposes supported debate status links', () => {
    const wrapper = mountLayout()

    const items = wrapper.findAll('.debate-sidebar-item')

    expect(items.map(item => item.attributes('data-to'))).toEqual([
      '/debate',
      '/debate?status=archived',
    ])
    expect(items.map(item => item.text().trim())).toEqual(['全部辩题', '已归档'])
    expect(wrapper.text()).not.toContain(['进行', '中'].join(''))
    expect(wrapper.text()).not.toContain(['已', '结题'].join(''))
  })
})
