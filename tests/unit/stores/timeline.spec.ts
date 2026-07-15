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
