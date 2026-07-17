import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDMStore } from '@/stores/dm'
import { useAuthStore } from '@/stores/auth'

const makeToken = () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
  return `${header}.${payload}.signature`
}

const makeMessage = (id: string, conversationId: string, senderUsername: string) => ({
  id,
  conversation_id: conversationId,
  sender_id: `${senderUsername}-id`,
  sender: { username: senderUsername, email: `${senderUsername}@example.com` },
  content: `${senderUsername} message`,
  image_url: '',
  created_at: '2026-06-30T00:00:00Z',
  updated_at: '2026-06-30T00:00:00Z',
})

describe('dm store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    localStorage.setItem('token', makeToken())
    localStorage.setItem('user', JSON.stringify({ username: 'me', email: 'me@example.com' }))
    setActivePinia(createPinia())
  })

  it('ignores stale openConversation responses and only marks the active conversation read', async () => {
    let resolveAlice!: (response: Response) => void
    let resolveBob!: (response: Response) => void
    const aliceResponse = new Promise<Response>((resolve) => {
      resolveAlice = resolve
    })
    const bobResponse = new Promise<Response>((resolve) => {
      resolveBob = resolve
    })

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/dm/conversations/alice?page=1')) return aliceResponse
      if (url.endsWith('/dm/conversations/bob?page=1')) return bobResponse
      if (url.endsWith('/dm/conversations/alice/read') || url.endsWith('/dm/conversations/bob/read')) {
        return new Response(null, { status: 204 })
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`)
    })

    const store = useDMStore()
    const aliceOpen = store.openConversation('alice')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const bobOpen = store.openConversation('bob')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    resolveBob(new Response(JSON.stringify({
      data: [makeMessage('bob-message', 'bob-conversation', 'bob')],
      total: 1,
    }), { status: 200 }))
    await bobOpen

    resolveAlice(new Response(JSON.stringify({
      data: [makeMessage('alice-message', 'alice-conversation', 'alice')],
      total: 1,
    }), { status: 200 }))
    await aliceOpen

    expect(store.activeConversation).toBe('bob')
    expect(store.messages.map((message) => message.id)).toEqual(['bob-message'])
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/dm/conversations/bob/read', expect.objectContaining({
      method: 'PUT',
    }))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/dm/conversations/alice/read', expect.anything())
  })

  it('exposes blocked state for active conversation', () => {
    const store = useDMStore()
    store.conversations = [{ conversation_id: 'c1', other_username: 'alice', other_user_id: 'u1', preview: '', unread_count: 0, is_blocked: true }]
    store.activeConversation = 'alice'
    expect(store.activeConversationBlocked).toBe(true)
  })

  it('does not count own realtime echo as unread', () => {
    const auth = useAuthStore()
    auth.user = { uuid: 'me-id', username: 'me', email: 'me@example.com' } as never
    const store = useDMStore()
    store.unreadCount = 2
    store.conversations = [{ conversation_id: 'c1', other_username: 'alice', other_user_id: 'alice-id', preview: '', unread_count: 0 }]
    store.activeConversation = 'alice'

    store.receiveDM({
      conversation_id: 'c1',
      message_id: 'm1',
      sender_id: 'me-id',
      sender_username: 'me',
      content: 'hello',
      image_url: '',
      created_at: '2026-07-09T00:00:00Z',
    })

    expect(store.unreadCount).toBe(2)
    expect(store.conversations[0].unread_count).toBe(0)
  })
})
