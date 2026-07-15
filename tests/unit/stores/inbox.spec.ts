import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDMStore } from '@/stores/dm'
import { useInboxStore } from '@/stores/inbox'
import { useNotificationStore } from '@/stores/notification'

class FakeWebSocket {
  static urls: string[] = []

  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(url: string) {
    FakeWebSocket.urls.push(url)
  }

  close() {}
}

describe('inbox store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    FakeWebSocket.urls = []
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

  it('clears the previous account inbox data when bootstrapping logged out', async () => {
    const auth = useAuthStore()
    auth.token = null
    auth.isAuthenticated = false

    const notifications = useNotificationStore()
    notifications.unreadCount = 3
    notifications.notifications = [{ id: 'notification-1' } as never]
    notifications.total = 1

    const dm = useDMStore()
    dm.unreadCount = 2
    dm.conversations = [{ conversation_id: 'conversation-1' } as never]
    dm.activeConversation = 'alice'
    dm.messages = [{ id: 'message-1' } as never]
    dm.total = 1

    const inbox = useInboxStore()
    await inbox.bootstrap()

    expect(inbox.totalUnread).toBe(0)
    expect(notifications.notifications).toEqual([])
    expect(notifications.total).toBe(0)
    expect(dm.conversations).toEqual([])
    expect(dm.activeConversation).toBeNull()
    expect(dm.messages).toEqual([])
    expect(dm.total).toBe(0)
  })
})
