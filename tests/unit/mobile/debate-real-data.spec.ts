import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DebateHallView from '@/../apps/mobile/views/debate/DebateHallView.vue'
import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'

const mockPush = vi.fn()
let currentQueryTab: string | undefined = undefined

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useRoute: () => ({
    query: { tab: currentQueryTab },
    path: '/debate',
  }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

describe('Debate Mobile Real Data & Tab Navigation', () => {
  let pinia: ReturnType<typeof createPinia>

  function createSampleTopics() {
    return [
      {
        id: 'deb-1',
        title: '远程工作是否优于传统办公室办公？',
        description: '探讨分布式办公对沟通效率与团队凝聚力的深远影响。',
        affirmativeCount: 45,
        negativeCount: 15,
        userVote: 'affirmative' as const,
        isHot: true,
      },
      {
        id: 'deb-2',
        title: '静态类型语言是否大幅提升了项目可维护性？',
        description: '对比动态语言原型速度与类型安全重构成本。',
        affirmativeCount: 88,
        negativeCount: 12,
        userVote: null,
        isHot: true,
      },
    ]
  }

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()
    currentQueryTab = undefined

    const debateStore = useDebateStore()
    debateStore.fetchDebates = vi.fn().mockResolvedValue(undefined)
    debateStore.removeVote = vi.fn().mockResolvedValue(null)
    debateStore.setVote = vi.fn().mockResolvedValue(null)
  })

  it('renders debate topic cards and navigates to /debate/:id on card click', async () => {
    const wrapper = mount(DebateHallView, {
      props: { initialTopics: createSampleTopics() },
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('远程工作是否优于传统办公室办公？')
    const cards = wrapper.findAll('[data-testid="debate-topic-card"]')
    expect(cards.length).toBe(2)

    await cards[0].trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/debate/deb-1')
  })

  it('voting does not trigger card click navigation due to click.stop', async () => {
    const wrapper = mount(DebateHallView, {
      props: { initialTopics: createSampleTopics() },
      global: { plugins: [pinia] },
    })

    const affBtn = wrapper.find('[data-testid="vote-affirmative-btn"]')
    await affBtn.trigger('click')

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('renders opinions tab when route query tab=opinions', async () => {
    currentQueryTab = 'opinions'
    const wrapper = mount(DebateHallView, {
      props: { initialTopics: createSampleTopics() },
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('核心观点')
    expect(wrapper.findAll('[data-testid="debate-topic-card"]').length).toBe(2)
  })

  it('renders guest card when unauthenticated on tab=mine', async () => {
    currentQueryTab = 'mine'
    const authStore = useAuthStore()
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(DebateHallView, {
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('登录查看我的辩题')
  })

  it('renders user participated debates and rules shortcut when authenticated on tab=mine', async () => {
    currentQueryTab = 'mine'
    const authStore = useAuthStore()
    authStore.token = 'test-token'
    authStore.isAuthenticated = true
    authStore.user = { id: 1, uuid: 'u-1', username: 'debater', display_name: '哲思辩手', role: 'user' }

    const wrapper = mount(DebateHallView, {
      props: { initialTopics: createSampleTopics() },
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('哲思辩手')
    expect(wrapper.text()).toContain('辩论规则')
    expect(wrapper.text()).toContain('支持正方')
  })

  it('renders guest card when unauthenticated on tab=subscriptions', async () => {
    currentQueryTab = 'subscriptions'
    const authStore = useAuthStore()
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(DebateHallView, {
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('登录查看关注辩题')
  })
})
