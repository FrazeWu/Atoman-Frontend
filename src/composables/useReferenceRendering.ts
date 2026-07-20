import type { ResolvedReference } from '@/api/references'
import { moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { modulePathUrl } from '@/router/siteUrls'

type ReferenceLocation = Pick<ResolvedReference, 'module' | 'path'>

export function referenceHref(reference: ReferenceLocation) {
  const path = reference.path || ''
  if (!path.startsWith('/')) return '#'
  if (path.startsWith('/users/') || path.startsWith('/channels/')) return path
  const module = reference.module as ModuleRoomKey
  if (!moduleRooms[module]) return path
  const prefix = `/${moduleRooms[module].publicPathSegment}`
  if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) return path
  return modulePathUrl(module, path)
}

function escapeMarkdownLabel(value: string) {
  return value.replace(/([\\\[\]])/g, '\\$1')
}

function escapeMarkdownHref(value: string) {
  return value.replace(/([()])/g, '\\$1')
}

export function applyResolvedReferences(content: string, references: ResolvedReference[] = [], field = 'content') {
  const points = Array.from(content)
  const items = references
    .filter(reference => reference.available && (!reference.field || reference.field === field))
    .sort((left, right) => right.start - left.start || right.end - left.end)
  let lastStart = points.length
  for (const reference of items) {
    if (reference.start < 0 || reference.end <= reference.start || reference.end > points.length || reference.end > lastStart) continue
    const visible = reference.target_type === 'user' && reference.subtitle?.startsWith('@')
      ? reference.subtitle
      : reference.label ? `@${reference.label}` : ''
    const href = referenceHref(reference)
    if (!visible || href === '#') continue
    points.splice(reference.start, reference.end - reference.start, `[${escapeMarkdownLabel(visible)}](${escapeMarkdownHref(href)})`)
    lastStart = reference.start
  }
  return points.join('')
}
