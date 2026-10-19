import { apiGetOptional, apiGetRaw, apiPostJson } from '@/api/client'
import type { Song, Album, Artist } from '../model/types'

export async function fetchSongById(id: string | number): Promise<Song | null> {
  return apiGetOptional<Song>(`/api/v1/music/songs/${id}`)
}

export async function fetchAlbumById(id: string | number): Promise<Album | null> {
  return apiGetOptional<Album>(`/api/v1/music/albums/${id}`)
}

export async function fetchArtistById(id: string | number): Promise<Artist | null> {
  return apiGetOptional<Artist>(`/api/v1/music/artists/${id}`)
}

export async function fetchLyricsBySongId(songId: string | number): Promise<string> {
  const res = await apiGetRaw<string>(`/api/v1/music/songs/${songId}/lyrics`)
  return res || ''
}

export const fetchLyrics = fetchLyricsBySongId

export async function recordSongPlay(
  songId: string | number,
  playlistId?: string,
  playEventId?: string,
): Promise<{ recorded: boolean }> {
  return apiPostJson<{ recorded: boolean }>('/api/v1/music/plays', {
    song_id: String(songId),
    ...(playlistId ? { playlist_id: playlistId } : {}),
    ...(playEventId ? { play_event_id: playEventId } : {}),
  })
}
