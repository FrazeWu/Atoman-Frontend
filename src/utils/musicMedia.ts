import type { MusicAlbumListItem } from '@/api/musicV1'
import type { Song } from '@/types'

type MusicAlbumSongLike = NonNullable<MusicAlbumListItem['songs']>[number]

export function resolveAlbumCoverUrl(album: Pick<MusicAlbumListItem, 'cover_url' | 'songs'>): string {
  const directCover = album.cover_url?.trim()
  if (directCover) return directCover

  const fallbackCover = album.songs?.find((song) => song.cover_url?.trim())?.cover_url?.trim()
  return fallbackCover || ''
}

export function buildPlayableSongsFromAlbum(album: MusicAlbumListItem): Song[] {
  const artistText = album.artists?.map((artist) => artist.name).join(', ') || '未知艺术家'
  const coverUrl = resolveAlbumCoverUrl(album)

  return (album.songs || [])
    .filter((song): song is MusicAlbumSongLike & { audio_url: string } => typeof song.audio_url === 'string' && song.audio_url.trim().length > 0)
    .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
    .map((song) => ({
      id: song.id,
      title: song.title,
      artist: artistText,
      album: album.title,
      album_id: album.id,
      year: album.year || Number(album.release_date?.slice(0, 4)) || 0,
      release_date: album.release_date || '',
      lyrics: song.lyrics || '',
      audio_url: song.audio_url,
      cover_url: song.cover_url?.trim() || coverUrl,
      track_number: song.track_number,
      status: (song.status as Song['status'] | undefined) || 'approved',
      artists: album.artists?.map((artist) => ({
        id: artist.id,
        name: artist.name,
        username: '',
        email: '',
      })),
    }))
}
