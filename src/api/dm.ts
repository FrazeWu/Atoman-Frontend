import { ApiErrorResponseError, apiDeleteJson, apiGet, apiGetOptional, apiPostJson, apiPostMultipart, apiPutJson } from './client'
import { useApiUrl } from '@/composables/useApi'

export type DMPartyType = 'user' | 'channel'
export type DMPermission = 'one_before_reply' | 'following_only' | 'anyone' | 'closed'

export type DMParty = {
  type: DMPartyType
  id: string
  username?: string
  slug?: string
  display_name: string
  avatar_url?: string
}

export type DMMailbox = {
  type: DMPartyType
  id: string
  display_name: string
  unread_count: number
}

export type DMConversation = {
  id: string
  mailbox: DMMailbox
  other_party: DMParty
  last_message_at: string | null
  last_message_preview: string
  unread_count: number
  blocked: boolean
  reply_as: DMParty
}

export type DMMessage = {
  id: string
  conversation_id: string
  client_message_id: string
  sender: DMParty
  content: string
  image_id?: string
  image_url?: string
  read_at?: string | null
  created_at: string
}

export type DMPaged<T> = { items: T[]; next_cursor?: string }
export type DMTarget = { type: DMPartyType; id: string }
export type DMReadResult = { conversation_unread: number; mailbox_unread: number; dm_unread: number; total_unread: number }
export type DMImage = { id: string; url: string }
export type DMSettings = { permission: DMPermission }
export type DMReport = { reason: string; detail: string }

export type DMRealtimeEvent =
  | { event: 'dm.message.created'; data: { message: DMMessage; conversation: DMConversation; mailbox: DMMailbox; dm_unread: number; total_unread: number } }
  | { event: 'dm.message.read'; data: { conversation_id: string; read_at: string; mailbox: DMMailbox; dm_unread: number; total_unread: number } }
  | { event: 'dm.mailbox.updated'; data: { mailbox: DMMailbox; dm_unread: number; total_unread: number } }

export const dmErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiErrorResponseError)) return '暂时无法完成操作，请稍后重试'
  const messages: Record<string, string> = {
    'dm.waiting_reply': '等待对方回复后可继续发送',
    'dm.blocked': '当前会话无法发送消息',
    'dm.permission_denied': '对方暂不接收私信',
    'dm.rate_limited': '发送较频繁，请稍后再试',
    'dm.image_invalid': '请选择 10 MB 以内的 JPEG、PNG 或 WebP 图片',
    'dm.self_target': '不能给自己发送私信',
    'dm.target_not_found': '该用户或频道不存在',
    'dm.conversation_forbidden': '无法访问这个会话',
    'dm.message_not_found': '这条消息已不可用',
    'dm.already_reported': '你已经举报过这条消息',
  }
  return messages[error.code] ?? '暂时无法完成操作，请稍后重试'
}

const base = () => `${useApiUrl()}/dm`
const partyPath = (target: DMTarget) => `${encodeURIComponent(target.type)}/${encodeURIComponent(target.id)}`
const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value))
  })
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export const mailboxKey = (mailbox: Pick<DMMailbox, 'type' | 'id'>) => `${mailbox.type}:${mailbox.id}`

export const listMailboxes = () => apiGet<DMMailbox[]>(`${base()}/mailboxes`)
export const listConversations = (mailbox: DMTarget, cursor?: string, limit = 30) =>
  apiGet<DMPaged<DMConversation>>(`${base()}/mailboxes/${partyPath(mailbox)}/conversations${query({ cursor, limit })}`)
export const getTargetConversation = (target: DMTarget) =>
  apiGetOptional<DMConversation>(`${base()}/targets/${partyPath(target)}/conversation`)
export const listMessages = (conversationID: string, before?: string, limit = 30) =>
  apiGet<DMPaged<DMMessage>>(`${base()}/conversations/${encodeURIComponent(conversationID)}/messages${query({ before, limit })}`)

export type DMSendInput = { client_message_id: string; content: string; image_id?: string | null }

export const sendToTarget = (target: DMTarget, input: DMSendInput) =>
  apiPostJson<DMMessage>(`${base()}/targets/${partyPath(target)}/messages`, input)
export const sendInConversation = (conversationID: string, input: DMSendInput) =>
  apiPostJson<DMMessage>(`${base()}/conversations/${encodeURIComponent(conversationID)}/messages`, input)
export const markConversationRead = (conversationID: string) =>
  apiPutJson<DMReadResult>(`${base()}/conversations/${encodeURIComponent(conversationID)}/read`)
export const blockConversation = (conversationID: string) =>
  apiPostJson<DMConversation>(`${base()}/conversations/${encodeURIComponent(conversationID)}/block`, {})
export const unblockConversation = (conversationID: string) =>
  apiDeleteJson<DMConversation>(`${base()}/conversations/${encodeURIComponent(conversationID)}/block`)
export const uploadDMImage = (file: File) => {
  const form = new FormData()
  form.append('image', file)
  return apiPostMultipart<DMImage>(`${base()}/images`, form)
}
export const reportDMMessage = (messageID: string, report: DMReport) =>
  apiPostJson<void>(`${base()}/messages/${encodeURIComponent(messageID)}/reports`, report)
export const getDMSettings = () => apiGet<DMSettings>(`${base()}/settings`)
export const updateDMSettings = (settings: DMSettings) => apiPutJson<DMSettings>(`${base()}/settings`, settings)
export const getDMChannelSettings = (channelID: string) => apiGet<DMSettings>(`${base()}/channels/${encodeURIComponent(channelID)}/settings`)
export const updateDMChannelSettings = (channelID: string, settings: DMSettings) =>
  apiPutJson<DMSettings>(`${base()}/channels/${encodeURIComponent(channelID)}/settings`, settings)
export const listDMReports = () => apiGet<unknown[]>(`${useApiUrl()}/admin/dm/reports`)
export const updateDMReport = (reportID: string, status: 'resolved' | 'dismissed') =>
  apiPutJson<unknown>(`${useApiUrl()}/admin/dm/reports/${encodeURIComponent(reportID)}`, { status })
