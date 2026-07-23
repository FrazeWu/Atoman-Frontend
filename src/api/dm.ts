import { ApiErrorResponseError, apiDeleteJson, apiGet, apiGetOptional, apiPostJson, apiPostMultipart, apiPutJson } from './client'
import { apiFetch } from './transport'
import { useApiUrl } from '@/composables/useApi'

export type DMPartyType = 'user' | 'channel'
export type DMPermission = 'one_before_reply' | 'following_only' | 'anyone' | 'closed'

export type DMParty = { type: DMPartyType; id: string; display_name: string; avatar_url?: string }
export type DMMailbox = { type: DMPartyType; id: string; display_name: string; unread_count: number }
export type DMConversation = {
  id: string; mailbox: DMMailbox; other_party: DMParty; last_message_at: string | null
  last_message_preview: string; unread_count: number; blocked: boolean; reply_as: DMParty
}
export type DMMessage = {
  id: string; conversation_id: string; client_message_id: string; sender: DMParty; content: string
  image_id?: string; image_url?: string; read_at?: string | null; created_at: string
}
export type DMPaged<T> = { items: T[]; next_cursor?: string }
export type DMTarget = { type: DMPartyType; id: string }
export type DMReadResult = { conversation_unread: number; mailbox_unread: number; dm_unread: number; total_unread: number }
export type DMImage = { id: string; url: string }
export type DMSettings = { permission: DMPermission }
export type DMReportInput = { reason: string; detail: string }
export type DMReport = { id: string; message_id: string; reporter_user_id: string; reported_actor_user_id: string; reason: string; detail: string; snapshot_content: string; has_snapshot_image: boolean; conversation_context: string; status: string; created_at: string }

type RawParty = { type: DMPartyType; id: string; name: string; avatar_url: string }
type RawMailbox = { party: RawParty; unread: number }
type RawConversation = { id: string; participant_a: RawParty; participant_b: RawParty; last_message_at?: string | null; last_message_preview: string; unread: number; blocked: boolean }
type RawMessage = { id: string; conversation_id: string; sender_type: DMPartyType; sender_id: string; client_message_id: string; content: string; image_id?: string; image_url?: string; created_at: string }
type RawPage<T> = { items: T[]; next_cursor?: string }

export type DMRealtimeEvent =
  | { event: 'dm.message.created'; data: { message: DMMessage; conversation: DMConversation; mailbox: DMMailbox; dm_unread: number; total_unread: number } }
  | { event: 'dm.message.read'; data: { conversation_id: string; read_at: string; mailbox: DMMailbox; dm_unread: number; total_unread: number } }
  | { event: 'dm.mailbox.updated'; data: { mailbox: DMMailbox; dm_unread: number; total_unread: number } }

export const dmErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiErrorResponseError)) return '暂时无法完成操作，请稍后重试'
  const messages: Record<string, string> = {
    'dm.waiting_reply': '等待对方回复后可继续发送', 'dm.blocked': '当前会话无法发送消息',
    'dm.permission_denied': '对方暂不接收私信', 'dm.rate_limited': '发送较频繁，请稍后再试',
    'dm.image_invalid': '请选择 10 MB 以内的 JPEG、PNG 或 WebP 图片', 'dm.self_target': '不能给自己发送私信',
    'dm.target_not_found': '该用户或频道不存在', 'dm.conversation_forbidden': '无法访问这个会话',
    'dm.message_not_found': '这条消息已不可用', 'dm.already_reported': '你已经举报过这条消息',
  }
  return messages[error.code] ?? '暂时无法完成操作，请稍后重试'
}

const base = () => `${useApiUrl()}/dm`
const partyPath = (target: DMTarget) => `${encodeURIComponent(target.type)}/${encodeURIComponent(target.id)}`
const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)) })
  return params.size ? `?${params}` : ''
}
const party = (value: RawParty): DMParty => ({ type: value.type, id: value.id, display_name: value.name, ...(value.avatar_url ? { avatar_url: value.avatar_url } : {}) })
const mailbox = (value: RawMailbox): DMMailbox => ({ type: value.party.type, id: value.party.id, display_name: value.party.name, unread_count: value.unread })
const sameParty = (left: Pick<DMTarget, 'type' | 'id'>, right: RawParty) => left.type === right.type && left.id === right.id
const normalizeConversation = (value: RawConversation, targetMailbox?: DMMailbox): DMConversation => {
  const current = targetMailbox ?? (sameParty(value.participant_a, value.participant_b) ? value.participant_a : value.participant_a)
  const other = sameParty(current, value.participant_a) ? value.participant_b : value.participant_a
  const normalizedMailbox: DMMailbox = targetMailbox ?? { type: current.type, id: current.id, display_name: current.name, unread_count: 0 }
  const replyAs: DMParty = targetMailbox
    ? { type: targetMailbox.type, id: targetMailbox.id, display_name: targetMailbox.display_name }
    : party(current)
  return { id: value.id, mailbox: normalizedMailbox, other_party: party(other), last_message_at: value.last_message_at ?? null, last_message_preview: value.last_message_preview, unread_count: value.unread, blocked: value.blocked, reply_as: replyAs }
}
const normalizeMessage = (value: RawMessage): DMMessage => ({
  id: value.id, conversation_id: value.conversation_id, client_message_id: value.client_message_id,
  sender: { type: value.sender_type, id: value.sender_id, display_name: value.sender_id }, content: value.content,
  ...(value.image_id ? { image_id: value.image_id } : {}), ...(value.image_url ? { image_url: value.image_url } : {}), created_at: value.created_at,
})

export const mailboxKey = (value: Pick<DMMailbox, 'type' | 'id'>) => `${value.type}:${value.id}`
export const listMailboxes = async () => (await apiGet<RawMailbox[]>(`${base()}/mailboxes`)).map(mailbox)
export const listConversations = async (value: DMMailbox, cursor?: string, limit = 30): Promise<DMPaged<DMConversation>> => {
  const page = await apiGet<RawPage<RawConversation>>(`${base()}/mailboxes/${partyPath(value)}/conversations${query({ cursor, limit })}`)
  return { items: page.items.map((conversation) => normalizeConversation(conversation, value)), ...(page.next_cursor ? { next_cursor: page.next_cursor } : {}) }
}
export const getTargetConversation = async (target: DMTarget): Promise<DMConversation | null> => {
  const conversation = await apiGetOptional<RawConversation>(`${base()}/targets/${partyPath(target)}/conversation`)
  if (!conversation) return null
  const ownParty = sameParty(target, conversation.participant_a) ? conversation.participant_b : conversation.participant_a
  return normalizeConversation(conversation, { type: ownParty.type, id: ownParty.id, display_name: ownParty.name, unread_count: 0 })
}
export const listMessages = async (conversationID: string, before?: string, limit = 30): Promise<DMPaged<DMMessage>> => {
  const page = await apiGet<RawPage<RawMessage>>(`${base()}/conversations/${encodeURIComponent(conversationID)}/messages${query({ before, limit })}`)
  return { items: page.items.map(normalizeMessage), ...(page.next_cursor ? { next_cursor: page.next_cursor } : {}) }
}

export type DMSendInput = { client_message_id: string; content: string; image_id?: string | null }
export const sendToTarget = async (target: DMTarget, input: DMSendInput) => normalizeMessage(await apiPostJson<RawMessage>(`${base()}/targets/${partyPath(target)}/messages`, input))
export const sendInConversation = async (conversationID: string, input: DMSendInput) => normalizeMessage(await apiPostJson<RawMessage>(`${base()}/conversations/${encodeURIComponent(conversationID)}/messages`, input))
export const markConversationRead = (conversationID: string) => apiPutJson<DMReadResult>(`${base()}/conversations/${encodeURIComponent(conversationID)}/read`)
export const blockConversation = async (conversationID: string, activeMailbox: DMMailbox) => normalizeConversation(await apiPutJson<RawConversation>(`${base()}/conversations/${encodeURIComponent(conversationID)}/block`), activeMailbox)
export const unblockConversation = async (conversationID: string, activeMailbox: DMMailbox) => normalizeConversation(await apiDeleteJson<RawConversation>(`${base()}/conversations/${encodeURIComponent(conversationID)}/block`), activeMailbox)
export const uploadDMImage = (file: File) => { const form = new FormData(); form.append('image', file); return apiPostMultipart<DMImage>(`${base()}/images`, form) }
export const getDMImageContent = (imageID: string) => apiFetch(`${base()}/images/${encodeURIComponent(imageID)}/content`, { credentials: 'include', headers: { Accept: 'image/*' } })
export const reportDMMessage = (messageID: string, report: DMReportInput) => apiPostJson<{ status: string }>(`${base()}/messages/${encodeURIComponent(messageID)}/reports`, report)
export const getDMSettings = () => apiGet<DMSettings>(`${base()}/settings`)
export const updateDMSettings = (settings: DMSettings) => apiPutJson<DMSettings>(`${base()}/settings`, settings)
export const getDMChannelSettings = (channelID: string) => apiGet<DMSettings>(`${base()}/channels/${encodeURIComponent(channelID)}/settings`)
export const updateDMChannelSettings = (channelID: string, settings: DMSettings) => apiPutJson<DMSettings>(`${base()}/channels/${encodeURIComponent(channelID)}/settings`, settings)
export const listDMReports = (cursor?: string, limit = 30) => apiGet<DMPaged<DMReport>>(`${useApiUrl()}/admin/dm/reports${query({ cursor, limit })}`)
export const updateDMReport = (reportID: string, status: 'resolved' | 'dismissed') => apiPutJson<DMReport>(`${useApiUrl()}/admin/dm/reports/${encodeURIComponent(reportID)}`, { status })
