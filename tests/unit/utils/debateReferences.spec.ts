import { describe, expect, it } from 'vitest'

import { normalizeDebateReferences } from '@/utils/debateReferences'

describe('debate references contract', () => {
  it('以 ContentReference 的 target 与 relation 作为辩论引用主记录', () => {
    const [reference] = normalizeDebateReferences([{
      id: 'reference-1',
      field: 'content',
      start: 4,
      end: 59,
      raw: '@debate:11111111-1111-4111-8111-111111111111:support',
      target: {
        type: 'debate', id: '11111111-1111-4111-8111-111111111111', label: '来源辩题', module: 'debate', path: '/debate/source', available: true,
      },
      relation: {
        id: 'relation-1', stance: 'support', state: 'stale', conclusion_event_id: 'event-2', conclusion_direction: 'no',
      },
    }])

    expect(reference).toMatchObject({
      id: 'reference-1',
      field: 'content',
      target: { type: 'debate', label: '来源辩题', available: true },
      relation: { id: 'relation-1', stance: 'support', state: 'stale', conclusion_direction: 'no' },
    })
  })

  it('兼容迁移期间的扁平 DebateReference 响应', () => {
    const [reference] = normalizeDebateReferences([{
      raw: '@debate:11111111-1111-4111-8111-111111111111:oppose',
      kind: 'debate', resource_id: '11111111-1111-4111-8111-111111111111', title: '旧来源辩题', qualifier: 'oppose', state: 'active', relation_id: 'relation-old',
    }])

    expect(reference).toMatchObject({
      field: 'content',
      target: { type: 'debate', label: '旧来源辩题', available: true },
      relation: { id: 'relation-old', stance: 'oppose', state: 'active' },
    })
  })
})
