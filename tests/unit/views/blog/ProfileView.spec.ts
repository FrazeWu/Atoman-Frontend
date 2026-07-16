import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfileView from '@/views/blog/ProfileView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { username: 'alice' } }),
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/router/siteContext', () => ({
  resolveSiteContext: () => ({ type: 'module', module: 'blog' }),
}))

const mountProfile = (errorHandler?: (error: unknown) => void) => mount(ProfileView, {
  global: {
    config: errorHandler ? { errorHandler } : {},
    stubs: {
      BookmarkFolderModal: true,
      ChannelView: true,
      PAvatar: true,
      PBadge: true,
      PButton: true,
      PClip: true,
      PEmpty: { props: ['title'], template: '<div data-test="empty-state">{{ title }}</div>' },
      PToast: true,
      PEntry: { props: ['title'], template: '<article @click="$emit(\'click\')">{{ title }}</article>' },
    },
  },
})

describe('ProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users/by-username/alice')) {
        return new Response(JSON.stringify({ data: {
          uuid: 'user-1',
          username: 'alice',
          display_name: 'Alice',
          followers_count: 0,
          following_count: 0,
          posts_count: 1,
        } }), { status: 200 })
      }
      if (url.includes('/blog/channels?user_id=user-1')) {
        return new Response(JSON.stringify({ data: [
          { id: 'channel-blog', user_id: 'user-1', name: '文章频道', slug: 'articles', content_type: 'blog' },
          { id: 'channel-video', user_id: 'user-1', name: '视频频道', slug: 'videos', content_type: 'video' },
        ] }), { status: 200 })
      }
      if (url.includes('/blog/posts?user_id=user-1')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'post-1',
            user_id: 'user-1',
            title: '真实文章',
            content: '正文',
            status: 'published',
            visibility: 'public',
            allow_comments: true,
            pinned: false,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          }],
          meta: { page: 1, page_size: 8, total: 1, has_more: false },
        }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  it.each([
    {
      name: '非 2xx',
      loadPosts: () => Promise.resolve(new Response(JSON.stringify({ error: 'failed' }), { status: 500 })),
    },
    {
      name: '网络失败',
      loadPosts: () => Promise.reject(new Error('offline')),
    },
    {
      name: '无效 JSON',
      loadPosts: () => Promise.resolve(new Response('not-json', { status: 200 })),
    },
    {
      name: '非法响应结构',
      loadPosts: () => Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 })),
    },
  ])('最近发布请求$name时显示失败态而非空态', async ({ loadPosts }) => {
    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => (
      String(input).includes('/blog/posts?user_id=user-1') ? loadPosts() : initialFetch(input, init)
    ))
    const vueErrorHandler = vi.fn()
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const wrapper = mountProfile(vueErrorHandler)
      await flushPromises()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.get('[data-test="posts-error"]').text()).toBe('内容加载失败，请重试')
      expect(wrapper.text()).not.toContain('暂无内容')
      expect(vueErrorHandler).not.toHaveBeenCalled()
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('最近发布请求未完成时保持加载状态', async () => {
    let resolvePosts!: (response: Response) => void
    const pendingPosts = new Promise<Response>((resolve) => { resolvePosts = resolve })
    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => (
      String(input).includes('/blog/posts?user_id=user-1') ? pendingPosts : initialFetch(input, init)
    ))

    const wrapper = mountProfile()
    await flushPromises()

    expect(wrapper.findAll('.a-grid-2 .a-skeleton')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('暂无内容')
    expect(wrapper.find('[data-test="posts-error"]').exists()).toBe(false)

    resolvePosts(new Response(JSON.stringify({
      data: [],
      meta: { page: 1, page_size: 8, total: 0, has_more: false },
    }), { status: 200 }))
    await flushPromises()

    expect(wrapper.findAll('.a-grid-2 .a-skeleton')).toHaveLength(0)
    expect(wrapper.text()).toContain('暂无内容')
  })

  it('点击真实文章进入已注册的文章详情路由', async () => {
    const wrapper = mountProfile()
    await flushPromises()

    expect(wrapper.text()).toContain('文章频道')
    expect(wrapper.text()).not.toContain('视频频道')
    await wrapper.get('article').trigger('click')

    expect(push).toHaveBeenCalledWith('/posts/post/post-1')
  })
})
