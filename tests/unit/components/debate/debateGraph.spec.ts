import { describe, expect, it } from 'vitest'

import { buildDebateFlow } from '@/components/debate/debateGraph'
import type { DebateGraph } from '@/types'

const debate = (id: string, title: string, conclusionType: 'yes' | 'no' | '' = '') => ({
  id,
  user_id: 'user-1',
  title,
  description: '',
  content: '',
  status: conclusionType ? 'concluded' as const : 'open' as const,
  tags: [],
  view_count: 0,
  argument_count: 0,
  vote_count: 0,
  conclusion_type: conclusionType,
  created_at: '2026-07-18T00:00:00Z',
  updated_at: '2026-07-18T00:00:00Z',
})

describe('debate graph layout', () => {
  it('places the current debate above its incoming references', () => {
    const graph: DebateGraph = {
      root_id: 'root',
      nodes: [
        debate('root', '长期吸烟会不会显著增加肺癌风险？'),
        debate('child', '烟草烟雾会不会含有已知致癌物？', 'yes'),
        debate('grandchild', '过滤嘴会不会去除全部致癌物？', 'no'),
      ],
      relations: [
        { id: 'r1', source_debate_id: 'child', target_debate_id: 'root', stance: 'support', user_id: 'user-1', created_at: '', updated_at: '' },
        { id: 'r2', source_debate_id: 'grandchild', target_debate_id: 'child', stance: 'oppose', user_id: 'user-1', created_at: '', updated_at: '' },
      ],
    }

    const flow = buildDebateFlow(graph)
    const root = flow.nodes.find(({ id }) => id === 'root')!
    const child = flow.nodes.find(({ id }) => id === 'child')!
    const grandchild = flow.nodes.find(({ id }) => id === 'grandchild')!

    expect(root.position.y).toBeLessThan(child.position.y)
    expect(child.position.y).toBeLessThan(grandchild.position.y)
    expect(flow.edges.map(({ label }) => label)).toEqual(['支撑', '反驳'])
    expect(flow.edges[1]?.style).toMatchObject({ strokeDasharray: '7 5' })
  })
})
