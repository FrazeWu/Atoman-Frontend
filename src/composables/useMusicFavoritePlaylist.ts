import { ref } from 'vue'
import {
  addMusicPlaylistSong,
  createMusicPlaylist,
  getMusicPlaylist,
  listMusicPlaylists,
  removeMusicPlaylistSong,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const favoriteNames = new Set(['最爱', '我喜欢的单曲', '我喜欢'])

export function isFavoritePlaylistName(name: string) {
  return favoriteNames.has(name.trim())
}

export function useMusicFavoritePlaylist() {
  const { refreshPlaylists } = useMusicDrawers()
  const playlists = ref<MusicPlaylistSummary[]>([])
  const favoriteSongIds = ref<Set<string>>(new Set())

  async function loadPlaylists() {
    const response = await listMusicPlaylists()
    playlists.value = response.data || []
    return playlists.value
  }

  async function getFavoritePlaylist(createIfMissing = false) {
    const list = await loadPlaylists()
    const existing = list.find((playlist) => isFavoritePlaylistName(playlist.name))
    if (existing || !createIfMissing) return existing || null

    const created = await createMusicPlaylist({ name: '最爱' })
    playlists.value = [created, ...list]
    refreshPlaylists()
    return created
  }

  async function loadFavoriteSongs() {
    const favoritePlaylist = await getFavoritePlaylist(false)
    if (!favoritePlaylist) {
      favoriteSongIds.value = new Set()
      return favoriteSongIds.value
    }

    const detail = await getMusicPlaylist(String(favoritePlaylist.id))
    favoriteSongIds.value = new Set((detail.songs || []).map((song) => String(song.id)))
    return favoriteSongIds.value
  }

  function setSongFavorite(songId: string, isFavorite: boolean) {
    const next = new Set(favoriteSongIds.value)
    if (isFavorite) {
      next.add(songId)
    } else {
      next.delete(songId)
    }
    favoriteSongIds.value = next
  }

  async function toggleFavoriteSong(songId: string) {
    const favoritePlaylist = await getFavoritePlaylist(true)
    if (!favoritePlaylist) throw new Error('Favorite playlist unavailable')

    const playlistId = String(favoritePlaylist.id)
    if (favoriteSongIds.value.has(songId)) {
      await removeMusicPlaylistSong(playlistId, songId)
      setSongFavorite(songId, false)
      refreshPlaylists()
      return { isFavorite: false, message: '已从最爱中移除' }
    }

    await addMusicPlaylistSong(playlistId, songId)
    setSongFavorite(songId, true)
    refreshPlaylists()
    return { isFavorite: true, message: '已添加到最爱' }
  }

  function isFavoritePlaylist(playlistId: string) {
    return playlists.value.some((playlist) => String(playlist.id) === playlistId && isFavoritePlaylistName(playlist.name))
  }

  async function addSongToPlaylist(playlistId: string, songId: string) {
    await addMusicPlaylistSong(playlistId, songId)
    if (isFavoritePlaylist(playlistId)) setSongFavorite(songId, true)
    refreshPlaylists()
  }

  return {
    favoriteSongIds,
    loadFavoriteSongs,
    toggleFavoriteSong,
    addSongToPlaylist,
    isFavoritePlaylist,
  }
}
