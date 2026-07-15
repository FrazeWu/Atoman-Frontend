import type { CommentTimeAnchor } from '@/api/comments'

export type MediaTimeToken =
  | { type: 'text'; text: string }
  | { type: 'anchor'; text: string; anchor: CommentTimeAnchor }

export function tokenizeTimeAnchors(content: string, anchors: CommentTimeAnchor[]): MediaTimeToken[] {
  const points = Array.from(content)
  const valid: CommentTimeAnchor[] = []
  let acceptedEnd = 0
  for (const anchor of [...anchors].sort((a, b) => a.start - b.start || a.end - b.end)) {
    if (!Number.isInteger(anchor.start) || !Number.isInteger(anchor.end) || anchor.start < acceptedEnd
      || anchor.start < 0 || anchor.end <= anchor.start || anchor.end > points.length || anchor.seconds < 0) continue
    valid.push(anchor)
    acceptedEnd = anchor.end
  }
  if (!valid.length) return content ? [{ type: 'text', text: content }] : []

  const tokens: MediaTimeToken[] = []
  let cursor = 0
  valid.forEach((anchor) => {
    if (anchor.start > cursor) tokens.push({ type: 'text', text: points.slice(cursor, anchor.start).join('') })
    tokens.push({ type: 'anchor', text: points.slice(anchor.start, anchor.end).join(''), anchor })
    cursor = anchor.end
  })
  if (cursor < points.length) tokens.push({ type: 'text', text: points.slice(cursor).join('') })
  return tokens
}

export function seekToAnchor(anchor: CommentTimeAnchor, seek: (seconds: number) => void) {
  seek(anchor.seconds)
}

export function formatTimeAnchor(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const tail = String(total % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${tail}` : `${minutes}:${tail}`
}

export function formatTimestampLabel(seconds: number) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const tail = String(total % 60).padStart(2, '0')
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${tail}`
    : `${String(minutes).padStart(2, '0')}:${tail}`
}
