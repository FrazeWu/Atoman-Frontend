import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTimelineStore } from '@/stores/timeline'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const personResponse = (id: string, name: string, total = 1) => new Response(JSON.stringify({
  data: [{ id, name }],
  total,
  page: 1,
  limit: 20,
}), { status: 200 })

const eventResponse = (id: string, title: string, total = 1) => new Response(JSON.stringify({
  data: [{ id, title }],
  total,
  page: 1,
  limit: 200,
}), { status: 200 })

describe('timeline store event requests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetch).mockReset()
  })

  it('sends the complete event query contract', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(eventResponse('event-1', '结果'))
    const store = useTimelineStore()

    await store.fetchEvents({
      category: 'history',
      yearStart: 1900,
      yearEnd: 2000,
      page: 3,
      limit: 40,
    })

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(requestUrl.pathname).toBe('/api/v1/timeline/events')
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({
      category: 'history',
      year_start: '1900',
      year_end: '2000',
      page: '3',
      limit: '40',
    })
  })

  it('does not let a delayed previous response overwrite the current query', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    const fetchMock = vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    const previousLoad = store.fetchEvents({ category: 'old', limit: 200 })
    const currentLoad = store.fetchEvents({ category: 'current', limit: 200 })
    current.resolve(eventResponse('event-current', '当前结果', 2))
    await currentLoad
    previous.resolve(eventResponse('event-old', '旧结果', 9))
    await previousLoad

    const previousUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    const currentUrl = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost')
    expect(Object.fromEntries(previousUrl.searchParams)).toEqual({ category: 'old', limit: '200' })
    expect(Object.fromEntries(currentUrl.searchParams)).toEqual({ category: 'current', limit: '200' })
    expect(store.events.map(event => event.title)).toEqual(['当前结果'])
    expect(store.eventsTotal).toBe(2)
  })

  it('keeps loading the current query when the previous response arrives first', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    const previousLoad = store.fetchEvents({ category: 'old' })
    const currentLoad = store.fetchEvents({ category: 'current' })
    previous.resolve(eventResponse('event-old', '旧结果'))
    await previousLoad

    expect(store.loading).toBe(true)
    expect(store.events).toEqual([])

    current.resolve(eventResponse('event-current', '当前结果'))
    await currentLoad
    expect(store.loading).toBe(false)
  })

  it('ignores a previous failed query after the current query succeeds', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    const previousLoad = store.fetchEvents({ category: 'old' })
    const currentLoad = store.fetchEvents({ category: 'current' })
    current.resolve(eventResponse('event-current', '当前结果'))
    await currentLoad
    previous.reject(new Error('old request failed'))
    await previousLoad

    expect(store.events.map(event => event.title)).toEqual(['当前结果'])
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('clears previous events while the current query is pending', async () => {
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(eventResponse('event-old', '旧结果', 9))
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    await store.fetchEvents({ category: 'old' })
    const currentLoad = store.fetchEvents({ category: 'current' })

    expect(store.events).toEqual([])
    expect(store.eventsTotal).toBe(0)
    expect(store.loading).toBe(true)

    current.resolve(eventResponse('event-current', '当前结果'))
    await currentLoad
  })

  it.each([
    ['network failure', () => Promise.reject(new Error('network failed'))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
    ['non-2xx response', () => Promise.resolve(new Response('', { status: 500 }))],
  ])('clears previous events and settles loading after current %s', async (_case, response) => {
    vi.mocked(fetch).mockImplementation(response)
    const store = useTimelineStore()
    store.events = [{ id: 'event-old', title: '旧结果' } as never]
    store.eventsTotal = 9

    await store.fetchEvents({ category: 'current' })

    expect(store.events).toEqual([])
    expect(store.eventsTotal).toBe(0)
    expect(store.error).toBe('Failed to fetch events')
    expect(store.loading).toBe(false)
  })
})

describe('timeline store person requests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetch).mockReset()
  })

  it('keeps loading the current search when the previous response arrives first', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    const previousLoad = store.fetchPersons({ search: 'old' })
    const currentLoad = store.fetchPersons({ search: 'current' })
    previous.resolve(personResponse('person-old', '旧结果'))
    await previousLoad

    expect(store.loading).toBe(true)
    expect(store.persons).toEqual([])

    current.resolve(personResponse('person-current', '当前结果'))
    await currentLoad
    expect(store.persons.map(person => person.name)).toEqual(['当前结果'])
  })

  it('clears previous persons while the current search is pending', async () => {
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(personResponse('person-old', '旧结果', 9))
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    await store.fetchPersons({ search: 'old' })
    expect(store.persons.map(person => person.name)).toEqual(['旧结果'])
    expect(store.personsTotal).toBe(9)

    const currentLoad = store.fetchPersons({ search: 'current' })
    expect(store.persons).toEqual([])
    expect(store.personsTotal).toBe(0)
    expect(store.loading).toBe(true)

    current.resolve(personResponse('person-current', '当前结果'))
    await currentLoad
  })

  it('does not let a delayed previous response overwrite the current search', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    const previousLoad = store.fetchPersons({ search: 'old' })
    const currentLoad = store.fetchPersons({ search: 'current' })
    current.resolve(personResponse('person-current', '当前结果', 2))
    await currentLoad
    previous.resolve(personResponse('person-old', '旧结果', 9))
    await previousLoad

    expect(store.persons.map(person => person.name)).toEqual(['当前结果'])
    expect(store.personsTotal).toBe(2)
  })

  it('ignores a previous failed search after the current search succeeds', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    const previousLoad = store.fetchPersons({ search: 'old' })
    const currentLoad = store.fetchPersons({ search: 'current' })
    current.resolve(personResponse('person-current', '当前结果'))
    await currentLoad
    previous.reject(new Error('old request failed'))
    await previousLoad

    expect(store.persons.map(person => person.name)).toEqual(['当前结果'])
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('settles loading when the current person search fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('current request failed'))
    const store = useTimelineStore()

    await store.fetchPersons({ search: 'current' })

    expect(store.persons).toEqual([])
    expect(store.error).toBe('Failed to fetch persons')
    expect(store.loading).toBe(false)
  })
})
