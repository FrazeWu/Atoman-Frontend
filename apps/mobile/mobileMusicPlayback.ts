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

export const canPlayMusicSong = hasPlayableMusicAudio

export function firstPlayableMusicSong(songs: Song[]): Song | undefined {
  return songs.find(canPlayMusicSong)
}
