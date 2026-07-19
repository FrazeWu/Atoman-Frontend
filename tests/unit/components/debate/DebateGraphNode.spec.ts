import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DebateGraphNode from '@/components/debate/DebateGraphNode.vue'

const baseDebate = {
  id: 'node-1',
  user_id: 'user-1',
  title: '吸烟量越大，肺癌风险会不会越高？',
  description: '',
  content: '',
  status: 'concluded' as const,
  tags: [],
  view_count: 0,
  argument_count: 0,
  vote_count: 0,
  conclusion_type: 'yes' as const,
  created_at: '2026-07-18T00:00:00Z',
  updated_at: '2026-07-18T00:00:00Z',
}

describe('DebateGraphNode', () => {
  it('uses the same yes/no conclusion wording for every debate node', () => {
    const wrapper = mount(DebateGraphNode, {
      props: { data: { debate: baseDebate, root: false } },
      global: {
        stubs: {
          Handle: true,
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    expect(wrapper.text()).toContain('结论 · 是')
    expect(wrapper.text()).not.toContain('正向结论')
    expect(wrapper.text()).not.toContain('论点')
  })
})
