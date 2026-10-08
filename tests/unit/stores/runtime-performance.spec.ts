import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useForumStore } from '@/stores/forum'
import { useInboxStore } from '@/stores/inbox'
import { useDMStore } from '@/stores/dm'
import { useNotificationStore } from '@/stores/notification'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  constructor(_url: string) { FakeWebSocket.instances.push(this) }
  close() {}
}

describe('shared runtime request performance', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'cookie-session'
    auth.isAuthenticated = true
  })

  afterEach(() => {
    useInboxStore().$dispose()
    useDMStore().$dispose()
    useNotificationStore().$dispose()
    useFeedStore().$dispose()
    useForumStore().$dispose()
    useAuthStore().$dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shares concurrent forum category loads and exposes the categories to both callers', async () => {
    const pending = deferred()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise.then(() =>
      new Response(JSON.stringify({ data: [{ id: 'category-1', name: '讨论' }] }), { status: 200 }),
    ))
    const forum = useForumStore()
    const requests = [forum.fetchCategories(), forum.fetchCategories()]
    pending.resolve()
    await Promise.all(requests)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(forum.categories).toEqual([{ id: 'category-1', name: '讨论' }])
    expect(forum.categoriesLoaded).toBe(true)
  })

  it.each(['fetchSubscriptions', 'fetchGroups'] as const)(
    'shares concurrent feed %s loads and makes both callers succeed',
    async method => {
      const pending = deferred()
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise.then(() =>
        new Response(JSON.stringify({ data: [{ id: 'loaded-1' }] }), { status: 200 }),
      ))
      const feed = useFeedStore()
      const requests = [feed[method](), feed[method]()]
      pending.resolve()
      const results = await Promise.all(requests)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(results).toEqual([true, true])
      expect(method === 'fetchSubscriptions' ? feed.subscriptions : feed.groups).toEqual([{ id: 'loaded-1' }])
    },
  )

  it('shares concurrent notification unread loads without losing the count', async () => {
    const pending = deferred()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending.promise.then(() =>
      new Response(JSON.stringify({ data: { items: { reply: 3, dm: 2 } } }), { status: 200 }),
    ))
    const notification = useNotificationStore()
    const requests = [notification.fetchUnreadCounts(), notification.fetchUnreadCounts()]
    pending.resolve()
    await Promise.all(requests)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(notification.unreadCount).toBe(5)
  })

  it.each(['forum', 'subscriptions', 'groups', 'notifications'] as const)(
    'isolates %s results when cookie-session users change and the old request finishes last',
    async resource => {
      const auth = useAuthStore()
      auth.user = { uuid: 'old-user', username: 'old', email: 'old@example.com' }
      const forum = useForumStore()
      const feed = useFeedStore()
      const notification = useNotificationStore()
      const cases = {
        forum: { load: forum.fetchCategories, state: () => forum.categories, oldData: [{ id: 'old-category' }], newData: [{ id: 'new-category' }], expected: [{ id: 'new-category' }] },
        subscriptions: { load: feed.fetchSubscriptions, state: () => feed.subscriptions, oldData: [{ id: 'old-subscription' }], newData: [{ id: 'new-subscription' }], expected: [{ id: 'new-subscription' }] },
        groups: { load: feed.fetchGroups, state: () => feed.groups, oldData: [{ id: 'old-group' }], newData: [{ id: 'new-group' }], expected: [{ id: 'new-group' }] },
        notifications: { load: notification.fetchUnreadCounts, state: () => notification.unreadCount, oldData: { items: { reply: 26 } }, newData: { items: { reply: 2 } }, expected: 2 },
      }
      const target = cases[resource]
      const oldGate = deferred()
      const newGate = deferred()
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        .mockImplementationOnce(() => oldGate.promise.then(() => new Response(JSON.stringify({ data: target.oldData }), { status: 200 })))
        .mockImplementationOnce(() => newGate.promise.then(() => new Response(JSON.stringify({ data: target.newData }), { status: 200 })))
      const oldRequest = target.load()
      auth.user = { uuid: 'new-user', username: 'new', email: 'new@example.com' }
      const newRequest = target.load()

      try {
        expect(fetchMock).toHaveBeenCalledTimes(2)
        newGate.resolve()
        await newRequest
        expect(target.state()).toEqual(target.expected)

        oldGate.resolve()
        await oldRequest
        expect(target.state()).toEqual(target.expected)
      } finally {
        oldGate.resolve()
        newGate.resolve()
        await Promise.allSettled([oldRequest, newRequest])
      }
    },
  )

  it.each(['forum', 'subscriptions', 'groups', 'notifications'] as const)(
    'allows refreshing %s after a failed request',
    async resource => {
      const forum = useForumStore()
      const feed = useFeedStore()
      const notification = useNotificationStore()
      const cases = {
        forum: { load: forum.fetchCategories, state: () => forum.categories, data: [{ id: 'category-1' }], expected: [{ id: 'category-1' }] },
        subscriptions: { load: feed.fetchSubscriptions, state: () => feed.subscriptions, data: [{ id: 'subscription-1' }], expected: [{ id: 'subscription-1' }] },
        groups: { load: feed.fetchGroups, state: () => feed.groups, data: [{ id: 'group-1' }], expected: [{ id: 'group-1' }] },
        notifications: { load: notification.fetchUnreadCounts, state: () => notification.unreadCount, data: { items: { reply: 4 } }, expected: 4 },
      }
      const target = cases[resource]
      const fetchMock = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'temporarily unavailable' }), { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: target.data }), { status: 200 }))

      await target.load()
      await target.load()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(target.state()).toEqual(target.expected)
    },
  )

  it('pauses fallback inbox polling while the page is hidden and resumes on return', async () => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    let visible = true
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible ? 'visible' : 'hidden')
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => !visible)
    const notification = useNotificationStore()
    const refresh = vi.spyOn(notification, 'fetchUnreadCounts').mockResolvedValue()
    const reconcile = vi.spyOn(useDMStore(), 'reconcileFromServer').mockResolvedValue()
    const inbox = useInboxStore()

    try {
      await inbox.connect()
      FakeWebSocket.instances[0].onclose?.()
      visible = false
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(60_000)

      expect(refresh).not.toHaveBeenCalled()
      expect(reconcile).not.toHaveBeenCalled()

      visible = true
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(60_000)
      expect(refresh).toHaveBeenCalled()
      expect(reconcile).toHaveBeenCalled()
    } finally {
      inbox.disconnect()
    }
  })

  it('does not start another fallback inbox poll while the previous poll is pending', async () => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const pending = deferred()
    const refresh = vi.spyOn(useNotificationStore(), 'fetchUnreadCounts').mockImplementation(() => pending.promise)
    vi.spyOn(useDMStore(), 'reconcileFromServer').mockResolvedValue()
    const inbox = useInboxStore()

    try {
      await inbox.connect()
      FakeWebSocket.instances[0].onclose?.()
      await vi.advanceTimersByTimeAsync(120_000)

      expect(refresh).toHaveBeenCalledTimes(1)
    } finally {
      inbox.disconnect()
      pending.resolve()
      await pending.promise
    }
  })
})
