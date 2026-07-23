import { afterEach, describe, expect, it, vi } from 'vitest'

import { blockConversation, getTargetConversation, listConversations, listDMReports, listMailboxes, sendToTarget } from '@/api/dm'
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

  it('normalizes the backend mailbox and participant DTOs', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{
        party: { type: 'user', id: 'me', name: 'Me', avatar_url: '' }, unread: 2,
      }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [{
        id: 'conversation-1',
        participant_a: { type: 'user', id: 'me', name: 'Me', avatar_url: '' },
        participant_b: { type: 'channel', id: 'channel-1', name: 'Channel', avatar_url: 'cover.png' },
        last_message_at: '2026-07-23T00:00:00Z', last_message_preview: 'hello', unread: 1, blocked: false,
      }], next_cursor: 'next' } }), { status: 200 })))

    const [mailbox] = await listMailboxes()
    const page = await listConversations(mailbox)

    expect(mailbox).toEqual({ type: 'user', id: 'me', display_name: 'Me', unread_count: 2 })
    expect(page.items[0]).toMatchObject({
      mailbox,
      other_party: { type: 'channel', id: 'channel-1', display_name: 'Channel', avatar_url: 'cover.png' },
      reply_as: { type: 'user', id: 'me', display_name: 'Me' },
      unread_count: 1,
    })
  })

  it('uses PUT for block and returns paged admin reports', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: 'conversation-1', participant_a: { type: 'user', id: 'me', name: 'Me', avatar_url: '' },
        participant_b: { type: 'user', id: 'alice', name: 'Alice', avatar_url: '' }, last_message_preview: '', unread: 0, blocked: true,
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { items: [{ id: 'report-1', status: 'pending' }], next_cursor: 'next' } }), { status: 200 })))

    await blockConversation('conversation-1', { type: 'user', id: 'me', display_name: 'Me', unread_count: 0 })
    await expect(listDMReports()).resolves.toEqual({ items: [{ id: 'report-1', status: 'pending' }], next_cursor: 'next' })

    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'PUT' })
  })
})
