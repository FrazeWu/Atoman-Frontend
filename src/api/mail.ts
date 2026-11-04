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

export const redeemMailInvitation = (token: string): Promise<MailAccountInfo> =>
  apiPostJson<MailAccountInfo>(`${mailBase()}/activate`, { token })
