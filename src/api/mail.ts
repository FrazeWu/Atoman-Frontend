import { apiGet, apiPostJson } from '@/api/client'
import { useApiUrl } from '@/composables/useApiUrl'

/** Atoman website account reservation, not the IMAP mailbox itself. */
export type MailAccountStatus = 'not_invited' | 'not_ready' | 'reserved' | 'provisioning' | 'active' | 'suspended' | 'failed'

export interface MailAccountInfo {
  available: boolean
  status: MailAccountStatus
  address?: string
}

export interface MailFolder {
  id: string
  name: string
  parentId: string | null
  role: string | null
  totalEmails: number
  unreadEmails: number
}

/** List preview only; full mail body/attachments are not available yet. */
export interface MailSummary {
  id: string
  threadId: string
  subject: string
  receivedAt: string
  preview: string
  hasAttachment: boolean
}

export interface MailAddress { name: string; email: string }
export interface MailAttachmentInfo { name: string; type: string; size: number }
export interface MailDetail {
  id: string
  threadId: string
  subject: string
  receivedAt: string
  from: MailAddress[]
  to: MailAddress[]
  cc: MailAddress[]
  plainText: string
  bodyTruncated: boolean
  hasPlainText: boolean
  attachments: MailAttachmentInfo[]
  isRead: boolean
}

const mailBase = () => `${useApiUrl()}/mail`

export const fetchMyMailAccount = (): Promise<MailAccountInfo> =>
  apiGet<MailAccountInfo>(`${mailBase()}/me`)

export const fetchMailFolders = (): Promise<MailFolder[]> =>
  apiGet<MailFolder[]>(`${mailBase()}/folders`)

export function fetchMailSummaries(mailboxId: string, limit = 50): Promise<MailSummary[]> {
  if (!mailboxId || limit < 1 || limit > 100 || !Number.isInteger(limit)) {
    return Promise.reject(new Error('无效的邮件文件夹或读取数量'))
  }
  const query = new URLSearchParams({ mailbox_id: mailboxId, limit: String(limit) })
  return apiGet<MailSummary[]>(`${mailBase()}/messages?${query}`)
}

/** Read details within the signed-in user's scoped Stalwart mailbox. */
export function fetchMailDetail(mailboxId: string, messageId: string): Promise<MailDetail> {
  if (!mailboxId || !messageId || mailboxId.length > 512 || messageId.length > 512) {
    return Promise.reject(new Error('无效的邮件标识'))
  }
  const query = new URLSearchParams({ mailbox_id: mailboxId, message_id: messageId })
  return apiGet<MailDetail>(`${mailBase()}/message?${query}`)
}

/** Only call after the selected message has actually been displayed. */
export function markMailRead(mailboxId: string, messageId: string): Promise<{ read: boolean }> {
  if (!mailboxId || !messageId || mailboxId.length > 512 || messageId.length > 512) {
    return Promise.reject(new Error('无效的邮件标识'))
  }
  return apiPostJson<{ read: boolean }>(`${mailBase()}/messages/read`, { mailbox_id: mailboxId, message_id: messageId })
}

export interface IssuedMailInvitation {
  id: string
  token: string
  expires_at: string
  address?: string
}

export function issueMailInvitation(targetUserId: string): Promise<IssuedMailInvitation> {
  return apiPostJson<IssuedMailInvitation>(`${mailBase()}/admin/invites`, { target_user_id: targetUserId })
}

export function reserveAdminMailAddress(localPart: string): Promise<MailAccountInfo> {
  return apiPostJson<MailAccountInfo>(`${mailBase()}/admin/reserve-self`, { local_part: localPart })
}

export function redeemMailInvitation(token: string, localPart: string): Promise<MailAccountInfo> {
  return apiPostJson<MailAccountInfo>(`${mailBase()}/activate`, { token, local_part: localPart })
}
