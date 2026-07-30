import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/dm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/dm')>()
  return {
    ...actual,
    getTargetConversation: vi.fn(),
    listMessages: vi.fn(),
    markConversationRead: vi.fn(),
    sendInConversation: vi.fn(),
    sendToTarget: vi.fn(),
  }
})

import { useDMStore } from '@/stores/dm'
import { getTargetConversation, listMessages, markConversationRead, sendInConversation, sendToTarget } from '@/api/dm'
import { useNotificationStore } from '@/stores/notification'
import type { DMConversation, DMMailbox, DMMessage } from '@/api/dm'

const userMailbox: DMMailbox = { type: 'user', id: 'me', display_name: '我的私信', unread_count: 2 }
const channelMailbox: DMMailbox = { type: 'channel', id: 'channel-1', display_name: '频道', unread_count: 0 }

const makeConversation = (id: string, mailbox = userMailbox): DMConversation => ({
  id,
  mailbox,
  other_party: { type: 'user', id: 'alice', username: 'alice', display_name: 'Alice' },
  last_message_at: '2026-07-23T00:00:00Z',
  last_message_preview: 'hello',
  unread_count: 0,
  blocked: false,
  reply_as: { type: mailbox.type, id: mailbox.id, display_name: mailbox.display_name },
})

const makeMessage = (id: string, conversationId: string, createdAt: string, clientMessageId = id): DMMessage => ({
  id,
  conversation_id: conversationId,
  client_message_id: clientMessageId,
  sender: { type: 'user', id: 'alice', username: 'alice', display_name: 'Alice' },
  content: id,
  created_at: createdAt,
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('dm store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  it('normalizes mailboxes and conversations by stable ids', () => {
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox, channelMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-2'), makeConversation('conversation-1')] },
      activeConversationId: '',
      activeMessages: [],
    })

    expect(store.mailboxOrder).toEqual(['user:me', 'channel:channel-1'])
    expect(store.conversationIdsByMailbox['user:me']).toEqual(['conversation-2', 'conversation-1'])
  })

  it('prepends older messages in chronological order', () => {
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-1')] },
      activeConversationId: 'conversation-1',
      activeMessages: [makeMessage('newer', 'conversation-1', '2026-07-23T00:00:00Z')],
    })
    store.mergeMessages('conversation-1', [makeMessage('older', 'conversation-1', '2026-07-22T00:00:00Z')])

    expect(store.messagesByConversation['conversation-1'].map((item) => item.id)).toEqual(['older', 'newer'])
  })

  it('deduplicates events by message id and client message id', () => {
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-1')] },
      activeConversationId: 'conversation-1',
      activeMessages: [makeMessage('local-message', 'conversation-1', '2026-07-23T00:00:00Z', 'client-1')],
    })
    store.receiveEvent({ event: 'dm.message.created', data: {
      message: makeMessage('server-message', 'conversation-1', '2026-07-23T00:00:00Z', 'client-1'),
      conversation: makeConversation('conversation-1'), mailbox: userMailbox, dm_unread: 2, total_unread: 2,
    } })

    expect(store.activeMessages.map((item) => item.id)).toEqual(['server-message'])
  })

  it('keeps every mailbox in order when an event updates one conversation', () => {
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox, channelMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-1')] },
      activeConversationId: '',
      activeMessages: [],
    })
    store.receiveEvent({ event: 'dm.message.created', data: {
      message: makeMessage('message-1', 'conversation-1', '2026-07-23T00:00:00Z'),
      conversation: makeConversation('conversation-1'), mailbox: userMailbox, dm_unread: 2, total_unread: 2,
    } })

    expect(store.mailboxOrder).toEqual(['user:me', 'channel:channel-1'])
  })

  it('ignores a stale conversation response after switching conversations', async () => {
    let resolveFirst!: (value: { items: DMMessage[] }) => void
    let resolveSecond!: (value: { items: DMMessage[] }) => void
    vi.mocked(listMessages)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
    vi.mocked(markConversationRead).mockResolvedValue({ conversation_unread: 0, mailbox_unread: 0, dm_unread: 0, total_unread: 0 })

    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-1'), makeConversation('conversation-2')] },
      activeConversationId: '',
      activeMessages: [],
    })
    const first = store.openConversation('conversation-1')
    const second = store.openConversation('conversation-2')
    resolveSecond({ items: [makeMessage('second', 'conversation-2', '2026-07-23T00:00:00Z')] })
    await second
    resolveFirst({ items: [makeMessage('first', 'conversation-1', '2026-07-23T00:00:00Z')] })
    await first

    expect(store.activeConversationId).toBe('conversation-2')
    expect(store.activeMessages.map((item) => item.id)).toEqual(['second'])
    expect(store.messagesByConversation['conversation-1']).toBeUndefined()
  })

  it('ignores an older-page success after reopening the same conversation', async () => {
    const stalePage = deferred<{ items: DMMessage[]; next_cursor?: string }>()
    vi.mocked(listMessages)
      .mockResolvedValueOnce({ items: [makeMessage('initial', 'conversation-1', '2026-07-23T00:00:00Z')], next_cursor: 'stale-cursor' })
      .mockImplementationOnce(() => stalePage.promise)
      .mockResolvedValueOnce({ items: [makeMessage('reopened', 'conversation-1', '2026-07-24T00:00:00Z')], next_cursor: 'fresh-cursor' })
    vi.mocked(markConversationRead).mockResolvedValue({ conversation_unread: 0, mailbox_unread: 0, dm_unread: 0, total_unread: 0 })
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-1')] },
      activeConversationId: '',
      activeMessages: [],
    })

    await store.openConversation('conversation-1')
    const staleRequest = store.loadOlderMessages()
    await store.openConversation('conversation-1')
    stalePage.resolve({ items: [makeMessage('stale', 'conversation-1', '2026-07-22T00:00:00Z')], next_cursor: 'wrong-cursor' })
    await staleRequest

    expect(store.activeMessages.map((message) => message.id)).toEqual(['initial', 'reopened'])
    expect(store.messageCursorByConversation['conversation-1']).toBe('fresh-cursor')
  })

  it('keeps reopened conversation state when an older-page request fails', async () => {
    const stalePage = deferred<{ items: DMMessage[]; next_cursor?: string }>()
    const currentPage = deferred<{ items: DMMessage[]; next_cursor?: string }>()
    vi.mocked(listMessages)
      .mockResolvedValueOnce({ items: [makeMessage('initial', 'conversation-1', '2026-07-23T00:00:00Z')], next_cursor: 'stale-cursor' })
      .mockImplementationOnce(() => stalePage.promise)
      .mockResolvedValueOnce({ items: [makeMessage('reopened', 'conversation-1', '2026-07-24T00:00:00Z')], next_cursor: 'fresh-cursor' })
      .mockImplementationOnce(() => currentPage.promise)
    vi.mocked(markConversationRead).mockResolvedValue({ conversation_unread: 0, mailbox_unread: 0, dm_unread: 0, total_unread: 0 })
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-1')] },
      activeConversationId: '',
      activeMessages: [],
    })

    await store.openConversation('conversation-1')
    const staleRequest = store.loadOlderMessages()
    await store.openConversation('conversation-1')
    const currentRequest = store.loadOlderMessages()
    stalePage.reject(new Error('stale failure'))
    await expect(staleRequest).rejects.toThrow('stale failure')

    expect(store.activeMessages.map((message) => message.id)).toEqual(['initial', 'reopened'])
    expect(store.messageCursorByConversation['conversation-1']).toBe('fresh-cursor')
    expect(store.loadingMessages).toBe(true)

    currentPage.resolve({ items: [] })
    await currentRequest
  })

  it('does not let an older request end loading for the reopened conversation', async () => {
    const stalePage = deferred<{ items: DMMessage[]; next_cursor?: string }>()
    const currentPage = deferred<{ items: DMMessage[]; next_cursor?: string }>()
    vi.mocked(listMessages)
      .mockResolvedValueOnce({ items: [], next_cursor: 'stale-cursor' })
      .mockImplementationOnce(() => stalePage.promise)
      .mockResolvedValueOnce({ items: [], next_cursor: 'fresh-cursor' })
      .mockImplementationOnce(() => currentPage.promise)
    vi.mocked(markConversationRead).mockResolvedValue({ conversation_unread: 0, mailbox_unread: 0, dm_unread: 0, total_unread: 0 })
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-1')] },
      activeConversationId: '',
      activeMessages: [],
    })

    await store.openConversation('conversation-1')
    const staleRequest = store.loadOlderMessages()
    await store.openConversation('conversation-1')
    const currentRequest = store.loadOlderMessages()
    stalePage.resolve({ items: [] })
    await staleRequest

    expect(store.loadingMessages).toBe(true)

    currentPage.resolve({ items: [] })
    await currentRequest
    expect(store.loadingMessages).toBe(false)
  })

  it('keeps cached messages when a target has no conversation', async () => {
    vi.mocked(getTargetConversation).mockResolvedValue(null)
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox],
      conversationsByMailbox: { 'user:me': [makeConversation('conversation-1')] },
      activeConversationId: 'conversation-1',
      activeMessages: [makeMessage('cached', 'conversation-1', '2026-07-23T00:00:00Z')],
    })

    await store.openTarget({ type: 'user', id: 'new-user' })

    expect(store.activeConversationId).toBe('')
    expect(store.messagesByConversation['conversation-1'].map((message) => message.id)).toEqual(['cached'])
  })

  it('creates a target conversation on its first sent message', async () => {
    vi.mocked(getTargetConversation).mockResolvedValue(null)
    vi.mocked(sendToTarget).mockResolvedValue(makeMessage('message-1', 'conversation-new', '2026-07-23T00:00:00Z'))
    const store = useDMStore()

    await store.openTarget({ type: 'user', id: 'new-user' })
    await store.sendActiveMessage('hello')

    expect(sendToTarget).toHaveBeenCalledWith({ type: 'user', id: 'new-user' }, expect.objectContaining({ content: 'hello' }))
    expect(store.activeConversationId).toBe('conversation-new')
    expect(store.activeMessages.map((message) => message.id)).toEqual(['message-1'])
  })

  it('does not restore a stale target after the first message lookup finishes', async () => {
    let resolveConversation!: (value: DMConversation | null) => void
    vi.mocked(getTargetConversation)
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveConversation = resolve }))
      .mockResolvedValueOnce(null)
    vi.mocked(sendToTarget).mockResolvedValue(makeMessage('message-1', 'conversation-new', '2026-07-23T00:00:00Z'))
    const store = useDMStore()
    const firstTarget = { type: 'user' as const, id: 'first-user' }
    const secondTarget = { type: 'user' as const, id: 'second-user' }

    await store.openTarget(firstTarget)
    const send = store.sendActiveMessage('hello')
    await Promise.resolve()
    await store.openTarget(secondTarget)
    resolveConversation(makeConversation('conversation-new'))
    await send

    expect(store.activeConversationId).toBe('')
    expect(store.activeTarget).toEqual(secondTarget)
  })

  it('never treats active message content as a legacy conversation reference', async () => {
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox], conversationsByMailbox: { 'user:me': [makeConversation('hello'), makeConversation('conversation-1')] },
      activeConversationId: 'conversation-1', activeMessages: [],
    })
    vi.mocked(sendInConversation).mockResolvedValue(makeMessage('message-1', 'conversation-1', '2026-07-23T00:00:00Z'))

    await store.sendActiveMessage('hello')

    expect(sendInConversation).toHaveBeenCalledWith('conversation-1', expect.objectContaining({ content: 'hello' }))
  })

  it('syncs mark-read results to the unified notification count', async () => {
    const store = useDMStore()
    store.reconcile({
      mailboxes: [userMailbox], conversationsByMailbox: { 'user:me': [makeConversation('conversation-1')] },
      activeConversationId: 'conversation-1', activeMessages: [],
    })
    vi.mocked(markConversationRead).mockResolvedValue({ conversation_unread: 0, mailbox_unread: 0, dm_unread: 3, total_unread: 8 })

    await store.markRead()

    expect(useNotificationStore().unreadCounts.dm).toBe(3)
  })
})
