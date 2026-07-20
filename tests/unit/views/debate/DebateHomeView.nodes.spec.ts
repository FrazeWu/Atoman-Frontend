import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import DebateHomeView from '@/views/debate/DebateHomeView.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('DebateHomeView node wording', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.isAuthenticated = true
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      data: [{
        id: 'debate-1', user_id: 'user-1', user: { username: 'fafa' },
        title: '长期吸烟会不会显著增加肺癌风险？', description: '@thread:topic', content: '',
        status: 'concluded', tags: [], view_count: 2, argument_count: 9, vote_count: 0,
        conclusion_type: 'yes', created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
        references: [{
          kind: 'resource', target_type: 'thread', target_id: 'topic-1', field: 'description',
          start: 0, end: 13, label: '讨论主题', module: 'forum', path: '/topic/topic-1', available: true,
        }],
      }],
      meta: { total: 1 },
    }), { status: 200 }))
  })

  it('treats every item as a debate node and uses the unified conclusion stamp', async () => {
    const wrapper = shallowMount(DebateHomeView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot name="action" /></header>' },
          PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          PEntry: { template: '<article><slot name="meta" /><slot name="title" /><slot name="summary" /><slot name="actions" /></article>' },
          PSelect: true,
          PInput: true,
          PEmpty: true,
          PModal: { template: '<div><slot /></div>' },
          PTextarea: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('新建辩题')
    expect(wrapper.text()).toContain('结论 · 是')
    expect(wrapper.find('a[href="/forum/topic/topic-1"]').text()).toBe('@讨论主题')
    expect(wrapper.text()).not.toContain('论点 9')
    expect(wrapper.text()).not.toContain('发起辩论')
  })
})
