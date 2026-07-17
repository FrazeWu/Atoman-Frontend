import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'

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
})
