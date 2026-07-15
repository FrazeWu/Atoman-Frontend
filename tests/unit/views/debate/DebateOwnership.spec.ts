import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ArgumentNode from '@/components/debate/ArgumentNode.vue'
import DebateTopicView from '@/views/debate/DebateTopicView.vue'
import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'
import type { Argument, Debate } from '@/types'

const debate: Debate = {
  id: 'debate-1',
  user_id: 'user-uuid-1',
  title: '测试辩题',
  description: '描述',
  content: '',
  status: 'open',
  tags: [],
  view_count: 0,
  argument_count: 1,
  vote_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const argument: Argument = {
  id: 'argument-1',
  debate_id: debate.id,
  user_id: 'user-uuid-1',
  content: '论点',
  argument_type: 'support',
  vote_count: 0,
  is_concluded: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('debate ownership', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = { uuid: 'user-uuid-1', username: 'owner', email: 'owner@example.com' }
  })

  it('UUID 用户可以编辑和删除自己的论点', () => {
    const wrapper = mount(ArgumentNode, {
      props: { argument, debate },
      global: {
        stubs: {
          PButton: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('编辑')
    expect(wrapper.text()).toContain('删除')
  })

  it('UUID 用户可以编辑和结题自己的辩题', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/debates/:id', component: DebateTopicView }],
    })
    await router.push('/debates/debate-1')
    await router.isReady()

    const store = useDebateStore()
    store.currentDebate = debate
    store.argumentList = []
    store.fetchDebate = vi.fn().mockResolvedValue(debate)
    store.fetchArguments = vi.fn().mockResolvedValue([])

    const wrapper = mount(DebateTopicView, {
      global: {
        plugins: [router],
        stubs: {
          ArgumentNode: true,
          DebateConcludeModal: true,
          DebateHeaderActions: true,
          PEditor: true,
          PEmpty: true,
          PModal: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.vm.$.setupState.canEdit).toBe(true)
    expect(wrapper.vm.$.setupState.canConclude).toBe(true)
  })
})
