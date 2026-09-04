export const PUBLIC_RATING_MIN_COUNT = 5

export function hasPublicRating(count?: number | null): boolean {
  return Number(count || 0) >= PUBLIC_RATING_MIN_COUNT
}

export function scoreToStars(score: number): string {
  return (score / 2).toFixed(1)
}

export function formatPublicRating(score?: number | null, count?: number | null): string | null {
  if (!hasPublicRating(count)) return null
  return `${Number(score || 0).toFixed(1)} / 10 · ${Number(count)} 人`
}

export function formatViewerRating(score: number): string {
  const normalized = Math.max(1, Math.min(10, Math.round(score)))
  return `${normalized}/10 · ${scoreToStars(normalized)} 星`
}
