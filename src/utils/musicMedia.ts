import type { MusicAlbumListItem } from '@/api/musicV1'
import type { Song } from '@/types'

type MusicAlbumSongLike = NonNullable<MusicAlbumListItem['songs']>[number]

export function formatAlbumTypeLabel(type?: string) {
  if (!type) return '专辑'
  const labels: Record<string, string> = {
    album: '专辑',
    ep: 'EP',
    single: '单曲',
    leak: '泄曲',
    compilation: '精选集',
    live: '现场专辑',
    soundtrack: '原声带',
    demo: 'Demo',
  }
  return labels[type.toLowerCase()] ?? type
}

export function compareAlbumTracks(
  left: Pick<MusicAlbumSongLike, 'disc_number' | 'track_number'>,
  right: Pick<MusicAlbumSongLike, 'disc_number' | 'track_number'>,
): number {
  const discDifference = (left.disc_number || 1) - (right.disc_number || 1)
  return discDifference || (left.track_number || 0) - (right.track_number || 0)
}

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
    .sort(compareAlbumTracks)
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
      disc_number: song.disc_number,
      status: (song.status as Song['status'] | undefined) || 'approved',
      artists: album.artists?.map((artist) => ({
        id: artist.id,
        name: artist.name,
        username: '',
        email: '',
      })),
    }))
}
