import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import BlogSheetStack from '@/components/blog/BlogSheetStack.vue'
import { useBlogSheets } from '@/composables/useBlogSheets'

describe('BlogSheetStack', () => {
  beforeEach(() => useBlogSheets().closeAll())

  it('renders collection and post layers in order', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/posts', component: { template: '<div />' } }],
    })
    await router.push('/posts')
    await router.isReady()
    const sheets = useBlogSheets()
    sheets.openCollection('collection-1', '合集一', 'channel-1')
    sheets.openPost('post-1', '文章一', 'collection-1')

    const wrapper = mount(BlogSheetStack, {
      global: {
        plugins: [router],
        stubs: {
          BlogCollectionSheet: { props: ['layerIndex'], template: '<div data-test="collection-layer">{{ layerIndex }}</div>' },
          BlogPostSheet: { props: ['layerIndex'], template: '<div data-test="post-layer">{{ layerIndex }}</div>' },
        },
      },
    })

    expect(wrapper.find('[data-test="collection-layer"]').text()).toBe('0')
    expect(wrapper.find('[data-test="post-layer"]').text()).toBe('1')
  })

  it('closes all layers when entering the article editor', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts', component: { template: '<div />' } },
        { path: '/posts/post/:id/edit', component: { template: '<div />' } },
      ],
    })
    await router.push('/posts')
    await router.isReady()

    const sheets = useBlogSheets()
    sheets.openPost('post-1', '文章一')
    mount(BlogSheetStack, {
      global: {
        plugins: [router],
        stubs: {
          BlogPostSheet: { template: '<div />' },
        },
      },
    })

    await router.push('/posts/post/post-1/edit')

    expect(sheets.layers.value).toHaveLength(0)
  })
})
