import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openPost } = vi.hoisted(() => ({ openPost: vi.fn() }))

vi.mock('@/composables/useBlogSheets', () => ({
  useBlogSheets: () => ({ openPost }),
}))

import BlogArticlesView from '@/views/blog/BlogArticlesView.vue'

const response = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

describe('BlogArticlesView', () => {
  beforeEach(() => {
    openPost.mockReset()
  })

  it('按路由查询加载博文，并能打开文章', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/channels')) {
        return response({ data: [{ id: 'channel-1', name: '技术笔记' }] })
      }
      if (url.includes('/blog/posts')) {
        return response({
          data: [{
            id: 'post-1',
            user_id: 'author-1',
            title: '独立博文页面',
            content: '正文',
            status: 'published',
            visibility: 'public',
            pinned: false,
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z',
            channel: { id: 'channel-1', name: '技术笔记' },
            tags: ['Vue'],
          }],
          meta: { has_more: false, total: 1 },
        })
      }
      throw new Error(`unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/posts/articles', component: BlogArticlesView }],
    })
    await router.push('/posts/articles?q=独立&channel_id=channel-1')
    await router.isReady()

    const wrapper = mount(BlogArticlesView, {
      global: {
        plugins: [router],
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PInput: { props: ['modelValue'], template: '<input :value="modelValue" />' },
          PSegmentedControl: { props: ['modelValue', 'options'], template: '<div />' },
          PSelect: { props: ['modelValue', 'options'], template: '<div />' },
          PButton: { template: '<button><slot /></button>' },
          PEmpty: { props: ['title', 'description'], template: '<div>{{ title }}{{ description }}</div>' },
          BlogItemCard: { props: ['item'], template: '<article @click="$emit(\'click\')">{{ item.title }}</article>' },
        },
      },
    })
    await flushPromises()

    const postRequest = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes('/blog/posts'))
    expect(postRequest).toContain('q=%E7%8B%AC%E7%AB%8B')
    expect(postRequest).toContain('channel_id=channel-1')
    expect(postRequest).toContain('page=1')
    expect(postRequest).toContain('page_size=20')
    expect(wrapper.text()).toContain('独立博文页面')

    await wrapper.get('article').trigger('click')
    expect(openPost).toHaveBeenCalledWith('post-1', '独立博文页面')
  })
})
