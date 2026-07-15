import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

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

  it.each([
    ['non-2xx response', () => Promise.resolve(new Response(null, { status: 500 }))],
    ['network failure', () => Promise.reject(new Error('offline'))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('records list loading failure for %s', async (_case, response) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(response)
    const store = useDebateStore()

    await store.fetchDebates()

    expect(store.error).toBe('Failed to fetch debates')
    expect(store.loading).toBe(false)
  })

  it('keeps existing debates when loading a later page fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'debate-1', title: 'First' }],
        meta: { page: 1, page_size: 1, total: 2 },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    const store = useDebateStore()

    await store.fetchDebates({ page: 1, limit: 1 })
    await store.fetchDebates({ page: 2, limit: 1 })

    expect(store.debates.map(debate => debate.id)).toEqual(['debate-1'])
    expect(store.error).toBe('Failed to fetch debates')
  })

  it('ignores an older fetch success after the latest filter succeeds', async () => {
    const oldResponse = deferred<Response>()
    const latestResponse = deferred<Response>()
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(latestResponse.promise)
    const store = useDebateStore()

    const oldResult = store.fetchDebates({ status: 'open' })
    const latestResult = store.fetchDebates({ status: 'concluded' })
    latestResponse.resolve(jsonResponse({
      data: [{ id: 'latest', title: 'Latest' }],
      meta: { total: 1 },
    }))
    await expect(latestResult).resolves.toBe(true)
    oldResponse.resolve(jsonResponse({
      data: [{ id: 'old', title: 'Old' }],
      meta: { total: 99 },
    }))

    await expect(oldResult).resolves.toBe(false)
    expect(store.debates.map(debate => debate.id)).toEqual(['latest'])
    expect(store.debatesTotal).toBe(1)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('keeps the latest request loading when an older fetch fails', async () => {
    const oldResponse = deferred<Response>()
    const latestResponse = deferred<Response>()
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(latestResponse.promise)
    const store = useDebateStore()

    const oldResult = store.fetchDebates({ status: 'open' })
    const latestResult = store.fetchDebates({ status: 'concluded' })
    oldResponse.reject(new Error('old request failed'))

    await expect(oldResult).resolves.toBe(false)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(true)

    latestResponse.resolve(jsonResponse({
      data: [{ id: 'latest', title: 'Latest' }],
      meta: { total: 1 },
    }))
    await expect(latestResult).resolves.toBe(true)
    expect(store.loading).toBe(false)
  })

  it('ignores older JSON that resolves after the latest filter response', async () => {
    const oldData = deferred<unknown>()
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(oldData.promise)
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(oldResponse)
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'latest', title: 'Latest' }],
        meta: { total: 1 },
      }))
    const store = useDebateStore()

    const oldResult = store.fetchDebates({ status: 'open' })
    await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())
    await expect(store.fetchDebates({ status: 'concluded' })).resolves.toBe(true)
    oldData.resolve({
      data: [{ id: 'old', title: 'Old' }],
      meta: { total: 99 },
    })

    await expect(oldResult).resolves.toBe(false)
    expect(store.debates.map(debate => debate.id)).toEqual(['latest'])
    expect(store.debatesTotal).toBe(1)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('does not restore debate state when a fetch succeeds after reset', async () => {
    const response = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise)
    const store = useDebateStore()

    const result = store.fetchDebates()
    store.resetStore()
    response.resolve(jsonResponse({
      data: [{ id: 'late', title: 'Late' }],
      meta: { total: 99 },
    }))

    await expect(result).resolves.toBe(false)
    expect(store.debates).toEqual([])
    expect(store.debatesTotal).toBe(0)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('does not restore an error or loading state when a fetch fails after reset', async () => {
    const response = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise)
    const store = useDebateStore()

    const result = store.fetchDebates()
    store.resetStore()
    response.reject(new Error('late failure'))

    await expect(result).resolves.toBe(false)
    expect(store.debates).toEqual([])
    expect(store.debatesTotal).toBe(0)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('does not restore debate state when JSON resolves after reset', async () => {
    const data = deferred<unknown>()
    const response = new Response(null, { status: 200 })
    const json = vi.spyOn(response, 'json').mockReturnValue(data.promise)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
    const store = useDebateStore()

    const result = store.fetchDebates()
    await vi.waitFor(() => expect(json).toHaveBeenCalledOnce())
    store.resetStore()
    data.resolve({
      data: [{ id: 'late', title: 'Late' }],
      meta: { total: 99 },
    })

    await expect(result).resolves.toBe(false)
    expect(store.debates).toEqual([])
    expect(store.debatesTotal).toBe(0)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('clears the previous account argument votes when resetting the store', () => {
    const store = useDebateStore()
    store.userVotes = { 'argument-1': 1 }

    store.resetStore()

    expect(store.userVotes).toEqual({})
  })
})
