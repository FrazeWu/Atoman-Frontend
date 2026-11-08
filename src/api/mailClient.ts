import { apiGet, apiPostJson, apiPutJson, apiDeleteJson, apiPostMultipart, apiRequest } from '@/api/client'
import { useApiUrl } from '@/composables/useApiUrl'
import type { MailSummary, MailAccountInfo } from '@/api/mail'
const base = () => `${useApiUrl()}/mail`
const key = (value: string) => encodeURIComponent(value)
export interface MailUpload { id: string; name: string; type: string; size: number }
export interface MailComposeFields { external_account_id?: string; alias_id?: string; to: string[]; cc: string[]; bcc: string[]; subject: string; text: string; html?: string; send_at?: string; in_reply_to?: string; references?: string[]; attachments: MailUpload[] }
export interface MailDraft extends MailComposeFields { id: string; revision?: number; updated_at?: string }
interface DraftResponse { id: string; revision: number; subject: string; updated_at: string; compose?: MailComposeFields }
function readDraft(row: DraftResponse): MailDraft { const compose = row.compose; return { ...compose, id: row.id, revision: row.revision, updated_at: row.updated_at, to: compose?.to || [], cc: compose?.cc || [], bcc: compose?.bcc || [], text: compose?.text || '', attachments: compose?.attachments || [], subject: compose?.subject || row.subject || '' } }
export interface MailOutbox { id: string; scheduled?: boolean; status: string; send_after: string; created_at: string; draft_id?: string; draft_revision?: number }
export interface MailPage { items: MailSummary[]; has_more: boolean; next_position?: number; total?: number; position?: number }
type ServerSummary = Omit<MailSummary, 'mailboxIds'> & { isStarred?: boolean; mailboxIds?: string[] | Record<string, boolean> }
function readSummary(row: ServerSummary): MailSummary { return { ...row, isFlagged: row.isStarred ?? row.isFlagged, mailboxIds: Array.isArray(row.mailboxIds) ? row.mailboxIds : Object.keys(row.mailboxIds || {}).filter(id => (row.mailboxIds as Record<string, boolean>)[id]) } }
export interface MailAdvancedFilters {
 from?: string; to?: string; subject?: string; after?: string; before?: string
 unread?: boolean | null; starred?: boolean | null; attachment?: boolean | null
}
export async function queryMailMessages(mailboxId: string, query = '', position = 0, limit = 50, filters?: MailAdvancedFilters): Promise<MailPage> {
  const params = new URLSearchParams({ mailbox_id: mailboxId, limit: String(limit), position: String(position) })
  if (query.trim()) params.set('q', query.trim())
  if (filters) {
    for (const field of ['from','to','subject','after','before'] as const) if (filters[field]) params.set(field, filters[field])
    for (const field of ['unread','starred','attachment'] as const) if (filters[field] !== undefined && filters[field] !== null) params.set(field, String(filters[field]))
  }
  const result = await apiGet<MailPage & { items: ServerSummary[] }>(`${base()}/search?${params}`)
  return { ...result, items: result.items.map(readSummary), next_position: (result.position ?? position) + result.items.length }
}
export async function fetchMailThread(_mailboxId: string, threadId: string): Promise<MailSummary[]> {
  const messages: MailSummary[] = []
  let position = 0
  for (;;) {
    const result = await apiGet<MailPage & { items: ServerSummary[] }>(`${base()}/search?${new URLSearchParams({ thread_id: threadId, limit: '100', position: String(position) })}`)
    messages.push(...result.items.map(readSummary))
    if (!result.has_more) return messages
    const next = (result.position ?? position) + result.items.length
    if (next <= position) throw new Error('完整会话暂时无法加载，请重试。')
    position = next
  }
}
export async function fetchMailDrafts() { return (await apiGet<DraftResponse[]>(`${base()}/drafts`)).map(readDraft) }
export async function fetchMailDraft(id: string) { return readDraft(await apiGet<DraftResponse>(`${base()}/drafts/${key(id)}`)) }
export async function saveMailDraft(draft: MailDraft) {
  const { id, revision, updated_at: _updatedAt, ...compose } = draft
  return readDraft(await apiPutJson<DraftResponse>(`${base()}/drafts/${key(id)}`, { revision: revision || 0, compose }))
}
export const deleteMailDraft = (id: string) => apiDeleteJson<{ deleted: boolean }>(`${base()}/drafts/${key(id)}`)
export const queueMail = (fields: MailComposeFields, requestId: string, draftId?: string, draftRevision?: number, sendAt?: string) => { const { attachments, ...content } = fields; return apiPostJson<MailOutbox>(`${base()}/outbox`, { ...content, attachment_ids: attachments.map(file => file.id), request_id: requestId, draft_id: draftId, draft_revision: draftRevision, ...(sendAt ? { send_at: sendAt } : {}) }) }
export interface MailSenderIdentity {address:string; provider:string; external_account_id?:string; alias_id?:string}
export const fetchMailSenders = () => apiGet<MailSenderIdentity[]>(`${base()}/senders`)
export interface MailAlias {id:string; address:string; status:'active'|'disabled'|'needs_review';error_code?:string; created_at:string}
export const fetchMailAliases = () => apiGet<MailAlias[]>(`${base()}/aliases`)
export const createMailAlias = (local_part:string) => apiPostJson<MailAlias>(`${base()}/aliases`,{local_part})
export const setMailAliasEnabled = (id:string,enabled:boolean) => apiPostJson<MailAlias>(`${base()}/aliases/${key(id)}/action`,{action:enabled?'enable':'disable'})
export const provisionMailAccount = () => apiPostJson<MailAccountInfo>(`${base()}/provision`, {})
export const fetchMailOutbox = (id: string) => apiGet<MailOutbox>(`${base()}/outbox/${key(id)}`)
export const fetchMailOutboxes = () => apiGet<MailOutbox[]>(`${base()}/outbox`)
export const cancelMailOutbox = (id: string) => apiPostJson<MailOutbox>(`${base()}/outbox/${key(id)}/cancel`, {})
export const reconcileMailOutbox = (id: string) => apiPostJson<MailOutbox>(`${base()}/outbox/${key(id)}/reconcile`, {})
export async function uploadMailAttachment(file: File): Promise<MailUpload> { const form = new FormData(); form.append('file', file); return apiPostMultipart<MailUpload>(`${base()}/attachments`, form) }
export const deleteMailUpload = (id: string) => apiDeleteJson<{ deleted: boolean }>(`${base()}/attachments/${key(id)}`)
export async function fetchMailAttachmentBlob(messageId: string, partId: string): Promise<Blob> {
  const params = new URLSearchParams({ message_id: messageId, part_id: partId })
  const response = await apiRequest(`${base()}/attachment?${params}`, { credentials: 'include' })
  if (!response.ok) throw new Error('无法下载附件，请重试。')
  return response.blob()
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}
export async function downloadMailAttachment(messageId: string, partId: string, filename: string): Promise<void> { saveBlob(await fetchMailAttachmentBlob(messageId, partId), filename || 'attachment') }
export async function downloadMailSource(messageId: string): Promise<void> {
  const response = await apiRequest(`${base()}/raw?${new URLSearchParams({ message_id: messageId })}`, { credentials: 'include' })
  if (!response.ok) throw new Error('无法下载原始邮件，请重试。')
  saveBlob(await response.blob(), 'message.eml')
}
export type MailAction = 'archive' | 'trash' | 'junk' | 'restore' | 'read' | 'unread' | 'flag' | 'unflag' | 'move'
export interface MailActionResult { undo_id?: string; affected: number; updated?: string[]; failed?: string[] }
interface ActionResponse { undo_token?: string; updated: string[]; failed?: string[] }
export async function mutateMailMessages(_mailboxId: string, messageIds: string[], action: MailAction, targetMailboxId?: string): Promise<MailActionResult> {
  const result = await apiPostJson<ActionResponse>(`${base()}/messages/actions`, { ids: messageIds, action: action === 'flag' ? 'star' : action === 'unflag' ? 'unstar' : action, mailbox_id: targetMailboxId || '' })
  return { undo_id: result.undo_token, affected: result.updated.length, updated: result.updated, failed: result.failed }
}
export const undoMailAction = (token: string) => apiPostJson<ActionResponse>(`${base()}/messages/actions/undo`, { token })
export const createMailFolder = (name: string) => apiPostJson<{ id: string }>(`${base()}/folders`, { name })
export const deleteMailFolder = (id: string) => apiDeleteJson<{ deleted: boolean }>(`${base()}/folders/${key(id)}`)
export interface MailFilterRule { id: string; name?: string; enabled: boolean; field: 'from' | 'to' | 'subject'; value: string; action: 'move' | 'junk' | 'archive' | 'trash'; mailbox_id?: string }
export interface MailSignature { enabled: boolean; text: string; html: string; on_reply: boolean }
export interface MailPreferences { signature?: MailSignature; mail_notifications?: boolean; conversation_mode?: boolean; rules: MailFilterRule[]; blocked_senders: string[]; vacation: { enabled: boolean; subject: string; text: string } }
interface PreferencesResponse { conversation_mode: boolean; rules: Array<Omit<MailFilterRule, 'value'> & { contains: string }>; blocked_senders: string[]; signature?: MailSignature; auto_reply: MailPreferences['vacation'] }
function readPreferences(row: PreferencesResponse): MailPreferences { return { conversation_mode: row.conversation_mode, signature: row.signature || { enabled:false,text:'',html:'',on_reply:true }, blocked_senders: row.blocked_senders || [], vacation: row.auto_reply, rules: (row.rules || []).map(rule => ({ ...rule, value: rule.contains })) } }
export async function fetchMailPreferences() { return readPreferences(await apiGet<PreferencesResponse>(`${base()}/settings`)) }
export async function saveMailPreferences(settings: MailPreferences) {
  const payload: PreferencesResponse = { conversation_mode: settings.conversation_mode ?? true, signature: settings.signature || { enabled:false,text:'',html:'',on_reply:true }, blocked_senders: settings.blocked_senders, auto_reply: settings.vacation, rules: settings.rules.map(({ value, ...rule }) => ({ ...rule, name: rule.name || value, contains: value })) }
  return readPreferences(await apiPutJson<PreferencesResponse>(`${base()}/settings`, payload))
}
export interface MailAppPassword { id: string; name: string; created_at: string }
export const fetchMailAppPasswords = () => apiGet<MailAppPassword[]>(`${base()}/app-passwords`)
export const createMailAppPassword = (name: string) => apiPostJson<MailAppPassword & { password: string }>(`${base()}/app-passwords`, { name })
export const revokeMailAppPassword = (id: string) => apiDeleteJson<{ revoked: boolean }>(`${base()}/app-passwords/${key(id)}`)

export interface MailContact { id: string; name: string; email: string; notes: string; revision: number; updated_at: string }
export const fetchMailContacts = () => apiGet<MailContact[]>(base()+'/contacts')
export const createMailContact = (item: Pick<MailContact,'name'|'email'|'notes'>) => apiPostJson<MailContact>(base()+'/contacts', item)
export const updateMailContact = (item: MailContact) => apiPutJson<MailContact>(base()+'/contacts/'+key(item.id), item)
export const deleteMailContact = (id: string) => apiDeleteJson<{ deleted:boolean }>(base()+'/contacts/'+key(id))
export const fetchMailUnread = () => apiGet<{count:number;latest_id?:string}>(base()+'/unread')

// Remote IMAP accounts are owned by the active Atoman session. The provider
// authorization secret is accepted once, never returned by any read route.
export type ExternalIMAPProvider = 'gmail' | 'qq' | '163' | 'icloud' | 'yahoo'
export interface MailExternalProvider { id: ExternalIMAPProvider; label: string; host: string; port: number }
export interface MailExternalAccount {
  id: string
  provider: ExternalIMAPProvider
  address: string
  last_synced_at?: string
  last_error_code?: string
  messages_count: number
  unread_count: number
  has_more: boolean
  revision: number
}
export interface MailExternalMessage {
  account_id: string
  account_address: string
  provider: ExternalIMAPProvider
  uid: number
  uid_validity: number
  subject: string
  from: string
  from_name: string
  date: string
  seen: boolean
  size: number
}
export interface MailExternalUnifiedInbox {
  accounts: MailExternalAccount[]
  messages: MailExternalMessage[]
}
export const fetchExternalProviders = () => apiGet<MailExternalProvider[]>(base()+'/external/providers')
export const fetchExternalAccounts = () => apiGet<MailExternalAccount[]>(base()+'/external/accounts')
export const connectExternalAccount = (provider: ExternalIMAPProvider,address:string,app_password:string) =>
  apiPostJson<MailExternalAccount>(base()+'/external/accounts',{provider,address,app_password})
export const syncExternalAccount = (id:string) =>
  apiPostJson<MailExternalAccount>(base()+'/external/accounts/'+key(id)+'/sync',{})
export const disconnectExternalAccount = (id:string) =>
  apiDeleteJson<{deleted:boolean}>(base()+'/external/accounts/'+key(id))
export const fetchExternalUnifiedInbox = () =>
  apiGet<MailExternalUnifiedInbox>(base()+'/external/unified')
export const setExternalMessageSeen = (accountId:string,uid:number,validity:number,seen:boolean,folder?:string) =>
  apiPostJson<MailExternalAccount | {updated:boolean}>(base()+'/external/accounts/'+key(accountId)+'/messages/'+key(String(uid))+'/seen', {uid_validity:validity,seen,...(folder ? {folder} : {})})
export interface MailExternalFolder { name: string; delimiter?: string; role?: string }
export interface MailExternalFolderPage {
  folder:string
  uid_validity:number
  messages:Array<{uid:number;subject:string;from:string;from_name:string;date:string;seen:boolean;size:number}>
  total:number
  has_more:boolean
  next_position:number
}
export const fetchExternalFolders = (accountId:string) =>
  apiGet<MailExternalFolder[]>(base()+'/external/accounts/'+key(accountId)+'/folders')
export const fetchExternalFolderPage = (accountId:string,folder:string,position=0) =>
  apiGet<MailExternalFolderPage>(base()+'/external/accounts/'+key(accountId)+'/folder-messages?'+new URLSearchParams({folder,position:String(position)}))
export interface ExternalMoveReceipt {moved:boolean;inbox_cache_updated:boolean;refresh_recommended:boolean}
export const moveExternalMessage = (accountId:string,uid:number,validity:number,source:string,destination:string) =>
  apiPostJson<ExternalMoveReceipt>(base()+'/external/accounts/'+key(accountId)+'/messages/'+key(String(uid))+'/move',
    {uid_validity:validity,source,destination})
export const fetchExternalMessagePlain = (accountId:string,uid:number,validity:number,folder?:string) => {
  const url=base()+'/external/accounts/'+key(accountId)+'/messages/'+key(String(uid))+
    '?'+new URLSearchParams({uid_validity:String(validity),...(folder ? {folder} : {})})
  return apiGet<{text:string}>(url)
}

// The import source is always an explicitly authorized provider account.
// Only public progress counts and user-owned source folder names are returned.
export type MailExternalHistoryStatus = 'queued' | 'running' | 'paused' | 'failed' | 'needs_review' | 'cancelled' | 'completed' | 'watching'
export interface MailExternalHistoryJob {
 id:string
 account_id:string
 folder:string
 status:MailExternalHistoryStatus
 continuous:boolean
 flag_sync_enabled?:boolean
 flag_sync_generation?:number
 flag_sync_cursor_uid?:number
 flag_last_polled_at?:string
 flag_last_error_code?:string
 last_polled_at?:string
 uid_validity:number
 upper_uid:number
 next_uid:number
 imported:number
 skipped:number
 last_error_code?:string
 created_at:string
 updated_at:string
}
export const fetchExternalHistoryJobs = (accountId:string) =>
  apiGet<MailExternalHistoryJob[]>(base()+'/external/accounts/'+key(accountId)+'/imports')
export const startExternalHistoryJob = (accountId:string,folder:string,continuous=false) =>
  apiPostJson<MailExternalHistoryJob>(base()+'/external/accounts/'+key(accountId)+'/imports',{folder,continuous})
export const actionExternalHistoryJob = (accountId:string,jobId:string,action:'pause'|'resume'|'cancel'|'enable_live'|'disable_live') =>
  apiPostJson<MailExternalHistoryJob>(base()+'/external/accounts/'+key(accountId)+'/imports/'+key(jobId)+'/action',{action})

// A read-only flag-diff preview never invokes IMAP STORE or JMAP Email/set.
export interface MailFlagDiff {source:boolean;native:boolean;baseline:boolean;decision:'in_sync'|'copy_to_native'|'copy_to_source'|'conflict'}
export interface MailFlagPreviewItem {source_uid:number;native_email_id:string;status:'ready'|'baseline_unknown'|'source_missing'|'native_missing'|'sync_needs_review';seen:MailFlagDiff;flagged:MailFlagDiff}
export interface MailFlagPreviewPage {job_id:string;folder:string;items:MailFlagPreviewItem[];next_position:number;has_more:boolean;checked_at:string}
export const fetchExternalFlagPreview = (accountId:string,jobId:string,position=0) =>
  apiGet<MailFlagPreviewPage>(base()+'/external/accounts/'+key(accountId)+'/imports/'+key(jobId)+'/flag-preview?'+new URLSearchParams({position:String(position)}))

// Explicit per-import-job opt-in; the server also requires a separately
// enabled operational gate. No send, move or permanent-delete effects.
export interface ExternalFlagAttempt {id:string;source_uid:number;flag:'seen'|'flagged';direction:'copy_to_source'|'copy_to_native';desired:boolean;status:'dispatching'|'needs_review'|'applied'|'aborted_prewrite';error_code?:string;created_at:string}
export const configureExternalFlagSync = (accountId:string,jobId:string,enabled:boolean) =>
  apiPostJson<MailExternalHistoryJob>(base()+'/external/accounts/'+key(accountId)+'/imports/'+key(jobId)+'/flag-sync',{enabled})
export const fetchExternalFlagAttempts = (accountId:string,jobId:string) =>
  apiGet<ExternalFlagAttempt[]>(base()+'/external/accounts/'+key(accountId)+'/imports/'+key(jobId)+'/flag-attempts')
export const reconcileExternalFlagAttempt = (accountId:string,jobId:string,attemptId:string) =>
  apiPostJson<ExternalFlagAttempt>(base()+'/external/accounts/'+key(accountId)+'/imports/'+key(jobId)+'/flag-attempts/'+key(attemptId)+'/reconcile',{})

// Atoman-private encrypted mail organizer metadata; independent from remote IMAP flags.
export type MailOrganizerColor = 'slate' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink'
export interface MailOrganizerLabel { id: string; name: string; color: MailOrganizerColor; revision: number }
export interface MailOrganizerRecord { message_id: string; snooze_until?: string; follow_up_at?: string; label_ids: string[]; revision: number }
export interface MailOrganizerState { labels: MailOrganizerLabel[]; records: MailOrganizerRecord[] }
export type MailOrganizerAction = 'snooze' | 'unsnooze' | 'follow_up' | 'clear_follow_up' | 'label_add' | 'label_remove'
export interface MailOrganizerMutation {
  message_id: string
  action: MailOrganizerAction
  due_at?: string
  label_id?: string
  revision?: number
}
export const fetchMailOrganizer = (): Promise<MailOrganizerState> => apiGet<MailOrganizerState>(base()+'/organize')
export const createMailOrganizerLabel = (name: string, color: MailOrganizerColor) => apiPostJson<MailOrganizerLabel>(base()+'/organize/labels', {name,color})
export const updateMailOrganizerLabel = (row: MailOrganizerLabel) => apiPutJson<MailOrganizerLabel>(base()+'/organize/labels/'+key(row.id), row)
export const deleteMailOrganizerLabel = (id: string) => apiDeleteJson<{deleted:boolean}>(base()+'/organize/labels/'+key(id))
export const mutateMailOrganizer = (input: MailOrganizerMutation) => apiPostJson<MailOrganizerRecord>(base()+'/organize/messages', input)
