import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedView from '@/views/feed/FeedView.vue'
import OnboardingFeedRecommendations from '@/components/onboarding/OnboardingFeedRecommendations.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useOnboardingStore } from '@/stores/onboarding'
import { usePlayerStore } from '@/stores/player'

const { navigateModuleWithShutter, routerPush, routerReplace, routeQuery } = vi.hoisted(() => ({
  navigateModuleWithShutter: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  routeQuery: {} as Record<string, string>,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  useRoute: () => ({ query: routeQuery }),
}))

vi.mock('@/composables/useAsyncNavigate', () => ({
  useAsyncNavigate: () => ({
    navigateModuleWithShutter,
  }),
}))

const feedViewStubs = {
  PButton: true,
  PModal: true,
  PEmpty: true,
  PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
  PSelect: true,
  PField: true,
  PPress: { props: ['label'], template: '<button type="button">{{ label }}</button>' },
  PBadge: { template: '<span><slot /></span>' },
  PClip: {
    props: ['label'],
    emits: ['click'],
    template: '<button type="button" class="p-clip-stub" @click="$emit(\'click\')">{{ label }}</button>',
  },
  PShortcutHints: true,
  SubscriptionAddSheet: true,
  SubscriptionManageSheet: true,
  FeedArticleSheet: true,
  FeedSourceArticlesSheet: true,
}

const clusteredTimelineResponse = (isRead = false) => ({
  data: [{
    type: 'feed_item',
    feed_item: {
      id: 'cluster-primary',
      feed_source_id: 'source-a',
      feed_source: { id: 'source-a', source_type: 'external_rss', title: 'Source A' },
      guid: 'cluster-primary',
      title: '同题报道',
      link: 'https://example.com/story',
      summary: '摘要',
      author: '作者',
      published_at: '2026-07-19T00:00:00Z',
      fetched_at: '2026-07-19T00:00:00Z',
      duplicate_count: 2,
      duplicate_sources: ['Source A', 'Source B'],
      duplicate_item_ids: ['cluster-primary', 'cluster-copy'],
    },
    published_at: '2026-07-19T00:00:00Z',
    is_read: isRead,
  }],
  meta: { page: 1, page_size: 20, total: 1, has_more: false },
})

describe('FeedView', () => {
  beforeEach(() => {
    navigateModuleWithShutter.mockReset()
    routerPush.mockReset()
    routerReplace.mockReset()
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
    setActivePinia(createPinia())
    window.history.replaceState(null, '', '/?site=feed')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'post',
          post: {
            id: 'post-1',
            user_id: 'user-1',
            title: '内部文章',
            content: '正文',
            summary: '摘要',
            status: 'published',
            visibility: 'public',
            allow_comments: true,
            pinned: false,
            created_at: '2026-05-31T00:00:00Z',
            updated_at: '2026-05-31T00:00:00Z',
          },
          published_at: '2026-05-31T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true

    const feedStore = useFeedStore()
    feedStore.fetchSubscriptions = vi.fn().mockResolvedValue(undefined) as any
    feedStore.fetchGroups = vi.fn().mockResolvedValue(undefined) as any
    feedStore.fetchSubscriptionRules = vi.fn().mockResolvedValue(undefined) as any
    feedStore.createSubscriptionRule = vi.fn().mockImplementation(async (payload) => {
      feedStore.subscriptionRules = [
        {
          id: 'rule-1',
          position: 0,
          ...payload,
        },
      ] as any
      return true
    }) as any
    feedStore.updateSubscriptionRule = vi.fn().mockResolvedValue(true) as any
    feedStore.deleteSubscriptionRule = vi.fn().mockResolvedValue(true) as any
    feedStore.reorderSubscriptionRules = vi.fn().mockResolvedValue(true) as any
    feedStore.applySubscriptionRules = vi.fn().mockResolvedValue(true) as any
  })

  it('merges duplicate stories by default and persists an explicit off state', async () => {
    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()

    const timelineCall = vi.mocked(globalThis.fetch).mock.calls.find(([input]) => String(input).includes('/feed/timeline?'))
    expect(String(timelineCall?.[0])).toContain('hide_duplicates=true')
    const toggle = wrapper.get('[data-test="feed-merge-duplicates"]')
    expect((toggle.element as HTMLInputElement).checked).toBe(true)

    await toggle.setValue(false)
    await flushPromises()
    expect(routerReplace).toHaveBeenLastCalledWith({
      query: expect.objectContaining({ merge_duplicates: 'false', page: undefined }),
    })
  })

  it('keeps a single source timeline unmerged and hides the merge control', async () => {
    routeQuery.source_id = 'subscription-a'
    const feedStore = useFeedStore()
    feedStore.subscriptions = [{
      id: 'subscription-a',
      user_id: 'viewer',
      feed_source_id: 'source-a',
      title: 'Source A',
      created_at: '2026-01-01T00:00:00Z',
    }]

    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()

    const timelineCall = vi.mocked(globalThis.fetch).mock.calls.find(([input]) => String(input).includes('/feed/timeline?'))
    expect(String(timelineCall?.[0])).not.toContain('hide_duplicates=true')
    expect(wrapper.find('[data-test="feed-merge-duplicates"]').exists()).toBe(false)
  })

  it('restores the explicit unmerged route state', async () => {
    routeQuery.merge_duplicates = 'false'
    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()

    const timelineCall = vi.mocked(globalThis.fetch).mock.calls.find(([input]) => String(input).includes('/feed/timeline?'))
    expect(String(timelineCall?.[0])).not.toContain('hide_duplicates=true')
    expect((wrapper.get('[data-test="feed-merge-duplicates"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('shows duplicate sources and marks the whole cluster read while saving only the primary', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).includes('/feed/timeline?')) {
        return new Response(JSON.stringify(clusteredTimelineResponse()), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    const feedStore = useFeedStore()
    const markRead = vi.spyOn(feedStore, 'markItemsRead').mockResolvedValue(true)
    const toggleStar = vi.spyOn(feedStore, 'toggleStar').mockResolvedValue(undefined as any)
    const toggleReadingList = vi.spyOn(feedStore, 'toggleReadingListItem').mockResolvedValue(undefined as any)

    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('来自 2 个来源')
    expect(wrapper.find('[data-test="feed-duplicate-sources"]').exists()).toBe(false)
    await wrapper.get('[data-test="feed-duplicate-toggle"]').trigger('click')
    expect(wrapper.get('[data-test="feed-duplicate-sources"]').text()).toContain('Source A')
    expect(wrapper.get('[data-test="feed-duplicate-sources"]').text()).toContain('Source B')

    await wrapper.get('.p-entry').trigger('click')
    await flushPromises()
    expect(markRead).toHaveBeenCalledWith(['cluster-primary', 'cluster-copy'])

    await wrapper.findAll('.p-clip-stub').find((button) => button.text() === '收藏')!.trigger('click')
    await wrapper.findAll('.p-clip-stub').find((button) => button.text() === '稍后阅读')!.trigger('click')
    expect(toggleStar).toHaveBeenCalledWith('cluster-primary')
    expect(toggleReadingList).toHaveBeenCalledWith('cluster-primary')
  })

  it('groups duplicate source details in a responsive summary block', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).includes('/feed/timeline?')) {
        return new Response(JSON.stringify(clusteredTimelineResponse()), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })

    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()

    const summary = wrapper.get('[data-test="feed-duplicate-summary"]')
    expect(summary.get('[data-test="feed-duplicate-toggle"]').exists()).toBe(true)
    await summary.get('[data-test="feed-duplicate-toggle"]').trigger('click')
    expect(summary.get('[data-test="feed-duplicate-sources"]').text()).toContain('Source B')
  })

  it('rolls a clustered item back to unread when group marking fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).includes('/feed/timeline?')) {
        return new Response(JSON.stringify(clusteredTimelineResponse()), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'markItemsRead').mockResolvedValue(false)

    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()
    await wrapper.get('.p-entry').trigger('click')
    await flushPromises()

    expect(feedStore.markItemsRead).toHaveBeenCalledWith(['cluster-primary', 'cluster-copy'])
    expect(wrapper.get('.p-entry').classes()).not.toContain('is-read')
  })

  it('rolls a source article back to unread when marking fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).includes('/feed/timeline?')) {
        return new Response(JSON.stringify(clusteredTimelineResponse()), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'markItemsRead').mockResolvedValue(false)
    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()
    const sourceItem = JSON.parse(JSON.stringify((wrapper.vm as any).timeline[0]))
    ;(wrapper.vm as any).sourceArticles = [sourceItem]

    ;(wrapper.vm as any).openSourceArticle(sourceItem)
    await flushPromises()

    expect(sourceItem.is_read).toBe(false)
  })

  it('marks the whole cluster unread from the timeline read toggle', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).includes('/feed/timeline?')) {
        return new Response(JSON.stringify(clusteredTimelineResponse(true)), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    const feedStore = useFeedStore()
    const markUnread = vi.spyOn(feedStore, 'markItemsUnread').mockResolvedValue(true)

    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()
    ;(wrapper.vm as any).toggleRead((wrapper.vm as any).timeline[0])
    await flushPromises()

    expect(markUnread).toHaveBeenCalledWith(['cluster-primary', 'cluster-copy'])
  })

  it('marks the whole cluster read when podcast playback starts', async () => {
    const response = clusteredTimelineResponse()
    Object.assign(response.data[0].feed_item, {
      enclosure_url: 'https://example.com/episode.mp3',
      enclosure_type: 'audio/mpeg',
    })
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).includes('/feed/timeline?')) {
        return new Response(JSON.stringify(response), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    const feedStore = useFeedStore()
    const markRead = vi.spyOn(feedStore, 'markItemsRead').mockResolvedValue(true)
    const playerStore = usePlayerStore()
    vi.spyOn(playerStore, 'playQueuedSong').mockImplementation(() => undefined)
    const wrapper = mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()

    ;(wrapper.vm as any).playFeedItemFromSheet((wrapper.vm as any).timeline[0].feed_item)
    await flushPromises()

    expect(markRead).toHaveBeenCalledWith(['cluster-primary', 'cluster-copy'])
  })

  it('expands auto-read to the cluster but auto-saves only the primary item', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).includes('/feed/timeline?')) {
        return new Response(JSON.stringify(clusteredTimelineResponse()), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    const feedStore = useFeedStore()
    feedStore.subscriptions = [{
      id: 'subscription-a',
      user_id: 'viewer',
      feed_source_id: 'source-a',
      feed_source: { id: 'source-a', source_type: 'external_rss', hash: 'source-a', created_at: '2026-01-01T00:00:00Z' },
      title: 'Source A',
      auto_mark_read: true,
      auto_add_reading_list: true,
      created_at: '2026-01-01T00:00:00Z',
    }]
    const markRead = vi.spyOn(feedStore, 'markItemsRead').mockResolvedValue(true)
    const toggleReadingList = vi.spyOn(feedStore, 'toggleReadingListItem').mockResolvedValue(undefined as any)

    mount(FeedView, { global: { stubs: feedViewStubs } })
    await flushPromises()

    expect(markRead).toHaveBeenCalledWith(['cluster-primary', 'cluster-copy'])
    expect(toggleReadingList).toHaveBeenCalledWith('cluster-primary')
  })

  it('subscribes selected onboarding recommendations and completes after one success', async () => {
    const feedStore = useFeedStore()
    const onboardingStore = useOnboardingStore()
    const recommendations = [
      { id: 'rec-1', feed_source_id: 'source-1', enabled: true, sort_order: 1, title: 'One', category: 'blog', rss_url: 'https://one.example/feed', cover_url: '', health_status: 'healthy' },
      { id: 'rec-2', feed_source_id: 'source-2', enabled: true, sort_order: 2, title: 'Two', category: 'blog', rss_url: 'https://two.example/feed', cover_url: '', health_status: 'healthy' },
    ]
    onboardingStore.isVisible = true
    onboardingStore.recommendations = recommendations
    vi.spyOn(onboardingStore, 'loadRecommendations').mockResolvedValue(undefined)
    const completeSpy = vi.spyOn(onboardingStore, 'complete').mockResolvedValue(true)
    const subscribeSpy = vi.spyOn(feedStore, 'subscribeToRSS').mockImplementation(async (url) => url.includes('one'))

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PPress: true,
          PBadge: true,
          PShortcutHints: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })
    await flushPromises()

    const panel = wrapper.findComponent(OnboardingFeedRecommendations)
    expect(panel.exists()).toBe(true)
    panel.vm.$emit('subscribe', recommendations)
    await flushPromises()

    expect(subscribeSpy).toHaveBeenCalledTimes(2)
    expect(completeSpy).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('已订阅 1 个来源，1 个未成功')
  })

  it('opens internal posts in the feed article sheet', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: { props: ['text'], template: '<div data-test="empty-state">{{ text }}</div>' },
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.get('.p-entry').trigger('click')

    expect(routerPush).not.toHaveBeenCalled()
    expect(navigateModuleWithShutter).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/feed/timeline/mark-read'))).toBe(false)
    expect(wrapper.findComponent({ name: 'FeedArticleSheet' }).exists()).toBe(true)
  })

  it('shows pagination from timeline meta total', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-1',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-1',
            title: '订阅条目',
            link: 'https://example.com/item',
            summary: '摘要',
            author: '作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 40, has_more: true },
    }), { status: 200 }))

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: { props: ['text'], template: '<div data-test="empty-state">{{ text }}</div>' },
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    const pageButtons = wrapper.findAll('.feed-page-number').map((button) => button.text())
    expect(pageButtons).toContain('2')
  })

  it('does not show anonymous timeline items on the subscription home', async () => {
    const authStore = useAuthStore()
    authStore.token = ''
    authStore.user = null as any
    authStore.isAuthenticated = false

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: { props: ['text'], template: '<div data-test="empty-state">{{ text }}</div>' },
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('订阅后开始探索')
    expect(wrapper.text()).not.toContain('内部文章')
  })

  it('positions the add subscription sheet directly below the sticky header without double-counting the top bar', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: { props: ['text'], template: '<div data-test="empty-state">{{ text }}</div>' },
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          SubscriptionAddSheet: {
            name: 'SubscriptionAddSheet',
            props: ['show', 'top'],
            template: '<div data-test="add-sheet-probe" :data-show="String(show)" :data-top="top"></div>',
          },
        },
      },
    })

    await flushPromises()

    const headerRef = wrapper.vm.$refs.headerRef as HTMLElement
    Object.defineProperty(headerRef, 'offsetHeight', { configurable: true, value: 160 })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    const sheet = wrapper.get('[data-test="add-sheet-probe"]')
    expect(sheet.attributes('data-show')).toBe('true')
    expect(sheet.attributes('data-top')).toBe('160px')
  })

  it('does not render feed-item-only actions for internal posts', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: { props: ['text'], template: '<div data-test="empty-state">{{ text }}</div>' },
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: { name: 'PClip', props: ['label'], template: '<button>{{ label }}</button>' },
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    const actionLabels = wrapper.findAll('button').map((button) => button.text())
    expect(actionLabels).not.toContain('收藏')
    expect(actionLabels).not.toContain('稍后阅读')
  })

  it('shows channel source names for internal subscription posts and opens the source article sheet', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'post',
          post: {
            id: 'post-1',
            user_id: 'user-1',
            channel_id: 'channel-1',
            channel: { id: 'channel-1', name: '思想频道', slug: 'think' },
            user: { username: 'alice', email: 'alice@example.com', display_name: 'Alice' },
            title: '内部文章',
            content: '正文',
            summary: '摘要',
            status: 'published',
            visibility: 'public',
            allow_comments: true,
            pinned: false,
            created_at: '2026-05-31T00:00:00Z',
            updated_at: '2026-05-31T00:00:00Z',
          },
          published_at: '2026-05-31T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-channel-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-channel-1',
        title: '思想频道',
        feed_source: {
          id: 'source-channel-1',
          source_type: 'internal_channel',
          source_id: 'channel-1',
          hash: 'internal-channel:channel-1',
          title: '思想频道',
          created_at: '2026-01-01T00:00:00Z',
        },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: {
            name: 'FeedSourceArticlesSheet',
            props: ['show', 'source', 'items'],
            template: '<section data-test="source-sheet" :data-show="String(show)"><h2>{{ source?.title }}</h2><article v-for="item in items" :key="item.post?.id || item.feed_item?.id">{{ item.post?.title || item.feed_item?.title }}</article></section>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('.feed-entry-meta').text()).toContain('思想频道')
    expect(wrapper.find('.feed-entry-meta').text()).not.toContain('Alice')

    const trigger = wrapper.get('[data-test="feed-source-trigger"]')
    expect(trigger.element.tagName).toBe('BUTTON')
    expect(trigger.classes()).not.toContain('a-muted')
    expect(trigger.attributes('title')).toBe('查看 思想频道 的所有文章')
    expect(trigger.attributes('aria-label')).toBe('查看 思想频道 的所有文章')

    await trigger.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="source-sheet"]').attributes('data-show')).toBe('true')
    expect(wrapper.get('[data-test="source-sheet"]').text()).toContain('思想频道')
    expect(wrapper.get('[data-test="source-sheet"]').text()).toContain('内部文章')
  })

  it('shows RSS source names for external subscription items and opens the source article sheet', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-1',
            feed_source_id: 'source-rss-1',
            feed_source: {
              id: 'source-rss-1',
              source_type: 'external_rss',
              title: 'Example RSS',
              rss_url: 'https://example.com/feed.xml',
            },
            guid: 'feed-item-1',
            title: '外部条目',
            link: 'https://example.com/item',
            summary: '摘要',
            author: '外部作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-rss-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-rss-1',
        title: 'Example RSS',
        feed_source: {
          id: 'source-rss-1',
          source_type: 'external_rss',
          rss_url: 'https://example.com/feed.xml',
          hash: 'external-rss:example',
          title: 'Example RSS',
          created_at: '2026-01-01T00:00:00Z',
        },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: {
            name: 'FeedSourceArticlesSheet',
            props: ['show', 'source', 'items'],
            template: '<section data-test="source-sheet" :data-show="String(show)"><h2>{{ source?.title }}</h2><article v-for="item in items" :key="item.post?.id || item.feed_item?.id">{{ item.post?.title || item.feed_item?.title }}</article></section>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('.feed-entry-meta').text()).toContain('Example RSS')
    expect(wrapper.find('.feed-entry-meta').text()).not.toContain('外部作者')

    const trigger = wrapper.get('[data-test="feed-source-trigger"]')
    expect(trigger.element.tagName).toBe('BUTTON')
    expect(trigger.classes()).not.toContain('a-muted')
    expect(trigger.attributes('title')).toBe('查看 Example RSS 的所有文章')
    expect(trigger.attributes('aria-label')).toBe('查看 Example RSS 的所有文章')

    await trigger.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="source-sheet"]').attributes('data-show')).toBe('true')
    expect(wrapper.get('[data-test="source-sheet"]').text()).toContain('Example RSS')
    expect(wrapper.get('[data-test="source-sheet"]').text()).toContain('外部条目')
  })

  it('shows current source context and returns to all subscriptions', async () => {
    routeQuery.source_id = 'sub-rss-1'
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-1',
            feed_source_id: 'source-rss-1',
            feed_source: {
              id: 'source-rss-1',
              source_type: 'external_rss',
              title: 'Example RSS',
              rss_url: 'https://example.com/feed.xml',
            },
            guid: 'feed-item-1',
            title: '外部条目',
            link: 'https://example.com/item',
            summary: '摘要',
            author: '外部作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-rss-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-rss-1',
        title: 'Example RSS',
        unread_count: 3,
        feed_source: {
          id: 'source-rss-1',
          source_type: 'external_rss',
          rss_url: 'https://example.com/feed.xml',
          hash: 'external-rss:example',
          title: 'Example RSS',
          created_at: '2026-01-01T00:00:00Z',
        },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="feed-current-source"]').text()).toContain('Example RSS')
    expect(wrapper.get('[data-test="feed-current-source"]').text()).toContain('3')

    await wrapper.get('[data-test="feed-clear-source"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith({
      query: {
        source_id: undefined,
        group_id: undefined,
        page: undefined,
      },
    })
  })

  it('marks the current source read while in a source view', async () => {
    routeQuery.source_id = 'sub-rss-1'
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/timeline/mark-read')) {
        return new Response(null, { status: 204 })
      }
      if (url.includes('/feed/subscriptions')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: [
          {
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-1',
              feed_source_id: 'source-rss-1',
              feed_source: { id: 'source-rss-1', source_type: 'external_rss', title: 'Example RSS' },
              guid: 'feed-item-1',
              title: '外部条目',
              link: 'https://example.com/item',
              summary: '摘要',
              author: '外部作者',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          },
        ],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      }), { status: 200 })
    })

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-rss-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-rss-1',
        title: 'Example RSS',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    const markItemsRead = vi.spyOn(feedStore, 'markItemsRead')
    const markSubscriptionRead = vi.spyOn(feedStore, 'markSubscriptionRead')
    const markAllFeedRead = vi.spyOn(feedStore, 'markAllFeedRead')

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '当前来源已读')!.trigger('click')
    await flushPromises()

    expect(markSubscriptionRead).toHaveBeenCalledWith('sub-rss-1')
    expect(markItemsRead).not.toHaveBeenCalled()
    expect(markAllFeedRead).not.toHaveBeenCalled()
  })

  it('keeps source read state unchanged when marking the current source read fails', async () => {
    routeQuery.source_id = 'sub-rss-1'
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-source-fail-1',
            feed_source_id: 'source-rss-1',
            feed_source: { id: 'source-rss-1', source_type: 'external_rss', title: 'Example RSS' },
            guid: 'feed-item-source-fail-1',
            title: '来源批量失败条目',
            link: 'https://example.com/source-fail',
            summary: '摘要',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-rss-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-rss-1',
        title: 'Example RSS',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    vi.spyOn(feedStore, 'markSubscriptionRead').mockResolvedValue(false)

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()
    vi.mocked(feedStore.fetchSubscriptions).mockClear()

    await wrapper.findAll('button').find((button) => button.text() === '当前来源已读')!.trigger('click')
    await flushPromises()

    expect(feedStore.markSubscriptionRead).toHaveBeenCalledWith('sub-rss-1')
    expect(feedStore.fetchSubscriptions).not.toHaveBeenCalled()
    expect(wrapper.findAll('button').some((button) => button.text() === '当前来源已读')).toBe(true)
  })

  it('keeps all-read state unchanged when marking all feed read fails', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-all-fail-1',
            feed_source_id: 'source-all-fail-1',
            feed_source: { id: 'source-all-fail-1', source_type: 'external_rss', title: 'All Feed' },
            guid: 'feed-item-all-fail-1',
            title: '全部已读失败条目',
            link: 'https://example.com/all-fail',
            summary: '摘要',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'markAllFeedRead').mockResolvedValue(false)

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()
    vi.mocked(feedStore.fetchSubscriptions).mockClear()

    await wrapper.findAll('button').find((button) => button.text() === '全部已读')!.trigger('click')
    await flushPromises()

    expect(feedStore.markAllFeedRead).toHaveBeenCalled()
    expect(feedStore.fetchSubscriptions).not.toHaveBeenCalled()
    expect(wrapper.findAll('button').some((button) => button.text() === '全部已读')).toBe(true)
  })

  it('filters muted sources from subscription flags and still keeps hidden keywords local', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-muted-1',
            feed_source_id: 'source-muted-1',
            feed_source: {
              id: 'source-muted-1',
              source_type: 'external_rss',
              title: '安静来源',
              rss_url: 'https://example.com/muted.xml',
            },
            guid: 'feed-item-muted-1',
            title: '这条来自静音来源',
            link: 'https://example.com/muted-item',
            summary: '普通摘要',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-keyword-1',
            feed_source_id: 'source-normal-1',
            feed_source: {
              id: 'source-normal-1',
              source_type: 'external_rss',
              title: '普通来源',
              rss_url: 'https://example.com/normal.xml',
            },
            guid: 'feed-item-keyword-1',
            title: '没有问题的标题',
            link: 'https://example.com/keyword-item',
            summary: '这里有剧透内容',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-visible-1',
            feed_source_id: 'source-normal-2',
            feed_source: {
              id: 'source-normal-2',
              source_type: 'external_rss',
              title: '可见来源',
              rss_url: 'https://example.com/visible.xml',
            },
            guid: 'feed-item-visible-1',
            title: '保留下来的条目',
            link: 'https://example.com/visible-item',
            summary: '正常摘要',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 3, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-muted-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-muted-1',
        is_muted: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-normal-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-normal-1',
        is_muted: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-normal-2',
        user_id: 'viewer-1',
        feed_source_id: 'source-normal-2',
        is_muted: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    feedStore.setFilterRules({
      mutedSourceIds: [],
      hiddenKeywords: ['剧透'],
    })

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).not.toContain('这条来自静音来源')
    expect(wrapper.text()).not.toContain('没有问题的标题')
    expect(wrapper.text()).toContain('保留下来的条目')
  })

  it('auto-marks sources as read from subscription flags instead of local automation rules', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/feed/timeline/mark-read')) {
        return new Response(null, { status: 204 })
      }
      if (url.includes('/feed/timeline')) {
        return new Response(JSON.stringify({
          data: [
            {
              type: 'feed_item',
              feed_item: {
                id: 'feed-item-auto-read-1',
                feed_source_id: 'source-auto-1',
                feed_source: {
                  id: 'source-auto-1',
                  source_type: 'external_rss',
                  title: '自动已读来源',
                  rss_url: 'https://example.com/auto.xml',
                },
                guid: 'feed-item-auto-read-1',
                title: '自动标记为已读的条目',
                link: 'https://example.com/auto-read-item',
                summary: '摘要',
                published_at: '2026-06-16T00:00:00Z',
                fetched_at: '2026-06-16T00:00:00Z',
              },
              published_at: '2026-06-16T00:00:00Z',
              is_read: false,
            },
            {
              type: 'feed_item',
              feed_item: {
                id: 'feed-item-normal-1',
                feed_source_id: 'source-normal-1',
                feed_source: {
                  id: 'source-normal-1',
                  source_type: 'external_rss',
                  title: '普通来源',
                  rss_url: 'https://example.com/normal.xml',
                },
                guid: 'feed-item-normal-1',
                title: '保持未读的条目',
                link: 'https://example.com/normal-item',
                summary: '摘要',
                published_at: '2026-06-16T00:00:00Z',
                fetched_at: '2026-06-16T00:00:00Z',
              },
              published_at: '2026-06-16T00:00:00Z',
              is_read: false,
            },
          ],
          meta: { page: 1, page_size: 20, total: 2, has_more: false },
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-auto-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-auto-1',
        auto_mark_read: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-normal-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-normal-1',
        auto_mark_read: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    feedStore.setAutomationRules({
      autoMarkReadSourceIds: ['source-normal-1'],
      autoAddReadingListSourceIds: [],
    })

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/feed/timeline/mark-read'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ feed_item_ids: ['feed-item-auto-read-1'] }),
    }))
    const autoReadEntry = wrapper.findAll('.p-entry').find(el => el.text().includes('自动标记为已读的条目'))
    expect(autoReadEntry?.classes()).toContain('is-read')
    expect(wrapper.text()).toContain('保持未读的条目')
  })

  it('does not refresh subscriptions when marking an opened item read fails', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-read-fail-1',
            feed_source_id: 'source-read-fail-1',
            feed_source: {
              id: 'source-read-fail-1',
              source_type: 'external_rss',
              title: '失败来源',
              rss_url: 'https://example.com/fail.xml',
            },
            guid: 'feed-item-read-fail-1',
            title: '打开后标记失败的条目',
            link: 'https://example.com/fail-item',
            summary: '摘要',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'markItemsRead').mockResolvedValue(false)

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.get('.p-entry').trigger('click')
    await flushPromises()

    expect(feedStore.markItemsRead).toHaveBeenCalledWith(['feed-item-read-fail-1'])
    expect(feedStore.fetchSubscriptions).not.toHaveBeenCalled()
  })

  it('auto-adds sources to reading list from subscription flags instead of local automation rules', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/reading-list')) {
        return new Response(JSON.stringify({ data: { saved: true } }), { status: 200 })
      }
      if (url.includes('/feed/timeline')) {
        return new Response(JSON.stringify({
          data: [
            {
              type: 'feed_item',
              feed_item: {
                id: 'feed-item-auto-later-1',
                feed_source_id: 'source-later-1',
                feed_source: {
                  id: 'source-later-1',
                  source_type: 'external_rss',
                  title: '自动稍后来源',
                  rss_url: 'https://example.com/later.xml',
                },
                guid: 'feed-item-auto-later-1',
                title: '自动加入稍后阅读的条目',
                link: 'https://example.com/later-item',
                summary: '摘要',
                published_at: '2026-06-16T00:00:00Z',
                fetched_at: '2026-06-16T00:00:00Z',
              },
              published_at: '2026-06-16T00:00:00Z',
              is_read: false,
            },
            {
              type: 'feed_item',
              feed_item: {
                id: 'feed-item-normal-2',
                feed_source_id: 'source-normal-2',
                feed_source: {
                  id: 'source-normal-2',
                  source_type: 'external_rss',
                  title: '普通来源',
                  rss_url: 'https://example.com/normal-2.xml',
                },
                guid: 'feed-item-normal-2',
                title: '不加入稍后阅读的条目',
                link: 'https://example.com/normal-2-item',
                summary: '摘要',
                published_at: '2026-06-16T00:00:00Z',
                fetched_at: '2026-06-16T00:00:00Z',
              },
              published_at: '2026-06-16T00:00:00Z',
              is_read: false,
            },
          ],
          meta: { page: 1, page_size: 20, total: 2, has_more: false },
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-later-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-later-1',
        auto_add_reading_list: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-normal-2',
        user_id: 'viewer-1',
        feed_source_id: 'source-normal-2',
        auto_add_reading_list: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
    feedStore.setAutomationRules({
      autoMarkReadSourceIds: [],
      autoAddReadingListSourceIds: ['source-normal-2'],
    })

    mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/feed/reading-list'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ feed_item_id: 'feed-item-auto-later-1' }),
    }))
    expect(feedStore.readingListItemIds.has('feed-item-auto-later-1')).toBe(true)
    expect(feedStore.readingListItemIds.has('feed-item-normal-2')).toBe(false)
  })

  it('re-applies subscription automation after subscriptions arrive later on first load', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/timeline/mark-read')) {
        return new Response(null, { status: 204 })
      }
      if (url.includes('/feed/timeline')) {
        return new Response(JSON.stringify({
          data: [
            {
              type: 'feed_item',
              feed_item: {
                id: 'feed-item-late-auto-read-1',
                feed_source_id: 'source-late-auto-1',
                feed_source: {
                  id: 'source-late-auto-1',
                  source_type: 'external_rss',
                  title: '晚到来源',
                  rss_url: 'https://example.com/late-auto.xml',
                },
                guid: 'feed-item-late-auto-read-1',
                title: '订阅晚到后也应自动已读',
                link: 'https://example.com/late-auto-item',
                summary: '摘要',
                published_at: '2026-06-16T00:00:00Z',
                fetched_at: '2026-06-16T00:00:00Z',
              },
              published_at: '2026-06-16T00:00:00Z',
              is_read: false,
            },
          ],
          meta: { page: 1, page_size: 20, total: 1, has_more: false },
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })

    const feedStore = useFeedStore()
    feedStore.subscriptions = []

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/feed/timeline/mark-read'))).toBe(false)

    feedStore.subscriptions = [
      {
        id: 'sub-late-auto-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-late-auto-1',
        auto_mark_read: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/feed/timeline/mark-read'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ feed_item_ids: ['feed-item-late-auto-read-1'] }),
    }))
    expect(wrapper.find('.p-entry').classes()).toContain('is-read')
  })

  it('filters the mixed timeline by source content type', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/stars?limit=500')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      if (url.includes('/feed/reading-list?limit=500')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: [
          {
            type: 'post',
            post: {
              id: 'post-internal-1',
              user_id: 'user-1',
              title: '站内文章',
              content: '正文',
              summary: '内部摘要',
              status: 'published',
              visibility: 'public',
              allow_comments: true,
              pinned: false,
              created_at: '2026-05-31T00:00:00Z',
              updated_at: '2026-05-31T00:00:00Z',
            },
            published_at: '2026-05-31T00:00:00Z',
            is_read: false,
          },
          {
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-blog-1',
              feed_source_id: 'source-blog-1',
              feed_source: {
                id: 'source-blog-1',
                source_type: 'external_rss',
                title: '博客来源',
                rss_url: 'https://example.com/blog.xml',
              },
              guid: 'feed-item-blog-1',
              title: '外部博客',
              link: 'https://example.com/blog-item',
              summary: '博客摘要',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          },
          {
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-podcast-1',
              feed_source_id: 'source-podcast-1',
              feed_source: {
                id: 'source-podcast-1',
                source_type: 'external_rss',
                title: '播客来源',
                rss_url: 'https://example.com/podcast.xml',
              },
              guid: 'feed-item-podcast-1',
              title: '外部播客',
              link: 'https://example.com/podcast-item',
              summary: '播客摘要',
              enclosure_url: 'https://cdn.example.com/audio.mp3',
              enclosure_type: 'audio/mpeg',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          },
        ],
        meta: { page: 1, page_size: 20, total: 3, has_more: false },
      }), { status: 200 })
    })

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
          PSegmentedControl: {
            props: ['modelValue', 'options'],
            template: `
              <div>
                <button
                  v-for="o in options"
                  :key="o.value"
                  :data-test="o.test"
                  @click="$emit('update:modelValue', o.value)"
                >
                  {{ o.label }} |
                </button>
              </div>
            `
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('站内文章')
    expect(wrapper.text()).toContain('外部博客')
    expect(wrapper.text()).toContain('外部播客')

    const podcastFilter = wrapper.get('[data-test="source-type-filter-podcast"]')
    await podcastFilter.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('站内文章')
    expect(wrapper.text()).not.toContain('外部博客')
    expect(wrapper.text()).toContain('外部播客')

    const internalFilter = wrapper.get('[data-test="source-type-filter-internal"]')
    await internalFilter.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('站内文章')
    expect(wrapper.text()).not.toContain('外部博客')
    expect(wrapper.text()).not.toContain('外部播客')
  })

  it('extracts shared themes from mixed items and filters the timeline by theme', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/stars?limit=500')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      if (url.includes('/feed/reading-list?limit=500')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: [
          {
            type: 'post',
            post: {
              id: 'post-theme-1',
              user_id: 'user-1',
              title: 'AI 评论写作',
              content: '正文',
              summary: '关于 AI 文章策展',
              status: 'published',
              visibility: 'public',
              allow_comments: true,
              pinned: false,
              created_at: '2026-05-31T00:00:00Z',
              updated_at: '2026-05-31T00:00:00Z',
            },
            published_at: '2026-05-31T00:00:00Z',
            is_read: false,
          },
          {
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-theme-1',
              feed_source_id: 'source-theme-1',
              feed_source: {
                id: 'source-theme-1',
                source_type: 'external_rss',
                title: 'AI Digest',
                rss_url: 'https://example.com/ai.xml',
              },
              guid: 'feed-item-theme-1',
              title: 'AI News Weekly',
              link: 'https://example.com/ai-news',
              summary: 'AI 工具与研究进展',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          },
          {
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-theme-2',
              feed_source_id: 'source-theme-2',
              feed_source: {
                id: 'source-theme-2',
                source_type: 'external_rss',
                title: 'Design Notes',
                rss_url: 'https://example.com/design.xml',
              },
              guid: 'feed-item-theme-2',
              title: 'Design systems digest',
              link: 'https://example.com/design-news',
              summary: '关于排版和界面系统',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          },
        ],
        meta: { page: 1, page_size: 20, total: 3, has_more: false },
      }), { status: 200 })
    })

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('AI')

    const themeFilter = wrapper.get('[data-test="theme-filter-ai"]')
    await themeFilter.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('AI 评论写作')
    expect(wrapper.text()).toContain('AI News Weekly')
    expect(wrapper.text()).not.toContain('Design systems digest')
  })

  it('supports previous and next article navigation inside the reading sheet', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-nav-1',
            feed_source_id: 'source-nav-1',
            feed_source: { id: 'source-nav-1', source_type: 'external_rss', title: 'Nav Feed' },
            guid: 'guid-nav-1',
            title: '第一篇',
            link: 'https://example.com/1',
            summary: '摘要 1',
            published_at: '2026-06-18T00:00:00Z',
            fetched_at: '2026-06-18T00:00:00Z',
          },
          published_at: '2026-06-18T00:00:00Z',
          is_read: false,
        },
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-nav-2',
            feed_source_id: 'source-nav-1',
            feed_source: { id: 'source-nav-1', source_type: 'external_rss', title: 'Nav Feed' },
            guid: 'guid-nav-2',
            title: '第二篇',
            link: 'https://example.com/2',
            summary: '摘要 2',
            published_at: '2026-06-17T00:00:00Z',
            fetched_at: '2026-06-17T00:00:00Z',
          },
          published_at: '2026-06-17T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 2, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedSourceArticlesSheet: true,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            props: ['show', 'article', 'hasPrevious', 'hasNext'],
            template: `
              <section v-if="show" data-test="sheet-probe">
                <h2 data-test="sheet-title">{{ article?.feed_item?.title }}</h2>
                <button v-if="hasPrevious" data-test="sheet-prev" @click="$emit('previous')">prev</button>
                <button v-if="hasNext" data-test="sheet-next" @click="$emit('next')">next</button>
              </section>
            `,
          },
        },
      },
    })

    await flushPromises()

    await wrapper.findAll('.p-entry')[0]?.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="sheet-title"]').text()).toBe('第一篇')
    expect(wrapper.find('[data-test="sheet-prev"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="sheet-next"]').exists()).toBe(true)

    await wrapper.get('[data-test="sheet-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="sheet-title"]').text()).toBe('第二篇')
    expect(wrapper.find('[data-test="sheet-prev"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="sheet-next"]').exists()).toBe(false)
  })

  it('prefers the custom subscription title over the raw rss url in external feed items', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-custom-title-1',
            feed_source_id: 'source-rss-custom-1',
            feed_source: {
              id: 'source-rss-custom-1',
              source_type: 'external_rss',
              title: 'Acast Show Name',
              rss_url: 'https://feeds.acast.com/public/shows/68004395b4ef799a7a410371',
            },
            guid: 'feed-item-custom-title-1',
            title: '播客条目',
            link: 'https://example.com/podcast-episode',
            summary: '摘要',
            author: '播客作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-rss-custom-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-rss-custom-1',
        title: '我的播客名字',
        feed_source: {
          id: 'source-rss-custom-1',
          source_type: 'external_rss',
          rss_url: 'https://feeds.acast.com/public/shows/68004395b4ef799a7a410371',
          hash: 'external-rss:acast-show',
          title: 'Acast Show Name',
          created_at: '2026-01-01T00:00:00Z',
        },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: {
            name: 'FeedSourceArticlesSheet',
            props: ['show', 'source', 'items'],
            template: '<section data-test="source-sheet" :data-show="String(show)"><h2>{{ source?.title }}</h2></section>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('.feed-entry-meta').text()).toContain('我的播客名字')
    expect(wrapper.find('.feed-entry-meta').text()).not.toContain('https://feeds.acast.com/public/shows/68004395b4ef799a7a410371')

    const trigger = wrapper.get('[data-test="feed-source-trigger"]')
    expect(trigger.attributes('title')).toBe('查看 我的播客名字 的所有文章')

    await trigger.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="source-sheet"]').text()).toContain('我的播客名字')
  })

  it('falls back to the feed source name when the subscription title is just the rss url', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-url-title-1',
            feed_source_id: 'source-rss-url-title-1',
            feed_source: {
              id: 'source-rss-url-title-1',
              source_type: 'external_rss',
              title: 'Acast Show Name',
              rss_url: 'https://feeds.acast.com/public/shows/68004395b4ef799a7a410371',
            },
            guid: 'feed-item-url-title-1',
            title: '播客条目',
            link: 'https://example.com/podcast-episode',
            summary: '摘要',
            author: '播客作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
          published_at: '2026-06-16T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-rss-url-title-1',
        user_id: 'viewer-1',
        feed_source_id: 'source-rss-url-title-1',
        title: 'https://feeds.acast.com/public/shows/68004395b4ef799a7a410371',
        feed_source: {
          id: 'source-rss-url-title-1',
          source_type: 'external_rss',
          rss_url: 'https://feeds.acast.com/public/shows/68004395b4ef799a7a410371',
          hash: 'external-rss:acast-show-url-title',
          title: 'Acast Show Name',
          created_at: '2026-01-01T00:00:00Z',
        },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: {
            name: 'FeedSourceArticlesSheet',
            props: ['show', 'source', 'items'],
            template: '<section data-test="source-sheet" :data-show="String(show)"><h2>{{ source?.title }}</h2></section>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('.feed-entry-meta').text()).toContain('Acast Show Name')
    expect(wrapper.find('.feed-entry-meta').text()).not.toContain('https://feeds.acast.com/public/shows/68004395b4ef799a7a410371')

    const trigger = wrapper.get('[data-test="feed-source-trigger"]')
    expect(trigger.attributes('title')).toBe('查看 Acast Show Name 的所有文章')
  })

  it('does not render the old right-edge subscription source drawer', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.findComponent({ name: 'PIndexTrigger' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'SubscriptionIndexSheet' }).exists()).toBe(false)
  })

  it('opens subscription management from manage_subscriptions query and clears the query flag', async () => {
    routeQuery.manage_subscriptions = '1'
    routeQuery.page = '2'

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show'],
            template: '<div data-test="manage-sheet" :data-show="String(show)"></div>',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').attributes('data-show')).toBe('true')
    expect(routerReplace).toHaveBeenCalledWith({ query: { page: '2' } })
  })

  it('closes add subscription sheet when opening subscription management', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            name: 'PPress',
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: {
            name: 'SubscriptionAddSheet',
            props: ['show'],
            template: '<div data-test="add-sheet" :data-show="String(show)"></div>',
          },
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show'],
            template: '<div data-test="manage-sheet" :data-show="String(show)"></div>',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    const buttonByText = (label: string) => {
      const button = wrapper.findAll('button').find((item) => item.text() === label)
      if (!button) throw new Error(`Missing button: ${label}`)
      return button
    }

    await buttonByText('+ 订阅').trigger('click')
    expect(wrapper.get('[data-test="add-sheet"]').attributes('data-show')).toBe('true')
    expect(wrapper.find('[data-test="manage-sheet"]').exists()).toBe(false)

    await buttonByText('订阅源管理').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="add-sheet"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="manage-sheet"]').attributes('data-show')).toBe('true')
  })

  it('shows manage errors when OPML import fails', async () => {
    const feedStore = useFeedStore()
    const file = new File(['bad opml'], 'feeds.opml', { type: 'text/xml' })
    vi.spyOn(feedStore, 'importOPML').mockImplementation(async () => {
      feedStore.error = '导入失败'
      return null
    })

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            name: 'PPress',
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show', 'error'],
            emits: ['import-opml'],
            template: '<section data-test="manage-sheet" @click="$emit(\'import-opml\', file)">{{ error }}</section>',
            setup() {
              return { file }
            },
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="manage-sheet"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').text()).toContain('导入失败')
  })

  it('shows manage errors when OPML export fails', async () => {
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'exportOPML').mockRejectedValue(new Error('导出失败'))

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            name: 'PPress',
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show', 'error'],
            emits: ['export-opml'],
            template: '<section data-test="manage-sheet" @click="$emit(\'export-opml\')">{{ error }}</section>',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="manage-sheet"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').text()).toContain('导出失败')
  })

  it('shows manage errors when saving subscription rules fails', async () => {
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, 'createSubscriptionRule').mockImplementation(async () => {
      feedStore.error = '保存失败'
      return false
    })

    const rule = {
      id: null,
      payload: {
        name: '自动稍后阅读',
        is_enabled: true,
        match_type: 'all',
        conditions_json: [{ field: 'title', operator: 'contains', value: 'AI' }],
        actions_json: { add_to_read_later: true },
      },
    }

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            name: 'PPress',
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show', 'error'],
            emits: ['save-rule'],
            template: '<section data-test="manage-sheet" @click="$emit(\'save-rule\', rule)">{{ error }}</section>',
            setup() {
              return { rule }
            },
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="manage-sheet"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').text()).toContain('保存失败')
  })

  it.each([
    {
      eventName: 'create-group',
      methodName: 'createGroup',
      errorText: '创建失败',
      args: ['新分组'],
    },
    {
      eventName: 'rename-subscription',
      methodName: 'updateSubscription',
      errorText: '保存失败',
      args: ['sub-1', '新标题'],
    },
    {
      eventName: 'update-subscription',
      methodName: 'updateSubscription',
      errorText: '保存失败',
      args: ['sub-1', { is_muted: true }],
    },
    {
      eventName: 'move-subscription',
      methodName: 'setSubscriptionGroup',
      errorText: '移动失败',
      args: ['sub-1', 'group-1'],
    },
    {
      eventName: 'delete-subscription',
      methodName: 'unsubscribe',
      errorText: '删除失败',
      args: ['sub-1'],
    },
    {
      eventName: 'rename-group',
      methodName: 'updateGroup',
      errorText: '保存失败',
      args: ['group-1', '新分组'],
    },
    {
      eventName: 'delete-group',
      methodName: 'deleteGroup',
      errorText: '删除失败',
      args: ['group-1'],
    },
    {
      eventName: 'check-subscription-health',
      methodName: 'checkSubscriptionHealth',
      errorText: '检查失败',
      args: ['sub-1'],
    },
    {
      eventName: 'check-all-subscriptions-health',
      methodName: 'checkAllSubscriptionsHealth',
      errorText: '检查失败',
      args: [],
    },
  ])('shows manage errors when $eventName fails', async ({ eventName, methodName, errorText, args }) => {
    const feedStore = useFeedStore()
    vi.spyOn(feedStore, methodName as any).mockResolvedValue(false)

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            name: 'PPress',
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show', 'error'],
            emits: [eventName],
            template: '<section data-test="manage-sheet" @click="$emit(eventName, ...args)">{{ error }}</section>',
            setup() {
              return { eventName, args }
            },
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="manage-sheet"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').text()).toContain(errorText)
  })

  it.each([
    {
      eventName: 'move-rule-down',
      methodName: 'reorderSubscriptionRules',
      errorText: '排序失败',
      payload: 'rule-1',
    },
    {
      eventName: 'apply-rule',
      methodName: 'applySubscriptionRules',
      errorText: '应用失败',
      payload: 'rule-1',
    },
    {
      eventName: 'delete-rule',
      methodName: 'deleteSubscriptionRule',
      errorText: '删除失败',
      payload: 'rule-1',
    },
  ])('shows manage errors when $eventName fails', async ({ eventName, methodName, errorText, payload }) => {
    const feedStore = useFeedStore()
    feedStore.subscriptionRules = [
      { id: 'rule-1', name: '规则一', position: 0 },
      { id: 'rule-2', name: '规则二', position: 1 },
    ] as any
    vi.spyOn(feedStore, methodName as any).mockResolvedValue(false)

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: {
            name: 'PPress',
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show', 'error'],
            emits: [eventName],
            template: '<section data-test="manage-sheet" @click="$emit(eventName, payload)">{{ error }}</section>',
            setup() {
              return { eventName, payload }
            },
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="manage-sheet"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').text()).toContain(errorText)
  })

  it('clears manage_subscriptions query without opening management for unauthenticated users', async () => {
    routeQuery.manage_subscriptions = '1'
    routeQuery.page = '2'

    const authStore = useAuthStore()
    authStore.token = null
    authStore.user = null
    authStore.isAuthenticated = false

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            props: ['show'],
            template: '<div data-test="manage-sheet" :data-show="String(show)"></div>',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="manage-sheet"]').attributes('data-show')).toBe('false')
    expect(routerReplace).toHaveBeenCalledWith({ query: { page: '2' } })
  })

  it('shows an empty subscription state for anonymous visitors', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.user = null
    authStore.isAuthenticated = false

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          type: 'feed_item',
          feed_item: {
            id: 'feed-item-1',
            title: '公开 RSS 条目',
            summary: '公开摘要',
            link: 'https://example.com/article',
            published_at: '2026-05-31T00:00:00Z',
            feed_source: { title: 'Example Feed' },
          },
          published_at: '2026-05-31T00:00:00Z',
          is_read: false,
        },
      ],
      meta: { total: 1, page: 1, page_size: 20, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedTimelineFooter: {
            name: 'FeedTimelineFooter',
            props: ['total'],
            template: '<div data-test="feed-footer" :data-total="String(total)"></div>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).not.toContain('公开 RSS 条目')
    expect(wrapper.find('[data-test="feed-footer"]').exists()).toBe(false)
  })

  it('auto-adds subscriptions from the unified add sheet submit event', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: {
            name: 'SubscriptionAddSheet',
            emits: ['submit', 'close'],
            props: ['show'],
            template: '<div data-test="add-sheet" @click="$emit(\'submit\', { input: \'https://github.com/DIYgod/RSSHub\', title: \'RSSHub Repo\' })"></div>',
          },
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    const feedStore = useFeedStore()
    const autoAddSpy = vi.spyOn(feedStore, 'autoAddSubscription').mockResolvedValue(true)

    await wrapper.get('[data-test="add-sheet"]').trigger('click')
    await flushPromises()

    expect(autoAddSpy).toHaveBeenCalledWith({
      input: 'https://github.com/DIYgod/RSSHub',
      title: 'RSSHub Repo',
    })
  })

  it('renders timeline entries inside a real layout element', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
          FeedTimelineFooter: true,
        },
      },
    })

    await flushPromises()

    const timeline = wrapper.get('.feed-timeline')
    expect(timeline.element.tagName).not.toBe('TEMPLATE')
    expect(timeline.element.closest('template')).toBeNull()
    expect(wrapper.get('.p-entry').text()).toContain('内部文章')
  })

  it('plays the selected podcast from the article sheet', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [
          {
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-play-1',
              feed_source_id: 'source-play-1',
              feed_source: {
                id: 'source-play-1',
                source_type: 'external_rss',
                title: 'Podcast Feed',
                rss_url: 'https://example.com/feed.xml',
              },
              guid: 'feed-item-play-1',
              title: '可播放播客',
              link: 'https://example.com/item',
              summary: '摘要',
              author: '主播',
              enclosure_url: 'https://cdn.example.com/audio.mp3',
              enclosure_type: 'audio/mpeg',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          },
        ],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            emits: ['play-podcast', 'close'],
            template: '<button data-test="sheet-play" @click="$emit(\'play-podcast\', { id: \'feed-item-play-1\', title: \'可播放播客\', enclosure_url: \'https://cdn.example.com/audio.mp3\', published_at: \'2026-06-16T00:00:00Z\', author: \'主播\', feed_source: { title: \'Podcast Feed\' } })">play</button>',
          },
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()

    const playerStore = usePlayerStore()
    const setQueueSpy = vi.spyOn(playerStore, 'setQueueFromCurrentItems')
    const playQueuedSongSpy = vi.spyOn(playerStore, 'playQueuedSong').mockImplementation(() => {})
    const createPodcastSongSpy = vi.spyOn(playerStore, 'createPodcastSong')

    await wrapper.get('[data-test="sheet-play"]').trigger('click')

    expect(setQueueSpy).toHaveBeenCalled()
    expect(createPodcastSongSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'feed-item-play-1' }))
    expect(playQueuedSongSpy).toHaveBeenCalled()
  })

  it('submits feed search through the route query and resets to the first page', async () => {
    routeQuery.page = '4'
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    const input = wrapper.get('[data-test="feed-search-input"]')
    await input.setValue('  rust newsletter  ')
    await wrapper.get('[data-test="feed-search-form"]').trigger('submit')

    expect(routerReplace).toHaveBeenCalledWith({
      query: expect.objectContaining({
        q: 'rust newsletter',
        page: undefined,
      }),
    })
  })

  it('clears feed search from the route query', async () => {
    routeQuery.q = 'existing search'
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.get('[data-test="feed-search-clear"]').trigger('click')

    expect(routerReplace).toHaveBeenCalledWith({
      query: expect.objectContaining({
        q: undefined,
        page: undefined,
      }),
    })
  })

  it('passes feed search query from the route into timeline requests', async () => {
    routeQuery.q = 'climate digest'
    mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/feed/timeline?'),
      expect.any(Object),
    )
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toContain('q=climate+digest')
  })

  it('shows a feed search empty state for the active query', async () => {
    routeQuery.q = 'missing topic'
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({
      data: [],
      meta: { page: 1, page_size: 20, total: 0, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: {
            name: 'PEmpty',
            props: ['text'],
            template: '<section data-test="empty-state">{{ text }}</section>',
          },
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PPress: true,
          PBadge: true,
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="empty-state"]').text()).toContain('没有找到“missing topic”')
  })

  it('fetches rules when opening the manage sheet', async () => {
    const feedStore = useFeedStore()
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PBadge: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()

    expect(feedStore.fetchSubscriptions).toHaveBeenCalled()
    expect(feedStore.fetchGroups).toHaveBeenCalled()
    expect(feedStore.fetchSubscriptionRules).toHaveBeenCalled()
  })

  it('creates a rule then confirms and applies it to existing subscriptions', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const feedStore = useFeedStore()

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PBadge: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            emits: ['close', 'save-rule'],
            template: '<section data-test="manage-sheet" @click="$emit(\'save-rule\', { id: null, payload: { name: \'播客归档\', enabled: true, match_type: \'source_category\', conditions_json: { categories: [\'podcast\'] }, action_group_id: \'group-1\', action_muted: false, action_auto_mark_read: true, action_auto_add_reading_list: false } })" />',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="manage-sheet"]').trigger('click')
    await flushPromises()

    expect(feedStore.createSubscriptionRule).toHaveBeenCalledWith({
      name: '播客归档',
      enabled: true,
      match_type: 'source_category',
      conditions_json: { categories: ['podcast'] },
      action_group_id: 'group-1',
      action_muted: false,
      action_auto_mark_read: true,
      action_auto_add_reading_list: false,
    })
    expect(feedStore.applySubscriptionRules).toHaveBeenCalledWith({ rule_id: 'rule-1' })

    confirm.mockRestore()
  })

  it('updates subscription flags from the management sheet', async () => {
    const feedStore = useFeedStore()
    const updateSubscription = vi.spyOn(feedStore, 'updateSubscription').mockResolvedValue(true)

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PBadge: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            emits: ['update-subscription'],
            template: '<section data-test="manage-sheet" @click="$emit(\'update-subscription\', \'sub-1\', { is_muted: true })" />',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="manage-sheet"]').trigger('click')
    await flushPromises()

    expect(updateSubscription).toHaveBeenCalledWith('sub-1', { is_muted: true })
  })

  it('moves subscriptions back to the default group through the group endpoint', async () => {
    const feedStore = useFeedStore()
    const setSubscriptionGroup = vi.spyOn(feedStore, 'setSubscriptionGroup').mockResolvedValue(undefined)
    const updateSubscription = vi.spyOn(feedStore, 'updateSubscription').mockResolvedValue(true)

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PBadge: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            emits: ['move-subscription'],
            template: '<section data-test="manage-sheet" @click="$emit(\'move-subscription\', \'sub-1\', \'\')" />',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="manage-sheet"]').trigger('click')
    await flushPromises()

    expect(setSubscriptionGroup).toHaveBeenCalledWith('sub-1', null)
    expect(updateSubscription).not.toHaveBeenCalledWith('sub-1', { group_id: '' })
  })

  it('reorders and applies rules from the manage sheet', async () => {
    const feedStore = useFeedStore()
    feedStore.subscriptionRules = [
      {
        id: 'rule-1',
        name: '规则一',
        enabled: true,
        position: 0,
        match_type: 'keywords',
        conditions_json: { keywords: ['AI'] },
      },
      {
        id: 'rule-2',
        name: '规则二',
        enabled: true,
        position: 1,
        match_type: 'source_ids',
        conditions_json: { source_ids: ['source-2'] },
      },
    ] as any

    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PSelect: true,
          PField: true,
          PClip: true,
          PBadge: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          SubscriptionAddSheet: true,
          SubscriptionManageSheet: {
            name: 'SubscriptionManageSheet',
            emits: ['close', 'move-rule-down', 'apply-all-rules'],
            template: '<section><button data-test="move-down" @click="$emit(\'move-rule-down\', \'rule-1\')" /><button data-test="apply-all" @click="$emit(\'apply-all-rules\')" /></section>',
          },
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '订阅源管理')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="move-down"]').trigger('click')
    await wrapper.get('[data-test="apply-all"]').trigger('click')
    await flushPromises()

    expect(feedStore.reorderSubscriptionRules).toHaveBeenCalledWith(['rule-2', 'rule-1'])
    expect(feedStore.applySubscriptionRules).toHaveBeenCalledWith({ all: true })
  })
})
