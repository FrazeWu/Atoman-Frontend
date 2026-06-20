import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import FeedRecommendedView from '@/views/feed/FeedRecommendedView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const routeQuery = reactive({} as Record<string, string | undefined>)
const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery }),
  useRouter: () => ({ push: routerPush }),
}))

describe('FeedRecommendedView', () => {
  beforeEach(() => {
    routerPush.mockReset()
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
    setActivePinia(createPinia())
    window.history.replaceState(null, '', '/explore?site=feed')

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        feed_source_id: 'source-1',
        title: '来源',
        feed_source: {
          id: 'source-1',
          source_type: 'external_rss',
          rss_url: 'https://example.com/rss.xml',
          hash: 'source-1-hash',
          title: '来源',
          created_at: '2026-01-01T00:00:00Z',
        },
        created_at: '2026-01-01T00:00:00Z',
      },
    ]
  })

  it('shows a second page when explore meta total exceeds the page size', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/explore')) {
        return new Response(JSON.stringify({
          data: [{
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-1',
              feed_source_id: 'source-1',
              feed_source: { id: 'source-1', title: '来源' },
              guid: 'feed-item-1',
              title: '探索条目',
              link: 'https://example.com/item',
              summary: '摘要',
              author: '作者',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          }],
          meta: { page: 1, page_size: 20, total: 40, has_more: true },
        }), { status: 200 })
      }
      if (url.includes('/feed/stars') || url.includes('/feed/reading-list')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PButton: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PTab: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    const pageButtons = wrapper.findAll('.feed-page-number').map((button) => button.text())
    expect(pageButtons).toContain('2')
  })

  it('keeps article mode as the default explore surface', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/explore')) {
        return new Response(JSON.stringify({
          data: [{
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-1',
              feed_source_id: 'source-1',
              feed_source: { id: 'source-1', title: '来源' },
              guid: 'feed-item-1',
              title: '探索条目',
              link: 'https://example.com/item',
              summary: '摘要',
              author: '作者',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          }],
          meta: { page: 1, page_size: 20, total: 1, has_more: false },
        }), { status: 200 })
      }
      if (url.includes('/feed/stars') || url.includes('/feed/reading-list')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PButton: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PTab: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="meta" /><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('探索条目')
    expect(wrapper.find('[data-test="explore-mode-articles"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="explore-mode-channels"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="channel-card"]').exists()).toBe(false)
  })

  it('opens source articles and lets an authenticated user subscribe from explore', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/feed/explore')) {
        return new Response(JSON.stringify({
          data: [{
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-1',
              feed_source_id: 'source-1',
              feed_source: { id: 'source-1', title: '来源', rss_url: 'https://example.com/rss.xml' },
              guid: 'feed-item-1',
              title: '探索条目',
              link: 'https://example.com/item',
              summary: '摘要',
              author: '作者',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
          }],
          meta: { page: 1, page_size: 20, total: 1, has_more: false },
        }), { status: 200 })
      }
      if (url.includes('/feed/timeline?')) {
        return new Response(JSON.stringify({
          data: [{
            type: 'feed_item',
            feed_item: {
              id: 'feed-item-1',
              feed_source_id: 'source-1',
              feed_source: { id: 'source-1', title: '来源', rss_url: 'https://example.com/rss.xml' },
              guid: 'feed-item-1',
              title: '来源文章',
              link: 'https://example.com/source-item',
              summary: '来源摘要',
              author: '作者',
              published_at: '2026-06-15T00:00:00Z',
              fetched_at: '2026-06-15T00:00:00Z',
            },
            published_at: '2026-06-15T00:00:00Z',
            is_read: false,
          }],
        }), { status: 200 })
      }
      if (url.includes('/feed/stars') || url.includes('/feed/reading-list')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PButton: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PTab: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="meta" /><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PShortcutHints: true,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            props: ['show', 'article'],
            template: '<section data-test="article-sheet" :data-show="String(show)">{{ article?.feed_item?.title }}</section>',
          },
          FeedSourceArticlesSheet: {
            name: 'FeedSourceArticlesSheet',
            props: ['show', 'source', 'items', 'loading', 'subscribeBusy'],
            template: '<section data-test="source-sheet" :data-show="String(show)"><h2>{{ source?.title }}</h2><button data-test="subscribe-btn" @click="$emit(\'subscribe\')">subscribe</button><article v-for="item in items" :key="item.feed_item?.id">{{ item.feed_item?.title }}</article></section>',
          },
        },
      },
    })

    await flushPromises()

    const sourceTrigger = wrapper.get('[data-test="feed-source-trigger"]')
    expect(sourceTrigger.text()).toContain('来源')
    expect(sourceTrigger.attributes('title')).toBe('查看 来源 的所有文章')

    await sourceTrigger.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="source-sheet"]').attributes('data-show')).toBe('true')
    expect(wrapper.get('[data-test="source-sheet"]').text()).toContain('来源文章')
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/feed/timeline?') && String(url).includes('source_id=sub-1'))).toBe(true)
  })

  it('fetches channel explore data when mode=channels', async () => {
    Object.assign(routeQuery, { mode: 'channels' })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/explore/sources')) {
        return new Response(JSON.stringify({
          data: [{
            id: 'source-1',
            title: 'Source One',
            rss_url: 'https://example.com/rss.xml',
            subscription_count: 3,
            recent_item_count: 8,
            last_published_at: '2026-06-19T00:00:00Z',
            subscribed: false,
          }],
          meta: { page: 1, page_size: 20, total: 1, has_more: false },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: [],
        meta: { page: 1, page_size: 20, total: 0, has_more: false },
      }), { status: 200 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PButton: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PPress: {
            props: ['label'],
            template: '<button v-bind="$attrs" @click="$emit(\'click\')">{{ label }}<slot /></button>',
          },
          PTab: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="meta" /><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })
    await flushPromises()

    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/feed/explore/sources'))).toBe(true)
    expect(wrapper.findAll('[data-test="channel-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Source One')
  })

  it('switching to channel mode syncs the query string', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/feed/explore')) {
        return new Response(JSON.stringify({
          data: [],
          meta: { page: 1, page_size: 20, total: 0, has_more: false },
        }), { status: 200 })
      }
      if (url.includes('/feed/stars') || url.includes('/feed/reading-list')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404 })
    })

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PButton: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PPress: {
            props: ['label'],
            template: '<button v-bind="$attrs" @click="$emit(\'click\')">{{ label }}<slot /></button>',
          },
          PTab: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="meta" /><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()
    await wrapper.get('[data-test="explore-mode-channels"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith({
      query: {
        mode: 'channels',
        page: undefined,
        sort: undefined,
      },
    })
  })

  it('refetches subscriptions when auth token becomes available after mount', async () => {
    const feedStore = useFeedStore()
    const fetchSubscriptions = vi.spyOn(feedStore, 'fetchSubscriptions').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchStarredIds').mockResolvedValue(undefined)
    vi.spyOn(feedStore, 'fetchReadingListIds').mockResolvedValue(undefined)

    const wrapper = mount(FeedRecommendedView, {
      global: {
        stubs: {
          PButton: true,
          PEmpty: true,
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PTab: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="meta" /><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
          FeedSourceArticlesSheet: true,
        },
      },
    })

    await flushPromises()
    expect(fetchSubscriptions.mock.calls.length).toBeGreaterThanOrEqual(1)

    const authStore = useAuthStore()
    authStore.token = 'new-token'
    await flushPromises()

    expect(fetchSubscriptions.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(wrapper.exists()).toBe(true)
  })
})
