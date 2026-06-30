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
  it('keeps status filter links inside the debate module', () => {
    const wrapper = mountLayout()

    const links = wrapper.findAll('.debate-sidebar-item').map(item => item.attributes('data-to'))

    expect(links).toEqual([
      '/debate',
      '/debate?status=open',
      '/debate?status=concluded',
      '/debate?status=archived',
    ])
  })
})
