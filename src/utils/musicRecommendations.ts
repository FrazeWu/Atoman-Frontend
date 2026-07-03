import type {
  MusicAlbumBookmark,
  MusicArtistBookmark,
  MusicRecommendationItem,
  MusicRecommendationMode,
} from '@/api/musicV1'

export const MUSIC_RECOMMENDATION_MODE_OPTIONS: Array<{ label: string; value: MusicRecommendationMode }> = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

export function parseRecommendationTargetId(targetPath: string, entity: 'artist' | 'album'): string | null {
  const match = targetPath.match(new RegExp(`/music/${entity}/([^/?#]+)`))
  return match?.[1] ?? null
}

export function filterArtistRecommendationsByBookmarks(
  recommendations: MusicRecommendationItem[],
  bookmarks: MusicArtistBookmark[],
) {
  const bookmarkedIds = new Set(bookmarks.map((bookmark) => String(bookmark.artist_id)))
  return recommendations.filter((item) => {
    const artistId = parseRecommendationTargetId(item.target_path, 'artist')
    return artistId ? bookmarkedIds.has(artistId) : false
  })
}

export function filterAlbumRecommendationsByBookmarks(
  recommendations: MusicRecommendationItem[],
  bookmarks: MusicAlbumBookmark[],
) {
  const bookmarkedIds = new Set(bookmarks.map((bookmark) => String(bookmark.album_id)))
  return recommendations.filter((item) => {
    const albumId = parseRecommendationTargetId(item.target_path, 'album')
    return albumId ? bookmarkedIds.has(albumId) : false
  })
}
