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
      if (url.includes('/blog/search')) {
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
      .find((url) => url.includes('/blog/search'))
    expect(postRequest).toContain('/blog/search?')
    expect(postRequest).toContain('q=%E7%8B%AC%E7%AB%8B')
    expect(postRequest).toContain('channel_id=channel-1')
    expect(postRequest).toContain('page=1')
    expect(postRequest).toContain('page_size=20')
    expect(wrapper.text()).toContain('独立博文页面')

    await wrapper.get('article').trigger('click')
    expect(openPost).toHaveBeenCalledWith('post-1', '独立博文页面')
  })

  it('将作者、频道、合集、标签和排序组合为结构化搜索条件', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/channels/channel-1/collections')) {
        return response({ data: [{ id: 'collection-1', name: '前端专题' }] })
      }
      if (url === '/api/v1/blog/channels') {
        return response({ data: [{ id: 'channel-1', name: '技术笔记', user: { uuid: 'author-1', username: 'alice' } }] })
      }
      if (url.includes('/blog/search')) {
        return response({ data: [], meta: { has_more: false, total: 0 } })
      }
      throw new Error(`unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/posts/articles', component: BlogArticlesView }],
    })
    await router.push('/posts/articles?q=独立&tag=vue&author_id=author-1&channel_id=channel-1&collection_id=collection-1&sort=recent')
    await router.isReady()

    mount(BlogArticlesView, {
      global: {
        plugins: [router],
        stubs: {
          PPageHeader: true,
          PInput: true,
          PSegmentedControl: true,
          PSelect: true,
          PButton: true,
          PEmpty: true,
          BlogItemCard: true,
        },
      },
    })
    await flushPromises()

    const searchRequest = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes('/blog/search'))
    expect(searchRequest).toContain('q=%E7%8B%AC%E7%AB%8B')
    expect(searchRequest).toContain('tag=vue')
    expect(searchRequest).toContain('author_id=author-1')
    expect(searchRequest).toContain('channel_id=channel-1')
    expect(searchRequest).toContain('collection_id=collection-1')
    expect(searchRequest).toContain('sort=recent')
  })

  it('以真实 URL 展示第 2 页和可抓取的上下页链接', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/channels')) return response({ data: [] })
      if (url.includes('/blog/posts')) return response({
        data: [{
          id: 'older-post', title: '历史博文', content: '正文', status: 'published',
          visibility: 'public', created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z', tags: [],
        }],
        meta: { page: 2, page_size: 20, total: 55, has_more: true },
      })
      throw new Error('Unexpected request: ' + url)
    })
    vi.stubGlobal('fetch', fetchMock)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/posts/articles', component: BlogArticlesView }],
    })
    await router.push('/posts/articles?page=2')
    await router.isReady()
    const wrapper = mount(BlogArticlesView, {
      global: {
        plugins: [router],
        stubs: {
          PPageHeader: true, PInput: true, PSegmentedControl: true,
          PSelect: true, PButton: true, PEmpty: true,
          BlogItemCard: { props: ['item'], template: '<article>{{ item.title }}</article>' },
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    })
    await flushPromises()
    const calls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(calls.some(url => url.includes('/blog/posts?') && url.includes('page=2'))).toBe(true)
    expect(wrapper.text()).toContain('历史博文')
    expect(wrapper.find('a[href="/posts/articles"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/posts/articles?page=3"]').exists()).toBe(true)
  })
})
