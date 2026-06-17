import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedRecommendedView from '@/views/feed/FeedRecommendedView.vue'
import { useAuthStore } from '@/stores/auth'

const { routeQuery, routerPush } = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string | undefined>,
  routerPush: vi.fn(),
}))

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
})
