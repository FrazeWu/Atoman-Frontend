export function clampTimestamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function formatTimestampLabel(value: number): string {
  const total = clampTimestamp(value)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function serializeTimestampComment(timestampSec?: number | null): { timestamp_sec: number | null } {
  if (timestampSec === null || timestampSec === undefined) {
    return { timestamp_sec: null }
  }
  return { timestamp_sec: clampTimestamp(timestampSec) }
}

export function extractTimestampFromComment(content: string): number | null {
  const match = content.match(/(?:^|[^\d])(?:(\d{1,2}):)?(\d{1,2}):([0-5]\d)(?=$|[^\d])/)
  if (!match) return null

  const hours = Number(match[1] || 0)
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (minutes > 59) return null

  return hours * 3600 + minutes * 60 + seconds
}
