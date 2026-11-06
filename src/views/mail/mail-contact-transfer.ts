/** Local-only, size-limited contact interchange. The server remains the authority for ownership and validation. */
export interface TransferContact { name: string; email: string; notes: string }
export interface ContactImport { rows: TransferContact[]; duplicateRows: number }
export const CONTACT_FILE_MAX_BYTES = 1024 * 1024
export const CONTACT_BATCH_LIMIT = 500

const validEmail = (email: string) => /^[^\s@<>,;:"\[\]\\]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(email) &&
  email.length <= 254 && !email.includes('..') && email.includes('.')
function normal(row: TransferContact, index: number): TransferContact {
  const name = row.name.trim(), email = row.email.trim().toLowerCase(), notes = row.notes.trim()
  if (!validEmail(email) || name.length > 200 || notes.length > 2048 || /[\u0000]/.test(name + notes))
    throw new Error(`第 ${index} 条联系人格式无效，请检查邮箱、姓名或备注。`)
  return { name, email, notes }
}
function unique(raw: TransferContact[]): ContactImport {
  if (raw.length > CONTACT_BATCH_LIMIT) throw new Error(`一次最多导入 ${CONTACT_BATCH_LIMIT} 个联系人。`)
  const seen = new Set<string>(), rows: TransferContact[] = []
  let duplicateRows = 0
  raw.forEach((row, index) => {
    const item = normal(row, index + 1)
    if (seen.has(item.email)) duplicateRows++
    else { seen.add(item.email); rows.push(item) }
  })
  if (!rows.length) throw new Error('文件中没有可导入的邮箱联系人。')
  return { rows, duplicateRows }
}
function parseCSVCells(input: string): string[][] {
  const rows: string[][] = [], record: string[] = []
  let field = '', quoted = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += ch
    } else if (ch === ',') {
      record.push(field); field = ''
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      record.push(field); field = ''
      if (record.some(v => v.trim())) rows.push(record.slice())
      record.length = 0
      if (rows.length > CONTACT_BATCH_LIMIT + 1) throw new Error('CSV 联系人数量超过每次 500 条的限制。')
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === '"') throw new Error('CSV 引号格式无效。')
    else field += ch
  }
  if (quoted) throw new Error('CSV 文件存在未闭合的引号。')
  if (record.length || field.length) {
    record.push(field)
    if (record.some(v => v.trim())) rows.push(record)
  }
  return rows
}
function parseCSV(input: string): ContactImport {
  const rows = parseCSVCells(input)
  const headers = (rows.shift() || []).map(v => v.trim().toLowerCase())
  const column = (...names: string[]) => headers.findIndex(h => names.includes(h))
  const emailCol = column('email', 'e-mail', '邮箱', '邮箱地址', 'email address')
  const nameCol = column('name', 'full name', '姓名', 'display name')
  const notesCol = column('notes', 'note', '备注')
  if (emailCol < 0) throw new Error('CSV 必须有 email（或邮箱地址）列。')
  return unique(rows.map(r => ({ name: nameCol >= 0 ? r[nameCol] || '' : '', email: r[emailCol] || '', notes: notesCol >= 0 ? r[notesCol] || '' : '' })))
}
function decodeVCardText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => c.toLowerCase() === 'n' ? '\n' : c)
}
function parseVCard(input: string): ContactImport {
  // vCard 3.0 and plain UTF-8 vCard 4.0 text fields, including folded lines.
  const lines = input.replace(/\r\n?/g, '\n').split('\n')
  const unfolded: string[] = []
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1)
    else unfolded.push(line)
  }
  const contacts: TransferContact[] = []
  let card: { name: string; fallbackName: string; notes: string; emails: string[] } | null = null
  for (const line of unfolded) {
    const raw = line.trim()
    if (raw.toUpperCase() === 'BEGIN:VCARD') {
      if (card) throw new Error('vCard 文件格式无效：重复 BEGIN。')
      card = { name: '', fallbackName: '', notes: '', emails: [] }
      continue
    }
    if (raw.toUpperCase() === 'END:VCARD') {
      if (!card) throw new Error('vCard 文件格式无效：缺少 BEGIN。')
      for (const email of card.emails) contacts.push({ name: card.name || card.fallbackName, email, notes: card.notes })
      card = null
      if (contacts.length > CONTACT_BATCH_LIMIT) throw new Error('一次最多导入 500 个联系人。')
      continue
    }
    if (!card) continue
    const pos = line.indexOf(':')
    if (pos < 0) continue
    const head = line.slice(0, pos).toUpperCase(), key = head.split(';')[0] || ''
    const data = decodeVCardText(line.slice(pos + 1))
    if (head.includes('ENCODING=') || head.includes('VALUE=URI')) continue
    if (key === 'FN') card.name = data
    else if (key === 'N') {
      const [family = '', given = ''] = data.split(';')
      card.fallbackName = [given, family].filter(Boolean).join(' ')
    } else if (key === 'EMAIL') card.emails.push(data.replace(/^mailto:/i, ''))
    else if (key === 'NOTE') card.notes = data
  }
  if (card) throw new Error('vCard 文件格式无效：缺少 END。')
  return unique(contacts)
}
export function parseContactFile(filename: string, input: string): ContactImport {
  if (new TextEncoder().encode(input).length > CONTACT_FILE_MAX_BYTES) throw new Error('文件不能超过 1 MB。')
  if (input.includes('\u0000')) throw new Error('文件不是有效的 UTF-8 文本。')
  const value = input.replace(/^\uFEFF/, '')
  if (/\.vcf$/i.test(filename) || /^\s*BEGIN:VCARD/im.test(value)) return parseVCard(value)
  if (/\.csv$/i.test(filename)) return parseCSV(value)
  throw new Error('只支持 .csv 或 .vcf 文件。')
}
function csvCell(raw: string): string {
  // Defuse spreadsheet formula evaluation on export, including leading whitespace.
  const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw
  return '"' + safe.replace(/"/g, '""') + '"'
}
export function exportContactsCSV(rows: TransferContact[]): string {
  return '\uFEFF' + ['name,email,notes', ...rows.map(r => [r.name, r.email, r.notes].map(csvCell).join(','))].join('\r\n') + '\r\n'
}
const escapeCard = (value: string) => value.replace(/\r\n?/g, '\n').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
function foldVCard(raw: string): string {
  // RFC 6350 line folding: no physical line exceeds 75 UTF-8 octets.
  const lines: string[] = []
  let part = '', used = 0
  const encoder = new TextEncoder()
  for (const c of raw) {
    const bytes = encoder.encode(c).length
    if (used + bytes > 75) { lines.push(part); part = ' '; used = 1 }
    part += c; used += bytes
  }
  lines.push(part)
  return lines.join('\r\n')
}
export function exportContactsVCard(rows: TransferContact[]): string {
  return rows.map(r => [
    'BEGIN:VCARD', 'VERSION:3.0',
    foldVCard('FN:' + escapeCard(r.name || r.email)),
    'N:;;;;', foldVCard('EMAIL;TYPE=INTERNET:' + escapeCard(r.email)),
    ...(r.notes ? [foldVCard('NOTE:' + escapeCard(r.notes))] : []),
    'END:VCARD'
  ].join('\r\n')).join('\r\n') + '\r\n'
}
