import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDMStore } from '@/stores/dm'
import { useInboxStore } from '@/stores/inbox'
import { useNotificationStore } from '@/stores/notification'

class FakeWebSocket {
  static urls: string[] = []
  static instances: FakeWebSocket[] = []

  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(url: string) {
    FakeWebSocket.urls.push(url)
    FakeWebSocket.instances.push(this)
  }

  close() {}
}

describe('inbox store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    FakeWebSocket.urls = []
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  it('connects user websocket without putting bearer token in the URL', async () => {
    const auth = useAuthStore()
    auth.token = 'long-lived-token'
    auth.isAuthenticated = true

    const inbox = useInboxStore()
    await inbox.connect()

    expect(FakeWebSocket.urls).toHaveLength(1)
    expect(FakeWebSocket.urls[0]).toBe('ws://localhost:3000/ws/user')
    expect(FakeWebSocket.urls[0]).not.toContain('token=')
  })

  it('ignores malformed and legacy dm websocket payloads', async () => {
    const auth = useAuthStore()
    auth.token = 'cookie-session'
    auth.isAuthenticated = true
    const inbox = useInboxStore()
    await inbox.connect()
    const dm = useDMStore()
    const notifications = useNotificationStore()
    const receiveEvent = vi.spyOn(dm, 'receiveEvent')

    await FakeWebSocket.instances[0].onmessage?.({ data: '{invalid' } as MessageEvent)
    await FakeWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ event: 'dm', data: { sender_username: 'alice' } }) } as MessageEvent)

    expect(receiveEvent).not.toHaveBeenCalled()
  })

  it('normalizes and routes all dm v2 websocket events', async () => {
    const auth = useAuthStore()
    auth.token = 'cookie-session'
    auth.isAuthenticated = true
    const inbox = useInboxStore()
    await inbox.connect()
    const dm = useDMStore()
    const notifications = useNotificationStore()
    const receiveEvent = vi.spyOn(dm, 'receiveEvent')
    const markRead = vi.spyOn(dm, 'markRead').mockResolvedValue()
    dm.activeConversationId = 'conversation-1'
    notifications.unreadCounts.dm = 9
    const mailbox = { party: { type: 'user', id: 'me', name: '', avatar_url: '' }, unread: 1 }

    for (const payload of [
      { event: 'dm.message.created', data: { message: { id: 'message-1', conversation_id: 'conversation-1', sender_type: 'user', sender_id: 'alice', client_message_id: 'client-1', content: 'hello', created_at: '2026-07-23T00:00:00Z' }, conversation: { id: 'conversation-1', participant_a: mailbox.party, participant_b: { type: 'user', id: 'alice', name: 'Alice', avatar_url: '' }, last_message_preview: 'hello', unread: 1, blocked: false }, mailbox, dm_unread: 1, total_unread: 3 } },
      { event: 'dm.message.read', data: { conversation_id: 'conversation-1', read_at: '2026-07-23T00:01:00Z', mailbox, dm_unread: 0, total_unread: 2 } },
      { event: 'dm.mailbox.updated', data: { mailbox, dm_unread: 0, total_unread: 2 } },
    ]) {
      await FakeWebSocket.instances[0].onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)
    }

    expect(receiveEvent.mock.calls.map(([event]) => event.event)).toEqual(['dm.message.created', 'dm.message.read', 'dm.mailbox.updated'])
    expect((receiveEvent.mock.calls[0][0] as { data: { mailbox: { display_name: string } } }).data.mailbox.display_name).toBe('me')
    expect(markRead).toHaveBeenCalledTimes(1)
    expect(markRead).toHaveBeenCalledWith()
    expect(notifications.unreadCounts.dm).toBe(0)
  })

  it('reconnects with exponential backoff and refreshes state after opening', async () => {
    vi.useFakeTimers()
    const auth = useAuthStore()
    auth.token = 'cookie-session'
    auth.isAuthenticated = true
    const dm = useDMStore()
    const notifications = useNotificationStore()
    const reconcile = vi.spyOn(dm, 'reconcileFromServer').mockResolvedValue()
    const refresh = vi.spyOn(notifications, 'fetchUnreadCounts').mockResolvedValue()
    const inbox = useInboxStore()

    await inbox.connect()
    for (const delay of [1000, 2000, 4000, 8000, 16000, 30000]) {
      FakeWebSocket.instances.at(-1)?.onclose?.()
      await vi.advanceTimersByTimeAsync(delay)
    }
    await FakeWebSocket.instances.at(-1)?.onopen?.()
    await vi.runAllTicks()

    expect(FakeWebSocket.instances).toHaveLength(7)
    expect(reconcile).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('reconnects after socket errors and falls back to polling when reconciliation fails', async () => {
    vi.useFakeTimers()
    const auth = useAuthStore()
    auth.token = 'cookie-session'
    auth.isAuthenticated = true
    const dm = useDMStore()
    vi.spyOn(dm, 'reconcileFromServer').mockRejectedValue(new Error('offline'))
    const inbox = useInboxStore()

    await inbox.connect()
    FakeWebSocket.instances[0].onerror?.()
    await vi.advanceTimersByTimeAsync(1000)
    await FakeWebSocket.instances[1].onopen?.()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(inbox.polling).toBe(true)
    vi.useRealTimers()
  })

  it('makes a reset socket unable to write state or reconnect', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const auth = useAuthStore()
    auth.token = 'cookie-session'
    auth.isAuthenticated = true
    const inbox = useInboxStore()
    const dm = useDMStore()
    const notifications = useNotificationStore()
    const receiveEvent = vi.spyOn(dm, 'receiveEvent')
    const receiveNotification = vi.spyOn(notifications, 'receiveNotification')

    await inbox.connect()
    const staleSocket = FakeWebSocket.instances[0]
    await auth.logout()
    auth.token = 'new-session'
    auth.isAuthenticated = true

    await staleSocket.onmessage?.({ data: JSON.stringify({ event: 'notification', data: { id: 'old' } }) } as MessageEvent)
    staleSocket.onclose?.()
    await vi.advanceTimersByTimeAsync(30000)

    expect(receiveEvent).not.toHaveBeenCalled()
    expect(receiveNotification).not.toHaveBeenCalled()
    expect(FakeWebSocket.instances).toHaveLength(1)

    await inbox.connect()
    expect(FakeWebSocket.instances).toHaveLength(2)
    vi.useRealTimers()
  })
})
