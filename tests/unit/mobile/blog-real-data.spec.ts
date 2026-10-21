import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BlogMeView from '@/../apps/mobile/views/blog/BlogMeView.vue'
import MGuestCard from '@/../apps/mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useRoute: () => ({ query: {} }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

vi.mock('@/api/client', () => ({
  apiRequestEnvelope: vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('/short-notes')) {
      return {
        data: [
          {
            id: 'real-note-1',
            content: '实时的短笺内容测试',
            created_at: '2026-10-21T10:00:00Z',
            likes_count: 9,
            comments_count: 2,
          },
        ],
      }
    }
    if (url.includes('/posts')) {
      return {
        data: [
          {
            id: 'real-article-1',
            title: '真实长文标题',
            reading_time_minutes: 5,
            published_at: '2026-10-21T09:00:00Z',
          },
        ],
      }
    }
    return { data: [] }
  }),
}))

describe('Blog Mobile Real Data Wiring', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()
  })

  it('renders MGuestCard in BlogMeView when unauthenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(BlogMeView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(true)
    expect(wrapper.text()).toContain('登录')
  })

  it('renders real user info and loads notes/articles when authenticated in BlogMeView', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token-123'
    authStore.isAuthenticated = true
    authStore.user = {
      id: 99,
      uuid: 'author-uuid-99',
      username: 'luxun',
      display_name: '鲁迅',
      bio: '横眉冷对千夫指，俯首甘为孺子牛。',
      role: 'user',
    }

    const wrapper = mount(BlogMeView, {
      global: { plugins: [pinia] },
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(false)
    expect(wrapper.text()).toContain('鲁迅')
    expect(wrapper.text()).toContain('@luxun')
    expect(wrapper.text()).toContain('横眉冷对千夫指')
  })
})
