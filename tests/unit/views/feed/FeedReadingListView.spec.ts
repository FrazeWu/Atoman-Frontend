import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedReadingListView from '@/views/feed/FeedReadingListView.vue'
import { useAuthStore } from '@/stores/auth'

const { routeQuery, routerPush, routerReplace } = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string | undefined>,
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ query: routeQuery }),
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

describe('FeedReadingListView', () => {
  beforeEach(() => {
    routerPush.mockReset()
    routerReplace.mockReset()
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
    setActivePinia(createPinia())
    window.history.replaceState(null, '', '/reading-list?site=feed')

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('renders entries from nested reading-list response data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: {
        items: [{
          feed_item_id: 'feed-item-1',
          created_at: '2026-06-16T00:00:00Z',
          feed_item: {
            id: 'feed-item-1',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-1',
            title: '稍后读条目',
            link: 'https://example.com/item',
            summary: '摘要',
            author: '作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
        }],
        page: 1,
        total: 1,
      },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          APageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          AEmpty: true,
          PaperEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PaperBadge: true,
          PaperClip: true,
          PaperPress: true,
          ShortcutHints: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('稍后读条目')
    expect(wrapper.text()).not.toContain('阅读列表为空')
  })
})
