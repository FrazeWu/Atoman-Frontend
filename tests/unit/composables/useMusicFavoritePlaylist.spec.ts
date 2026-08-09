import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'

const musicApi = vi.hoisted(() => ({
  addMusicPlaylistSong: vi.fn(),
  createSongBookmark: vi.fn(),
  deleteSongBookmark: vi.fn(),
  getSongBookmarkStatus: vi.fn(),
}))

vi.mock('@/api/musicV1', () => musicApi)
vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({ refreshPlaylists: vi.fn() }),
}))

describe('useMusicFavoritePlaylist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    musicApi.getSongBookmarkStatus.mockResolvedValue(['song-1'])
    musicApi.createSongBookmark.mockResolvedValue({ id: 'bookmark-1', song_id: 'song-2' })
    musicApi.deleteSongBookmark.mockResolvedValue(undefined)
  })

  it('loads only visible song bookmark states', async () => {
    const favorite = useMusicFavoritePlaylist()
    await favorite.loadFavoriteSongs(['song-1', 'song-2', 'song-1'])

    expect(musicApi.getSongBookmarkStatus).toHaveBeenCalledWith(['song-1', 'song-2'])
    expect([...favorite.favoriteSongIds.value]).toEqual(['song-1'])
  })

  it('toggles favorite songs through the compatibility API', async () => {
    const favorite = useMusicFavoritePlaylist()
    favorite.favoriteSongIds.value = new Set(['song-1'])

    await expect(favorite.toggleFavoriteSong('song-1')).resolves.toEqual({ isFavorite: false, message: '已取消收藏' })
    await expect(favorite.toggleFavoriteSong('song-2')).resolves.toEqual({ isFavorite: true, message: '已收藏' })

    expect(musicApi.deleteSongBookmark).toHaveBeenCalledWith('song-1')
    expect(musicApi.createSongBookmark).toHaveBeenCalledWith('song-2')
  })
})
