import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileMobileView from '@/../apps/mobile/views/me/ProfileMobileView.vue'
import MGuestCard from '@/../apps/mobile/components/ui/MGuestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { listLibrary } from '@/api/bookPrivate'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useRoute: () => ({ query: {} }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

vi.mock('@/api/bookPrivate', () => ({
  listLibrary: vi.fn(),
}))

describe('Profile Mobile Real Data Wiring', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()

    vi.mocked(listLibrary).mockResolvedValue({
      items: [
        { id: 'lib-1', work_id: 'w-1', work_title: '局外人', status: 'reading', version: 1, tags: [] },
        { id: 'lib-2', work_id: 'w-2', work_title: '西西弗神话', status: 'reading', version: 1, tags: [] },
        { id: 'lib-3', work_id: 'w-3', work_title: '鼠疫', status: 'read', version: 1, tags: [] },
      ],
      total: 3,
    })

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: any) => {
      const url = String(input?.url || input)
      if (url.includes('/short-notes')) {
        return new Response(JSON.stringify({
          code: 0,
          data: [{ id: 'sn-1' }, { id: 'sn-2' }],
          total: 2,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/blog/posts')) {
        return new Response(JSON.stringify({
          code: 0,
          data: [{ id: 'p-1' }, { id: 'p-2' }, { id: 'p-3' }],
          total: 3,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/feed/stars')) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            items: [{ id: 's-1' }, { id: 's-2' }, { id: 's-3' }, { id: 's-4' }],
            total: 4,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ code: 0, data: [] }), { status: 200 })
    }))
  })

  it('renders MGuestCard in ProfileMobileView when unauthenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = null
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(ProfileMobileView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(true)
    expect(wrapper.text()).toContain('登录')
    expect(wrapper.find('[data-testid="profile-card"]').exists()).toBe(false)
  })

  it('renders live user info and dynamic counters when authenticated', async () => {
    const authStore = useAuthStore()
    authStore.token = 'auth-token'
    authStore.isAuthenticated = true
    authStore.user = {
      id: 77,
      uuid: 'user-77',
      username: 'digital_thinker',
      display_name: '数字思想者',
      bio: '在算法与文字交汇处构建秩序。',
      role: 'user',
    }

    const wrapper = mount(ProfileMobileView, {
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(wrapper.findComponent(MGuestCard).exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('数字思想者')
    expect(wrapper.text()).toContain('@digital_thinker')
    expect(wrapper.text()).toContain('在算法与文字交汇处构建秩序。')

    // Stats: articles = 2 (notes) + 3 (posts) = 5
    expect(wrapper.text()).toContain('5')
    // Stats: reading = 2
    expect(wrapper.text()).toContain('2')
    // Stats: bookmarks = 4
    expect(wrapper.text()).toContain('4')
  })
})
