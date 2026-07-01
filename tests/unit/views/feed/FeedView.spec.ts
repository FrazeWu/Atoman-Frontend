import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedView from '@/views/feed/FeedView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
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

  it('filters muted sources and hidden keywords from the visible timeline', async () => {
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
    feedStore.setFilterRules({
      mutedSourceIds: ['source-muted-1'],
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

  it('auto-marks configured sources as read after timeline load', async () => {
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
    feedStore.setAutomationRules({
      autoMarkReadSourceIds: ['source-auto-1'],
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
    expect(wrapper.text()).toContain('已读')
    expect(wrapper.text()).toContain('保持未读的条目')
  })

  it('auto-adds configured sources to reading list after timeline load', async () => {
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
    feedStore.setAutomationRules({
      autoMarkReadSourceIds: [],
      autoAddReadingListSourceIds: ['source-later-1'],
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
})
