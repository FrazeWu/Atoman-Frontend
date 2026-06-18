import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedView from '@/views/feed/FeedView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

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
  })

  it('opens internal posts in the feed article sheet', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
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

    const pageButtons = wrapper.findAll('.feed-page-number').map((button) => button.text())
    expect(pageButtons).toContain('2')
  })

  it('does not render feed-item-only actions for internal posts', async () => {
    const wrapper = mount(FeedView, {
      global: {
        stubs: {
          PButton: true,
          PModal: true,
          PEmpty: true,
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

    await wrapper.get('[data-test="feed-source-trigger"]').trigger('click')
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

    await wrapper.get('[data-test="feed-source-trigger"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="source-sheet"]').attributes('data-show')).toBe('true')
    expect(wrapper.get('[data-test="source-sheet"]').text()).toContain('Example RSS')
    expect(wrapper.get('[data-test="source-sheet"]').text()).toContain('外部条目')
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

  it('renders anonymous public feed items from the paged v1 response', async () => {
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

    expect(wrapper.text()).toContain('公开 RSS 条目')
    expect(wrapper.get('[data-test="feed-footer"]').attributes('data-total')).toBe('1')
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
})
