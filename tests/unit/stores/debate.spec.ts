import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve })
  return { promise, resolve }
}

describe('debate store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(fetch).mockReset()
  })

  it('uses the wiki list query and appends paginated results', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: [{ id: 'first' }],
        meta: { page: 1, page_size: 15, total: 2, has_more: true },
      }))
      .mockResolvedValueOnce(response({
        data: [{ id: 'second' }],
        meta: { page: 2, page_size: 15, total: 2, has_more: false },
      }))
    const store = useDebateStore()

    await store.fetchDebates({ status: 'active', search: '能源', tag: '政策', page: 1, pageSize: 15 })
    await store.fetchDebates({ status: 'active', search: '能源', tag: '政策', page: 2, pageSize: 15 })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/debate/topics?status=active&search=%E8%83%BD%E6%BA%90&tag=%E6%94%BF%E7%AD%96&page=1&page_size=15')
    expect(store.debates.map(({ id }) => id)).toEqual(['first', 'second'])
    expect(store.debatesTotal).toBe(2)
    expect(store.debatesMeta).toEqual({ page: 2, page_size: 15, total: 2, has_more: false })
  })

  it('keeps the latest debate list when requests resolve out of order', async () => {
    let resolveFirst!: (value: Response) => void
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve })
    vi.mocked(fetch)
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(response({ data: [{ id: 'latest' }], meta: { total: 1 } }))
    const store = useDebateStore()

    const staleRequest = store.fetchDebates({ search: 'old' })
    await store.fetchDebates({ search: 'new' })
    resolveFirst(response({ data: [{ id: 'stale' }], meta: { total: 1 } }))
    await staleRequest

    expect(store.debates.map(({ id }) => id)).toEqual(['latest'])
  })

  it('keeps the latest current debate when requests resolve out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const store = useDebateStore()

    const firstRequest = store.fetchDebate('topic-a')
    const secondRequest = store.fetchDebate('topic-b')
    second.resolve(response({ data: { id: 'topic-b', title: 'B' } }))
    await secondRequest
    first.resolve(response({ data: { id: 'topic-a', title: 'A' } }))

    expect(await firstRequest).toBeNull()
    expect(store.currentDebate?.id).toBe('topic-b')
  })

  it('keeps the latest revision owner when requests resolve out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const store = useDebateStore()

    const firstRequest = store.fetchRevisions('topic-a')
    const secondRequest = store.fetchRevisions('topic-b')
    expect(store.revisionsLoading).toBe(true)
    second.resolve(response({ data: [{ id: 'revision-b' }] }))
    await secondRequest
    first.resolve(response({ data: [{ id: 'revision-a' }] }))

    expect(await firstRequest).toBeNull()
    expect(store.revisions.map(({ id }) => id)).toEqual(['revision-b'])
    expect(store.revisionsLoading).toBe(false)
  })

  it('keeps the latest vote owner when requests resolve out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const store = useDebateStore()

    const firstRequest = store.fetchVotes('topic-a')
    const secondRequest = store.fetchVotes('topic-b')
    expect(store.votesLoading).toBe(true)
    second.resolve(response({ data: {
      yes_votes: 2,
      no_votes: 0,
      total_votes: 2,
      current_direction: '',
      current_user_vote: '',
    } }))
    await secondRequest
    first.resolve(response({ data: {
      yes_votes: 0,
      no_votes: 1,
      total_votes: 1,
      current_direction: '',
      current_user_vote: '',
    } }))

    expect(await firstRequest).toBeNull()
    expect(store.voteSummary?.total_votes).toBe(2)
    expect(store.votesLoading).toBe(false)
  })

  it('keeps the latest relation graph owner when requests resolve out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const store = useDebateStore()

    const firstRequest = store.fetchRelationGraph('topic-a', 'graph')
    const secondRequest = store.fetchRelationGraph('topic-b', 'graph')
    second.resolve(response({ data: { root_id: 'topic-b', nodes: [], relations: [], expandable_node_ids: [] } }))
    await secondRequest
    first.resolve(response({ data: { root_id: 'topic-a', nodes: [], relations: [], expandable_node_ids: [] } }))

    expect(await firstRequest).toBeNull()
    expect(store.relationGraph?.root_id).toBe('topic-b')
    expect(store.relationLoading).toBe(false)
  })

  it('invalidates every singleton request when the store resets', async () => {
    const current = deferred<Response>()
    const revisionList = deferred<Response>()
    const votes = deferred<Response>()
    const graph = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(current.promise)
      .mockReturnValueOnce(revisionList.promise)
      .mockReturnValueOnce(votes.promise)
      .mockReturnValueOnce(graph.promise)
    const store = useDebateStore()

    const requests = [
      store.fetchDebate('topic-a'),
      store.fetchRevisions('topic-a'),
      store.fetchVotes('topic-a'),
      store.fetchRelationGraph('topic-a', 'graph'),
    ]
    store.resetStore()
    current.resolve(response({ data: { id: 'topic-a' } }))
    revisionList.resolve(response({ data: [{ id: 'revision-a' }] }))
    votes.resolve(response({ data: { total_votes: 1 } }))
    graph.resolve(response({ data: { root_id: 'topic-a', nodes: [], relations: [] } }))

    expect(await Promise.all(requests)).toEqual([null, null, null, null])
    expect(store.currentDebate).toBeNull()
    expect(store.revisions).toEqual([])
    expect(store.voteSummary).toBeNull()
    expect(store.relationGraph).toBeNull()
    expect(store.revisionsLoading).toBe(false)
    expect(store.votesLoading).toBe(false)
    expect(store.relationLoading).toBe(false)
  })

  it('tracks wiki saves and revision fetches independently', async () => {
    const save = deferred<Response>()
    const revisionList = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(save.promise)
      .mockReturnValueOnce(revisionList.promise)
    const store = useDebateStore()

    const saveRequest = store.saveWiki('topic-a', {
      title: 'A',
      description: '',
      content: '',
      tags: [],
      edit_summary: 'Save A',
      base_revision: 'revision-a',
    })
    const revisionsRequest = store.fetchRevisions('topic-a')
    expect(store.wikiSaving).toBe(true)
    expect(store.revisionsLoading).toBe(true)
    expect(store.loading).toBe(false)

    save.resolve(response({ data: { id: 'topic-a', current_revision_id: 'revision-b' } }))
    await saveRequest
    expect(store.wikiSaving).toBe(false)
    expect(store.revisionsLoading).toBe(true)

    revisionList.resolve(response({ data: [{ id: 'revision-b' }] }))
    await revisionsRequest
    expect(store.revisionsLoading).toBe(false)
  })

  it('clears debate loading when a wiki save supersedes the fetch', async () => {
    const debate = deferred<Response>()
    const save = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(debate.promise)
      .mockReturnValueOnce(save.promise)
    const store = useDebateStore()

    const debateRequest = store.fetchDebate('topic-a')
    const saveRequest = store.saveWiki('topic-b', {
      title: 'B',
      description: '',
      content: '',
      tags: [],
      edit_summary: 'Save B',
      base_revision: 'revision-b',
    })
    save.resolve(response({ data: { id: 'topic-b' } }))
    await saveRequest
    debate.resolve(response({ data: { id: 'topic-a' } }))

    expect(await debateRequest).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.currentDebate?.id).toBe('topic-b')
  })

  it('keeps wiki saving active until the latest save finishes', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const store = useDebateStore()
    const payload = {
      title: 'Title',
      description: '',
      content: '',
      tags: [],
      edit_summary: 'Save',
      base_revision: 'revision-a',
    }

    const firstRequest = store.saveWiki('topic-a', payload)
    const secondRequest = store.saveWiki('topic-b', payload)
    first.resolve(response({ data: { id: 'topic-a' } }))
    await firstRequest
    expect(store.wikiSaving).toBe(true)
    expect(store.currentDebate).toBeNull()

    second.resolve(response({ data: { id: 'topic-b' } }))
    await secondRequest
    expect(store.wikiSaving).toBe(false)
    expect(store.currentDebate?.id).toBe('topic-b')
  })

  it('saves a wiki revision and updates the current debate', async () => {
    const auth = useAuthStore()
    auth.token = 'wiki-token'
    vi.mocked(fetch).mockResolvedValue(response({ data: { id: 'topic-1', current_revision_id: 'revision-2' } }))
    const store = useDebateStore()

    const result = await store.saveWiki('topic-1', {
      title: '新标题',
      description: '摘要',
      content: '正文',
      tags: ['科学'],
      edit_summary: '更新证据',
      base_revision: 'revision-1',
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/debate/topics/topic-1', expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wiki-token' },
      body: JSON.stringify({
        title: '新标题',
        description: '摘要',
        content: '正文',
        tags: ['科学'],
        edit_summary: '更新证据',
        base_revision: 'revision-1',
      }),
    }))
    expect(result).toEqual({ ok: true, debate: expect.objectContaining({ current_revision_id: 'revision-2' }) })
    expect(store.currentDebate?.current_revision_id).toBe('revision-2')
  })

  it('returns nested revision conflict details without clearing the current debate', async () => {
    const auth = useAuthStore()
    auth.token = 'wiki-token'
    vi.mocked(fetch).mockResolvedValue(response({
      error: {
        code: 'debate.edit_conflict',
        message: 'The debate changed while you were editing',
        details: { base_revision_id: 'revision-1', current_revision_id: 'revision-2' },
      },
    }, 409))
    const store = useDebateStore()
    store.currentDebate = { id: 'topic-1', current_revision_id: 'revision-1' } as never

    const result = await store.saveWiki('topic-1', {
      title: '冲突标题',
      description: '',
      content: '',
      tags: [],
      edit_summary: '冲突编辑',
      base_revision: 'revision-1',
    })

    expect(result).toEqual({
      ok: false,
      conflict: { base_revision_id: 'revision-1', current_revision_id: 'revision-2' },
    })
    expect(store.currentDebate?.current_revision_id).toBe('revision-1')
    expect(store.error).toBeNull()
  })

  it('fetches, sets, and removes the current debate vote with conditional auth', async () => {
    const voteData = {
      yes_votes: 7,
      no_votes: 3,
      total_votes: 10,
      current_direction: 'yes',
      current_user_vote: 'yes',
    }
    vi.mocked(fetch).mockResolvedValue(response({ data: voteData }))
    const store = useDebateStore()

    await store.fetchVotes('topic-1')
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/debate/topics/topic-1/votes', { headers: {} })

    const auth = useAuthStore()
    auth.token = 'vote-token'
    await store.setVote('topic-1', 'yes')
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/debate/topics/topic-1/vote', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer vote-token' },
      body: JSON.stringify({ direction: 'yes' }),
    })

    await store.removeVote('topic-1')
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/debate/topics/topic-1/vote', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer vote-token' },
    })
    expect(store.voteSummary).toEqual(voteData)
  })

  it('loads revision history, a revision, and its diff', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: [{ id: 'revision-2' }] }))
      .mockResolvedValueOnce(response({ data: { id: 'revision-2', version_number: 2 } }))
      .mockResolvedValueOnce(response({
        data: { revision_id: 'revision-2', against_revision_id: 'revision-1', changes: {} },
      }))
    const store = useDebateStore()

    const revisions = await store.fetchRevisions('topic-1')
    const revision = await store.fetchRevision('topic-1', 'revision-2')
    const diff = await store.fetchRevisionDiff('topic-1', 'revision-2', 'revision-1')

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/debate/topics/topic-1/revisions')
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/debate/topics/topic-1/revisions/revision-2')
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/debate/topics/topic-1/revisions/revision-2/diff?against=revision-1')
    expect(revisions?.[0]?.id).toBe('revision-2')
    expect(revision?.version_number).toBe(2)
    expect(diff?.against_revision_id).toBe('revision-1')
    expect(store.revisions[0]?.id).toBe('revision-2')
  })

  it('reverts a revision and reconfirms a stale reference with the wiki concurrency body', async () => {
    const auth = useAuthStore()
    auth.token = 'editor-token'
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { id: 'topic-1', current_revision_id: 'revision-3' } }))
      .mockResolvedValueOnce(response({ data: { id: 'topic-1', current_revision_id: 'revision-4' } }))
    const store = useDebateStore()

    await store.revertRevision('topic-1', 'revision-1', {
      base_revision: 'revision-2',
      edit_summary: '恢复旧版本',
    })
    await store.reconfirmReference('topic-1', 'relation-1', {
      base_revision: 'revision-3',
      edit_summary: '刷新引用',
    })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/debate/topics/topic-1/revisions/revision-1/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer editor-token' },
      body: JSON.stringify({ base_revision: 'revision-2', edit_summary: '恢复旧版本' }),
    })
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/debate/topics/topic-1/references/relation-1/reconfirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer editor-token' },
      body: JSON.stringify({ base_revision: 'revision-3', edit_summary: '刷新引用' }),
    })
    expect(store.currentDebate?.current_revision_id).toBe('revision-4')
  })

  it('loads immutable conclusion events', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ data: [{ id: 'event-1', direction: 'yes' }] }))
    const store = useDebateStore()

    const conclusions = await store.fetchConclusions('topic-1')

    expect(fetch).toHaveBeenCalledWith('/api/v1/debate/topics/topic-1/conclusions')
    expect(conclusions?.[0]?.direction).toBe('yes')
  })

  it('loads a relation graph with an optional depth', async () => {
    vi.mocked(fetch).mockResolvedValue(response({
      data: { root_id: 'root', nodes: [], relations: [], expandable_node_ids: ['next'] },
    }))
    const store = useDebateStore()

    await store.fetchRelationGraph('root', 'graph', 3)

    expect(fetch).toHaveBeenCalledWith('/api/v1/debates/root/relations?view=graph&depth=3')
    expect(store.relationGraph?.root_id).toBe('root')
    expect(store.relationGraph?.expandable_node_ids).toEqual(['next'])
  })

  it('keeps the two-argument relation graph call compatible', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ data: { root_id: 'root', nodes: [], relations: [] } }))
    const store = useDebateStore()

    await store.fetchRelationGraph('root', 'tree')

    expect(fetch).toHaveBeenCalledWith('/api/v1/debates/root/relations?view=tree')
  })

  it('keeps direct relation creation as a deprecated compatibility method', async () => {
    const auth = useAuthStore()
    auth.token = 'relation-token'
    vi.mocked(fetch).mockResolvedValue(response({
      data: { id: 'relation-1', source_debate_id: 'source', target_debate_id: 'target', stance: 'support' },
    }, 201))
    const store = useDebateStore()

    const created = await store.createRelation('source', 'target', 'support')

    expect(created?.id).toBe('relation-1')
    expect(fetch).toHaveBeenCalledWith('/api/v1/debate-relations', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer relation-token' }),
      body: JSON.stringify({ source_debate_id: 'source', target_debate_id: 'target', stance: 'support' }),
    }))
  })

  it('searches the real list endpoint and keeps only citable active debates', async () => {
    vi.mocked(fetch).mockResolvedValue(response({
      data: [
        { id: 'yes', status: 'active', current_conclusion_event_id: 'event-1', conclusion_type: 'yes' },
        { id: 'no', status: 'active', current_conclusion_event_id: 'event-2', conclusion_type: 'no' },
        { id: 'pending', status: 'active', conclusion_type: '' },
        { id: 'archived', status: 'archived', current_conclusion_event_id: 'event-3', conclusion_type: 'yes' },
        { id: 'legacy', status: 'active', current_conclusion_event_id: 'event-4', conclusion_type: 'inconclusive' },
      ],
    }))
    const store = useDebateStore()

    const results = await store.searchCitableDebates('肺癌', 'no')

    expect(fetch).toHaveBeenCalledWith('/api/v1/debate/topics?search=%E8%82%BA%E7%99%8C&status=active&page_size=10')
    expect(results.map(({ id }) => id)).toEqual(['yes'])
  })
})
