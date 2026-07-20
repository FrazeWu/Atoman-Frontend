import { describe, expect, it } from 'vitest'

import { buildDebateFlow } from '@/components/debate/debateGraph'
import type { Debate, DebateGraph, DebateRelation } from '@/types'

const debate = (
  id: string,
  title: string,
  options: { status?: Debate['status']; conclusionType?: 'yes' | 'no' | '' } = {},
): Debate => ({
  id,
  user_id: 'user-1',
  title,
  description: '',
  content: '',
  status: options.status ?? 'active',
  tags: [],
  view_count: 0,
  current_revision_id: `revision-${id}`,
  conclusion_type: options.conclusionType ?? '',
  references: [],
  created_at: '2026-07-18T00:00:00Z',
  updated_at: '2026-07-18T00:00:00Z',
})

const relation = (
  id: string,
  source: string,
  target: string,
  stance: DebateRelation['stance'],
): DebateRelation => ({
  id,
  source_debate_id: source,
  target_debate_id: target,
  stance,
  target_revision_id: `revision-${target}`,
  source_conclusion_event_id: `conclusion-${source}`,
  status: 'active',
  created_at: '2026-07-18T00:00:00Z',
  updated_at: '2026-07-18T00:00:00Z',
})

const graph: DebateGraph = {
  root_id: 'root',
  nodes: [
    debate('root', '长期吸烟会不会显著增加肺癌风险？'),
    debate('support-1', '烟草烟雾会不会含有已知致癌物？', { conclusionType: 'yes' }),
    debate('support-2', '过滤嘴会不会去除全部致癌物？', { status: 'archived', conclusionType: 'no' }),
    debate('oppose-1', '现有研究会不会高估吸烟风险？', { conclusionType: 'yes' }),
  ],
  relations: [
    relation('r1', 'support-1', 'root', 'support'),
    relation('r2', 'support-2', 'support-1', 'support'),
    relation('r3', 'oppose-1', 'root', 'oppose'),
  ],
  expandable_node_ids: ['support-1'],
}

describe('debate graph layout', () => {
  it('lays out the root above incoming support nodes in tree view', () => {
    const flow = buildDebateFlow(graph, { view: 'tree' })
    const root = flow.nodes.find(({ id }) => id === 'root')!
    const child = flow.nodes.find(({ id }) => id === 'support-1')!
    const grandchild = flow.nodes.find(({ id }) => id === 'support-2')!

    expect(root.position.y).toBeLessThan(child.position.y)
    expect(child.position.y).toBeLessThan(grandchild.position.y)
    expect(flow.nodes.map(({ id }) => id)).not.toContain('oppose-1')
    expect(flow.edges.map(({ id }) => id)).toEqual(['r1', 'r2'])
    expect(flow.edges.every(edge => edge.data?.stance === 'support')).toBe(true)
  })

  it('keeps semantic edge direction while using layout-only reversed tree edges', () => {
    const flow = buildDebateFlow(graph, { view: 'tree' })

    expect(flow.edges[0]).toMatchObject({
      source: 'support-1',
      target: 'root',
      sourceHandle: 'top-source',
      targetHandle: 'bottom-target',
      data: { stance: 'support' },
    })
  })

  it('keeps both relation stances in graph view and exposes stable node state', () => {
    const flow = buildDebateFlow(graph, {
      view: 'graph',
      expandingNodeIds: ['support-1'],
    })
    const expandable = flow.nodes.find(({ id }) => id === 'support-1')!

    expect(flow.edges.map(({ label }) => label)).toEqual(['支撑', '支撑', '反驳'])
    expect(flow.edges.map(edge => edge.data?.stance)).toEqual(['support', 'support', 'oppose'])
    expect(flow.edges[2]?.style).toMatchObject({ strokeDasharray: '7 5' })
    expect(flow.edges[0]?.style).toMatchObject({ stroke: 'var(--a-color-success)' })
    expect(flow.edges[2]?.style).toMatchObject({ stroke: 'var(--a-color-danger)' })
    expect(expandable.data).toMatchObject({ expandable: true, expanding: true })
    expect(flow.nodes.every(node => node.draggable === false && node.connectable === false)).toBe(true)
  })
})
