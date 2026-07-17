import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import BlogLayout from '@/views/blog/BlogLayout.vue'

describe('BlogLayout', () => {
  it('侧栏入口使用 /posts 模块前缀', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts', component: BlogLayout, meta: { hasSidebar: true } },
      ],
    })
    await router.push('/posts')
    await router.isReady()

    const wrapper = mount(BlogLayout, {
      global: {
        plugins: [router],
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

  it('用户管理子路由不渲染文章模块侧栏', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/posts',
          component: BlogLayout,
          meta: { hasSidebar: true },
          children: [
            { path: 'settings', component: { template: '<div />' }, meta: { hasSidebar: false } },
          ],
        },
      ],
    })
    await router.push('/posts/settings')
    await router.isReady()

    const wrapper = mount(BlogLayout, {
      global: {
        plugins: [router],
        stubs: {
          RouterView: true,
          PSidebar: { template: '<nav data-testid="blog-sidebar"><slot /></nav>' },
          PSidebarItem: true,
        },
      },
    })

    expect(wrapper.find('[data-testid="blog-sidebar"]').exists()).toBe(false)
  })
})
