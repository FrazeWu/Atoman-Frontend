import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DebateVotePanel from '@/components/debate/DebateVotePanel.vue'
import { useAuthStore } from '@/stores/auth'
import type { DebateVoteSummary } from '@/types'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

const summary: DebateVoteSummary = {
  yes_votes: 32,
  no_votes: 9,
  total_votes: 41,
  current_direction: 'yes',
  current_user_vote: 'yes',
}

describe('DebateVotePanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    routerPush.mockReset()
  })

  it('结论形成后仍允许从是改投否', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const wrapper = mount(DebateVotePanel, { props: { summary } })

    await wrapper.get('[data-test="vote-no"]').trigger('click')

    expect(wrapper.emitted('vote')).toEqual([['no']])
  })

  it('未登录投票时进入登录页', async () => {
    const wrapper = mount(DebateVotePanel, { props: { summary } })

    await wrapper.get('[data-test="vote-no"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/login')
    expect(wrapper.emitted('vote')).toBeUndefined()
  })

  it('同时显示当前结论和用户当前选择', () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const wrapper = mount(DebateVotePanel, { props: { summary } })

    expect(wrapper.get('[data-test="current-conclusion"]').text()).toContain('是')
    expect(wrapper.get('[data-test="current-user-vote"]').text()).toContain('是')
    expect(wrapper.get('[data-test="vote-yes"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-test="vote-no"]').attributes('aria-pressed')).toBe('false')
  })

  it('再次点击已选项时撤回投票', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    const wrapper = mount(DebateVotePanel, { props: { summary } })

    await wrapper.get('[data-test="vote-yes"]').trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.emitted('vote')).toBeUndefined()
  })
})
