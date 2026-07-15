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
})
