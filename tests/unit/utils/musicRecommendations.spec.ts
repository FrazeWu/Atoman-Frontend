import { describe, expect, it } from 'vitest'

import {
  filterAlbumRecommendationsByBookmarks,
  filterArtistRecommendationsByBookmarks,
  MUSIC_BROWSE_MODE_OPTIONS,
  parseRecommendationTargetId,
} from '@/utils/musicRecommendations'

describe('musicRecommendations', () => {
  it('uses the same browse modes on every music index page', () => {
    expect(MUSIC_BROWSE_MODE_OPTIONS).toEqual([
      { label: '热度', value: 'hot' },
      { label: '精选', value: 'featured' },
      { label: '最新', value: 'latest' },
    ])
  })

  it('parses entity ids from recommendation target paths', () => {
    expect(parseRecommendationTargetId('/music/artist/artist-1', 'artist')).toBe('artist-1')
    expect(parseRecommendationTargetId('/music/album/album-1?foo=bar', 'album')).toBe('album-1')
    expect(parseRecommendationTargetId('/music/explore', 'artist')).toBeNull()
  })

  it('filters artist recommendations by bookmarked artists', () => {
    const result = filterArtistRecommendationsByBookmarks(
      [
        { id: 'artist-1', title: 'Artist 1', target_path: '/music/artist/artist-1' },
        { id: 'artist-2', title: 'Artist 2', target_path: '/music/artist/artist-2' },
      ],
      [
        { id: 'bookmark-2', artist_id: 'artist-2', created_at: '2026-07-03T00:00:00Z' },
      ],
    )

    expect(result.map((item) => item.id)).toEqual(['artist-2'])
  })

  it('filters album recommendations by bookmarked albums', () => {
    const result = filterAlbumRecommendationsByBookmarks(
      [
        { id: 'album-1', title: 'Album 1', target_path: '/music/album/album-1' },
        { id: 'album-2', title: 'Album 2', target_path: '/music/album/album-2' },
      ],
      [
        { id: 'bookmark-1', album_id: 'album-1', created_at: '2026-07-03T00:00:00Z' },
      ],
    )

    expect(result.map((item) => item.id)).toEqual(['album-1'])
  })
})
