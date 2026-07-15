import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useSheetStore } from '@/stores/sheet'
import CollectionView from '@/views/blog/CollectionView.vue'

const push = vi.fn()
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

const routerFailureMocks = vi.hoisted(() => ({
  navigationFailure: { type: 4, __navigationFailure: true },
  isNavigationFailure: vi.fn((value: unknown) => Boolean(
    value && typeof value === 'object' && '__navigationFailure' in value,
  )),
}))

vi.mock('vue-router', () => ({
  isNavigationFailure: routerFailureMocks.isNavigationFailure,
  useRoute: () => ({ params: { id: 'collection-1' } }),
  useRouter: () => ({ push }),
}))

const ownerViewStubs = {
  BookmarkFolderModal: true,
  PCard: { template: '<section><slot /></section>' },
  PClip: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
  PEmpty: true,
  PEntry: true,
  PLink: true,
  PModal: {
    props: ['modelValue', 'title'],
    template: '<div v-if="modelValue" data-testid="modal"><slot /></div>',
  },
  PPageHeader: { template: '<header><slot name="action" /></header>' },
  PPress: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
  PReject: {
    props: ['label', 'disabled'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  PSectionHeader: true,
}

const mountOwnerView = () => mount(CollectionView, {
  global: { stubs: ownerViewStubs },
})

describe('CollectionView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(useFeedStore(), 'fetchBookmarkedPostIds').mockResolvedValue()
    vi.spyOn(useFeedStore(), 'fetchReadingListIds').mockResolvedValue()
    push.mockReset()
    routerFailureMocks.isNavigationFailure.mockClear()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'collection-1',
          channel_id: 'channel-1',
          name: '合集',
        } }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'channel-1',
          user_id: 'author-1',
          name: '频道',
          slug: 'real-channel',
        } }), { status: 200 })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return new Response(JSON.stringify({ data: [{
          id: 'post-1',
          collection_id: 'collection-1',
          title: '文章',
          content: '正文',
          status: 'published',
          updated_at: '2026-01-01T00:00:00Z',
        }], meta: { page: 1, page_size: 100, total: 1, has_more: false } }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))
  })

  it('使用真实频道和文章详情路由', async () => {
    const wrapper = mount(CollectionView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          PCard: { template: '<section><slot /></section>' },
          PClip: true,
          PEmpty: true,
          PEntry: { props: ['title'], template: '<article @click="$emit(\'click\')">{{ title }}<slot name="actions" /></article>' },
          PLink: { props: ['href', 'label'], template: '<a :href="href">{{ label }}<slot /></a>' },
          PModal: true,
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PSectionHeader: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('a[href="/channels/real-channel"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/posts/post/post-1"]').exists()).toBe(true)
    await wrapper.get('article').trigger('click')
    expect(push).toHaveBeenCalledWith('/posts/post/post-1')
  })

  it('按合集顺序拉取全部分页文章', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `post-${index + 1}`,
      collection_id: 'collection-1',
      title: `文章 ${index + 1}`,
      content: '正文',
      status: 'published',
      updated_at: '2026-01-01T00:00:00Z',
    }))
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1')) {
        return response({ data: { id: 'collection-1', channel_id: 'channel-1', name: '合集' } })
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return response({ data: { id: 'channel-1', name: '频道', slug: 'channel' } })
      }
      if (url.endsWith('/blog/posts?collection_id=collection-1&page_size=100&page=1')) {
        return response({ data: firstPage, meta: { page: 1, page_size: 100, total: 101, has_more: true } })
      }
      if (url.endsWith('/blog/posts?collection_id=collection-1&page_size=100&page=2')) {
        return response({ data: [{
          id: 'post-101', collection_id: 'collection-1', title: '文章 101', content: '正文',
          status: 'published', updated_at: '2026-01-01T00:00:00Z',
        }], meta: { page: 2, page_size: 100, total: 101, has_more: false } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, {
      global: { stubs: {
        ...ownerViewStubs,
        PEmpty: { props: ['text'], template: '<div>{{ text }}</div>' },
        PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
      } },
    })
    await flushPromises()

    const postURLs = fetchMock.mock.calls.map(([input]) => String(input)).filter(url => url.includes('/blog/posts?'))
    expect(postURLs).toEqual([
      '/api/v1/blog/posts?collection_id=collection-1&page_size=100&page=1',
      '/api/v1/blog/posts?collection_id=collection-1&page_size=100&page=2',
    ])
    expect(postURLs.every(url => !url.includes('channel_id'))).toBe(true)
    expect(wrapper.vm.$.setupState.posts).toHaveLength(101)
    expect(wrapper.vm.$.setupState.posts[0].id).toBe('post-1')
    expect(wrapper.vm.$.setupState.posts[100].id).toBe('post-101')
    expect(wrapper.text()).toContain('文章 1')
    expect(wrapper.text()).toContain('文章 101')
    expect(wrapper.text()).not.toContain('文章加载失败')
  })

  it.each([
    ['非 2xx', () => Promise.resolve(response({ error: { message: 'database unavailable' } }, 500))],
    ['网络错误', () => Promise.reject(new Error('offline'))],
    ['错误 JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('第 2 页%s时整体失败且不提交第 1 页', async (_label, secondPageResult) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1')) {
        return Promise.resolve(response({ data: { id: 'collection-1', channel_id: 'channel-1', name: '合集' } }))
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return Promise.resolve(response({ data: { id: 'channel-1', name: '频道', slug: 'channel' } }))
      }
      if (url.endsWith('/blog/posts?collection_id=collection-1&page_size=100&page=1')) {
        return Promise.resolve(response({
          data: [{ id: 'page-1-post', collection_id: 'collection-1', title: '不应半写', content: '正文', status: 'published' }],
          meta: { page: 1, page_size: 100, total: 101, has_more: true },
        }))
      }
      if (url.endsWith('/blog/posts?collection_id=collection-1&page_size=100&page=2')) return secondPageResult()
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { global: { stubs: {
      ...ownerViewStubs,
      PEmpty: { props: ['text'], template: '<div>{{ text }}</div>' },
      PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
    } } })
    await flushPromises()

    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.text()).toContain('文章加载失败')
    expect(wrapper.text()).not.toContain('当前合集暂无文章')
    expect(wrapper.text()).not.toContain('不应半写')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('单页 200 空列表显示真实空态', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1')) return response({ data: { id: 'collection-1', channel_id: 'channel-1', name: '合集' } })
      if (url.endsWith('/blog/channels/channel-1')) return response({ data: { id: 'channel-1', name: '频道', slug: 'channel' } })
      if (url.endsWith('/blog/posts?collection_id=collection-1&page_size=100&page=1')) {
        return response({ data: [], meta: { page: 1, page_size: 100, total: 0, has_more: false } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { global: { stubs: {
      ...ownerViewStubs,
      PEmpty: { props: ['text'], template: '<div>{{ text }}</div>' },
    } } })
    await flushPromises()

    expect(wrapper.text()).toContain('当前合集暂无文章')
    expect(wrapper.text()).not.toContain('文章加载失败')
  })

  it.each([
    ['非 2xx', (pending: ReturnType<typeof deferred<Response>>) => pending.resolve(response({ error: 'not found' }, 404))],
    ['网络错误', (pending: ReturnType<typeof deferred<Response>>) => pending.reject(new Error('offline'))],
    ['错误 JSON', (pending: ReturnType<typeof deferred<Response>>) => pending.resolve(new Response('not-json', { status: 200 }))],
  ])('已显示 A 后切换到详情%s的 B 时立即清空旧内容并显示不存在空态', async (_label, settleB) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'viewer' } as typeof authStore.user
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'isSubscribedToCollection').mockResolvedValue(true)
    const pendingB = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/collections/collection-b')) return pendingB.promise
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', user_id: 'owner', name: '频道 A', slug: 'channel-a' } })
      if (url.endsWith('/blog/posts?collection_id=collection-a&page_size=100&page=1')) {
        return response({ data: [{ id: 'post-a', collection_id: 'collection-a', title: '文章 A', content: '正文', status: 'published' }], meta: { has_more: false } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, {
      props: { id: 'collection-a' },
      global: { stubs: {
        ...ownerViewStubs,
        PEmpty: { props: ['text'], template: '<div>{{ text }}</div>' },
      } },
    })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(true))
    expect(wrapper.vm.$.setupState.collection?.name).toBe('合集 A')
    expect(wrapper.vm.$.setupState.posts).toHaveLength(1)

    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/collections/collection-b'))

    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(wrapper.vm.$.setupState.collection).toBe(null)
    expect(wrapper.vm.$.setupState.channel).toBe(null)
    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(false)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(false)
    expect(wrapper.text()).not.toContain('合集 A')
    expect(wrapper.text()).not.toContain('文章 A')

    settleB(pendingB)
    await flushPromises()

    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(wrapper.vm.$.setupState.collection).toBe(null)
    expect(wrapper.vm.$.setupState.channel).toBe(null)
    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(false)
    expect(wrapper.text()).toContain('合集不存在或已被删除')
    expect(wrapper.text()).not.toContain('合集 A')
    expect(consoleError.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('旧订阅成功和 finally 不能覆盖 B 的订阅查询状态', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'viewer' } as typeof authStore.user
    const feedStore = useFeedStore()
    const pendingBQuery = deferred<boolean>()
    vi.spyOn(feedStore, 'isSubscribedToCollection').mockImplementation((id) => (
      id === 'collection-a' ? Promise.resolve(false) : pendingBQuery.promise
    ))
    const pendingAMutation = deferred<boolean>()
    const subscribe = vi.spyOn(feedStore, 'subscribeToCollection').mockReturnValue(pendingAMutation.promise)
    vi.spyOn(feedStore, 'unsubscribeFromCollection').mockResolvedValue(true)
    const pendingBDetail = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      const id = url.includes('collection-a') ? 'a' : 'b'
      if (url.endsWith('/blog/collections/collection-b')) return pendingBDetail.promise
      if (url.includes('/blog/collections/collection-')) return response({ data: { id: `collection-${id}`, channel_id: `channel-${id}`, name: `合集 ${id.toUpperCase()}` } })
      if (url.includes('/blog/channels/channel-')) return response({ data: { id: `channel-${id}`, user_id: 'owner', name: `频道 ${id.toUpperCase()}`, slug: `channel-${id}` } })
      if (url.includes('/blog/posts?collection_id=collection-')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('订阅合集'))
    await wrapper.findAll('button').find(button => button.text() === '订阅合集')!.trigger('click')
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(true)

    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/collections/collection-b'))
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(false)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(false)

    pendingBDetail.resolve(response({ data: { id: 'collection-b', channel_id: 'channel-b', name: '合集 B' } }))
    await vi.waitFor(() => expect(feedStore.isSubscribedToCollection).toHaveBeenCalledWith('collection-b'))
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(false)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(true)

    pendingAMutation.resolve(true)
    await flushPromises()

    expect(subscribe).toHaveBeenCalledWith('collection-a')
    expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-b')
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(false)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(true)

    pendingBQuery.resolve(false)
    await flushPromises()
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(false)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(false)
  })

  it.each([
    { name: 'A 订阅成功', aSubscribed: false, bSubscribed: true, aMethod: 'subscribeToCollection', bMethod: 'unsubscribeFromCollection', rejectA: false },
    { name: 'A 取消订阅失败', aSubscribed: true, bSubscribed: false, aMethod: 'unsubscribeFromCollection', bMethod: 'subscribeToCollection', rejectA: true },
  ] as const)('$name不能影响 B 的新订阅操作', async ({ aSubscribed, bSubscribed, aMethod, bMethod, rejectA }) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'viewer' } as typeof authStore.user
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'isSubscribedToCollection').mockImplementation((id) => Promise.resolve(
      id === 'collection-a' ? aSubscribed : bSubscribed,
    ))
    const pendingA = deferred<boolean>()
    const pendingB = deferred<boolean>()
    const subscribe = vi.spyOn(feedStore, 'subscribeToCollection').mockImplementation((id) => (
      id === 'collection-a' ? pendingA.promise : pendingB.promise
    ))
    const unsubscribe = vi.spyOn(feedStore, 'unsubscribeFromCollection').mockImplementation((id) => (
      id === 'collection-a' ? pendingA.promise : pendingB.promise
    ))
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      const id = url.includes('collection-a') || url.includes('channel-a') ? 'a' : 'b'
      if (url.includes('/blog/collections/collection-')) return response({ data: { id: `collection-${id}`, channel_id: `channel-${id}`, name: `合集 ${id.toUpperCase()}` } })
      if (url.includes('/blog/channels/channel-')) return response({ data: { id: `channel-${id}`, user_id: 'owner', name: `频道 ${id.toUpperCase()}`, slug: `channel-${id}` } })
      if (url.includes('/blog/posts?collection_id=collection-')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    const aLabel = aSubscribed ? '已订阅' : '订阅合集'
    await vi.waitFor(() => expect(wrapper.text()).toContain(aLabel))
    await wrapper.findAll('button').find(button => button.text() === aLabel)!.trigger('click')
    await wrapper.setProps({ id: 'collection-b' })
    const bLabel = bSubscribed ? '已订阅' : '订阅合集'
    await vi.waitFor(() => expect(wrapper.text()).toContain(bLabel))
    await wrapper.findAll('button').find(button => button.text() === bLabel)!.trigger('click')
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(true)

    if (rejectA) pendingA.reject(new Error('late A mutation failure'))
    else pendingA.resolve(true)
    await flushPromises()

    expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-b')
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(bSubscribed)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()

    pendingB.resolve(true)
    await flushPromises()

    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(!bSubscribed)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(false)
    expect(aMethod === 'subscribeToCollection' ? subscribe : unsubscribe).toHaveBeenCalledWith('collection-a')
    expect(bMethod === 'subscribeToCollection' ? subscribe : unsubscribe).toHaveBeenCalledWith('collection-b')
  })

  it('订阅成功按点击时快照设置目标值', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'viewer' } as typeof authStore.user
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'isSubscribedToCollection').mockResolvedValue(false)
    const pendingMutation = deferred<boolean>()
    vi.spyOn(feedStore, 'subscribeToCollection').mockReturnValue(pendingMutation.promise)
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', user_id: 'owner', name: '频道 A', slug: 'channel-a' } })
      if (url.includes('/blog/posts?collection_id=collection-a')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('订阅合集'))
    await wrapper.findAll('button').find(button => button.text() === '订阅合集')!.trigger('click')
    wrapper.vm.$.setupState.collectionSubscribed = true
    pendingMutation.resolve(true)
    await flushPromises()

    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(true)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(false)
  })

  it('同一合集重新加载时立即失效旧订阅操作', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'viewer' } as typeof authStore.user
    const feedStore = useFeedStore()
    const queryStatus = vi.spyOn(feedStore, 'isSubscribedToCollection').mockResolvedValue(false)
    const pendingMutation = deferred<boolean>()
    vi.spyOn(feedStore, 'subscribeToCollection').mockReturnValue(pendingMutation.promise)
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', user_id: 'owner', name: '频道 A', slug: 'channel-a' } })
      if (url.includes('/blog/posts?collection_id=collection-a')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('订阅合集'))
    await wrapper.findAll('button').find(button => button.text() === '订阅合集')!.trigger('click')
    await wrapper.vm.$.setupState.fetchCollection()
    expect(queryStatus).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(false)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(false)

    pendingMutation.resolve(true)
    await flushPromises()

    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(false)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(false)
  })

  it.each([
    { name: '订阅成功', initialSubscribed: false, reject: false },
    { name: '取消订阅失败', initialSubscribed: true, reject: true },
  ])('卸载后迟到的$name不能写订阅状态', async ({ initialSubscribed, reject }) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'viewer' } as typeof authStore.user
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'isSubscribedToCollection').mockResolvedValue(initialSubscribed)
    const pendingMutation = deferred<boolean>()
    const subscribe = vi.spyOn(feedStore, 'subscribeToCollection').mockReturnValue(pendingMutation.promise)
    const unsubscribe = vi.spyOn(feedStore, 'unsubscribeFromCollection').mockReturnValue(pendingMutation.promise)
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', user_id: 'owner', name: '频道 A', slug: 'channel-a' } })
      if (url.includes('/blog/posts?collection_id=collection-a')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    const label = initialSubscribed ? '已订阅' : '订阅合集'
    await vi.waitFor(() => expect(wrapper.text()).toContain(label))
    await wrapper.findAll('button').find(button => button.text() === label)!.trigger('click')
    wrapper.unmount()
    if (reject) pendingMutation.reject(new Error('late mutation failure'))
    else pendingMutation.resolve(true)
    await flushPromises()

    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(initialSubscribed)
    expect(wrapper.vm.$.setupState.collectionSubscribeLoading).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
    expect(initialSubscribed ? unsubscribe : subscribe).toHaveBeenCalledWith('collection-a')
  })

  it.each(['fetch', 'json'] as const)('切换合集后详情%s迟到不能覆盖新合集或启动旧合集请求', async (stage) => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    const subscribeStatus = vi.spyOn(feedStore, 'isSubscribedToCollection').mockResolvedValue(true)
    const sheetStore = useSheetStore()
    const updateSheetTitle = vi.spyOn(sheetStore, 'updateSheetTitle')
    const pendingResponse = deferred<Response>()
    const pendingData = deferred<unknown>()
    const oldCollection = { data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } }
    const lateFetchResponse = new Response(null, { status: 200 })
    const lateFetchJSON = vi.spyOn(lateFetchResponse, 'json').mockResolvedValue(oldCollection)
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(pendingData.promise)
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) {
        return stage === 'fetch' ? pendingResponse.promise : oldResponse
      }
      if (url.endsWith('/blog/collections/collection-b')) {
        return response({ data: { id: 'collection-b', channel_id: 'channel-b', name: '合集 B' } })
      }
      if (url.endsWith('/blog/channels/channel-a')) {
        return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      }
      if (url.endsWith('/blog/channels/channel-b')) {
        return response({ data: { id: 'channel-b', name: '频道 B', slug: 'channel-b' } })
      }
      if (url.endsWith('/blog/posts?collection_id=collection-a&page_size=100&page=1')) {
        return response({ data: [{ id: 'post-a', collection_id: 'collection-a', title: '文章 A', content: '正文', status: 'published' }], meta: { has_more: false } })
      }
      if (url.endsWith('/blog/posts?collection_id=collection-b&page_size=100&page=1')) {
        return response({ data: [{ id: 'post-b', collection_id: 'collection-b', title: '文章 B', content: '正文', status: 'published' }], meta: { has_more: false } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    if (stage === 'fetch') {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/collections/collection-a'))
    } else {
      await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())
    }
    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['post-b']))

    if (stage === 'fetch') pendingResponse.resolve(lateFetchResponse)
    else pendingData.resolve(oldCollection)
    await flushPromises()

    if (stage === 'fetch') expect(lateFetchJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.collection.id).toBe('collection-b')
    expect(wrapper.vm.$.setupState.channel.id).toBe('channel-b')
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['post-b'])
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain('/api/v1/blog/channels/channel-a')
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain(
      '/api/v1/blog/posts?collection_id=collection-a&page_size=100&page=1',
    )
    expect(subscribeStatus).toHaveBeenCalledTimes(1)
    expect(subscribeStatus).toHaveBeenCalledWith('collection-b')
    expect(updateSheetTitle).toHaveBeenCalledTimes(1)
    expect(updateSheetTitle).toHaveBeenCalledWith('collection-b', 'collection', '合集 B')
  })

  it('频道请求迟到后不能提交旧详情或继续旧合集流程', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    const subscribeStatus = vi.spyOn(feedStore, 'isSubscribedToCollection').mockResolvedValue(true)
    const sheetStore = useSheetStore()
    const updateSheetTitle = vi.spyOn(sheetStore, 'updateSheetTitle')
    const oldChannelResponse = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/collections/collection-b')) return response({ data: { id: 'collection-b', channel_id: 'channel-b', name: '合集 B' } })
      if (url.endsWith('/blog/channels/channel-a')) return oldChannelResponse.promise
      if (url.endsWith('/blog/channels/channel-b')) return response({ data: { id: 'channel-b', name: '频道 B', slug: 'channel-b' } })
      if (url.endsWith('/blog/posts?collection_id=collection-b&page_size=100&page=1')) {
        return response({ data: [{ id: 'post-b', collection_id: 'collection-b', title: '文章 B', content: '正文', status: 'published' }], meta: { has_more: false } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/channels/channel-a'))
    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['post-b']))
    oldChannelResponse.resolve(response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } }))
    await flushPromises()

    expect(wrapper.vm.$.setupState.collection.id).toBe('collection-b')
    expect(wrapper.vm.$.setupState.channel.id).toBe('channel-b')
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['post-b'])
    expect(fetchMock.mock.calls.map(([input]) => String(input)).filter(url => url.includes('/blog/posts?'))).toEqual([
      '/api/v1/blog/posts?collection_id=collection-b&page_size=100&page=1',
    ])
    expect(subscribeStatus).toHaveBeenCalledTimes(1)
    expect(updateSheetTitle).toHaveBeenCalledTimes(1)
  })

  it('文章请求迟到后不能继续旧详情的订阅和标题流程', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    const subscribeStatus = vi.spyOn(feedStore, 'isSubscribedToCollection').mockResolvedValue(true)
    const sheetStore = useSheetStore()
    const updateSheetTitle = vi.spyOn(sheetStore, 'updateSheetTitle')
    const oldPostsResponse = deferred<Response>()
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/collections/collection-b')) return response({ data: { id: 'collection-b', channel_id: 'channel-b', name: '合集 B' } })
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      if (url.endsWith('/blog/channels/channel-b')) return response({ data: { id: 'channel-b', name: '频道 B', slug: 'channel-b' } })
      if (url.endsWith('/blog/posts?collection_id=collection-a&page_size=100&page=1')) return oldPostsResponse.promise
      if (url.endsWith('/blog/posts?collection_id=collection-b&page_size=100&page=1')) {
        return response({ data: [{ id: 'post-b', collection_id: 'collection-b', title: '文章 B', content: '正文', status: 'published' }], meta: { has_more: false } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      '/api/v1/blog/posts?collection_id=collection-a&page_size=100&page=1',
    ))
    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['post-b']))
    oldPostsResponse.resolve(response({ data: [{ id: 'post-a', collection_id: 'collection-a', title: '文章 A', content: '正文', status: 'published' }], meta: { has_more: false } }))
    await flushPromises()

    expect(wrapper.vm.$.setupState.collection.id).toBe('collection-b')
    expect(wrapper.vm.$.setupState.channel.id).toBe('channel-b')
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['post-b'])
    expect(subscribeStatus).toHaveBeenCalledTimes(1)
    expect(subscribeStatus).toHaveBeenCalledWith('collection-b')
    expect(updateSheetTitle).toHaveBeenCalledTimes(1)
  })

  it('订阅检查迟到后不能覆盖新合集订阅状态或重复更新标题', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    const oldSubscription = deferred<boolean>()
    const subscribeStatus = vi.spyOn(feedStore, 'isSubscribedToCollection').mockImplementation((id) => (
      id === 'collection-a' ? oldSubscription.promise : Promise.resolve(true)
    ))
    const sheetStore = useSheetStore()
    const updateSheetTitle = vi.spyOn(sheetStore, 'updateSheetTitle')
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/collections/collection-b')) return response({ data: { id: 'collection-b', channel_id: 'channel-b', name: '合集 B' } })
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      if (url.endsWith('/blog/channels/channel-b')) return response({ data: { id: 'channel-b', name: '频道 B', slug: 'channel-b' } })
      if (url.includes('/blog/posts?collection_id=')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(subscribeStatus).toHaveBeenCalledWith('collection-a'))
    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(true))
    oldSubscription.resolve(false)
    await flushPromises()

    expect(wrapper.vm.$.setupState.collection.id).toBe('collection-b')
    expect(wrapper.vm.$.setupState.collectionSubscribed).toBe(true)
    expect(subscribeStatus.mock.calls.map(([id]) => id)).toEqual(['collection-a', 'collection-b'])
    expect(updateSheetTitle).toHaveBeenCalledTimes(1)
    expect(updateSheetTitle).toHaveBeenCalledWith('collection-b', 'collection', '合集 B')
  })

  it('旧详情失败的 catch 和 finally 不能影响仍在加载的新合集', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const oldCollection = deferred<Response>()
    const nextCollection = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return oldCollection.promise
      if (url.endsWith('/blog/collections/collection-b')) return nextCollection.promise
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/collections/collection-a'))
    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/collections/collection-b'))
    oldCollection.reject(new Error('late collection failure'))
    await flushPromises()

    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(wrapper.vm.$.setupState.collection).toBe(null)
    expect(consoleError).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['fetch', 'json'] as const)('卸载后详情%s迟到不能写状态或启动后续请求', async (stage) => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const feedStore = useFeedStore()
    const subscribeStatus = vi.spyOn(feedStore, 'isSubscribedToCollection').mockResolvedValue(true)
    const sheetStore = useSheetStore()
    const updateSheetTitle = vi.spyOn(sheetStore, 'updateSheetTitle')
    const pendingResponse = deferred<Response>()
    const pendingData = deferred<unknown>()
    const loadedCollection = { data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } }
    const lateFetchResponse = new Response(null, { status: 200 })
    const lateFetchJSON = vi.spyOn(lateFetchResponse, 'json').mockResolvedValue(loadedCollection)
    const detailResponse = new Response(null, { status: 200 })
    const detailJSON = vi.spyOn(detailResponse, 'json').mockReturnValue(pendingData.promise)
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) {
        return stage === 'fetch' ? pendingResponse.promise : detailResponse
      }
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      if (url.includes('/blog/posts?collection_id=collection-a')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    if (stage === 'fetch') await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    else await vi.waitFor(() => expect(detailJSON).toHaveBeenCalledOnce())
    wrapper.unmount()
    if (stage === 'fetch') pendingResponse.resolve(lateFetchResponse)
    else pendingData.resolve(loadedCollection)
    await flushPromises()

    if (stage === 'fetch') expect(lateFetchJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.collection).toBe(null)
    expect(wrapper.vm.$.setupState.channel).toBe(null)
    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(subscribeStatus).not.toHaveBeenCalled()
    expect(updateSheetTitle).not.toHaveBeenCalled()
  })

  it('切换合集后旧分页停止且不能写入新合集', async () => {
    const oldData = deferred<unknown>()
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(oldData.promise)
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-1', name: '合集 A' } })
      if (url.endsWith('/blog/collections/collection-b')) return response({ data: { id: 'collection-b', channel_id: 'channel-1', name: '合集 B' } })
      if (url.endsWith('/blog/channels/channel-1')) return response({ data: { id: 'channel-1', name: '频道', slug: 'channel' } })
      if (url.endsWith('/blog/posts?collection_id=collection-a&page_size=100&page=1')) return oldResponse
      if (url.endsWith('/blog/posts?collection_id=collection-b&page_size=100&page=1')) {
        return response({
          data: [{ id: 'post-b', collection_id: 'collection-b', title: '合集 B 文章', content: '正文', status: 'published' }],
          meta: { page: 1, page_size: 100, total: 1, has_more: false },
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())
    await wrapper.setProps({ id: 'collection-b' })
    await flushPromises()
    oldData.resolve({
      data: [{ id: 'post-a', collection_id: 'collection-a', title: '旧文章', content: '正文', status: 'published' }],
      meta: { page: 1, page_size: 100, total: 101, has_more: true },
    })
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain(
      '/api/v1/blog/posts?collection_id=collection-a&page_size=100&page=2',
    )
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['post-b'])
    expect(wrapper.vm.$.setupState.postsLoadError).toBe('')
  })

  it('新合集主详情仍在等待时就立即停止旧分页', async () => {
    const oldData = deferred<unknown>()
    const nextCollection = deferred<Response>()
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(oldData.promise)
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-1', name: '合集 A' } })
      if (url.endsWith('/blog/collections/collection-b')) return nextCollection.promise
      if (url.endsWith('/blog/channels/channel-1')) return response({ data: { id: 'channel-1', name: '频道', slug: 'channel' } })
      if (url.endsWith('/blog/posts?collection_id=collection-a&page_size=100&page=1')) return oldResponse
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())
    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain('/api/v1/blog/collections/collection-b'))

    oldData.resolve({
      data: [{ id: 'post-a', collection_id: 'collection-a', title: '旧文章', content: '正文', status: 'published' }],
      meta: { page: 1, page_size: 100, total: 101, has_more: true },
    })
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain(
      '/api/v1/blog/posts?collection_id=collection-a&page_size=100&page=2',
    )
    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.postsLoadError).toBe('')

    nextCollection.resolve(response({ data: { id: 'collection-b', channel_id: 'channel-1', name: '合集 B' } }))
    await flushPromises()
  })

  it.each([
    ['GET 成功', 'fetch', false],
    ['GET 失败', 'fetch', true],
    ['JSON 成功', 'json', false],
    ['JSON 失败', 'json', true],
  ])('卸载后迟到的文章%s不写状态', async (_label, stage, shouldReject) => {
    const pendingResponse = deferred<Response>()
    const pendingData = deferred<unknown>()
    const postResponse = new Response(null, { status: 200 })
    const postJSON = vi.spyOn(postResponse, 'json').mockReturnValue(pendingData.promise)
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1')) return response({ data: { id: 'collection-1', channel_id: 'channel-1', name: '合集' } })
      if (url.endsWith('/blog/channels/channel-1')) return response({ data: { id: 'channel-1', name: '频道', slug: 'channel' } })
      if (url.endsWith('/blog/posts?collection_id=collection-1&page_size=100&page=1')) {
        return stage === 'fetch' ? pendingResponse.promise : postResponse
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { global: { stubs: ownerViewStubs } })
    if (stage === 'fetch') await vi.waitFor(() => expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(3))
    else await vi.waitFor(() => expect(postJSON).toHaveBeenCalledOnce())
    wrapper.unmount()
    if (stage === 'fetch') {
      if (shouldReject) pendingResponse.reject(new Error('late posts failure'))
      else pendingResponse.resolve(postResponse)
    } else if (shouldReject) {
      pendingData.reject(new Error('late posts JSON failure'))
    } else {
      pendingData.resolve({
        data: [{ id: 'late-post', collection_id: 'collection-1', title: '迟到文章', content: '正文', status: 'published' }],
        meta: { page: 1, page_size: 100, total: 1, has_more: false },
      })
    }
    await flushPromises()

    if (stage === 'fetch') expect(postJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.postsLoadError).toBe('')
  })

  it('切换合集开始时立即关闭并清空未提交的 A 编辑会话', async () => {
    const pendingB = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A', description: 'A 描述' } })
      if (url.endsWith('/blog/collections/collection-b')) return pendingB.promise
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      if (url.endsWith('/blog/channels/channel-b')) return response({ data: { id: 'channel-b', name: '频道 B', slug: 'channel-b' } })
      if (url.includes('/blog/posts?collection_id=')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-a'))
    wrapper.vm.$.setupState.openEditModal()
    wrapper.vm.$.setupState.form.name = '未提交的 A'
    wrapper.vm.$.setupState.form.description = '未提交描述'
    wrapper.vm.$.setupState.saveError = '旧错误'
    wrapper.vm.$.setupState.saving = true

    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/collections/collection-b'))

    expect(wrapper.vm.$.setupState.editModalOpen).toBe(false)
    expect(wrapper.vm.$.setupState.form).toEqual({ name: '', description: '' })
    expect(wrapper.vm.$.setupState.saveError).toBe('')
    expect(wrapper.vm.$.setupState.saving).toBe(false)

    pendingB.resolve(response({ data: { id: 'collection-b', channel_id: 'channel-b', name: '合集 B', description: 'B 描述' } }))
    await flushPromises()
    expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-b')
    expect(wrapper.vm.$.setupState.editModalOpen).toBe(false)
    expect(wrapper.vm.$.setupState.form).toEqual({ name: '', description: '' })
  })

  it.each([
    ['成功', (pending: ReturnType<typeof deferred<Response>>) => pending.resolve(response({ data: { id: 'collection-a' } }))],
    ['非 2xx', (pending: ReturnType<typeof deferred<Response>>) => pending.resolve(response({ error: 'forbidden' }, 403))],
    ['网络错误', (pending: ReturnType<typeof deferred<Response>>) => pending.reject(new Error('late A save failure'))],
  ])('A 保存%s迟到不能影响 B 的新编辑保存', async (_label, settleA) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pendingA = deferred<Response>()
    const pendingB = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT' && url.endsWith('/blog/collections/collection-a')) return pendingA.promise
      if (init?.method === 'PUT' && url.endsWith('/blog/collections/collection-b')) return pendingB.promise
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/collections/collection-b')) return response({ data: { id: 'collection-b', channel_id: 'channel-b', name: '合集 B' } })
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      if (url.endsWith('/blog/channels/channel-b')) return response({ data: { id: 'channel-b', name: '频道 B', slug: 'channel-b' } })
      if (url.includes('/blog/posts?collection_id=')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-a'))
    wrapper.vm.$.setupState.openEditModal()
    wrapper.vm.$.setupState.form.name = '提交 A'
    void wrapper.vm.$.setupState.saveCollection()
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => (
      String(input).endsWith('/blog/collections/collection-a') && init?.method === 'PUT'
    ))).toBe(true))

    await wrapper.setProps({ id: 'collection-b' })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-b'))
    wrapper.vm.$.setupState.openEditModal()
    wrapper.vm.$.setupState.form.name = '提交 B'
    void wrapper.vm.$.setupState.saveCollection()
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => (
      String(input).endsWith('/blog/collections/collection-b') && init?.method === 'PUT'
    ))).toBe(true))
    expect(wrapper.vm.$.setupState.saving).toBe(true)

    settleA(pendingA)
    await flushPromises()

    expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-b')
    expect(wrapper.vm.$.setupState.editModalOpen).toBe(true)
    expect(wrapper.vm.$.setupState.form.name).toBe('提交 B')
    expect(wrapper.vm.$.setupState.saveError).toBe('')
    expect(wrapper.vm.$.setupState.saving).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.filter(([input, init]) => (
      String(input).endsWith('/blog/collections/collection-b') && !init?.method
    ))).toHaveLength(1)

    pendingB.resolve(response({ error: 'B save rejected' }, 403))
    await flushPromises()
  })

  it('保存请求使用提交时的合集 ID 和表单快照', async () => {
    const pendingSave = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') return pendingSave.promise
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/collections/collection-b')) return response({ data: { id: 'collection-b', channel_id: 'channel-b', name: '合集 B' } })
      if (url.includes('/blog/channels/channel-')) return response({ data: { id: 'channel', name: '频道', slug: 'channel' } })
      if (url.includes('/blog/posts?collection_id=')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-a'))
    wrapper.vm.$.setupState.form = { name: '提交名称 A', description: '提交描述 A' }
    void wrapper.vm.$.setupState.saveCollection()
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))
    await wrapper.setProps({ id: 'collection-b' })
    wrapper.vm.$.setupState.form = { name: '后续名称 B', description: '后续描述 B' }

    const [input, init] = fetchMock.mock.calls.find(([, requestInit]) => requestInit?.method === 'PUT')!
    expect(String(input)).toBe('/api/v1/blog/collections/collection-a')
    expect(JSON.parse(String(init?.body))).toEqual({ name: '提交名称 A', description: '提交描述 A' })

    pendingSave.resolve(response({ data: { id: 'collection-a' } }))
    await flushPromises()
  })

  it('同一合集重新加载时失效旧保存且不关闭新的编辑会话', async () => {
    const pendingSave = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') return pendingSave.promise
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      if (url.includes('/blog/posts?collection_id=collection-a')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-a'))
    wrapper.vm.$.setupState.form.name = '旧保存'
    void wrapper.vm.$.setupState.saveCollection()
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true))

    await wrapper.vm.$.setupState.fetchCollection()
    wrapper.vm.$.setupState.openEditModal()
    wrapper.vm.$.setupState.form.name = '新的编辑内容'
    pendingSave.resolve(response({ data: { id: 'collection-a' } }))
    await flushPromises()

    expect(wrapper.vm.$.setupState.editModalOpen).toBe(true)
    expect(wrapper.vm.$.setupState.form.name).toBe('新的编辑内容')
    expect(wrapper.vm.$.setupState.saveError).toBe('')
    expect(wrapper.vm.$.setupState.saving).toBe(false)
    expect(fetchMock.mock.calls.filter(([input, init]) => (
      String(input).endsWith('/blog/collections/collection-a') && !init?.method
    ))).toHaveLength(2)
  })

  it.each([
    ['成功', (pending: ReturnType<typeof deferred<Response>>) => pending.resolve(response({ data: { id: 'collection-a' } }))],
    ['网络错误', (pending: ReturnType<typeof deferred<Response>>) => pending.reject(new Error('late save failure'))],
  ])('卸载后保存%s迟到不能写状态或输出错误', async (_label, settleSave) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pendingSave = deferred<Response>()
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') return pendingSave.promise
      if (url.endsWith('/blog/collections/collection-a')) return response({ data: { id: 'collection-a', channel_id: 'channel-a', name: '合集 A' } })
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      if (url.includes('/blog/posts?collection_id=collection-a')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collection?.id).toBe('collection-a'))
    wrapper.vm.$.setupState.openEditModal()
    wrapper.vm.$.setupState.form.name = '待保存 A'
    void wrapper.vm.$.setupState.saveCollection()
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.saving).toBe(true))
    wrapper.unmount()

    expect(wrapper.vm.$.setupState.editModalOpen).toBe(false)
    expect(wrapper.vm.$.setupState.form).toEqual({ name: '', description: '' })
    expect(wrapper.vm.$.setupState.saveError).toBe('')
    expect(wrapper.vm.$.setupState.saving).toBe(false)

    settleSave(pendingSave)
    await flushPromises()

    expect(wrapper.vm.$.setupState.editModalOpen).toBe(false)
    expect(wrapper.vm.$.setupState.form).toEqual({ name: '', description: '' })
    expect(wrapper.vm.$.setupState.saveError).toBe('')
    expect(wrapper.vm.$.setupState.saving).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.filter(([input, init]) => (
      String(input).endsWith('/blog/collections/collection-a') && !init?.method
    ))).toHaveLength(1)
  })

  it('当前合集保存成功后刷新详情并结束编辑 loading', async () => {
    let detailRequestCount = 0
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') return response({ data: { id: 'collection-a' } })
      if (url.endsWith('/blog/collections/collection-a')) {
        detailRequestCount += 1
        return response({ data: {
          id: 'collection-a',
          channel_id: 'channel-a',
          name: detailRequestCount === 1 ? '合集 A' : '更新后的合集 A',
        } })
      }
      if (url.endsWith('/blog/channels/channel-a')) return response({ data: { id: 'channel-a', name: '频道 A', slug: 'channel-a' } })
      if (url.includes('/blog/posts?collection_id=collection-a')) return response({ data: [], meta: { has_more: false } })
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mount(CollectionView, { props: { id: 'collection-a' }, global: { stubs: ownerViewStubs } })
    await vi.waitFor(() => expect(wrapper.vm.$.setupState.collection?.name).toBe('合集 A'))
    wrapper.vm.$.setupState.openEditModal()
    wrapper.vm.$.setupState.form.name = '更新后的合集 A'
    await wrapper.vm.$.setupState.saveCollection()

    expect(wrapper.vm.$.setupState.collection?.name).toBe('更新后的合集 A')
    expect(wrapper.vm.$.setupState.editModalOpen).toBe(false)
    expect(wrapper.vm.$.setupState.form).toEqual({ name: '', description: '' })
    expect(wrapper.vm.$.setupState.saveError).toBe('')
    expect(wrapper.vm.$.setupState.saving).toBe(false)
    expect(wrapper.vm.$.setupState.loading).toBe(false)
    expect(fetchMock.mock.calls.filter(([input, init]) => (
      String(input).endsWith('/blog/collections/collection-a') && !init?.method
    ))).toHaveLength(2)
  })

  it('合集保存被后端拒绝时保留编辑框并提示失败', async () => {
    const authStore = useAuthStore()
    authStore.user = { uuid: 'author-1' } as typeof authStore.user

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-1') && init?.method === 'PUT') {
        return new Response(JSON.stringify({
          error: {
            code: 'blog.collection_forbidden',
            message: 'You do not have permission to modify this collection',
          },
        }), { status: 403 })
      }
      if (url.endsWith('/blog/collections/collection-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'collection-1',
          channel_id: 'channel-1',
          name: '合集',
        } }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return new Response(JSON.stringify({ data: {
          id: 'channel-1',
          user_id: 'author-1',
          name: '频道',
          slug: 'real-channel',
        } }), { status: 200 })
      }
      if (url.includes('/blog/posts?collection_id=collection-1')) {
        return new Response(JSON.stringify({ data: [], meta: { page: 1, page_size: 100, total: 0, has_more: false } }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(CollectionView, {
      global: {
        stubs: {
          BookmarkFolderModal: true,
          PCard: { template: '<section><slot /></section>' },
          PEmpty: true,
          PEntry: true,
          PLink: true,
          PModal: {
            props: ['modelValue', 'title'],
            template: '<div v-if="modelValue" data-testid="modal"><slot /></div>',
          },
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PSectionHeader: true,
        },
      },
    })
    await flushPromises()

    const editButton = wrapper.findAll('button').find(button => button.text() === '编辑')
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '更新')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('保存失败，请重试')
  })

  it('删除合集被后端拒绝时保留确认框、显示嵌套错误且不导航', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ error: {
          code: 'blog.collection_forbidden',
          message: 'You do not have permission to delete this collection',
        } }), { status: 403 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    const confirmButton = wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('You do not have permission to delete this collection')
    expect(confirmButton.attributes('disabled')).toBeUndefined()
    expect(push).not.toHaveBeenCalled()
  })

  it('删除合集返回字符串错误时保留确认框、显示错误且不导航', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ error: '合集仍包含内容' }), { status: 409 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('合集仍包含内容')
    expect(push).not.toHaveBeenCalled()
  })

  it('删除合集遇到网络错误时保留确认框并显示错误', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.reject(new Error('offline'))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('网络错误，请重试')
    expect(push).not.toHaveBeenCalled()
  })

  it('删除请求未完成时重复确认只发送一个 DELETE', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const { PReject: _PReject, ...stubsWithRealReject } = ownerViewStubs
    const wrapper = mount(CollectionView, { global: { stubs: stubsWithRealReject } })
    await flushPromises()

    let resolveDelete!: (response: Response) => void
    const deleteResponse = new Promise<Response>((resolve) => { resolveDelete = resolve })
    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') return deleteResponse
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    const confirmButton = wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!
    await confirmButton.trigger('click')
    await confirmButton.trigger('click')

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(confirmButton.attributes('disabled')).toBeDefined()

    resolveDelete(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
    await flushPromises()
  })

  it('删除合集成功后关闭确认框、恢复 pending 并只导航一次', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/channels/real-channel')

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    const reopenedDeleteButton = wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(reopenedDeleteButton.attributes('disabled')).toBeUndefined()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it.each([
    {
      name: '失败',
      response: () => new Response(JSON.stringify({ error: {
        code: 'blog.collection_forbidden',
        message: 'A delete failed',
      } }), { status: 403 }),
    },
    {
      name: '成功',
      response: () => new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }),
    },
  ])('删除 A 的迟到$name响应不能污染、关闭或导航离开 B', async ({ response }) => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    let resolveDeleteA!: (response: Response) => void
    const deleteA = new Promise<Response>((resolve) => { resolveDeleteA = resolve })

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/blog/collections/collection-a') && init?.method === 'DELETE') return deleteA
      if (url.endsWith('/blog/collections/collection-a')) {
        return Promise.resolve(new Response(JSON.stringify({ data: {
          id: 'collection-a', channel_id: 'channel-1', name: '合集 A',
        } }), { status: 200 }))
      }
      if (url.endsWith('/blog/collections/collection-b')) {
        return Promise.resolve(new Response(JSON.stringify({ data: {
          id: 'collection-b', channel_id: 'channel-1', name: '合集 B',
        } }), { status: 200 }))
      }
      if (url.endsWith('/blog/channels/channel-1')) {
        return Promise.resolve(new Response(JSON.stringify({ data: {
          id: 'channel-1', user_id: 'author-1', name: '频道', slug: 'real-channel',
        } }), { status: 200 }))
      }
      if (url.includes('/blog/posts?collection_id=')) {
        return Promise.resolve(new Response(JSON.stringify({ data: [], meta: { page: 1, page_size: 100, total: 0, has_more: false } }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    }))

    const wrapper = mount(CollectionView, {
      props: { id: 'collection-a' },
      global: { stubs: ownerViewStubs },
    })
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await wrapper.setProps({ id: 'collection-b' })
    await flushPromises()
    if (wrapper.find('[data-testid="modal"]').exists()) {
      await wrapper.findAll('button').find(button => button.text() === '取消')!.trigger('click')
    }
    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    expect(wrapper.text()).toContain('合集 B')

    resolveDeleteA(response())
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('合集 B')
    expect(wrapper.text()).not.toContain('A delete failed')
    expect(push).not.toHaveBeenCalled()
  })

  it('组件卸载后删除成功的迟到响应不能导航', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    const wrapper = mountOwnerView()
    await flushPromises()

    let resolveDelete!: (response: Response) => void
    const deleteResponse = new Promise<Response>((resolve) => { resolveDelete = resolve })
    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') return deleteResponse
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    wrapper.unmount()
    resolveDelete(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
  })

  it('删除成功但导航失败时显示返回路径，重试只再次导航', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    push.mockRejectedValueOnce(new Error('navigation failed')).mockResolvedValueOnce(undefined)
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('合集已删除，请返回频道')
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(1)

    await wrapper.findAll('button').find(button => button.text() === '返回频道')!.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
  })

  it('router.push resolve NavigationFailure 时保留返回路径且重试不重复删除', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'author-1' } as typeof authStore.user
    push.mockResolvedValueOnce(routerFailureMocks.navigationFailure).mockResolvedValueOnce(undefined)
    const wrapper = mountOwnerView()
    await flushPromises()

    const initialFetch = vi.mocked(globalThis.fetch).getMockImplementation()!
    const fetchMock = vi.mocked(globalThis.fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/blog/collections/collection-1') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ data: { message: 'Collection deleted' } }), { status: 200 }))
      }
      return initialFetch(input, init)
    })

    await wrapper.findAll('button').find(button => button.text() === '删除')!.trigger('click')
    await wrapper.findAll('button').filter(button => button.text() === '删除').at(-1)!.trigger('click')
    await flushPromises()

    expect(routerFailureMocks.isNavigationFailure).toHaveBeenCalledWith(routerFailureMocks.navigationFailure)
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('合集已删除，请返回频道')
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(1)

    await wrapper.findAll('button').find(button => button.text() === '返回频道')!.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    expect(push).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
  })
})
