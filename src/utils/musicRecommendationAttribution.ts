import type { MusicRecommendationContext } from '@/types'

const attributionTtlMs = 30 * 60 * 1000
const albumAttributions = new Map<string, { context: MusicRecommendationContext; expiresAt: number }>()

export function rememberMusicRecommendationAlbum(
  albumId: string,
  context: MusicRecommendationContext,
): void {
  albumAttributions.set(String(albumId), {
    context: { ...context },
    expiresAt: Date.now() + attributionTtlMs,
  })
}

export function getMusicRecommendationAlbumContext(
  albumId: string,
): MusicRecommendationContext | null {
  const entry = albumAttributions.get(String(albumId))
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    albumAttributions.delete(String(albumId))
    return null
  }
  return { ...entry.context }
}

export function clearMusicRecommendationAttribution(): void {
  albumAttributions.clear()
}
