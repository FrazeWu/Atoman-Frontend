import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FeedFollowingView from '@/../apps/mobile/views/feed/FeedFollowingView.vue'
import FeedStarredView from '@/../apps/mobile/views/feed/FeedStarredView.vue'
import FeedMeView from '@/../apps/mobile/views/feed/FeedMeView.vue'
import FeedSourcesView from '@/../apps/mobile/views/feed/FeedSourcesView.vue'
import MGuestCard from '@/../apps/mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useRoute: () => ({ query: {} }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

describe('Feed Mobile Real Data Wiring', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: any) => {
      const url = String(input?.url || input)
      if (url.includes('/feed/stars')) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            items: [
              {
                id: 'star-real-1',
                title: '实时星标文章：深入理解响应式系统',
                source_title: '前端周刊',
                category: '技术',
                created_at: '2026-10-21T10:00:00Z',
              },
            ],
            total: 1,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/feed/subscriptions')) {
        return new Response(JSON.stringify({
          code: 0,
          data: [
            { id: 'sub-1', title: 'Feed 1', url: 'https://example.com/rss1' },
            { id: 'sub-2', title: 'Feed 2', url: 'https://example.com/rss2' },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ code: 0, data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
  })

  it('renders real timeline articles in FeedFollowingView', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token'
    authStore.isAuthenticated = true

    const feedStore = useFeedStore()
    feedStore.timeline = [
      {
        type: 'feed_item',
        feed_item: {
          id: 'item-101',
          title: 'Vite 6 架构演进实战',
          summary: '环境共享与通用工具链',
          source_title: 'Vite Team',
          published_at: '2026-10-21T10:00:00Z',
          is_read: false,
        } as any,
      },
    ]
    feedStore.fetchTimeline = vi.fn().mockResolvedValue(undefined)
    feedStore.fetchSubscriptions = vi.fn().mockResolvedValue(undefined)

    const wrapper = mount(FeedFollowingView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(feedStore.fetchTimeline).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Vite 6 架构演进实战')
  })

  it('renders real starred articles in FeedStarredView', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token'
    authStore.isAuthenticated = true

    const wrapper = mount(FeedStarredView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(wrapper.text()).toContain('实时星标文章：深入理解响应式系统')
  })

  it('renders MGuestCard in FeedMeView when unauthenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(FeedMeView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(true)
    expect(wrapper.text()).toContain('登录')
  })

  it('renders real user info and stats in FeedMeView when authenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token'
    authStore.isAuthenticated = true
    authStore.user = {
      id: 77,
      uuid: 'user-77',
      username: 'rss_fan',
      display_name: '信息守望者',
      bio: '专注科技与设计',
      role: 'user',
    }

    const feedStore = useFeedStore()
    feedStore.subscriptions = [
      { id: 'sub-1', title: 'Feed 1', url: 'https://example.com/rss1' },
      { id: 'sub-2', title: 'Feed 2', url: 'https://example.com/rss2' },
    ] as any

    const wrapper = mount(FeedMeView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(false)
    expect(wrapper.text()).toContain('信息守望者')
    expect(wrapper.text()).toContain('2') // 2 subscriptions
  })
})
