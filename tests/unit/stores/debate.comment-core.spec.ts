import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/composables/useApi', () => ({ useApi: () => ({ url: '/api/v1' }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'token', isAuthenticated: true, user: { id: 'user-1', uuid: 'user-1' } }),
}))

import { useDebateStore } from '@/stores/debate'

describe('debate arguments use comment-core IDs and typed routes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  it('creates a typed argument through the formal debate route', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'comment-1' } }), { status: 201 }))
    await useDebateStore().createArgument('debate-1', { content: 'claim', argument_type: 'support' })
    expect(fetch).toHaveBeenCalledWith('/api/v1/debates/debate-1/arguments', expect.objectContaining({ method: 'POST' }))
  })

  it('updates typed metadata and core content through PATCH', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'comment-1' } }), { status: 200 }))
    await useDebateStore().updateArgument('comment-1', { content: 'edited', argument_type: 'evidence' })
    expect(fetch).toHaveBeenCalledWith('/api/v1/debate-arguments/comment-1', expect.objectContaining({ method: 'PATCH' }))
  })

  it('votes using the comment UUID', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { argument_id: 'comment-1' } }), { status: 200 }))
    await useDebateStore().voteArgument('comment-1', 1)
    expect(fetch).toHaveBeenCalledWith('/api/v1/debate-arguments/comment-1/vote', expect.objectContaining({ method: 'POST' }))
  })

  it('appends argument pages without duplicates and preserves them on failure', async () => {
	vi.mocked(fetch)
	  .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'a' }, { id: 'b' }], meta: { page: 1, has_more: true } }), { status: 200 }))
	  .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'b' }, { id: 'c' }], meta: { page: 2, has_more: false } }), { status: 200 }))
	  .mockRejectedValueOnce(new Error('offline'))
	const store = useDebateStore()
	await store.fetchArguments('debate-1')
	await store.fetchArguments('debate-1', { reset: false })
	expect(store.argumentList.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
	expect(store.argumentsHasMore).toBe(false)
	await store.fetchArguments('debate-1', { reset: false })
	expect(store.argumentList.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
  })
})
