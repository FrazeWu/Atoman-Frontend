import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  blockConversation, getTargetConversation, listConversations, listMailboxes, listMessages, mailboxKey,
  markConversationRead, normalizeDMRealtimeEvent, reportDMMessage, sendInConversation, sendToTarget, unblockConversation, uploadDMImage,
  type DMConversation, type DMMailbox, type DMMessage, type DMRealtimeEvent, type DMTarget,
} from '@/api/dm'

export type DMSnapshot = {
  mailboxes: DMMailbox[]
  conversationsByMailbox: Record<string, DMConversation[]>
  activeConversationId: string
  activeMessages: DMMessage[]
}

const sortMessages = (messages: DMMessage[]) => [...messages].sort((left, right) => (
  left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id)
))

export const useDMStore = defineStore('dm', () => {
  const mailboxesByKey = ref<Record<string, DMMailbox>>({})
  const mailboxOrder = ref<string[]>([])
  const conversationsById = ref<Record<string, DMConversation>>({})
  const conversationIdsByMailbox = ref<Record<string, string[]>>({})
  const messagesByConversation = ref<Record<string, DMMessage[]>>({})
  const conversationCursorByMailbox = ref<Record<string, string | null>>({})
  const messageCursorByConversation = ref<Record<string, string | null>>({})
  const activeMailboxKey = ref('')
  const activeConversationId = ref('')
  const activeTarget = ref<DMTarget | null>(null)
  const loadingConversations = ref(false)
  const loadingMessages = ref(false)
  const requestGeneration = ref(0)
  const dmUnread = ref(0)

  const activeMailbox = computed(() => mailboxesByKey.value[activeMailboxKey.value] ?? null)
  const activeConversation = computed(() => conversationsById.value[activeConversationId.value] ?? null)
  const activeMessages = computed(() => messagesByConversation.value[activeConversationId.value] ?? [])
  const canLoadOlderMessages = computed(() => Boolean(activeConversationId.value && messageCursorByConversation.value[activeConversationId.value]))
  const activeConversationBlocked = computed(() => activeConversation.value?.blocked ?? false)
  const replyAsLabel = computed(() => activeConversation.value?.reply_as.display_name ?? '')
  const conversations = computed(() => Object.values(conversationsById.value).map((conversation) => ({
    conversation_id: conversation.id,
    other_username: conversation.other_party.display_name,
    other_user_id: conversation.other_party.type === 'user' ? conversation.other_party.id : '',
    last_message_at: conversation.last_message_at,
    preview: conversation.last_message_preview,
    unread_count: conversation.unread_count,
    is_blocked: conversation.blocked,
  })))
  const messages = computed(() => activeMessages.value.map((message) => ({
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender.id,
    sender: { username: message.sender.display_name, email: '' },
    content: message.content,
    image_url: message.image_url,
    read_at: message.read_at,
    created_at: message.created_at,
    updated_at: message.created_at,
  })))
  const loading = computed(() => loadingConversations.value || loadingMessages.value)

  const mergeMailboxes = (mailboxes: DMMailbox[], replaceOrder = true) => {
    const next = { ...mailboxesByKey.value }
    mailboxes.forEach((mailbox) => { next[mailboxKey(mailbox)] = mailbox })
    mailboxesByKey.value = next
    if (replaceOrder) {
      mailboxOrder.value = mailboxes.map(mailboxKey)
    } else {
      mailboxOrder.value = [...mailboxOrder.value, ...mailboxes.map(mailboxKey).filter((key) => !mailboxOrder.value.includes(key))]
    }
    if (!activeMailboxKey.value && mailboxOrder.value[0]) activeMailboxKey.value = mailboxOrder.value[0]
  }

  const mergeConversations = (key: string, conversations: DMConversation[], append = false) => {
    const next = { ...conversationsById.value }
    conversations.forEach((conversation) => { next[conversation.id] = conversation })
    conversationsById.value = next
    const current = append ? (conversationIdsByMailbox.value[key] ?? []) : []
    conversationIdsByMailbox.value = {
      ...conversationIdsByMailbox.value,
      [key]: [...new Set([...current, ...conversations.map((conversation) => conversation.id)])],
    }
  }

  const mergeMessages = (conversationID: string, incoming: DMMessage[]) => {
    const current = messagesByConversation.value[conversationID] ?? []
    const byID = new Map(current.map((message) => [message.id, message]))
    incoming.forEach((message) => {
      const echoed = current.find((item) => item.client_message_id === message.client_message_id)
      if (echoed && echoed.id !== message.id) byID.delete(echoed.id)
      byID.set(message.id, message)
    })
    messagesByConversation.value = { ...messagesByConversation.value, [conversationID]: sortMessages([...byID.values()]) }
  }

  const applyConversation = (conversation: DMConversation) => {
    const key = mailboxKey(conversation.mailbox)
    mergeMailboxes([conversation.mailbox], false)
    conversationsById.value = { ...conversationsById.value, [conversation.id]: conversation }
    const ids = conversationIdsByMailbox.value[key] ?? []
    conversationIdsByMailbox.value = { ...conversationIdsByMailbox.value, [key]: [conversation.id, ...ids.filter((id) => id !== conversation.id)] }
  }

  const bootstrapDM = async () => {
    const mailboxes = await listMailboxes()
    mergeMailboxes(mailboxes)
    if (activeMailboxKey.value) await selectMailbox(activeMailboxKey.value)
  }

  const selectMailbox = async (key: string) => {
    const mailbox = mailboxesByKey.value[key]
    if (!mailbox) return
    activeMailboxKey.value = key
    loadingConversations.value = true
    try {
      const page = await listConversations(mailbox)
      if (activeMailboxKey.value !== key) return
      mergeConversations(key, page.items)
      conversationCursorByMailbox.value = { ...conversationCursorByMailbox.value, [key]: page.next_cursor ?? null }
    } finally {
      if (activeMailboxKey.value === key) loadingConversations.value = false
    }
  }

  const loadMoreConversations = async () => {
    const key = activeMailboxKey.value
    const mailbox = mailboxesByKey.value[key]
    const cursor = conversationCursorByMailbox.value[key]
    if (!mailbox || !cursor || loadingConversations.value) return
    loadingConversations.value = true
    try {
      const page = await listConversations(mailbox, cursor)
      if (activeMailboxKey.value !== key) return
      mergeConversations(key, page.items, true)
      conversationCursorByMailbox.value = { ...conversationCursorByMailbox.value, [key]: page.next_cursor ?? null }
    } finally {
      if (activeMailboxKey.value === key) loadingConversations.value = false
    }
  }

  const conversationIDFor = (value: string | DMConversation) => {
    if (typeof value !== 'string') return value.id
    if (conversationsById.value[value]) return value
    return Object.values(conversationsById.value).find((conversation) => (
      conversation.other_party.id === value || conversation.other_party.display_name === value
    ))?.id ?? ''
  }

  const openConversation = async (value: string | DMConversation) => {
    const conversationID = conversationIDFor(value)
    if (!conversationID) return
    const generation = ++requestGeneration.value
    activeConversationId.value = conversationID
    activeTarget.value = null
    loadingMessages.value = true
    try {
      const page = await listMessages(conversationID)
      if (generation !== requestGeneration.value || activeConversationId.value !== conversationID) return
      mergeMessages(conversationID, page.items)
      messageCursorByConversation.value = { ...messageCursorByConversation.value, [conversationID]: page.next_cursor ?? null }
      await markRead()
    } finally {
      if (generation === requestGeneration.value && activeConversationId.value === conversationID) loadingMessages.value = false
    }
  }

  const openTarget = async (target: DMTarget) => {
    activeTarget.value = target
    const conversation = await getTargetConversation(target)
    if (activeTarget.value?.type !== target.type || activeTarget.value.id !== target.id) return
    if (conversation) {
      applyConversation(conversation)
      await openConversation(conversation.id)
    } else {
      activeConversationId.value = ''
    }
  }

  const loadOlderMessages = async () => {
    const conversationID = activeConversationId.value
    const cursor = messageCursorByConversation.value[conversationID]
    if (!conversationID || !cursor || loadingMessages.value) return
    loadingMessages.value = true
    try {
      const page = await listMessages(conversationID, cursor)
      if (activeConversationId.value !== conversationID) return
      mergeMessages(conversationID, page.items)
      messageCursorByConversation.value = { ...messageCursorByConversation.value, [conversationID]: page.next_cursor ?? null }
    } finally {
      if (activeConversationId.value === conversationID) loadingMessages.value = false
    }
  }

  const sendMessage = async (contentOrConversation: string | DMConversation, contentOrImageID?: string, legacyImageID?: string) => {
    if (activeConversationBlocked.value) throw new Error('当前会话无法发送消息')
    const legacyCall = legacyImageID !== undefined || typeof contentOrConversation !== 'string' || Boolean(conversationIDFor(contentOrConversation))
    const conversationID = legacyCall ? conversationIDFor(contentOrConversation) : activeConversationId.value
    const input = {
      client_message_id: crypto.randomUUID(),
      content: legacyCall ? contentOrImageID ?? '' : contentOrConversation,
      image_id: legacyCall ? legacyImageID || null : contentOrImageID ?? null,
    }
    const message = conversationID
      ? await sendInConversation(conversationID, input)
      : activeTarget.value ? await sendToTarget(activeTarget.value, input) : null
    if (!message) throw new Error('请先选择会话')
    mergeMessages(message.conversation_id, [message])
    return message
  }

  const markRead = async () => {
    const conversationID = activeConversationId.value
    if (!conversationID) return
    const result = await markConversationRead(conversationID)
    dmUnread.value = result.dm_unread
    const conversation = conversationsById.value[conversationID]
    if (!conversation) return
    const mailbox = { ...conversation.mailbox, unread_count: result.mailbox_unread }
    applyConversation({ ...conversation, unread_count: result.conversation_unread, mailbox })
  }

  const blockActiveConversation = async () => {
    if (!activeConversation.value) return
    applyConversation(await blockConversation(activeConversation.value.id, activeConversation.value.mailbox))
  }
  const unblockActiveConversation = async () => {
    if (!activeConversation.value) return
    applyConversation(await unblockConversation(activeConversation.value.id, activeConversation.value.mailbox))
  }
  const uploadImage = uploadDMImage
  const reportMessage = reportDMMessage

  const receiveEvent = (value: unknown) => {
    const event = normalizeDMRealtimeEvent(value)
    if (!event) return
    if (event.event === 'dm.message.created') {
      mergeMessages(event.data.message.conversation_id, [event.data.message])
      applyConversation(event.data.conversation)
      dmUnread.value = event.data.dm_unread
      return
    }
    if (event.event === 'dm.message.read') {
      const conversation = conversationsById.value[event.data.conversation_id]
      if (conversation) applyConversation({ ...conversation, unread_count: 0, mailbox: event.data.mailbox })
      dmUnread.value = event.data.dm_unread
      return
    }
    mergeMailboxes([event.data.mailbox], false)
    dmUnread.value = event.data.dm_unread
  }

  const reconcile = (snapshot: DMSnapshot) => {
    mergeMailboxes(snapshot.mailboxes)
    Object.entries(snapshot.conversationsByMailbox).forEach(([key, conversations]) => mergeConversations(key, conversations))
    activeConversationId.value = snapshot.activeConversationId
    if (snapshot.activeConversationId) mergeMessages(snapshot.activeConversationId, snapshot.activeMessages)
  }

  const reconcileFromServer = async () => {
    await bootstrapDM()
    if (activeConversationId.value) await openConversation(activeConversationId.value)
  }

  const fetchConversations = bootstrapDM
  const receiveDM = (payload: unknown) => {
    receiveEvent(payload)
  }

  const resetStore = () => {
    requestGeneration.value += 1
    mailboxesByKey.value = {}; mailboxOrder.value = []; conversationsById.value = {}; conversationIdsByMailbox.value = {}
    messagesByConversation.value = {}; conversationCursorByMailbox.value = {}; messageCursorByConversation.value = {}
    activeMailboxKey.value = ''; activeConversationId.value = ''; activeTarget.value = null; loadingConversations.value = false; loadingMessages.value = false; dmUnread.value = 0
  }

  return {
    mailboxesByKey, mailboxOrder, conversationsById, conversationIdsByMailbox, messagesByConversation,
    conversationCursorByMailbox, messageCursorByConversation, activeMailboxKey, activeConversationId, activeTarget,
    loadingConversations, loadingMessages, requestGeneration, dmUnread, activeMailbox, activeConversation,
    activeMessages, canLoadOlderMessages, activeConversationBlocked, replyAsLabel, mergeMessages, bootstrapDM,
    selectMailbox, loadMoreConversations, openTarget, openConversation, loadOlderMessages, sendMessage, markRead,
    blockActiveConversation, unblockActiveConversation, uploadImage, reportMessage, reconcileFromServer, receiveEvent,
    reconcile, resetStore,
    conversations, messages, loading, fetchConversations, receiveDM,
  }
})
