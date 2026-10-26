import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FeedStatsMobileView from '@/../apps/mobile/views/feed/FeedStatsMobileView.vue'
import BlogSubscriptionsMobileView from '@/../apps/mobile/views/blog/BlogSubscriptionsMobileView.vue'
import FeedFollowingView from '@/../apps/mobile/views/feed/FeedFollowingView.vue'
import FeedStarredView from '@/../apps/mobile/views/feed/FeedStarredView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const mockPush = vi.fn()
const mockBack = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: mockBack }),
  useRoute: () => ({ query: {}, params: {} }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

const mockApiResult = vi.fn(async (url: string) => {
  if (url.includes('/feed/stats')) {
    return {
      ok: true,
      data: {
        total_read: 48,
        source_breakdown: [
          { feed_source_id: 'src-1', title: 'Evan You Blog', count: 30 },
          { feed_source_id: 'src-2', title: 'TypeScript Official', count: 18 },
        ],
      },
    }
  }
  return { ok: true, data: { data: [] } }
})

vi.mock('@/api/client', () => ({
  apiRequestResult: (url: string, options?: any) => mockApiResult(url),
  apiRequestEnvelope: vi.fn().mockResolvedValue({ data: [] }),
}))

describe('Feed & Subscription Real Data Wiring', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()
    mockBack.mockReset()
    mockApiResult.mockClear()
  })

  describe('FeedStatsMobileView.vue', () => {
    it('renders stats overview cards and source breakdown list', async () => {
      const authStore = useAuthStore()
      authStore.token = 'test-token'
      authStore.isAuthenticated = true
      authStore.user = { id: 1, uuid: 'user-1', username: 'tester', role: 'user' }

      const wrapper = mount(FeedStatsMobileView, {
        global: { plugins: [pinia] },
      })
      await flushPromises()

      expect(mockApiResult).toHaveBeenCalledWith(expect.stringContaining('/feed/stats?period=week'))
      expect(wrapper.find('[data-testid="stats-total-read"]').text()).toBe('48')
      expect(wrapper.find('[data-testid="stats-sources-count"]').text()).toBe('2')
      expect(wrapper.find('[data-testid="stats-top-source"]').text()).toContain('Evan You Blog')
      expect(wrapper.find('[data-testid="stats-source-list"]').text()).toContain('TypeScript Official')
    })

    it('switches period when tapping period button', async () => {
      const authStore = useAuthStore()
      authStore.token = 'test-token'
      authStore.isAuthenticated = true
      authStore.user = { id: 1, uuid: 'user-1', username: 'tester', role: 'user' }

      const wrapper = mount(FeedStatsMobileView, {
        global: { plugins: [pinia] },
      })
      await flushPromises()

      const monthBtn = wrapper.find('[data-testid="period-btn-month"]')
      await monthBtn.trigger('click')
      await flushPromises()

      expect(mockApiResult).toHaveBeenCalledWith(expect.stringContaining('/feed/stats?period=month'))
    })
  })

  describe('BlogSubscriptionsMobileView.vue', () => {
    it('renders empty state when there are no subscribed items', async () => {
      const authStore = useAuthStore()
      authStore.token = 'test-token'
      authStore.isAuthenticated = true
      authStore.user = { id: 1, uuid: 'user-1', username: 'tester', role: 'user' }

      const wrapper = mount(BlogSubscriptionsMobileView, {
        global: { plugins: [pinia] },
        props: { initialItems: [] },
      })
      await flushPromises()

      expect(wrapper.find('[data-testid="subs-empty"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('暂无订阅更新')
    })

    it('renders list of subscribed posts and navigates on tap', async () => {
      const authStore = useAuthStore()
      authStore.token = 'test-token'
      authStore.isAuthenticated = true
      authStore.user = { id: 1, uuid: 'user-1', username: 'tester', role: 'user' }

      const wrapper = mount(BlogSubscriptionsMobileView, {
        global: { plugins: [pinia] },
        props: {
          initialItems: [
            {
              id: 'p-sub-1',
              type: 'post',
              title: '订阅作者的深度长文',
              summary: '长文摘要内容...',
              author: { name: '订阅作者', avatar: '' },
              channel_name: '思考专栏',
              published_at: '2026-10-21T10:00:00Z',
              unread: true,
            },
          ],
        },
      })
      await flushPromises()

      expect(wrapper.find('[data-testid="subs-list"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('订阅作者的深度长文')
      expect(wrapper.text()).toContain('思考专栏')

      await wrapper.find('.blog-subs-card').trigger('click')
      expect(mockPush).toHaveBeenCalledWith('/post/p-sub-1')
    })
  })

  describe('FeedFollowingView.vue persistence', () => {
    it('calls feedStore.markAllFeedRead when tapping mark all as read', async () => {
      const feedStore = useFeedStore()
      const markSpy = vi.spyOn(feedStore, 'markAllFeedRead').mockResolvedValue(true)

      const wrapper = mount(FeedFollowingView, {
        global: { plugins: [pinia] },
        props: {
          initialArticles: [
            {
              id: 'art-un-1',
              title: '未读文章',
              summary: '摘要',
              sourceName: '源',
              unread: true,
            },
          ],
        },
      })
      await flushPromises()

      const markBtn = wrapper.find('[data-testid="mark-all-read-btn"]')
      await markBtn.trigger('click')
      await flushPromises()

      expect(markSpy).toHaveBeenCalled()
    })
  })

  describe('FeedStarredView.vue persistence', () => {
    it('calls feedStore.toggleStar when unstarring article', async () => {
      const feedStore = useFeedStore()
      const starSpy = vi.spyOn(feedStore, 'toggleStar').mockResolvedValue(true)

      const wrapper = mount(FeedStarredView, {
        global: { plugins: [pinia] },
        props: {
          initialArticles: [
            {
              id: 'star-1',
              title: '收藏的文章',
              sourceName: '源',
            },
          ],
        },
      })
      await flushPromises()

      const unstarBtn = wrapper.find('[data-testid="unstar-btn-star-1"]')
      await unstarBtn.trigger('click')
      await flushPromises()

      expect(starSpy).toHaveBeenCalledWith('star-1')
    })
  })
})
