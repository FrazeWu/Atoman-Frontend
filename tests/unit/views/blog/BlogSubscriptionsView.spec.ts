import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import BlogSubscriptionsView from '@/views/blog/BlogSubscriptionsView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

enableAutoUnmount(afterEach)

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const mountSimple = () => mount(BlogSubscriptionsView, {
  global: {
    plugins: [pinia],
    stubs: {
      BookmarkFolderModal: true,
      PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
      PClip: true,
      PEmpty: { props: ['title'], template: '<div>{{ title }}</div>' },
      PEntry: { props: ['title'], template: '<article>{{ title }}<slot name="actions" /></article>' },
      PPageHeader: true,
    },
  },
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const makePost = (id: string, title: string, contentType: 'blog' | 'podcast') => ({
  id,
  user_id: 'user-1',
  title,
  content: `${title}正文`,
  status: 'published',
  visibility: 'public',
  allow_comments: true,
  pinned: false,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  likes_count: contentType === 'blog' ? 7 : 0,
  comments_count: contentType === 'blog' ? 3 : 0,
  channel: {
    id: `channel-${contentType}`,
    user_id: 'user-1',
    name: `${contentType} channel`,
    slug: `${contentType}-channel`,
    content_type: contentType,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  },
})

describe('BlogSubscriptionsView', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [
        { type: 'post', post: makePost('post-blog', '订阅文章', 'blog'), published_at: '2026-07-01T00:00:00Z', is_read: false },
        { type: 'post', post: makePost('post-podcast', '订阅播客', 'podcast'), published_at: '2026-07-01T00:00:00Z', is_read: false },
      ],
      meta: { page: 1, page_size: 12, total: 2, has_more: false },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1', username: 'user', email: 'user@example.com' }

    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'fetchBookmarkedPostIds').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchReadingListIds').mockResolvedValue(undefined)
  })

  it('only renders blog posts from the mixed subscription timeline', async () => {
    const wrapper = mount(BlogSubscriptionsView, {
      global: {
        plugins: [pinia],
        stubs: {
          BookmarkFolderModal: true,
          PButton: true,
          PClip: true,
          PPageHeader: true,
        },
      },
    })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline?page=1&limit=12', {
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.text()).toContain('订阅文章')
    expect(wrapper.text()).not.toContain('订阅播客')
    expect(wrapper.text()).toContain('♥ 7')
    expect(wrapper.text()).toContain('💬 3')
  })

  it('removes its global keyboard listener when unmounted', async () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountSimple()
    await flushPromises()

    const keydownHandler = addEventListener.mock.calls.find(([type]) => type === 'keydown')?.[1]
    expect(keydownHandler).toBeTypeOf('function')

    wrapper.unmount()
    expect(removeEventListener).toHaveBeenCalledWith('keydown', keydownHandler)

    addEventListener.mockRestore()
    removeEventListener.mockRestore()
  })

  it('uses timeline meta instead of a full page length to decide whether more posts exist', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      data: Array.from({ length: 12 }, (_, index) => ({
        type: 'post',
        post: makePost(`post-${index + 1}`, `订阅文章 ${index + 1}`, 'blog'),
        published_at: '2026-07-01T00:00:00Z',
        is_read: false,
      })),
      meta: { page: 1, page_size: 12, total: 12, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(BlogSubscriptionsView, {
      global: {
        plugins: [pinia],
        stubs: {
          BookmarkFolderModal: true,
          PButton: { template: '<button><slot /></button>' },
          PClip: true,
          PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
          PPageHeader: true,
        },
      },
    })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline?page=1&limit=12', expect.anything())
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.text()).not.toContain('加载更多')
  })

  it('appends the next timeline page and follows has_more through the full pagination flow', async () => {
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          type: 'post',
          post: makePost('post-page-1', '第一页文章', 'blog'),
          published_at: '2026-07-02T00:00:00Z',
          is_read: false,
        }],
        meta: { page: 1, page_size: 12, total: 2, has_more: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          type: 'post',
          post: makePost('post-page-2', '第二页文章', 'blog'),
          published_at: '2026-07-01T00:00:00Z',
          is_read: false,
        }],
        meta: { page: 2, page_size: 12, total: 2, has_more: false },
      }), { status: 200 }))

    const wrapper = mount(BlogSubscriptionsView, {
      global: {
        plugins: [pinia],
        stubs: {
          BookmarkFolderModal: true,
          PButton: {
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
          PClip: true,
          PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
          PPageHeader: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.get('button').text()).toBe('加载更多')

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/feed/timeline?page=2&limit=12', expect.anything())
    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('第二页文章')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('shows the real empty state for a successful empty timeline envelope', async () => {
    fetchMock.mockResolvedValueOnce(response({
      data: [],
      meta: { page: 1, page_size: 12, total: 0, has_more: false },
    }))

    const wrapper = mountSimple()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无更新')
    expect(wrapper.text()).not.toContain('订阅内容加载失败')
    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.page).toBe(1)
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it.each([
    ['401', () => Promise.resolve(response({ error: { message: 'Login required' } }, 401))],
    ['500', () => Promise.resolve(response({ error: { message: 'database unavailable' } }, 500))],
    ['网络错误', () => Promise.reject(new Error('offline'))],
    ['错误 JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('初始订阅时间线%s时显示失败而非假空态', async (_label, result) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation(result)

    const wrapper = mountSimple()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('订阅内容加载失败')
    expect(wrapper.text()).not.toContain('暂无更新')
    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.page).toBe(1)
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('append 失败保留旧列表和页码，重试仍请求同一页', async () => {
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(response({
        data: [{ type: 'post', post: makePost('post-page-1', '第一页文章', 'blog') }],
        meta: { page: 1, page_size: 12, total: 2, has_more: true },
      }))
      .mockResolvedValueOnce(response({ error: { message: 'temporary failure' } }, 500))
      .mockResolvedValueOnce(response({
        data: [{ type: 'post', post: makePost('post-page-2', '第二页文章', 'blog') }],
        meta: { page: 2, page_size: 12, total: 2, has_more: false },
      }))

    const wrapper = mountSimple()
    await flushPromises()

    expect(await wrapper.vm.$.setupState.fetchTimeline(true)).toBe(false)
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/feed/timeline?page=2&limit=12', expect.anything())
    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('订阅内容加载失败')
    expect(wrapper.vm.$.setupState.page).toBe(1)
    expect(wrapper.vm.$.setupState.hasMore).toBe(true)

    expect(await wrapper.vm.$.setupState.fetchTimeline(true)).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/feed/timeline?page=2&limit=12', expect.anything())
    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('第二页文章')
    expect(wrapper.text()).not.toContain('订阅内容加载失败')
    expect(wrapper.vm.$.setupState.page).toBe(2)
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
  })

  it('append 加载中拒绝重复请求', async () => {
    const nextPage = deferred<Response>()
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(response({
        data: [{ type: 'post', post: makePost('post-page-1', '第一页文章', 'blog') }],
        meta: { page: 1, page_size: 12, total: 2, has_more: true },
      }))
      .mockReturnValueOnce(nextPage.promise)

    const wrapper = mountSimple()
    await flushPromises()

    const pendingLoad = wrapper.vm.$.setupState.fetchTimeline(true)
    expect(await wrapper.vm.$.setupState.fetchTimeline(true)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.$.setupState.page).toBe(1)

    nextPage.resolve(response({
      data: [{ type: 'post', post: makePost('post-page-2', '第二页文章', 'blog') }],
      meta: { page: 2, page_size: 12, total: 2, has_more: false },
    }))
    expect(await pendingLoad).toBe(true)
    expect(wrapper.vm.$.setupState.page).toBe(2)
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('旧 timeline GET 迟到%s时不解析或覆盖最新结果', async (_label, shouldReject) => {
    const oldRequest = deferred<Response>()
    const oldResponse = response({
      data: [{ type: 'post', post: makePost('old-post', '旧文章', 'blog') }],
      meta: { page: 1, page_size: 12, total: 1, has_more: true },
    })
    const oldJSON = vi.spyOn(oldResponse, 'json')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(response({
        data: [{ type: 'post', post: makePost('new-post', '最新文章', 'blog') }],
        meta: { page: 1, page_size: 12, total: 1, has_more: false },
      }))

    const wrapper = mountSimple()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(await wrapper.vm.$.setupState.fetchTimeline(false)).toBe(true)
    if (shouldReject) oldRequest.reject(new Error('old timeline failure'))
    else oldRequest.resolve(oldResponse)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(oldJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['new-post'])
    expect(wrapper.vm.$.setupState.page).toBe(1)
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('旧 timeline JSON 迟到%s时不覆盖最新结果', async (_label, shouldReject) => {
    const oldData = deferred<unknown>()
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(oldData.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock
      .mockResolvedValueOnce(oldResponse)
      .mockResolvedValueOnce(response({
        data: [{ type: 'post', post: makePost('new-post', '最新文章', 'blog') }],
        meta: { page: 1, page_size: 12, total: 1, has_more: false },
      }))

    const wrapper = mountSimple()
    await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())
    expect(await wrapper.vm.$.setupState.fetchTimeline(false)).toBe(true)
    if (shouldReject) oldData.reject(new Error('old timeline JSON failure'))
    else oldData.resolve({
      data: [{ type: 'post', post: makePost('old-post', '旧文章', 'blog') }],
      meta: { page: 1, page_size: 12, total: 1, has_more: true },
    })
    await flushPromises()

    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['new-post'])
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('旧失败和 finally 不污染仍在等待的最新刷新', async () => {
    const oldRequest = deferred<Response>()
    const latestRequest = deferred<Response>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(latestRequest.promise)

    const wrapper = mountSimple()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const latestLoad = wrapper.vm.$.setupState.fetchTimeline(false)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    oldRequest.reject(new Error('old timeline failure'))
    await flushPromises()

    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()

    latestRequest.resolve(response({ data: [], meta: { page: 1, page_size: 12, total: 0, has_more: false } }))
    expect(await latestLoad).toBe(true)
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it.each([
    ['GET 成功', 'fetch', false],
    ['GET 失败', 'fetch', true],
    ['JSON 成功', 'json', false],
    ['JSON 失败', 'json', true],
  ])('卸载后迟到的 timeline %s不写状态', async (_label, stage, shouldReject) => {
    const request = deferred<Response>()
    const data = deferred<unknown>()
    const timelineResponse = new Response(null, { status: 200 })
    const timelineJSON = vi.spyOn(timelineResponse, 'json').mockReturnValue(data.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    if (stage === 'fetch') fetchMock.mockReturnValueOnce(request.promise)
    else fetchMock.mockResolvedValueOnce(timelineResponse)

    const wrapper = mountSimple()
    if (stage === 'fetch') await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    else await vi.waitFor(() => expect(timelineJSON).toHaveBeenCalledOnce())
    wrapper.unmount()

    if (stage === 'fetch') {
      if (shouldReject) request.reject(new Error('late timeline failure'))
      else request.resolve(timelineResponse)
    } else if (shouldReject) {
      data.reject(new Error('late timeline JSON failure'))
    } else {
      data.resolve({
        data: [{ type: 'post', post: makePost('late-post', '迟到文章', 'blog') }],
        meta: { page: 1, page_size: 12, total: 1, has_more: true },
      })
    }
    await flushPromises()

    if (stage === 'fetch') expect(timelineJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.page).toBe(1)
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
