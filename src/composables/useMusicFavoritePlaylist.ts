import { ref } from 'vue'
import {
  addMusicPlaylistSong,
  createSongBookmark,
  deleteSongBookmark,
  getSongBookmarkStatus,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

export function useMusicFavoritePlaylist() {
  const { refreshPlaylists } = useMusicDrawers()
  const favoriteSongIds = ref<Set<string>>(new Set())

  async function loadFavoriteSongs(songIds: string[] = []) {
    const uniqueIds = [...new Set(songIds.filter(Boolean))]
    favoriteSongIds.value = new Set(await getSongBookmarkStatus(uniqueIds))
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
    if (favoriteSongIds.value.has(songId)) {
      await deleteSongBookmark(songId)
      setSongFavorite(songId, false)
      return { isFavorite: false, message: '已取消收藏' }
    }

    await createSongBookmark(songId)
    setSongFavorite(songId, true)
    return { isFavorite: true, message: '已收藏' }
  }

  async function addSongToPlaylist(playlistId: string, songId: string) {
    await addMusicPlaylistSong(playlistId, songId)
    refreshPlaylists()
  }

  return {
    favoriteSongIds,
    loadFavoriteSongs,
    toggleFavoriteSong,
    addSongToPlaylist,
  }
}
