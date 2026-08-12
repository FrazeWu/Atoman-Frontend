import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'

const musicApi = vi.hoisted(() => ({
  addMusicPlaylistSong: vi.fn(),
  removeMusicPlaylistSong: vi.fn(),
  getMusicPlaylistSongStatus: vi.fn(),
  listMusicPlaylists: vi.fn(),
}))

vi.mock('@/api/musicV1', () => musicApi)
vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({ refreshPlaylists: vi.fn() }),
}))

describe('useMusicFavoritePlaylist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    musicApi.listMusicPlaylists.mockResolvedValue({ data: [{ id: 'favorite-1', name: '最爱', kind: 'favorite' }] })
    musicApi.getMusicPlaylistSongStatus.mockResolvedValue(['song-1'])
    musicApi.addMusicPlaylistSong.mockResolvedValue({})
    musicApi.removeMusicPlaylistSong.mockResolvedValue({})
  })

  it('loads only requested favorite playlist members', async () => {
    const favorite = useMusicFavoritePlaylist()
    await favorite.loadFavoriteSongs(['song-1', 'song-2', 'song-1'])

    expect(musicApi.getMusicPlaylistSongStatus).toHaveBeenCalledWith('favorite-1', ['song-1', 'song-2'])
    expect([...favorite.favoriteSongIds.value]).toEqual(['song-1'])
  })

  it('toggles songs in the favorite playlist', async () => {
    const favorite = useMusicFavoritePlaylist()
    favorite.favoriteSongIds.value = new Set(['song-1'])

    await expect(favorite.toggleFavoriteSong('song-1')).resolves.toEqual({ isFavorite: false, message: '已移出最爱' })
    await expect(favorite.toggleFavoriteSong('song-2')).resolves.toEqual({ isFavorite: true, message: '已加入最爱' })

    expect(musicApi.removeMusicPlaylistSong).toHaveBeenCalledWith('favorite-1', 'song-1')
    expect(musicApi.addMusicPlaylistSong).toHaveBeenCalledWith('favorite-1', 'song-2')
  })

  it('updates the heart when the favorite playlist is selected from the playlist menu', async () => {
    const favorite = useMusicFavoritePlaylist()
    await favorite.loadPlaylists()

    await favorite.addSongToPlaylist('favorite-1', 'song-1')

    expect(favorite.favoriteSongIds.value.has('song-1')).toBe(true)
  })
})
