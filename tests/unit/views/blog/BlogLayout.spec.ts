import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BlogLayout from '@/views/blog/BlogLayout.vue'

describe('BlogLayout', () => {
  it('侧栏入口使用 /posts 模块前缀', () => {
    const wrapper = mount(BlogLayout, {
      global: {
        stubs: {
          RouterView: true,
          PSidebar: { template: '<nav><slot /></nav>' },
          PSidebarItem: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.find('a[href="/posts"]').text()).toContain('探索')
    expect(wrapper.find('a[href="/posts/subscriptions"]').text()).toContain('订阅')
    expect(wrapper.find('a[href="/posts/manage"]').text()).toContain('管理')
  })
})
