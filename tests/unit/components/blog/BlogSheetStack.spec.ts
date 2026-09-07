import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import BlogSheetStack from '../../../../src/components/blog/BlogSheetStack.vue'
import { useBlogSheets } from '../../../../src/composables/useBlogSheets'

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
        { path: '/studio/blog/:id/edit', component: { template: '<div />' } },
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

    await router.push('/studio/blog/post-1/edit')

    expect(sheets.layers.value).toHaveLength(0)
  })

  it('closes all layers when switching blog sections or modules', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts', component: { template: '<div />' } },
        { path: '/posts/articles', component: { template: '<div />' } },
        { path: '/music', component: { template: '<div />' } },
      ],
    })
    await router.push('/posts')
    await router.isReady()

    const sheets = useBlogSheets()
    const wrapper = mount(BlogSheetStack, {
      global: {
        plugins: [router],
        stubs: {
          BlogPostSheet: { template: '<div />' },
        },
      },
    })

    sheets.openPost('post-1', '文章一')
    await router.push('/posts/articles')
    await router.isReady()
    expect(sheets.layers.value).toHaveLength(0)

    sheets.openPost('post-2', '文章二')
    await router.push('/music')
    await router.isReady()
    expect(sheets.layers.value).toHaveLength(0)
    wrapper.unmount()
  })

  it('keeps the sheet during a desktop post route handoff back to the blog home', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts', component: { template: '<div />' } },
        { path: '/posts/post/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/posts/post/post-1')
    await router.isReady()

    const sheets = useBlogSheets()
    const wrapper = mount(BlogSheetStack, {
      global: {
        plugins: [router],
        stubs: {
          BlogPostSheet: { template: '<div />' },
        },
      },
    })

    sheets.openPost('post-1', '文章一')
    await router.replace('/posts')
    await router.isReady()

    expect(sheets.layers.value.map(layer => layer.key)).toEqual(['post:post-1'])
    wrapper.unmount()
  })
})
