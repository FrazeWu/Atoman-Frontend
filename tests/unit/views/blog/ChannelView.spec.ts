import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ChannelView from '@/views/blog/ChannelView.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'channel-1' } }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/router/siteContext', () => ({
  resolveSiteContext: () => ({ type: 'module' }),
  isLocalHost: () => true,
}))

const mountContentView = (errorHandler?: (error: unknown) => void) => mount(ChannelView, {
  global: {
    config: errorHandler ? { errorHandler } : {},
    stubs: {
      BookmarkFolderModal: true,
      PEmpty: { props: ['title'], template: '<div data-test="empty-state">{{ title }}</div>' },
      PPageHeader: true,
      PModal: true,
      PToast: true,
      PSurface: true,
      PTab: { template: '<button><slot /></button>' },
      PPress: true,
      PLink: true,
      PClip: true,
      PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
    },
  },
})

describe('ChannelView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.history.replaceState(null, '', '/channel/channel-1?site=blog')

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1', username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('读取频道全部文章分页并显示第二页内容', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/channels/slug/channel-1')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/slug/channel-1/collections')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url === '/api/v1/blog/posts?channel_id=channel-1&page=1&page_size=100') {
        return new Response(JSON.stringify({
          data: [{ id: 'post-1', title: '第一页文章', content: '', updated_at: '2026-07-16T00:00:00Z' }],
          meta: { page: 1, page_size: 100, total: 101, has_more: true },
        }), { status: 200 })
      }
      if (url === '/api/v1/blog/posts?channel_id=channel-1&page=2&page_size=100') {
        return new Response(JSON.stringify({
          data: [{ id: 'post-101', title: '第二页文章', content: '', updated_at: '2026-07-15T00:00:00Z' }],
          meta: { page: 2, page_size: 100, total: 101, has_more: false },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountContentView()
    await flushPromises()

    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('第二页文章')
    const postURLs = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter(url => url.includes('/blog/posts?'))
    expect(postURLs).toEqual([
      '/api/v1/blog/posts?channel_id=channel-1&page=1&page_size=100',
      '/api/v1/blog/posts?channel_id=channel-1&page=2&page_size=100',
    ])
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
  ])('频道文章请求$name时显示失败态而非空态', async ({ loadPosts }) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/channels/slug/channel-1')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/slug/channel-1/collections')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/blog/posts?')) return loadPosts()
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const vueErrorHandler = vi.fn()
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const wrapper = mountContentView(vueErrorHandler)
      await flushPromises()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.get('[data-test="posts-error"]').text()).toBe('内容加载失败，请重试')
      expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(false)
      expect(vueErrorHandler).not.toHaveBeenCalled()
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('频道文章成功为空时显示真实空态', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/channels/slug/channel-1')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [], meta: { page: 1, page_size: 100, total: 0, has_more: false } }), { status: 200 })
    }))

    const wrapper = mountContentView()
    await flushPromises()

    expect(wrapper.get('[data-test="empty-state"]').text()).toBe('暂无内容')
    expect(wrapper.find('[data-test="posts-error"]').exists()).toBe(false)
  })

  it('后续分页失败时不保留前页文章', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/channels/slug/channel-1')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/slug/channel-1/collections')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url === '/api/v1/blog/posts?channel_id=channel-1&page=1&page_size=100') {
        return new Response(JSON.stringify({
          data: [{ id: 'post-1', title: '不应残留的第一页文章', content: '', updated_at: '2026-07-16T00:00:00Z' }],
          meta: { page: 1, page_size: 100, total: 101, has_more: true },
        }), { status: 200 })
      }
      if (url === '/api/v1/blog/posts?channel_id=channel-1&page=2&page_size=100') {
        return new Response(JSON.stringify({ error: 'page failed' }), { status: 500 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const vueErrorHandler = vi.fn()
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const wrapper = mountContentView(vueErrorHandler)
      await flushPromises()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.get('[data-test="posts-error"]').text()).toBe('内容加载失败，请重试')
      expect(wrapper.text()).not.toContain('不应残留的第一页文章')
      expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(false)
      expect(wrapper.get('.collection-count').text()).toBe('0')
      expect(vueErrorHandler).not.toHaveBeenCalled()
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('文章后续分页未完成时保持加载状态而不显示空态', async () => {
    let resolveSecondPage!: (response: Response) => void
    const secondPage = new Promise<Response>((resolve) => { resolveSecondPage = resolve })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/channels/slug/channel-1')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/slug/channel-1/collections')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url === '/api/v1/blog/posts?channel_id=channel-1&page=1&page_size=100') {
        return new Response(JSON.stringify({
          data: [{ id: 'post-1', title: '第一页文章', content: '', updated_at: '2026-07-16T00:00:00Z' }],
          meta: { page: 1, page_size: 100, total: 101, has_more: true },
        }), { status: 200 })
      }
      if (url === '/api/v1/blog/posts?channel_id=channel-1&page=2&page_size=100') return secondPage
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    }))

    const wrapper = mountContentView()
    await flushPromises()

    expect(wrapper.find('.a-skeleton').exists()).toBe(true)
    expect(wrapper.find('[data-test="empty-state"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="posts-error"]').exists()).toBe(false)

    resolveSecondPage(new Response(JSON.stringify({
      data: [{ id: 'post-101', title: '第二页文章', content: '', updated_at: '2026-07-15T00:00:00Z' }],
      meta: { page: 2, page_size: 100, total: 101, has_more: false },
    }), { status: 200 }))
    await flushPromises()

    expect(wrapper.find('.a-skeleton').exists()).toBe(false)
    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('第二页文章')
  })

  it('turns 收藏 into 取消收藏 after selecting a folder', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/blog/channels/slug/channel-1') && !url.includes('/collections')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      if (url.includes('/blog/channels/slug/channel-1/collections')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/blog/posts?')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'post-1',
            user_id: 'user-1',
            channel_id: 'channel-1',
            title: '文章',
            content: '正文',
            status: 'published',
            visibility: 'public',
            allow_comments: true,
            pinned: false,
            created_at: '2026-06-15T00:00:00Z',
            updated_at: '2026-06-15T00:00:00Z',
          }],
        }), { status: 200 })
      }
      if (url.includes('/blog/bookmarks') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { id: 'bookmark-1', post_id: 'post-1' } }), { status: 201 })
      }
      if (url.includes('/blog/bookmark-folders')) {
        return new Response(JSON.stringify({ data: [{ id: 'folder-1', name: '默认收藏夹' }] }), { status: 200 })
      }
      if (url.includes('/blog/bookmarks')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/feed/reading-list')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
    })

    const wrapper = mount(ChannelView, {
      global: {
        stubs: {
          PEmpty: true,
          PPageHeader: true,
          PModal: { props: ['title'], template: '<section><h2>{{ title }}</h2><slot /><slot name="footer" /></section>' },
          PToast: true,
          PCard: true,
          PSurface: { template: '<section><slot /></section>' },
          PAvatar: true,
          PTab: true,
          PPress: true,
          PLink: true,
          PEntry: {
            props: ['title', 'summary'],
            template: '<article><h3>{{ title }}</h3><div @click.stop><slot name="actions" /></div></article>',
          },
          PClip: {
            props: ['label', 'active'],
            emits: ['click'],
            template: '<button type="button" :data-active="active" @click="$emit(\'click\', $event)">{{ label }}</button>',
          },
        },
      },
    })

    await flushPromises()
    const saveButton = wrapper.findAll('button').find((button) => button.text() === '收藏')
    expect(saveButton).toBeTruthy()

    await saveButton!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="bookmark-folder-folder-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('button').map((button) => button.text())).toContain('取消收藏')
  })

  it('所有者管理链接使用最终注册的文章空间路由', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/channels/slug/channel-1') && !url.includes('/collections')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      if (url.includes('/blog/channels/slug/channel-1/collections')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/blog/posts?')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const wrapper = mount(ChannelView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PToast: true,
          PSurface: true,
          PTab: true,
          PClip: true,
          PEntry: true,
          PLink: { props: ['href', 'label'], template: '<a :href="href">{{ label }}</a>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('a[href="/posts/channel/channel-1/manage"]').exists()).toBe(true)
  })

  it('创建合集被后端拒绝时保留弹窗且不刷新列表', async () => {
    let collectionLoads = 0
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/blog/channels/slug/channel-1') && !url.includes('/collections')) {
        return new Response(JSON.stringify({
          data: { id: 'channel-1', user_id: 'user-1', name: '频道', slug: 'channel-1' },
        }), { status: 200 })
      }
      if (url.includes('/blog/channels/slug/channel-1/collections')) {
        collectionLoads += 1
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/blog/channels/channel-1/collections') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          error: {
            code: 'blog.channel_forbidden',
            message: 'You do not have permission to add collections to this channel',
            details: null,
          },
        }), { status: 403 })
      }
      if (url.includes('/blog/posts?')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const wrapper = mount(ChannelView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PToast: true,
          PSurface: { template: '<section><slot /></section>' },
          PTab: true,
          PEntry: true,
          PLink: true,
          PModal: { template: '<section data-test="collection-modal"><slot /><slot name="footer" /></section>' },
          PClip: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PInput: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
          },
          PTextarea: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}<slot /></button>',
          },
        },
      },
    })
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '新建合集')!.trigger('click')
    await wrapper.get('input').setValue('失败合集')
    await wrapper.findAll('button').find(button => button.text() === '创建')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="collection-modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('创建失败，请重试')
    expect(collectionLoads).toBe(1)
  })
})
