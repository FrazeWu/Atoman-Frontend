import type { MusicPlaylistSummary } from '@/api/musicV1'

export function findFavoritePlaylist(playlists: MusicPlaylistSummary[]) {
  return playlists.find((playlist) => playlist.is_favorite)
}

export function regularPlaylists(playlists: MusicPlaylistSummary[]) {
  return playlists.filter((playlist) => !playlist.is_favorite)
}

export function sortPlaylistsWithFavoriteFirst(playlists: MusicPlaylistSummary[]) {
  return [...playlists].sort((left, right) => Number(right.is_favorite) - Number(left.is_favorite))
}
