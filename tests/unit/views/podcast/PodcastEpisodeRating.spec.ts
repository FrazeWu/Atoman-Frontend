import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PodcastEpisodeView from '@/views/podcast/PodcastEpisodeView.vue'
import { getPodcastEpisode, setPodcastRating, deletePodcastRating } from '@/api/podcast'

const auth = reactive({ token: 'test-token' as string | null })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/feed', () => ({ useFeedStore: () => ({ fetchSubscriptionHubTree: vi.fn().mockResolvedValue(true) }) }))
vi.mock('@/stores/player', () => ({ usePlayerStore: () => ({ currentSong: null }) }))
vi.mock('@/composables/useContentLifecycle', () => ({
  useContentLifecycle: () => ({ recordEvent: vi.fn().mockResolvedValue({}), getProgress: vi.fn().mockResolvedValue(null) }),
}))
vi.mock('@/api/podcast', () => ({
  getPodcastEpisode: vi.fn(), setPodcastRating: vi.fn(), deletePodcastRating: vi.fn(),
  addPodcastEpisodeBookmark: vi.fn(), addPodcastShowBookmark: vi.fn(),
}))

const episode = (id: string) => ({ id, post: { title: id, status: 'published', content: '' }, rating_count: 0, rating_score: 0, viewer_rating: null })

async function setup() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/episode/:id', component: PodcastEpisodeView }] })
  await router.push('/episode/first')
  const wrapper = mount(PodcastEpisodeView, {
    global: { plugins: [router], stubs: { CommentSideSheet: true, PDiscussionFAB: true, PButton: true } },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('播客单集评分', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.token = 'test-token'
    vi.mocked(getPodcastEpisode).mockImplementation(async (id) => episode(id) as never)
    vi.mocked(setPodcastRating).mockResolvedValue({ rating_count: 1, rating_score: 9, viewer_rating: 9 })
    vi.mocked(deletePodcastRating).mockResolvedValue({ rating_count: 0, rating_score: 0, viewer_rating: null })
  })

  it('支持首次评分、刷新读取和撤销，公开门槛不阻止个人评分', async () => {
    const { wrapper } = await setup()
    expect(wrapper.text()).toContain('暂无评分')
    await wrapper.get('[data-score="9"]').trigger('click')
    await flushPromises()
    expect(setPodcastRating).toHaveBeenCalledWith('first', 9, 'test-token')
    expect(wrapper.text()).toContain('我的评分：9/10')
    expect(wrapper.text()).toContain('评分已保存')
    expect(wrapper.find('.rating-control__public-score').exists()).toBe(false)
    await wrapper.get('.rating-control__clear').trigger('click')
    await flushPromises()
    expect(deletePodcastRating).toHaveBeenCalledWith('first', 'test-token')
    expect(wrapper.text()).toContain('暂无评分')
    expect(wrapper.find('.rating-control__mine').exists()).toBe(false)
    wrapper.unmount()
  })

  it('未登录不能提交，退出登录重新读取匿名摘要', async () => {
    const { wrapper } = await setup()
    auth.token = null
    await flushPromises()
    expect(getPodcastEpisode).toHaveBeenLastCalledWith('first', undefined)
    expect(wrapper.get('[data-score="9"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('登录后评分')
    wrapper.unmount()
  })

  it('失败不伪造已保存的评分', async () => {
    vi.mocked(setPodcastRating).mockRejectedValue(new Error('offline'))
    const { wrapper } = await setup()
    await wrapper.get('[data-score="9"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('评分未保存')
    expect(wrapper.find('.rating-control__mine').exists()).toBe(false)
    wrapper.unmount()
  })

  it('切换单集后忽略旧评分响应，并阻止保存中的重复提交', async () => {
    let resolve!: (value: { rating_score: number; rating_count: number; viewer_rating: number }) => void
    vi.mocked(setPodcastRating).mockReturnValue(new Promise(done => { resolve = done }))
    const { wrapper, router } = await setup()
    await wrapper.get('[data-score="9"]').trigger('click')
    await wrapper.get('[data-score="8"]').trigger('click')
    expect(setPodcastRating).toHaveBeenCalledTimes(1)
    await router.push('/episode/second')
    await flushPromises()
    resolve({ rating_score: 9, rating_count: 1, viewer_rating: 9 })
    await flushPromises()
    expect(wrapper.text()).toContain('second')
    expect(wrapper.text()).toContain('暂无评分')
    expect(wrapper.find('.rating-control__mine').exists()).toBe(false)
    wrapper.unmount()
  })
})
