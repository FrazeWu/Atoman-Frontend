import DOMPurify from 'dompurify'
import type { MailAddress, MailSummary, MailDetail } from '@/api/mail'

export function parseRecipients(value: string): string[] {
  const values = value.split(/[,;\n，；]+/).map(item => item.trim()).filter(Boolean)
  if (values.some(item => !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(item))) throw new Error('请检查收件人地址，多个地址用逗号分隔。')
  if (values.length > 100) throw new Error('一次最多发送给 100 个地址。')
  return [...new Set(values.map(item => item.toLowerCase()))]
}
export function addressText(items: MailAddress[] = []): string {
  return items.map(item => item.name ? `${item.name} <${item.email}>` : item.email).join('，') || '未提供'
}
export function mailTime(value: string, full = false): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', full ? { dateStyle: 'medium', timeStyle: 'short' } : { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}
export function fileSize(value: number): string {
  if (value >= 1024 * 1024) return `${(value / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.ceil(value / 1024))} KB`
}
export interface MailConversation { id: string; latest: MailSummary; messages: MailSummary[] }
export function groupConversations(messages: MailSummary[], grouped: boolean): MailConversation[] {
  const groups = new Map<string, MailConversation>()
  for (const mail of messages) {
    const id = grouped ? mail.threadId || mail.id : mail.id
    const current = groups.get(id)
    if (current) {
      current.messages.push(mail)
      if (Date.parse(mail.receivedAt) > Date.parse(current.latest.receivedAt)) current.latest = mail
    } else groups.set(id, { id, latest: mail, messages: [mail] })
  }
  return [...groups.values()].sort((a, b) => Date.parse(b.latest.receivedAt) - Date.parse(a.latest.receivedAt))
}
export function replyRecipients(detail: MailDetail, ownAddress: string, all: boolean) {
  const own = ownAddress.toLowerCase()
  const from = detail.replyTo?.length ? detail.replyTo : detail.from
  const to = [...new Set([...from, ...(all ? detail.to : [])].map(item => item.email.toLowerCase()).filter(item => item !== own))]
  const cc = all ? [...new Set(detail.cc.map(item => item.email.toLowerCase()).filter(item => item !== own && !to.includes(item)))] : []
  return { to, cc }
}
/** A scriptless unique-origin frame and restrictive CSP block tracking requests, CSS URLs, forms and script execution. */
export function mailFrameDocument(html: string): string {
  const safe = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'svg', 'math'], FORBID_ATTR: ['style', 'src', 'srcset', 'background', 'poster', 'ping', 'action', 'formaction', 'target'] })
  const doc = new DOMParser().parseFromString(safe, 'text/html')
  for (const node of doc.querySelectorAll('img')) {
    // Remote images and CID content require a scoped authenticated proxy; never fetch sender URLs.
    node.replaceWith(doc.createTextNode(node.getAttribute('alt') ? `[图片：${node.getAttribute('alt')}]` : '[图片]'))
  }
  for (const node of doc.querySelectorAll('a')) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer') }
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src \'none\'; font-src \'none\'; form-action \'none\'; base-uri \'none\'"><meta name="referrer" content="no-referrer"><style>body{font:14px/1.8 system-ui,sans-serif;color:#253142;overflow-wrap:anywhere;margin:14px}pre{white-space:pre-wrap}table{max-width:100%;border-collapse:collapse}td,th{padding:4px}blockquote{border-left:3px solid #d5dce4;margin-left:0;padding-left:14px;color:#64748b}a{color:#2563eb}</style></head><body>' + doc.body.innerHTML + '</body></html>'
}
export function newRequestID(): string { return crypto.randomUUID() }
