import type { Song } from '@/types'
import { hasPlayableMusicAudio } from '@/utils/musicMedia'

// Music metadata is available even when the audio asset is absent or processing.
// Only the actual media URL from the API may enter the player.
export function musicAudioFromApi(source: {
  audio_url?: unknown
  audio_status?: unknown
}): Pick<Song, 'audio_url' | 'audio_status'> {
  return {
    audio_url: typeof source.audio_url === 'string' ? source.audio_url.trim() : '',
    audio_status: typeof source.audio_status === 'string' ? source.audio_status.trim() : undefined,
  }
}

/**
 * Preserve lyric data already present in API lists. Most list endpoints omit
 * full lyrics: mark those items as summaries so the player fetches song detail
 * only when the track actually starts playing.
 *
 * Explicit summary_only=false from a complete detail response is respected,
 * even if that song genuinely has no lyrics.
 */
export function musicPlaybackDetailsFromApi(source: object): Pick<Song, 'lyrics' | 'waveform_peaks' | 'summary_only'> {
  const metadata = source as { lyrics?: unknown; waveform_peaks?: unknown; summary_only?: unknown }
  const lyrics = typeof metadata.lyrics === 'string' ? metadata.lyrics : undefined
  const waveform = Array.isArray(metadata.waveform_peaks)
    && metadata.waveform_peaks.every((value: unknown) => typeof value === 'number' && Number.isFinite(value))
      ? metadata.waveform_peaks as number[]
      : undefined
  const hasLyrics = Boolean(lyrics?.trim())
  return {
    ...(lyrics !== undefined ? { lyrics } : {}),
    ...(waveform !== undefined ? { waveform_peaks: waveform } : {}),
    summary_only: !hasLyrics && (metadata.summary_only !== false),
  }
}

export const canPlayMusicSong = hasPlayableMusicAudio

export function firstPlayableMusicSong(songs: Song[]): Song | undefined {
  return songs.find(canPlayMusicSong)
}

export function playableMusicQueue(songs: readonly Song[]): Song[] {
  // Keep the caller's order; only remove unavailable / processing tracks.
  return songs.filter(canPlayMusicSong)
}

type MobileMusicQueuePlayer = {
  currentSong: Song | null
  queue: Song[]
  playAlbum(songs: Song[], startIndex?: number): void
  togglePlay(): void
}

/**
 * 'Play all' installs the entire available collection, rather than resetting
 * the store to a single song with playSong(). A selected song starts from its
 * actual index in the filtered collection and can continue to the next track.
 */
export function startMobileMusicQueue(
  player: MobileMusicQueuePlayer,
  songs: readonly Song[],
  startSongId?: Song['id'],
): boolean {
  const playable = playableMusicQueue(songs)
  if (!playable.length) return false

  const startIndex = startSongId === undefined
    ? 0
    : playable.findIndex((song) => String(song.id) === String(startSongId))
  if (startIndex < 0) return false

  const isSameQueue = player.queue.length === playable.length
    && player.queue.every((song, index) => String(song.id) === String(playable[index].id))

  if (startSongId !== undefined
      && player.currentSong
      && String(player.currentSong.id) === String(startSongId)
      && isSameQueue) {
    // Preserve the existing tap-current-song pause/resume behavior.
    player.togglePlay()
  } else {
    player.playAlbum(playable, startIndex)
  }
  return true
}

/**
 * Fetch all pages in the backend's playlist ordering (position ASC).
 * Refuse incomplete responses rather than silently playing the first page.
 */
export async function fetchFullMobilePlaylist<T>(
  playlistId: string,
  fetchPage: (
    id: string,
    filters: { page: number; page_size: number },
  ) => Promise<{ data: T[]; meta: { has_more: boolean } }>,
  isCurrent: () => boolean = () => true,
): Promise<T[]> {
  const pageSize = 100 // Backend pagination cap.
  const result: T[] = []
  for (let page = 1; page <= 1000; page += 1) {
    if (!isCurrent()) throw new Error('Playlist request no longer active')
    const response = await fetchPage(playlistId, { page, page_size: pageSize })
    if (!isCurrent()) throw new Error('Playlist request no longer active')
    if (!Array.isArray(response?.data) || typeof response.meta?.has_more !== 'boolean') {
      throw new Error('Invalid playlist pagination response')
    }
    result.push(...response.data)
    if (!response.meta.has_more) return result
    if (response.data.length === 0) throw new Error('Playlist pagination made no progress')
  }
  throw new Error('Playlist exceeds the maximum supported queue size')
}
