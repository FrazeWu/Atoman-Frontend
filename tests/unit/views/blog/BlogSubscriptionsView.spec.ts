import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import type { Subscription } from '@/types'
import BlogSubscriptionsView from '@/views/blog/BlogSubscriptionsView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>
let router: Router
const bookmarkOpen = vi.fn()

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const subscriptions: Subscription[] = [
  {
    id: 'sub-author',
    user_id: 'viewer',
    feed_source_id: 'source-author',
    title: '林默',
    subscription_group_id: 'group-people',
    feed_source: {
      id: 'source-author',
      source_type: 'internal_user',
      source_id: 'user-1',
      hash: 'author',
      title: '林默',
      cover_url: '/lin-avatar.jpg',
      created_at: '2026-07-01T00:00:00Z',
    },
    created_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'sub-channel',
    user_id: 'viewer',
    feed_source_id: 'source-channel',
    title: '纸上建筑',
    subscription_group_id: 'group-writing',
    feed_source: {
      id: 'source-channel',
      source_type: 'internal_channel',
      source_id: 'channel-1',
      hash: 'channel',
      title: '纸上建筑',
      cover_url: '/channel-cover.jpg',
      created_at: '2026-07-01T00:00:00Z',
    },
    created_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'sub-collection',
    user_id: 'viewer',
    feed_source_id: 'source-collection',
    title: '城市札记',
    subscription_group_id: 'group-writing',
    feed_source: {
      id: 'source-collection',
      source_type: 'internal_collection',
      source_id: 'collection-1',
      hash: 'collection',
      title: '城市札记',
      cover_url: '/collection-cover.jpg',
      created_at: '2026-07-01T00:00:00Z',
    },
    created_at: '2026-07-01T00:00:00Z',
  },
]

const makePost = (id: string, title: string) => ({
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
})

function timelineResponse(data: unknown[] = [], hasMore = false) {
  return new Response(JSON.stringify({
    data,
    meta: { page: 1, page_size: 12, total: data.length, has_more: hasMore },
  }), { status: 200 })
}

async function mountView(url = '/posts/subscriptions') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/posts/subscriptions', component: BlogSubscriptionsView },
      { path: '/posts/post/:id', component: { template: '<div>post</div>' } },
      { path: '/feed', component: { template: '<div>feed</div>' } },
    ],
  })
  await router.push(url)
  await router.isReady()

  const wrapper = mount(BlogSubscriptionsView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        BookmarkFolderModal: {
          template: '<div />',
          setup(_: unknown, { expose }: { expose: (value: unknown) => void }) {
            expose({ open: bookmarkOpen })
          },
        },
        PClip: true,
        PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function timelineUrls() {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('/feed/timeline'))
}

describe('BlogSubscriptionsView', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    bookmarkOpen.mockReset()
    fetchMock.mockImplementation(() => Promise.resolve(timelineResponse()))
    vi.stubGlobal('fetch', fetchMock)

    pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.token = 'token'
    authStore.user = { uuid: 'viewer', username: 'viewer', email: 'viewer@example.com' }

    const feedStore = useFeedStore()
    feedStore.subscriptions = subscriptions
    feedStore.groups = [
      { id: 'group-people', user_id: 'viewer', name: '人物', created_at: '', updated_at: '' },
      { id: 'group-writing', user_id: 'viewer', name: '写作', created_at: '', updated_at: '' },
    ]
    vi.spyOn(feedStore, 'fetchSubscriptions').mockResolvedValue(true)
    vi.spyOn(feedStore, 'fetchGroups').mockResolvedValue(true)
    vi.spyOn(feedStore, 'fetchBookmarkedPostIds').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchReadingListIds').mockResolvedValue(undefined)
  })

  it('等待订阅和分组加载后再保留并请求合法筛选', async () => {
    const feedStore = useFeedStore()
    const subscriptionsLoaded = deferred<void>()
    const groupsLoaded = deferred<void>()
    feedStore.subscriptions = []
    feedStore.groups = []
    vi.mocked(feedStore.fetchSubscriptions).mockImplementation(async () => {
      await subscriptionsLoaded.promise
      feedStore.subscriptions = subscriptions
      return true
    })
    vi.mocked(feedStore.fetchGroups).mockImplementation(async () => {
      await groupsLoaded.promise
      feedStore.groups = [
        { id: 'group-people', user_id: 'viewer', name: '人物', created_at: '', updated_at: '' },
      ]
      return true
    })

    await mountView('/posts/subscriptions?kind=author&group=group-people&source=sub-author')
    expect(timelineUrls()).toHaveLength(0)
    expect(router.currentRoute.value.query).toEqual({
      kind: 'author',
      group: 'group-people',
      source: 'sub-author',
    })

    subscriptionsLoaded.resolve()
    groupsLoaded.resolve()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({
      kind: 'author',
      group: 'group-people',
      source: 'sub-author',
    })
    expect(timelineUrls()).toHaveLength(1)
    expect(timelineUrls()[0]).toContain('group_id=group-people')
    expect(timelineUrls()[0]).toContain('source_id=sub-author')
  })

  it.each([
    { failedMethod: 'fetchSubscriptions' as const },
    { failedMethod: 'fetchGroups' as const },
  ])('$failedMethod 加载失败时保留 URL 并提供重试', async ({ failedMethod }) => {
    const feedStore = useFeedStore()
    vi.mocked(feedStore[failedMethod]).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const wrapper = await mountView('/posts/subscriptions?kind=author&group=missing&source=missing&keep=1')

    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).not.toContain('暂无作者订阅')
    expect(router.currentRoute.value.query).toEqual({
      kind: 'author',
      group: 'missing',
      source: 'missing',
      keep: '1',
    })
    expect(timelineUrls()).toHaveLength(0)

    await wrapper.get('[data-testid="retry-initialization"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ kind: 'author', keep: '1' })
    expect(timelineUrls()).toHaveLength(1)
  })

  it.each([
    {
      name: '非法分组',
      url: '/posts/subscriptions?kind=author&group=missing&source=sub-author',
      query: { kind: 'author' },
    },
    {
      name: '跨类别来源',
      url: '/posts/subscriptions?kind=author&source=sub-channel',
      query: { kind: 'author' },
    },
    {
      name: '跨分组来源',
      url: '/posts/subscriptions?kind=author&group=group-writing&source=sub-author',
      query: { kind: 'author' },
    },
    {
      name: '不存在来源',
      url: '/posts/subscriptions?kind=author&source=missing',
      query: { kind: 'author' },
    },
    {
      name: '数组参数',
      url: '/posts/subscriptions?kind=author&group=group-people&group=group-writing&source=sub-author&source=sub-channel',
      query: { kind: 'author' },
    },
  ])('清除$name且不把非法值发给时间线', async ({ url, query }) => {
    await mountView(url)

    expect(router.currentRoute.value.query).toEqual(query)
    expect(timelineUrls()).toHaveLength(1)
    const timelineUrl = timelineUrls()[0] ?? ''
    if (!('group' in query)) expect(timelineUrl).not.toContain('group_id=')
    if (!('source' in query)) expect(timelineUrl).not.toContain('source_id=')
  })

  it('缺失或非法 kind 时归一为作者，且顶部没有“全部”类别', async () => {
    const wrapper = await mountView('/posts/subscriptions?kind=invalid&keep=1')

    expect(wrapper.get('[data-testid="kind-author"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('作者')
    expect(wrapper.text()).toContain('频道')
    expect(wrapper.text()).toContain('合集')
    expect(wrapper.text()).not.toContain('全部')
    expect(router.currentRoute.value.query).toEqual({ kind: 'author', keep: '1' })

    wrapper.unmount()
    await mountView('/posts/subscriptions?keep=1')
    expect(router.currentRoute.value.query).toEqual({ keep: '1', kind: 'author' })
  })

  it('按类别展示站内来源，并给人物来源显示头像和名称', async () => {
    const wrapper = await mountView('/posts/subscriptions?kind=author')

    expect(wrapper.get('[data-source-id="sub-author"]').text()).toContain('林默')
    expect(wrapper.get('[data-source-id="sub-author"] img').attributes('src')).toBe('/lin-avatar.jpg')
    expect(wrapper.text()).not.toContain('纸上建筑')

    await wrapper.get('[data-testid="kind-channel"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('纸上建筑')
    expect(wrapper.text()).not.toContain('林默')
    expect(timelineUrls().at(-1)).toContain('source_type=internal_channel')

    await wrapper.get('[data-testid="kind-collection"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('城市札记')
    expect(wrapper.text()).not.toContain('纸上建筑')
    expect(timelineUrls().at(-1)).toContain('source_type=internal_collection')
  })

  it('切换类别保留无关 query，清空来源和页码，并使用对应后端来源类型', async () => {
    const wrapper = await mountView('/posts/subscriptions?kind=author&source=sub-author&page=3&keep=1')

    expect(timelineUrls().at(-1)).toContain('content_type=blog')
    expect(timelineUrls().at(-1)).toContain('source_type=internal_user')
    expect(timelineUrls().at(-1)).toContain('source_id=sub-author')

    await wrapper.get('[data-testid="kind-channel"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ kind: 'channel', keep: '1' })
    expect(timelineUrls().at(-1)).toContain('source_type=internal_channel')
    expect(timelineUrls().at(-1)).not.toContain('source_id=')
  })

  it('频道特有分组切到作者时清除 group、source 和 page', async () => {
    const wrapper = await mountView(
      '/posts/subscriptions?kind=channel&group=group-writing&source=sub-channel&page=4&keep=1',
    )
    expect(timelineUrls().at(-1)).toContain('group_id=group-writing')

    await wrapper.get('[data-testid="kind-author"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ kind: 'author', keep: '1' })
    expect(timelineUrls().at(-1)).toContain('source_type=internal_user')
    expect(timelineUrls().at(-1)).not.toContain('group_id=')
    expect(timelineUrls().at(-1)).not.toContain('source_id=')
  })

  it('分组和单一来源筛选写入 URL，并传给时间线请求', async () => {
    const wrapper = await mountView('/posts/subscriptions?kind=channel')

    expect(wrapper.get('.filter-chip').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-group-id="group-writing"]').attributes('aria-pressed')).toBe('false')

    await wrapper.get('[data-group-id="group-writing"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-group-id="group-writing"]').attributes('aria-pressed')).toBe('true')
    expect(router.currentRoute.value.query).toEqual({ kind: 'channel', group: 'group-writing' })
    expect(timelineUrls().at(-1)).toContain('group_id=group-writing')

    await wrapper.get('[data-source-id="sub-channel"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-source-id="sub-channel"]').attributes('aria-pressed')).toBe('true')
    expect(router.currentRoute.value.query).toEqual({
      kind: 'channel',
      group: 'group-writing',
      source: 'sub-channel',
    })
    expect(timelineUrls().at(-1)).toContain('source_type=internal_channel')
    expect(timelineUrls().at(-1)).toContain('source_id=sub-channel')
  })

  it('切换筛选请求失败时立即清除旧内容和加载更多', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('source_type=internal_user')) {
        return Promise.resolve(timelineResponse([
          { type: 'post', post: makePost('post-author', '作者旧文章') },
        ], true))
      }
      return Promise.resolve(new Response(null, { status: 503 }))
    })
    const wrapper = await mountView('/posts/subscriptions?kind=author')
    expect(wrapper.text()).toContain('作者旧文章')
    expect(wrapper.find('[data-testid="load-more"]').exists()).toBe(true)

    await wrapper.get('[data-testid="kind-channel"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('作者旧文章')
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.find('[data-testid="load-more"]').exists()).toBe(false)
  })

  it('严格使用 meta.has_more 控制加载更多', async () => {
    fetchMock.mockResolvedValue(timelineResponse([
      { type: 'post', post: makePost('post-1', '一篇更新') },
    ], true))

    const wrapper = await mountView('/posts/subscriptions?kind=author')

    expect(wrapper.text()).toContain('一篇更新')
    expect(wrapper.get('[data-testid="load-more"]').exists()).toBe(true)
  })

  it('分页失败后不推进页码，重试仍请求同一页且不混入失败数据', async () => {
    let pageTwoAttempts = 0
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('page=1')) {
        return Promise.resolve(timelineResponse([
          { type: 'post', post: makePost('post-1', '第一页文章') },
        ], true))
      }
      pageTwoAttempts += 1
      if (pageTwoAttempts === 1) return Promise.resolve(new Response(null, { status: 503 }))
      return Promise.resolve(timelineResponse([
        { type: 'post', post: makePost('post-2', '第二页文章') },
      ], false))
    })
    const wrapper = await mountView('/posts/subscriptions?kind=author')

    await wrapper.get('[data-testid="load-more"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).not.toContain('第二页文章')

    await wrapper.get('[data-testid="retry-timeline"]').trigger('click')
    await flushPromises()

    const pages = timelineUrls().map((url) => new URL(url, 'http://localhost').searchParams.get('page'))
    expect(pages).toEqual(['1', '2', '2'])
    expect(wrapper.text()).toContain('第一页文章')
    expect(wrapper.text()).toContain('第二页文章')
    expect(wrapper.findAll('.p-entry')).toHaveLength(2)
  })

  it('快速切换类别时只采用最新时间线响应', async () => {
    const authorResponse = deferred<Response>()
    const channelResponse = deferred<Response>()
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('source_type=internal_user')) return authorResponse.promise
      if (url.includes('source_type=internal_channel')) return channelResponse.promise
      return Promise.resolve(timelineResponse())
    })
    const wrapper = await mountView('/posts/subscriptions?kind=author')

    await wrapper.get('[data-testid="kind-channel"]').trigger('click')
    await flushPromises()
    channelResponse.resolve(timelineResponse([
      { type: 'post', post: makePost('post-channel', '频道新文章') },
    ]))
    await flushPromises()
    authorResponse.resolve(timelineResponse([
      { type: 'post', post: makePost('post-author', '作者旧文章') },
    ], true))
    await flushPromises()

    expect(wrapper.text()).toContain('频道新文章')
    expect(wrapper.text()).not.toContain('作者旧文章')
    expect(wrapper.find('[data-testid="load-more"]').exists()).toBe(false)
  })

  it('保留文章点击、键盘打开、收藏和稍后阅读交互', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(timelineResponse([
      { type: 'post', post: makePost('post-1', '交互文章') },
    ])))
    const feedStore = useFeedStore()
    const toggleReadingListItem = vi.spyOn(feedStore, 'toggleReadingListItem').mockResolvedValue(true)
    const uiStore = useUIStore()
    uiStore.focusedSection = 'sidebar'
    const wrapper = await mountView('/posts/subscriptions?kind=author')
    uiStore.focusedSection = 'content'
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }))
    expect(bookmarkOpen).toHaveBeenCalledWith('post-1')
    expect(toggleReadingListItem).toHaveBeenCalledWith('post-1', 'post')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/posts/post/post-1')

    await router.replace('/posts/subscriptions?kind=author')
    await flushPromises()
    await wrapper.get('.p-entry').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/posts/post/post-1')
  })

  it('区分没有该类订阅和有来源但暂无文章', async () => {
    const feedStore = useFeedStore()
    feedStore.subscriptions = subscriptions.filter((subscription) => subscription.id !== 'sub-author')
    const wrapper = await mountView('/posts/subscriptions?kind=author')
    expect(wrapper.text()).toContain('暂无作者订阅')

    feedStore.subscriptions = subscriptions
    await router.replace({ path: '/posts/subscriptions', query: { kind: 'author' } })
    await flushPromises()
    expect(wrapper.text()).toContain('暂无更新')
    expect(wrapper.text()).not.toContain('暂无作者订阅')
  })

  it('管理订阅跳转到统一订阅模块', async () => {
    const wrapper = await mountView('/posts/subscriptions?kind=author')

    await wrapper.get('[data-testid="manage-subscriptions"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/feed?manage_subscriptions=1')
  })
})
