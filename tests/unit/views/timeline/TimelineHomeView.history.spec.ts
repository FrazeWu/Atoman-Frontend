import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useTimelineStore } from '@/stores/timeline'
import type { TimelineEvent, TimelineRevision } from '@/types'
import TimelineHomeView from '@/views/timeline/TimelineHomeView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const event = (id: string, title: string): TimelineEvent => ({
  id,
  user_id: 'user-1',
  title,
  description: '',
  content: '',
  event_date: '2026-07-01T00:00:00Z',
  location: 'Berlin',
  source: 'Archive',
  category: 'history',
  tags: [],
  is_public: true,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
})

const revision = (id: string, eventId: string, title: string): TimelineRevision => ({
  id,
  event_id: eventId,
  editor_id: 'user-1',
  title,
  description: '',
  content: '',
  event_date: '2026-07-01T00:00:00Z',
  location: 'Berlin',
  source: 'Archive',
  category: 'history',
  is_public: true,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
})

const historyResponse = (revisions: TimelineRevision[]) => new Response(JSON.stringify({ data: revisions }), { status: 200 })

type HistoryState = {
  historyEvent: TimelineEvent | null
  historyRevisions: TimelineRevision[]
  loadingHistory: boolean
  openHistory: (target: TimelineEvent) => Promise<void>
}

function historyState(wrapper: VueWrapper) {
  return wrapper.vm.$.setupState as HistoryState
}

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  vi.spyOn(useTimelineStore(), 'fetchEvents').mockResolvedValue()
  const auth = useAuthStore()
  auth.token = 'history-token'
  auth.isAuthenticated = true
  auth.user = { uuid: 'user-1', username: 'alice', email: 'alice@example.com' }

  const wrapper = mount(TimelineHomeView, {
    global: {
      plugins: [pinia],
      stubs: {
        PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
        PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        PModal: { template: '<section class="modal"><slot /><slot name="footer" /></section>' },
        PEmpty: true,
        PInput: true,
        PTextarea: true,
        PConfirm: true,
        PDatetimePicker: true,
        TimelineEventFormSection: true,
        TimelineMapPane: true,
      },
    },
  })
  return { wrapper, state: historyState(wrapper) }
}

describe('TimelineHomeView history requests', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('uses the event history endpoint with the bearer token', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(historyResponse([]))
    const { state } = mountView()

    await state.openHistory(event('event-a', '事件 A'))

    const [input, init] = fetchMock.mock.calls[0]
    const requestUrl = new URL(String(input), 'http://localhost')
    expect(requestUrl.pathname).toBe('/api/v1/timeline/events/event-a/history')
    expect(init?.headers).toEqual({ Authorization: 'Bearer history-token' })
  })

  it('does not let a delayed previous success overwrite the current event', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const { state } = mountView()

    const previousLoad = state.openHistory(event('event-a', '事件 A'))
    const currentLoad = state.openHistory(event('event-b', '事件 B'))
    current.resolve(historyResponse([revision('rev-b', 'event-b', '版本 B')]))
    await currentLoad
    previous.resolve(historyResponse([revision('rev-a', 'event-a', '版本 A')]))
    await previousLoad

    expect(state.historyEvent?.id).toBe('event-b')
    expect(state.historyRevisions.map(item => item.id)).toEqual(['rev-b'])
  })

  it('keeps loading the current event when the previous request finishes first', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const { state } = mountView()

    const previousLoad = state.openHistory(event('event-a', '事件 A'))
    const currentLoad = state.openHistory(event('event-b', '事件 B'))
    previous.resolve(historyResponse([revision('rev-a', 'event-a', '版本 A')]))
    await previousLoad

    expect(state.historyEvent?.id).toBe('event-b')
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(true)

    current.resolve(historyResponse([]))
    await currentLoad
  })

  it('ignores a previous failure while the current event is loading', async () => {
    const previous = deferred<Response>()
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise)
    const { state } = mountView()

    const previousLoad = state.openHistory(event('event-a', '事件 A'))
    const currentLoad = state.openHistory(event('event-b', '事件 B'))
    previous.reject(new Error('old request failed'))
    await expect(previousLoad).resolves.toBeUndefined()

    expect(state.historyEvent?.id).toBe('event-b')
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(true)

    current.resolve(historyResponse([]))
    await currentLoad
  })

  it('clears previous revisions immediately when opening another event', async () => {
    const current = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(historyResponse([revision('rev-a', 'event-a', '版本 A')]))
      .mockReturnValueOnce(current.promise)
    const { state } = mountView()

    await state.openHistory(event('event-a', '事件 A'))
    const currentLoad = state.openHistory(event('event-b', '事件 B'))

    expect(state.historyEvent?.id).toBe('event-b')
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(true)

    current.resolve(historyResponse([]))
    await currentLoad
  })

  it.each([
    ['network failure', () => Promise.reject(new Error('network failed'))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
    ['non-2xx response', () => Promise.resolve(new Response('', { status: 500 }))],
  ])('settles the current %s without stale revisions or rejection', async (_case, response) => {
    vi.mocked(fetch).mockImplementation(response)
    const { state } = mountView()

    await expect(state.openHistory(event('event-a', '事件 A'))).resolves.toBeUndefined()

    expect(state.historyEvent?.id).toBe('event-a')
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(false)
  })

  it('invalidates the request and clears history state when the modal closes', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const { wrapper, state } = mountView()

    const load = state.openHistory(event('event-a', '事件 A'))
    await nextTick()
    await wrapper.findAll('.a-modal-close').at(-1)!.trigger('click')
    expect(state.historyEvent).toBeNull()
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(false)

    pending.resolve(historyResponse([revision('rev-a', 'event-a', '版本 A')]))
    await load
    expect(state.historyEvent).toBeNull()
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(false)
  })

  it('clears loaded history immediately on unmount', async () => {
    vi.mocked(fetch).mockResolvedValue(historyResponse([revision('rev-a', 'event-a', '版本 A')]))
    const { wrapper, state } = mountView()

    await state.openHistory(event('event-a', '事件 A'))
    expect(state.historyEvent?.id).toBe('event-a')
    expect(state.historyRevisions.map(item => item.id)).toEqual(['rev-a'])
    expect(state.loadingHistory).toBe(false)

    wrapper.unmount()

    expect(state.historyEvent).toBeNull()
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(false)
  })

  it('clears a pending history request on unmount and ignores its delayed response', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const { wrapper, state } = mountView()

    const load = state.openHistory(event('event-a', '事件 A'))
    expect(state.loadingHistory).toBe(true)
    wrapper.unmount()

    expect(state.historyEvent).toBeNull()
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(false)

    pending.resolve(historyResponse([revision('rev-a', 'event-a', '版本 A')]))
    await load

    expect(state.historyEvent).toBeNull()
    expect(state.historyRevisions).toEqual([])
    expect(state.loadingHistory).toBe(false)
  })
})
