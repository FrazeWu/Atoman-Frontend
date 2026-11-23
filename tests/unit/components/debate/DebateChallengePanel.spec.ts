import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DebateChallengePanel from '@/components/debate/DebateChallengePanel.vue'
import { useAuthStore } from '@/stores/auth'
import type { DebateChallenge } from '@/types'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

const sampleChallenges: DebateChallenge[] = [
  {
    id: 'ch-open-1',
    debate_id: 'debate-1',
    target_type: 'entry',
    target_id: 'entry-1',
    target_label: '结构化证据',
    target_preview: '摘要预览',
    created_by: 'user-2',
    creator: { id: 'user-2', username: 'alice' } as DebateChallenge['creator'],
    reason_code: 'mismatch',
    rationale: '数据口径与原结论相反',
    references: [],
    status: 'open',
    uphold_votes: 3,
    dismiss_votes: 1,
    current_user_vote: 'uphold',
    min_votes: 5,
    threshold_percent: 75,
    created_at: '2026-11-23T08:00:00Z',
    updated_at: '2026-11-23T08:00:00Z',
  },
  {
    id: 'ch-resolved-1',
    debate_id: 'debate-1',
    target_type: 'reference',
    target_id: 'ref-1',
    target_label: '旧报道',
    created_by: 'user-3',
    reason_code: 'outdated',
    rationale: '已发布更正版',
    references: [],
    status: 'upheld',
    uphold_votes: 5,
    dismiss_votes: 0,
    min_votes: 5,
    threshold_percent: 75,
    created_at: '2026-11-22T08:00:00Z',
    updated_at: '2026-11-22T08:00:00Z',
  },
]

describe('DebateChallengePanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerPush.mockReset()
  })

  it('按状态筛选质询并显示纯社区裁决规则与结案结果', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true

    const wrapper = mount(DebateChallengePanel, {
      props: {
        challenges: sampleChallenges,
      },
    })

    // Default filter is 'open'
    expect(wrapper.find('[data-test="challenge-card-ch-open-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="challenge-card-ch-resolved-1"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('≥ 5 票且 > 75%')

    await wrapper.get('[data-test="challenge-filter-resolved"]').trigger('click')
    expect(wrapper.emitted('filter-change')?.[0]).toEqual(['resolved'])
    expect(wrapper.find('[data-test="challenge-card-ch-resolved-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('质询成立 · 已驳回')

    await wrapper.get('[data-test="challenge-filter-all"]').trigger('click')
    expect(wrapper.find('[data-test="challenge-card-ch-open-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="challenge-card-ch-resolved-1"]').exists()).toBe(true)
  })

  it('已登录用户点击同一选项触发取消投票，切换选项触发投票', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true

    const wrapper = mount(DebateChallengePanel, {
      props: {
        challenges: sampleChallenges,
      },
    })

    await wrapper.get('[data-test="challenge-vote-uphold-ch-open-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('remove-vote')?.[0]).toEqual(['ch-open-1'])

    await wrapper.get('[data-test="challenge-vote-dismiss-ch-open-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('vote')?.[0]).toEqual(['ch-open-1', 'dismiss'])
  })

  it('未登录点击质询投票会跳转登录页', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = false
    vi.spyOn(authStore, 'restoreSession').mockResolvedValue(false)

    const wrapper = mount(DebateChallengePanel, {
      props: {
        challenges: sampleChallenges,
      },
    })

    await wrapper.get('[data-test="challenge-vote-dismiss-ch-open-1"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith('/login')
    expect(wrapper.emitted('vote')).toBeUndefined()
  })
})
