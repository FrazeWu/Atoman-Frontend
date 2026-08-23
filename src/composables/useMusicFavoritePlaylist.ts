import { ref } from 'vue'
import {
  addMusicPlaylistSong,
  getMusicPlaylistSongStatus,
  listMusicPlaylists,
  removeMusicPlaylistSong,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

export function useMusicFavoritePlaylist() {
  const { refreshPlaylists } = useMusicDrawers()
  const favoriteSongIds = ref<Set<string>>(new Set())
	const playlists = ref<MusicPlaylistSummary[]>([])
	const favoritePlaylistId = ref('')

	async function loadPlaylists() {
		const response = await listMusicPlaylists({ page: 1, page_size: 100 })
		playlists.value = response.data || []
		favoritePlaylistId.value = String(playlists.value.find(playlist => playlist.kind === 'favorite')?.id || '')
		return playlists.value
	}

	async function requireFavoritePlaylistId() {
		if (!favoritePlaylistId.value) await loadPlaylists()
		if (!favoritePlaylistId.value) throw new Error('Favorite playlist is unavailable')
		return favoritePlaylistId.value
	}

  async function loadFavoriteSongs(songIds: string[] = [], isCurrent: () => boolean = () => true) {
    const uniqueIds = [...new Set(songIds.filter(Boolean))]
		if (!uniqueIds.length) {
			if (isCurrent()) favoriteSongIds.value = new Set()
			return favoriteSongIds.value
		}
		const playlistId = await requireFavoritePlaylistId()
		const loadedIds = new Set(await getMusicPlaylistSongStatus(playlistId, uniqueIds))
		if (isCurrent()) favoriteSongIds.value = loadedIds
    return loadedIds
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
		const playlistId = await requireFavoritePlaylistId()
    if (favoriteSongIds.value.has(songId)) {
			await removeMusicPlaylistSong(playlistId, songId)
      setSongFavorite(songId, false)
			return { isFavorite: false, message: '已移出最爱' }
    }

		await addMusicPlaylistSong(playlistId, songId)
    setSongFavorite(songId, true)
		return { isFavorite: true, message: '已加入最爱' }
  }

  async function addSongToPlaylist(playlistId: string, songId: string) {
    await addMusicPlaylistSong(playlistId, songId)
    if (playlistId === favoritePlaylistId.value) setSongFavorite(songId, true)
    refreshPlaylists()
  }

  return {
    favoriteSongIds,
		favoritePlaylistId,
		playlists,
		loadPlaylists,
    loadFavoriteSongs,
    toggleFavoriteSong,
    addSongToPlaylist,
  }
}
