import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTargetConversation, sendToTarget } from '@/api/dm'
import { setCSRFToken } from '@/api/transport'

describe('dm api', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setCSRFToken('')
  })

  it('returns null when a target has no existing conversation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))

    await expect(getTargetConversation({ type: 'user', id: 'user one' })).resolves.toBeNull()

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init).toMatchObject({ credentials: 'include' })
    expect(new Headers((init as RequestInit).headers).get('Accept')).toBe('application/json')
  })

  it('sends a target message through the cookie and csrf transport', async () => {
    setCSRFToken('csrf-token')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: {
        id: 'message-1', conversation_id: 'conversation-1', client_message_id: 'client-1',
        sender: { type: 'user', id: 'me', display_name: 'Me' }, content: '你好', created_at: '2026-07-23T00:00:00Z',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await sendToTarget({ type: 'channel', id: 'channel/one' }, { content: '你好', image_id: null, client_message_id: 'client-1' })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/v1/dm/targets/channel/channel%2Fone/messages')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(new Headers((init as RequestInit).headers).get('X-CSRF-Token')).toBe('csrf-token')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body).not.toHaveProperty('sender_type')
    expect(body).not.toHaveProperty('sender_id')
    expect(body).not.toHaveProperty('actor_user_id')
  })
})
