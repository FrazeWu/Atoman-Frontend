import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'

const mocks = vi.hoisted(() => ({
  listMusicPlaylists: vi.fn(),
  getMusicPlaylist: vi.fn(),
  createMusicPlaylist: vi.fn(),
  addMusicPlaylistSong: vi.fn(),
  removeMusicPlaylistSong: vi.fn(),
  refreshPlaylists: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicPlaylists: mocks.listMusicPlaylists,
  getMusicPlaylist: mocks.getMusicPlaylist,
  createMusicPlaylist: mocks.createMusicPlaylist,
  addMusicPlaylistSong: mocks.addMusicPlaylistSong,
  removeMusicPlaylistSong: mocks.removeMusicPlaylistSong,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    refreshPlaylists: mocks.refreshPlaylists,
  }),
}))

describe('useMusicFavoritePlaylist', () => {
  beforeEach(() => {
    mocks.listMusicPlaylists.mockReset()
    mocks.getMusicPlaylist.mockReset()
    mocks.createMusicPlaylist.mockReset()
    mocks.addMusicPlaylistSong.mockReset()
    mocks.removeMusicPlaylistSong.mockReset()
    mocks.refreshPlaylists.mockReset()

    mocks.addMusicPlaylistSong.mockResolvedValue({})
    mocks.removeMusicPlaylistSong.mockResolvedValue({ deleted: true })
  })

  it('loads favorite song ids from the existing favorite playlist', async () => {
    mocks.listMusicPlaylists.mockResolvedValue({
      data: [{ id: 'playlist-1', name: '我喜欢的单曲', song_count: 1 }],
    })
    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      name: '我喜欢的单曲',
      song_count: 1,
      songs: [{ id: 'song-1', title: 'Song', entry_status: 'open' }],
    })

    const favorite = useMusicFavoritePlaylist()
    await favorite.loadFavoriteSongs()

    expect(favorite.favoriteSongIds.value.has('song-1')).toBe(true)
    expect(mocks.getMusicPlaylist).toHaveBeenCalledWith('playlist-1')
  })

  it('creates the favorite playlist before adding a first favorite song', async () => {
    mocks.listMusicPlaylists.mockResolvedValueOnce({ data: [] })
    mocks.createMusicPlaylist.mockResolvedValue({ id: 'playlist-new', name: '最爱', song_count: 0 })

    const favorite = useMusicFavoritePlaylist()
    await favorite.toggleFavoriteSong('song-1')

    expect(mocks.createMusicPlaylist).toHaveBeenCalledWith({ name: '最爱' })
    expect(mocks.addMusicPlaylistSong).toHaveBeenCalledWith('playlist-new', 'song-1')
    expect(favorite.favoriteSongIds.value.has('song-1')).toBe(true)
    expect(mocks.refreshPlaylists).toHaveBeenCalled()
  })

  it('removes songs that are already in the favorite playlist', async () => {
    mocks.listMusicPlaylists.mockResolvedValue({
      data: [{ id: 'playlist-1', name: '最爱', song_count: 1 }],
    })

    const favorite = useMusicFavoritePlaylist()
    favorite.favoriteSongIds.value = new Set(['song-1'])
    await favorite.toggleFavoriteSong('song-1')

    expect(mocks.removeMusicPlaylistSong).toHaveBeenCalledWith('playlist-1', 'song-1')
    expect(favorite.favoriteSongIds.value.has('song-1')).toBe(false)
  })
})
