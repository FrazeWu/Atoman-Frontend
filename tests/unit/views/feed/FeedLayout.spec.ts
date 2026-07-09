import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedLayout from '@/views/feed/FeedLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import type { Subscription, SubscriptionGroup } from '@/types'

const groups: SubscriptionGroup[] = [
  {
    id: 'g-tech',
    user_id: 'user-1',
    name: '科技生活',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

const subscriptions: Subscription[] = [
  {
    id: 'sub-1',
    user_id: 'user-1',
    feed_source_id: 'source-1',
    title: '少数派',
    subscription_group_id: 'g-tech',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sub-2',
    user_id: 'user-1',
    feed_source_id: 'source-2',
    title: '英格兰周报',
    subscription_group_id: 'g-tech',
    created_at: '2026-01-01T00:00:00Z',
  },
]

const makeRouter = async (initialPath = '/feed') => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/feed', component: { template: '<div />' } },
      { path: '/feed/explore', component: { template: '<div />' } },
      { path: '/feed/reading-list', component: { template: '<div />' } },
      { path: '/feed/starred', component: { template: '<div />' } },
    ],
  })

  await router.push(initialPath)
  await router.isReady()
  return router
}

const mountLayout = async (initialPath = '/', authenticated = true) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const authStore = useAuthStore()
  authStore.token = authenticated ? 'token' : null
  authStore.user = authenticated ? { username: 'fafa', email: 'fafa@example.com' } : null
  authStore.isAuthenticated = authenticated

  const feedStore = useFeedStore()
  feedStore.subscriptions = subscriptions
  feedStore.groups = groups
  vi.spyOn(feedStore, 'fetchSubscriptions').mockResolvedValue(undefined)
  vi.spyOn(feedStore, 'fetchGroups').mockResolvedValue(undefined)

  const router = await makeRouter(initialPath)
  const pushSpy = vi.spyOn(router, 'push')

  const wrapper = mount(FeedLayout, {
    global: {
      plugins: [pinia, router],
    },
  })

  await flushPromises()
  pushSpy.mockClear()

  return { wrapper, router, pushSpy }
}

describe('FeedLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders nav rows with Ionicon SVG icons and sidebar sources', async () => {
    const { wrapper } = await mountLayout('/feed?source_id=sub-1')

    expect(wrapper.findAll('.p-sidebar-item')).toHaveLength(4)
    expect(wrapper.findAll('.p-sidebar-item-icon svg')).toHaveLength(4)
    expect(wrapper.text()).toContain('订阅源类别 / SOURCES')
    expect(wrapper.text()).toContain('少数派')
    expect(wrapper.get('[data-source-id="sub-1"]').classes()).toContain('is-active')
  })

  it('routes to the selected source when a sidebar source is clicked', async () => {
    const { wrapper, pushSpy } = await mountLayout('/feed')

    await wrapper.get('[data-source-id="sub-1"]').trigger('click')

    expect(pushSpy).toHaveBeenCalledWith({ path: '/feed', query: { source_id: 'sub-1' } })
  })

  it('shows unread counts from the loaded feed timeline', async () => {
    const { wrapper } = await mountLayout('/feed')
    const feedStore = useFeedStore()

    feedStore.timeline = [
      {
        type: 'feed_item',
        is_read: false,
        published_at: '2026-01-01T00:00:00Z',
        feed_item: {
          id: 'item-1',
          feed_source_id: 'source-1',
          guid: 'item-1',
          title: '未读文章',
          link: 'https://example.com/1',
          summary: '',
          author: '',
          published_at: '2026-01-01T00:00:00Z',
          fetched_at: '2026-01-01T00:00:00Z',
        },
      },
      {
        type: 'feed_item',
        is_read: true,
        published_at: '2026-01-01T00:00:00Z',
        feed_item: {
          id: 'item-2',
          feed_source_id: 'source-2',
          guid: 'item-2',
          title: '已读文章',
          link: 'https://example.com/2',
          summary: '',
          author: '',
          published_at: '2026-01-01T00:00:00Z',
          fetched_at: '2026-01-01T00:00:00Z',
        },
      },
    ]
    await flushPromises()

    expect(wrapper.get('[data-test="feed-sidebar-unread-count-sub-1"]').text()).toBe('1')
    expect(wrapper.find('[data-test="feed-sidebar-unread-count-sub-2"]').exists()).toBe(false)
  })

  it('prefers server unread counts over the current timeline page', async () => {
    const { wrapper } = await mountLayout('/feed')
    const feedStore = useFeedStore()

    feedStore.subscriptions = [
      { ...subscriptions[0], unread_count: 5 },
      { ...subscriptions[1], unread_count: 0 },
    ]
    feedStore.timeline = [
      {
        type: 'feed_item',
        is_read: false,
        published_at: '2026-01-01T00:00:00Z',
        feed_item: {
          id: 'item-1',
          feed_source_id: 'source-1',
          guid: 'item-1',
          title: '当前页未读',
          link: 'https://example.com/1',
          summary: '',
          author: '',
          published_at: '2026-01-01T00:00:00Z',
          fetched_at: '2026-01-01T00:00:00Z',
        },
      },
    ]
    await flushPromises()

    expect(wrapper.get('[data-test="feed-sidebar-unread-count-sub-1"]').text()).toBe('5')
    expect(wrapper.find('[data-test="feed-sidebar-unread-count-sub-2"]').exists()).toBe(false)
  })

  it('opens the manage sheet from the sidebar sources manage button', async () => {
    const { wrapper, pushSpy } = await mountLayout('/feed')

    await wrapper.get('[data-testid="feed-sidebar-manage"]').trigger('click')

    expect(pushSpy).toHaveBeenCalledWith({ path: '/feed', query: { manage_subscriptions: '1' } })
  })

  it('opens the feed mobile sources sheet from the header action and reuses source actions', async () => {
    const { wrapper, pushSpy } = await mountLayout('/feed')

    expect(wrapper.find('[data-testid="feed-mobile-sources-trigger"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists()).toBe(false)

    await wrapper.get('[data-testid="feed-mobile-sources-trigger"]').trigger('click')
    await flushPromises()

    const sheet = wrapper.get('[data-testid="feed-mobile-sources-sheet"]')
    expect(sheet.text()).toContain('订阅源类别 / SOURCES')
    expect(sheet.text()).toContain('少数派')

    await sheet.get('[data-source-id="sub-1"]').trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith({ path: '/feed', query: { source_id: 'sub-1' } })
    expect(wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists()).toBe(false)

    pushSpy.mockClear()

    await wrapper.get('[data-testid="feed-mobile-sources-trigger"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="feed-mobile-sources-sheet"]').get('[data-testid="feed-sidebar-manage"]').trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith({
      path: '/feed',
      query: { source_id: 'sub-1', manage_subscriptions: '1' },
    })
    expect(wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists()).toBe(false)
  })

  it('does not expose the mobile sources entry point when signed out', async () => {
    const { wrapper } = await mountLayout('/feed', false)

    expect(wrapper.find('[data-testid="feed-mobile-sources-trigger"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="feed-mobile-sources-sheet"]').exists()).toBe(false)
  })

  it('clears stale sidebar sources when auth state becomes signed out', async () => {
    const { wrapper } = await mountLayout('/feed')
    const authStore = useAuthStore()
    const feedStore = useFeedStore()

    expect(wrapper.text()).toContain('少数派')

    authStore.isAuthenticated = false
    authStore.token = null
    authStore.user = null
    await flushPromises()

    expect(feedStore.subscriptions).toEqual([])
    expect(feedStore.groups).toEqual([])
    expect(wrapper.text()).not.toContain('少数派')
  })

  it('refetches sidebar sources when an auth token becomes available after mount', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const authStore = useAuthStore()
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.token = null
    authStore.isAuthenticated = true

    const feedStore = useFeedStore()
    feedStore.subscriptions = []
    feedStore.groups = groups
    const fetchSubscriptions = vi.spyOn(feedStore, 'fetchSubscriptions').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchGroups').mockResolvedValue(undefined)

    const router = await makeRouter('/feed')
    mount(FeedLayout, {
      global: {
        plugins: [pinia, router],
      },
    })

    await flushPromises()
    expect(fetchSubscriptions).toHaveBeenCalledTimes(1)

    authStore.token = 'token'
    await flushPromises()

    expect(fetchSubscriptions).toHaveBeenCalledTimes(2)
  })
})
