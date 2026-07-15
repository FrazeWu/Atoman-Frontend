import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import type { Subscription } from '@/types'
import BlogSubscriptionsView from '@/views/blog/BlogSubscriptionsView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>
let router: Router

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
      { path: '/feed', component: { template: '<div>feed</div>' } },
    ],
  })
  await router.push(url)
  await router.isReady()

  const wrapper = mount(BlogSubscriptionsView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        BookmarkFolderModal: true,
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
    fetchMock.mockResolvedValue(timelineResponse())
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
    vi.spyOn(feedStore, 'fetchSubscriptions').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchGroups').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchBookmarkedPostIds').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchReadingListIds').mockResolvedValue(undefined)
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

  it('分组和单一来源筛选写入 URL，并传给时间线请求', async () => {
    const wrapper = await mountView('/posts/subscriptions?kind=channel')

    await wrapper.get('[data-group-id="group-writing"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ kind: 'channel', group: 'group-writing' })
    expect(timelineUrls().at(-1)).toContain('group_id=group-writing')

    await wrapper.get('[data-source-id="sub-channel"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      kind: 'channel',
      group: 'group-writing',
      source: 'sub-channel',
    })
    expect(timelineUrls().at(-1)).toContain('source_type=internal_channel')
    expect(timelineUrls().at(-1)).toContain('source_id=sub-channel')
  })

  it('严格使用 meta.has_more 控制加载更多', async () => {
    fetchMock.mockResolvedValue(timelineResponse([
      { type: 'post', post: makePost('post-1', '一篇更新') },
    ], true))

    const wrapper = await mountView('/posts/subscriptions?kind=author')

    expect(wrapper.text()).toContain('一篇更新')
    expect(wrapper.get('[data-testid="load-more"]').exists()).toBe(true)
  })

  it('区分没有该类订阅和有来源但暂无文章', async () => {
    const wrapper = await mountView('/posts/subscriptions?kind=author&group=group-writing')
    expect(wrapper.text()).toContain('暂无作者订阅')

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
