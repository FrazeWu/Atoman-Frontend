import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

describe('debate store HTTP contracts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
  })

  it('reads debate totals and current user argument votes from response metadata', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'debate-1', title: 'Debate' }],
        meta: { page: 1, page_size: 20, total: 12 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'argument-1', content: 'Argument' }],
        meta: { user_votes: { 'argument-1': 1 } },
      }))
    const store = useDebateStore()

    await store.fetchDebates()
    await store.fetchArguments('debate-1')

    expect(store.debatesTotal).toBe(12)
    expect(store.userVotes).toEqual({ 'argument-1': 1 })
  })

  it('uses the registered argument vote routes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'vote-1', vote_type: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { message: 'Vote removed' } }))
    const store = useDebateStore()

    const vote = await store.voteArgument('argument-1', 1)
    const removed = await store.removeVote('argument-1')

    expect(vote).toMatchObject({ id: 'vote-1', vote_type: 1 })
    expect(removed).toBe(true)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/debate-arguments/argument-1/vote')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/debate-arguments/argument-1/vote')
  })

  it('uses the registered conclusion vote route and unwraps response data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      data: { conclude_vote_count: 2, conclude_threshold: 5, auto_concluded: false },
    }))
    const store = useDebateStore()

    const result = await store.voteToConclude('debate-1')

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/debates/debate-1/conclusion-vote')
    expect(result).toEqual({ conclude_vote_count: 2, conclude_threshold: 5, auto_concluded: false })
  })

  it('appends later debate pages instead of replacing the first page', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'debate-1', title: 'First' }],
        meta: { page: 1, page_size: 1, total: 2 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'debate-2', title: 'Second' }],
        meta: { page: 2, page_size: 1, total: 2 },
      }))
    const store = useDebateStore()

    await store.fetchDebates({ page: 1, limit: 1 })
    await store.fetchDebates({ page: 2, limit: 1 })

    expect(store.debates.map(debate => debate.id)).toEqual(['debate-1', 'debate-2'])
  })

  it('clears the previous account argument votes when resetting the store', () => {
    const store = useDebateStore()
    store.userVotes = { 'argument-1': 1 }

    store.resetStore()

    expect(store.userVotes).toEqual({})
  })
})
