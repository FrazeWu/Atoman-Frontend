import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaArticlesView from '@/views/media/MediaArticlesView.vue'
import MediaPodcastsView from '@/views/media/MediaPodcastsView.vue'
import MediaVideosView from '@/views/media/MediaVideosView.vue'

const fetchMock = vi.fn()
const routerPushMock = vi.fn()
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const videoResponse = (id: string, title: string, status = 200) => new Response(JSON.stringify([{
  id,
  title,
  created_at: '2026-07-15T00:00:00Z',
}]), { status })
const RouterLinkStub = defineComponent({
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
  },
  setup(props, { slots }) {
    return () => h('a', { href: String(props.to) }, slots.default?.())
  },
})
const FeedArticleSheetStub = {
  name: 'FeedArticleSheet',
  props: ['show', 'article'],
  template: '<aside data-test="article-sheet" :data-show="String(show)" :data-article-id="article?.post?.id || \'\'"></aside>',
}
const articleGlobal = {
  stubs: {
    RouterLink: true,
    FeedArticleSheet: FeedArticleSheetStub,
  },
}
const mountArticleList = (errorHandler?: (error: unknown) => void) => mount(MediaArticlesView, {
  global: {
    config: errorHandler ? { errorHandler } : {},
    stubs: {
      RouterLink: true,
      FeedArticleSheet: FeedArticleSheetStub,
      PEmpty: { props: ['text'], template: '<div data-test="empty-state">{{ text }}</div>' },
      PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
    },
  },
})

vi.mock('@/composables/useMediaChannel', () => ({
  useMediaChannel: () => ({
    currentMediaChannelId: { value: 'channel-should-not-be-used' },
  }),
}))

vi.mock('@/components/feed/FeedArticleSheet.vue', () => ({
  default: {
    name: 'FeedArticleSheet',
    props: ['show', 'article'],
    template: '<aside data-test="article-sheet" :data-show="String(show)" :data-article-id="article?.post?.id || \'\'"></aside>',
  },
}))

vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: routerPushMock,
    }),
  }
})

describe('Media content view shells', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    routerPushMock.mockReset()
    fetchMock.mockImplementation(async (input) => new Response(JSON.stringify(
      String(input).includes('/blog/posts')
        ? { data: [], meta: { page: 1, page_size: 20, total: 0, has_more: false } }
        : [],
    ), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('读取全部文章分页并显示第二页内容', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url === '/api/v1/blog/posts?page=1&page_size=20&sort=latest') {
        return new Response(JSON.stringify({
          data: [{ id: 'post-1', title: '第一页文章', created_at: '2026-07-16T00:00:00Z' }],
          meta: { page: 1, page_size: 20, total: 21, has_more: true },
        }), { status: 200 })
      }
      if (url === '/api/v1/blog/posts?page=2&page_size=20&sort=latest') {
        return new Response(JSON.stringify({
          data: [{ id: 'post-21', title: '第二页文章', created_at: '2026-07-15T00:00:00Z' }],
          meta: { page: 2, page_size: 20, total: 21, has_more: false },
        }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mountArticleList()
    await flushPromises()

    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('第二页文章')
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/posts?page=1&page_size=20&sort=latest',
      '/api/v1/blog/posts?page=2&page_size=20&sort=latest',
    ])
  })

  it('后续文章分页失败时不显示已加载的前页内容', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url === '/api/v1/blog/posts?page=1&page_size=20&sort=latest') {
        return new Response(JSON.stringify({
          data: [{ id: 'post-1', title: '不应残留的第一页文章', created_at: '2026-07-16T00:00:00Z' }],
          meta: { page: 1, page_size: 20, total: 21, has_more: true },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'page failed' }), { status: 500 })
    })
    const vueErrorHandler = vi.fn()
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const wrapper = mountArticleList(vueErrorHandler)
      await flushPromises()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.get('[data-test="articles-error"]').text()).toBe('文章加载失败，请重试')
      expect(wrapper.text()).not.toContain('不应残留的第一页文章')
      expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(false)
      expect(wrapper.vm.$.setupState.posts).toEqual([])
      expect(vueErrorHandler).not.toHaveBeenCalled()
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('后续文章分页未完成时保持加载状态', async () => {
    const pendingSecondPage = deferred<Response>()
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url === '/api/v1/blog/posts?page=1&page_size=20&sort=latest') {
        return new Response(JSON.stringify({
          data: [{ id: 'post-1', title: '第一页文章', created_at: '2026-07-16T00:00:00Z' }],
          meta: { page: 1, page_size: 20, total: 21, has_more: true },
        }), { status: 200 })
      }
      return pendingSecondPage.promise
    })

    const wrapper = mountArticleList()
    await flushPromises()

    expect(wrapper.find('.media-list-skeleton').exists()).toBe(true)
    expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="articles-error"]').exists()).toBe(false)

    pendingSecondPage.resolve(new Response(JSON.stringify({
      data: [{ id: 'post-21', title: '第二页文章', created_at: '2026-07-15T00:00:00Z' }],
      meta: { page: 2, page_size: 20, total: 21, has_more: false },
    }), { status: 200 }))
    await flushPromises()

    expect(wrapper.find('.media-list-skeleton').exists()).toBe(false)
    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('第二页文章')
  })

  it.each([
    {
      name: '非 2xx',
      load: () => Promise.resolve(new Response(JSON.stringify({ error: 'failed' }), { status: 500 })),
    },
    {
      name: '网络失败',
      load: () => Promise.reject(new Error('offline')),
    },
    {
      name: '无效 JSON',
      load: () => Promise.resolve(new Response('not-json', { status: 200 })),
    },
  ])('文章请求$name时显示失败态而非空态', async ({ load }) => {
    fetchMock.mockImplementation(load)
    const vueErrorHandler = vi.fn()
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const wrapper = mountArticleList(vueErrorHandler)
      await flushPromises()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.get('[data-test="articles-error"]').text()).toBe('文章加载失败，请重试')
      expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(false)
      expect(vueErrorHandler).not.toHaveBeenCalled()
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it.each([
    { name: '顶层数组', payload: [] },
    { name: '缺失 meta', payload: { data: [] } },
    { name: '非法 data', payload: { data: {}, meta: { has_more: false } } },
    { name: '非法 meta', payload: { data: [], meta: null } },
    { name: '非法 has_more', payload: { data: [], meta: { has_more: 'false' } } },
  ])('文章接口返回$name时显示失败态', async ({ payload }) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))

    const wrapper = mountArticleList()
    await flushPromises()

    expect(wrapper.get('[data-test="articles-error"]').text()).toBe('文章加载失败，请重试')
    expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(false)
  })

  it('文章请求成功为空时显示真实空态', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [],
      meta: { page: 1, page_size: 20, total: 0, has_more: false },
    }), { status: 200 }))

    const wrapper = mountArticleList()
    await flushPromises()

    expect(wrapper.get('[data-test="empty-state"]').text()).toBe('暂无文章')
    expect(wrapper.find('[data-test="articles-error"]').exists()).toBe(false)
  })

  it('renders functional page titles', () => {
    const global = { stubs: ['RouterLink'] }
    expect(mount(MediaArticlesView, { global: articleGlobal }).text()).toContain('文章')
    expect(mount(MediaPodcastsView, { global }).text()).toContain('播客')
    expect(mount(MediaVideosView, { global }).text()).toContain('视频')
  })

  it('keeps create actions scoped to the media module', () => {
    const global = { stubs: { RouterLink: RouterLinkStub } }

    for (const View of [MediaArticlesView, MediaPodcastsView, MediaVideosView]) {
      const wrapper = mount(View, { global })
      const createLink = wrapper.find('a[href="/media/create"]')

      expect(createLink.exists()).toBe(true)
      expect(wrapper.find('a[href="/create"]').exists()).toBe(false)
    }
  })

  it('treats article podcast and video pages as site-wide explore pages', async () => {
    const global = { stubs: ['RouterLink'] }
    mount(MediaArticlesView, { global: articleGlobal })
    mount(MediaPodcastsView, { global })
    mount(MediaVideosView, { global })

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    const urls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(urls.some(url => url.includes('channel_id=channel-should-not-be-used'))).toBe(false)
    expect(urls.some(url => url.includes('/blog/posts?page=1&page_size=20'))).toBe(true)
    expect(urls.some(url => url.includes('/podcast/episodes'))).toBe(true)
    expect(urls.some(url => url.includes('/videos?sort='))).toBe(true)
    expect(mount(MediaArticlesView, { global: articleGlobal }).find('.media-explore-page').exists()).toBe(true)
  })

  it('renders videos with PVideoCard links to the media-scoped video detail route', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify([{
      id: 'video-1',
      title: '旧详情可达的视频',
      thumbnail_url: '',
      view_count: 12,
      duration_sec: 0,
      created_at: '2026-01-02T00:00:00Z',
    }]), { status: 200 }))

    const wrapper = mount(MediaVideosView, { global: { stubs: { RouterLink: RouterLinkStub } } })

    await vi.waitFor(() => {
      expect(wrapper.findComponent({ name: 'PVideoCard' }).exists()).toBe(true)
    })
    expect(wrapper.find('a[href="/media/videos/watch/video-1"]').exists()).toBe(true)
  })

  it('keeps loading popular videos when the previous latest request returns first', async () => {
    const latest = deferred<Response>()
    const popular = deferred<Response>()
    fetchMock.mockImplementation((input) => (
      String(input).includes('sort=latest') ? latest.promise : popular.promise
    ))
    const wrapper = mount(MediaVideosView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()

    wrapper.vm.$.setupState.changeSort('popular')
    latest.resolve(videoResponse('latest-video', '过期最新视频'))
    await flushPromises()

    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(wrapper.text()).not.toContain('过期最新视频')

    popular.resolve(videoResponse('popular-video', '当前热门视频'))
    await flushPromises()
    expect(wrapper.text()).toContain('当前热门视频')
  })

  it('does not let a delayed latest response overwrite popular videos', async () => {
    const latest = deferred<Response>()
    const popular = deferred<Response>()
    fetchMock.mockImplementation((input) => (
      String(input).includes('sort=latest') ? latest.promise : popular.promise
    ))
    const wrapper = mount(MediaVideosView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()

    wrapper.vm.$.setupState.changeSort('popular')
    popular.resolve(videoResponse('popular-video', '当前热门视频'))
    await flushPromises()
    expect(wrapper.text()).toContain('当前热门视频')

    latest.resolve(videoResponse('latest-video', '过期最新视频'))
    await flushPromises()
    expect(wrapper.text()).toContain('当前热门视频')
    expect(wrapper.text()).not.toContain('过期最新视频')
  })

  it('clears latest results when the selected popular request returns non-2xx', async () => {
    fetchMock.mockImplementation((input) => (
      String(input).includes('sort=latest')
        ? Promise.resolve(videoResponse('latest-video', '旧的最新视频'))
        : Promise.resolve(new Response(JSON.stringify({ error: 'failed' }), { status: 500 }))
    ))
    const wrapper = mount(MediaVideosView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    expect(wrapper.text()).toContain('旧的最新视频')

    wrapper.vm.$.setupState.changeSort('popular')
    await flushPromises()

    expect(wrapper.text()).not.toContain('旧的最新视频')
    expect(wrapper.text()).toContain('暂无视频')
  })

  it.each([
    ['network failure', () => Promise.reject(new Error('network failed'))],
    ['invalid JSON', () => Promise.resolve({
      ok: true,
      json: () => Promise.reject(new Error('invalid JSON')),
    })],
  ])('settles the selected popular request after %s', async (_case, failingRequest) => {
    const wrapper = mount(MediaVideosView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    fetchMock.mockImplementation(failingRequest)
    wrapper.vm.$.setupState.sort = 'popular'

    await expect(wrapper.vm.$.setupState.loadVideos()).resolves.toBeUndefined()

    expect(wrapper.vm.$.setupState.videos).toEqual([])
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(wrapper.text()).toContain('暂无视频')
  })

  it('does not mutate video state when a response arrives after unmount', async () => {
    const request = deferred<Response>()
    fetchMock.mockReturnValue(request.promise)
    const wrapper = mount(MediaVideosView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    const state = wrapper.vm.$.setupState

    wrapper.unmount()
    const videosAfterUnmount = state.videos
    const loadingAfterUnmount = state.loading
    request.resolve(videoResponse('late-video', '迟到视频'))
    await flushPromises()

    expect(state.videos).toBe(videosAfterUnmount)
    expect(state.loading).toBe(loadingAfterUnmount)
  })

  it('requests the exact initial and selected video sort parameters', async () => {
    const wrapper = mount(MediaVideosView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    wrapper.vm.$.setupState.changeSort('popular')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [initialUrl, popularUrl] = fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost'))
    expect(Object.fromEntries(initialUrl.searchParams)).toEqual({ sort: 'latest', limit: '40' })
    expect(Object.fromEntries(popularUrl.searchParams)).toEqual({ sort: 'popular', limit: '40' })
  })

  it('renders podcast episodes as PEntry rows and opens the media-scoped podcast detail route', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify([{
      id: 'episode-1',
      duration_sec: 125,
      created_at: '2026-01-02T00:00:00Z',
      post: { title: '旧单集详情可达', summary: '摘要' },
      channel: { name: '节目' },
    }]), { status: 200 }))

    const wrapper = mount(MediaPodcastsView, { global: { stubs: ['RouterLink'] } })

    await vi.waitFor(() => {
      expect(wrapper.find('.p-entry').exists()).toBe(true)
    })
    await wrapper.find('.p-entry').trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith('/media/podcasts/episode/episode-1')
  })

  it('opens articles in the subscription-style right sheet instead of navigating', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      data: [{
        id: 'post-1',
        title: '旧文章详情可达',
        summary: '文章摘要',
        created_at: '2026-01-02T00:00:00Z',
        channel: { name: '专栏' },
        user: { username: 'writer', display_name: '作者' },
      }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(MediaArticlesView, {
      global: {
        stubs: {
          RouterLink: true,
          FeedArticleSheet: FeedArticleSheetStub,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.p-entry').exists()).toBe(true)
    })
    expect(wrapper.find('a[href*="/posts/post/post-1"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="article-sheet"]').attributes('data-show')).toBe('false')
    await wrapper.find('.p-entry').trigger('click')
    expect(routerPushMock).not.toHaveBeenCalled()
    expect(wrapper.get('[data-test="article-sheet"]').attributes('data-show')).toBe('true')
    expect(wrapper.get('[data-test="article-sheet"]').attributes('data-article-id')).toBe('post-1')
  })

  it('keeps article clicks in the right sheet on explicit media paths', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        protocol: 'https:',
        hostname: 'atoman.org',
        search: '',
        pathname: '/media',
      },
    })
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      data: [{
        id: 'post-1',
        title: '生产链接',
        summary: '文章摘要',
        created_at: '2026-01-02T00:00:00Z',
      }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    try {
      const wrapper = mount(MediaArticlesView, {
        global: {
          stubs: {
            RouterLink: true,
            FeedArticleSheet: FeedArticleSheetStub,
          },
        },
      })

      await vi.waitFor(() => {
        expect(wrapper.find('.p-entry').exists()).toBe(true)
      })
      expect(wrapper.find('a[href*="/posts/post/post-1"]').exists()).toBe(false)
      await wrapper.find('.p-entry').trigger('click')
      expect(routerPushMock).not.toHaveBeenCalled()
      expect(wrapper.get('[data-test="article-sheet"]').attributes('data-show')).toBe('true')
      expect(wrapper.get('[data-test="article-sheet"]').attributes('data-article-id')).toBe('post-1')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })

  it('does not show unsupported popular sorting on articles', () => {
    const wrapper = mount(MediaArticlesView, { global: articleGlobal })

    expect(wrapper.text()).not.toContain('热门')
  })
})
