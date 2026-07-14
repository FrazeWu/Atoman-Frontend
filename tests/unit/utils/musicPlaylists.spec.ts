import { describe, expect, it } from 'vitest'
import {
  findFavoritePlaylist,
  regularPlaylists,
  sortPlaylistsWithFavoriteFirst,
} from '@/utils/musicPlaylists'
import type { MusicPlaylistSummary } from '@/api/musicV1'

const favorite: MusicPlaylistSummary = {
  id: 'favorite',
  name: '系统歌单',
  song_count: 2,
  is_favorite: true,
}
const regular: MusicPlaylistSummary = {
  id: 'regular',
  name: '通勤',
  song_count: 3,
  is_favorite: false,
}

describe('music playlist semantics', () => {
  it('finds the favorite playlist by metadata instead of name', () => {
    expect(findFavoritePlaylist([regular, favorite])).toBe(favorite)
  })

  it('keeps the favorite playlist out of regular playlist choices', () => {
    expect(regularPlaylists([favorite, regular])).toEqual([regular])
  })

  it('pins the favorite playlist before regular playlists', () => {
    expect(sortPlaylistsWithFavoriteFirst([regular, favorite])).toEqual([favorite, regular])
  })
})
