import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'

describe('debate relation store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(fetch).mockReset()
  })

  it('loads the requested tree or graph view', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      data: { root_id: 'root', nodes: [], relations: [] },
    }), { status: 200 }))
    const store = useDebateStore()

    await store.fetchRelationGraph('root', 'graph')

    expect(fetch).toHaveBeenCalledWith('/api/v1/debates/root/relations?view=graph')
    expect(store.relationGraph?.root_id).toBe('root')
  })

  it('creates a support or oppose relation with bearer auth', async () => {
    const auth = useAuthStore()
    auth.token = 'relation-token'
    auth.isAuthenticated = true
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'relation-1', source_debate_id: 'source', target_debate_id: 'target', stance: 'support' },
    }), { status: 201 }))
    const store = useDebateStore()

    const created = await store.createRelation('source', 'target', 'support')

    expect(created?.id).toBe('relation-1')
    expect(fetch).toHaveBeenCalledWith('/api/v1/debate-relations', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer relation-token' }),
      body: JSON.stringify({ source_debate_id: 'source', target_debate_id: 'target', stance: 'support' }),
    }))
  })

  it('returns only concluded yes/no debates as citable nodes', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: 'yes', status: 'concluded', conclusion_type: 'yes' },
        { id: 'no', status: 'concluded', conclusion_type: 'no' },
        { id: 'open', status: 'open', conclusion_type: '' },
        { id: 'legacy', status: 'concluded', conclusion_type: 'inconclusive' },
      ],
    }), { status: 200 }))
    const store = useDebateStore()

    const results = await store.searchCitableDebates('肺癌', 'no')

    expect(fetch).toHaveBeenCalledWith('/api/v1/debate/topics/search?q=%E8%82%BA%E7%99%8C&status=concluded&limit=10')
    expect(results.map(({ id }) => id)).toEqual(['yes'])
  })

  it('reports an actionable reference error when debate creation fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'reference.invalid_target', message: 'Reference is unavailable' },
    }), { status: 400 }))
    const store = useDebateStore()

    const created = await store.createDebate({
      title: '辩题', description: '描述', content: '@post:missing', tags: [],
    })

    expect(created).toBeNull()
    expect(store.error).toBe('请从候选中选择有效引用')
  })
})
