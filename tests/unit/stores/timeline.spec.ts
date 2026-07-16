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

const personResponse = (id: string, name: string, total = 1, page = 1, limit = 20) => new Response(JSON.stringify({
  data: [{ id, name }],
  total,
  page,
  limit,
}), { status: 200 })

const eventResponse = (id: string, title: string, total = 1) => new Response(JSON.stringify({
  data: [{ id, title }],
  total,
  page: 1,
  limit: 200,
}), { status: 200 })

const eventPageResponse = (ids: string[], total: number, page: number, limit: number) => new Response(JSON.stringify({
  data: ids.map(id => ({ id, title: id })),
  total,
  page,
  limit,
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
      limit: 40,
    })

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(requestUrl.pathname).toBe('/api/v1/timeline/events')
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({
      category: 'history',
      year_start: '1900',
      year_end: '2000',
      page: '1',
      limit: '40',
    })
  })

  it('loads every event page and commits the complete result atomically', async () => {
    const secondPage = deferred<Response>()
    const fetchMock = vi.mocked(fetch)
      .mockResolvedValueOnce(eventPageResponse(['event-1', 'event-2'], 3, 1, 2))
      .mockReturnValueOnce(secondPage.promise)
    const store = useTimelineStore()

    const loading = store.fetchEvents({ category: 'history', limit: 2 })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(store.events).toEqual([])
    expect(store.loading).toBe(true)
    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]), 'http://localhost')
    expect(Object.fromEntries(secondUrl.searchParams)).toEqual({ category: 'history', page: '2', limit: '2' })

    secondPage.resolve(eventPageResponse(['event-3'], 3, 2, 2))
    await loading
    expect(store.events.map(event => event.id)).toEqual(['event-1', 'event-2', 'event-3'])
    expect(store.eventsTotal).toBe(3)
    expect(store.loading).toBe(false)
  })

  it('does not expose a partial result when a later event page fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(eventPageResponse(['event-1', 'event-2'], 3, 1, 2))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
    const store = useTimelineStore()
    store.events = [{ id: 'event-old', title: '旧筛选' } as never]
    store.eventsTotal = 1

    await store.fetchEvents({ limit: 2 })

    expect(store.events).toEqual([])
    expect(store.eventsTotal).toBe(0)
    expect(store.error).toBe('Failed to fetch events')
    expect(store.loading).toBe(false)
  })

  it('rejects an event page containing more unique rows than its total', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(eventPageResponse(['unexpected-event'], 0, 1, 2))
    const store = useTimelineStore()
    store.events = [{ id: 'event-old', title: '旧筛选' } as never]
    store.eventsTotal = 1

    await store.fetchEvents({ limit: 2 })

    expect(store.events).toEqual([])
    expect(store.eventsTotal).toBe(0)
    expect(store.error).toBe('Failed to fetch events')
    expect(store.loading).toBe(false)
  })

  it('stops when duplicate full pages cannot satisfy the reported total', async () => {
    const fetchMock = vi.mocked(fetch)
      .mockResolvedValueOnce(eventPageResponse(['event-1', 'event-2'], 3, 1, 2))
      .mockResolvedValueOnce(eventPageResponse(['event-1', 'event-2'], 3, 2, 2))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
    const store = useTimelineStore()

    await store.fetchEvents({ limit: 2 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.events).toEqual([])
    expect(store.eventsTotal).toBe(0)
    expect(store.error).toBe('Failed to fetch events')
  })

  it('does not let an old pagination chain overwrite a newer filter', async () => {
    const oldSecondPage = deferred<Response>()
    const fetchMock = vi.mocked(fetch).mockImplementation((input) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.searchParams.get('category') === 'new') {
        return Promise.resolve(eventPageResponse(['new-1'], 1, 1, 2))
      }
      if (url.searchParams.get('page') === '2') return oldSecondPage.promise
      return Promise.resolve(eventPageResponse(['old-1', 'old-2'], 3, 1, 2))
    })
    const store = useTimelineStore()

    const oldLoad = store.fetchEvents({ category: 'old', limit: 2 })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const newLoad = store.fetchEvents({ category: 'new', limit: 2 })
    await newLoad
    oldSecondPage.resolve(eventPageResponse(['old-3'], 3, 2, 2))
    await oldLoad

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(store.events.map(event => event.id)).toEqual(['new-1'])
    expect(store.eventsTotal).toBe(1)
    expect(store.error).toBeNull()
  })

  it('invalidates an event pagination chain when the view is disposed', async () => {
    const firstPage = deferred<Response>()
    vi.mocked(fetch).mockReturnValueOnce(firstPage.promise)
    const store = useTimelineStore()

    const loading = store.fetchEvents({ limit: 2 })
    store.cancelEventRequests()
    firstPage.resolve(eventPageResponse(['late-event'], 1, 1, 2))
    await loading

    expect(store.events).toEqual([])
    expect(store.eventsTotal).toBe(0)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
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
    current.resolve(eventResponse('event-current', '当前结果'))
    await currentLoad
    previous.resolve(eventResponse('event-old', '旧结果', 9))
    await previousLoad

    const previousUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    const currentUrl = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost')
    expect(Object.fromEntries(previousUrl.searchParams)).toEqual({ category: 'old', page: '1', limit: '200' })
    expect(Object.fromEntries(currentUrl.searchParams)).toEqual({ category: 'current', page: '1', limit: '200' })
    expect(store.events.map(event => event.title)).toEqual(['当前结果'])
    expect(store.eventsTotal).toBe(1)
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
      .mockResolvedValueOnce(eventResponse('event-old', '旧结果'))
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

    expect(store.personsLoading).toBe(true)
    expect(store.persons).toEqual([])

    current.resolve(personResponse('person-current', '当前结果'))
    await currentLoad
    expect(store.persons.map(person => person.name)).toEqual(['当前结果'])
  })

  it('keeps previous persons until the current search succeeds', async () => {
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(personResponse('person-old', '旧结果', 9))
      .mockReturnValueOnce(current.promise)
    const store = useTimelineStore()

    await store.fetchPersons({ search: 'old' })
    expect(store.persons.map(person => person.name)).toEqual(['旧结果'])
    expect(store.personsTotal).toBe(9)

    const currentLoad = store.fetchPersons({ search: 'current' })
    expect(store.persons.map(person => person.name)).toEqual(['旧结果'])
    expect(store.personsTotal).toBe(9)
    expect(store.personsLoading).toBe(true)

    current.resolve(personResponse('person-current', '当前结果'))
    await currentLoad
    expect(store.persons.map(person => person.name)).toEqual(['当前结果'])
    expect(store.personsTotal).toBe(1)
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
    expect(store.personsError).toBeNull()
    expect(store.personsLoading).toBe(false)
  })

  it('settles loading when the current person search fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('current request failed'))
    const store = useTimelineStore()

    await store.fetchPersons({ search: 'current' })

    expect(store.persons).toEqual([])
    expect(store.personsError).toBe('Failed to fetch persons')
    expect(store.personsLoading).toBe(false)
  })

  it('keeps the committed person list when a replacement search fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(personResponse('person-old', '旧结果', 9))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
    const store = useTimelineStore()

    await store.fetchPersons({ search: 'old' })
    await expect(store.fetchPersons({ search: 'current' })).resolves.toBe(false)

    expect(store.persons.map(person => person.name)).toEqual(['旧结果'])
    expect(store.personsTotal).toBe(9)
    expect(store.personsError).toBe('Failed to fetch persons')
  })

  it('appends later person pages using the backend page envelope without duplicate rows', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: 'person-1', name: 'Ada' }, { id: 'person-2', name: 'Grace' }],
        total: 3,
        page: 1,
        limit: 2,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: 'person-2', name: 'Grace' }, { id: 'person-3', name: 'Katherine' }],
        total: 3,
        page: 2,
        limit: 2,
      }), { status: 200 }))
    const store = useTimelineStore()

    await expect(store.fetchPersons({ page: 1, limit: 2 })).resolves.toBe(true)
    await expect(store.fetchPersons({ page: 2, limit: 2 })).resolves.toBe(true)

    expect(store.persons.map(person => person.id)).toEqual(['person-1', 'person-2', 'person-3'])
    expect(store.personsTotal).toBe(3)
    const urls = vi.mocked(fetch).mock.calls.map(call => new URL(String(call[0]), 'http://localhost'))
    expect(urls.map(url => Object.fromEntries(url.searchParams))).toEqual([
      { page: '1', limit: '2' },
      { page: '2', limit: '2' },
    ])
  })

  it.each([
    ['non-2xx response', () => Promise.resolve(new Response('', { status: 500 }))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
    ['invalid envelope', () => Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))],
  ])('keeps existing persons and reports a later-page %s', async (_case, response) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(personResponse('person-1', 'Ada', 2))
      .mockImplementationOnce(response)
    const store = useTimelineStore()

    await store.fetchPersons({ page: 1, limit: 20 })
    await expect(store.fetchPersons({ page: 2, limit: 20 })).resolves.toBe(false)

    expect(store.persons.map(person => person.name)).toEqual(['Ada'])
    expect(store.personsTotal).toBe(2)
    expect(store.personsError).toBe('Failed to fetch persons')
    expect(store.personsLoading).toBe(false)
  })

  it('does not let a completed list request clear an in-flight person detail state', async () => {
    const listResponse = deferred<Response>()
    const detailResponse = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(listResponse.promise)
      .mockReturnValueOnce(detailResponse.promise)
    const store = useTimelineStore()

    const listLoad = store.fetchPersons()
    const detailLoad = store.fetchPerson('person-1')
    expect(store.personsLoading).toBe(true)
    expect(store.loading).toBe(true)

    listResponse.resolve(personResponse('person-1', 'Ada'))
    await listLoad

    expect(store.personsLoading).toBe(false)
    expect(store.loading).toBe(true)
    expect(store.error).toBeNull()

    detailResponse.reject(new Error('detail failed'))
    await detailLoad

    expect(store.loading).toBe(false)
    expect(store.error).toBe('Failed to fetch person')
    expect(store.personsError).toBeNull()
  })

  it('decrements the current list total after deleting a listed person', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }))
    const store = useTimelineStore()
    store.persons = [
      { id: 'person-1', name: 'Ada' },
      { id: 'person-2', name: 'Grace' },
    ] as never
    store.personsTotal = 2

    await store.deletePerson('person-1')

    expect(store.persons.map(person => person.id)).toEqual(['person-2'])
    expect(store.personsTotal).toBe(1)
  })
})
