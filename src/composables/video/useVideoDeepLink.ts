export function clampVideoTime(value: number, durationSec?: number) {
  const rounded = Math.max(0, Math.floor(value))
  if (!durationSec || durationSec <= 0) return rounded
  return Math.min(rounded, Math.max(0, Math.floor(durationSec) - 1))
}

export function parseVideoTimeParam(value: string | null | undefined, durationSec?: number): number | null {
  if (!value) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds)) return clampVideoTime(seconds, durationSec)

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  if (!match) return null
  const hasAnyPart = Boolean(match[1] || match[2] || match[3])
  if (!hasAnyPart) return null

  const total = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)
  return clampVideoTime(total, durationSec)
}

export function buildVideoTimeLink(href: string, currentTimeSec: number, durationSec?: number) {
  const url = new URL(href)
  url.searchParams.set('t', String(clampVideoTime(currentTimeSec, durationSec)))
  return url.toString()
}
