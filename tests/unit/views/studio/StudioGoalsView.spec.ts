import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioGoalsView from '@/views/studio/StudioGoalsView.vue'
import { useStudioStore } from '@/stores/studio'

async function mountGoals() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/studio/manage/goals', component: StudioGoalsView }],
  })
  await router.push('/studio/manage/goals')
  await router.isReady()
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
  const store = useStudioStore(pinia)
  store.loaded = true
  store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
  store.goals = {
    current_cycle: {
      id: 'cycle-1', channel_id: 'channel-1', start_date: '2026-08-01', end_date: '2026-08-31', timezone: 'Asia/Shanghai', status: 'active', needs_review: false,
      goals: [{ id: 'goal-1', cycle_id: 'cycle-1', name: '稳定发布产品观察', module: 'blog', metric: 'published', baseline_value: 0, target_value: 4, current_value: 2, progress: 50, actions: [{ id: 'action-1', goal_id: 'goal-1', title: '完成第二篇观察', status: 'pending', due_date: '2026-08-20' }] }],
    },
    cycles: [],
    metrics: [{ module: 'blog', metric: 'published', label: '发布数量' }],
  }
  store.goals.cycles = [store.goals.current_cycle!]
  store.contents.blog = []
  const wrapper = mount(StudioGoalsView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, store }
}

describe('StudioGoalsView', () => {
  it('renders cycle progress and toggles an action', async () => {
    const { wrapper, store } = await mountGoals()

    expect(wrapper.text()).toContain('稳定发布产品观察')
    expect(wrapper.text()).toContain('2 / 4')
    expect(wrapper.text()).toContain('完成 50%')
    expect(wrapper.text()).toContain('完成第二篇观察')

    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(store.updateGoalAction).toHaveBeenCalledWith('action-1', 'completed')
  })

  it('shows cycle creation when no cycle exists', async () => {
    const { wrapper, store } = await mountGoals()
    store.goals = { cycles: [], metrics: [] }
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('先建立一个周期')
    await wrapper.find('form').trigger('submit')
    expect(store.createGoalCycle).toHaveBeenCalled()
  })
})
