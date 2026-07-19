import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DebateTopicView from '@/views/debate/DebateTopicView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'root' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

const root = {
  id: 'root', user_id: 'user-1', title: '长期吸烟会不会显著增加肺癌风险？',
  description: '', content: '', status: 'open', tags: ['医学'], view_count: 0,
  argument_count: 0, vote_count: 0, created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
}

describe('DebateTopicView relation experience', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/relations')) {
        return new Response(JSON.stringify({ data: { root_id: 'root', nodes: [root], relations: [] } }), { status: 200 })
      }
      if (url.includes('/arguments')) {
        return new Response(JSON.stringify({ data: [], meta: {} }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: root }), { status: 200 })
    })
  })

  it('shows relation views and the debate discussion instead of the legacy argument list', async () => {
    const wrapper = shallowMount(DebateTopicView, {
      global: {
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PSegmentedControl: { template: '<div>辩论树 关系图谱</div>' },
          DebateRelationGraph: { template: '<div data-test="relation-graph" />' },
          CommentSection: { template: '<section data-test="debate-discussion">讨论</section>' },
        },
      },
    })
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/v1/debates/root/relations?view=tree')
    expect(wrapper.text()).toContain('辩论树')
    expect(wrapper.text()).toContain('关系图谱')
    expect(wrapper.text()).toContain('引用')
    expect(wrapper.find('[data-test="debate-discussion"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('论点列表')
    expect(wrapper.text()).not.toContain('添加论点')
  })
})
