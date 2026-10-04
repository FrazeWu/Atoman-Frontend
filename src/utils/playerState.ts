import type { Song } from '@/types'
import { hasPlayableMusicAudio } from '@/utils/musicMedia'

export function normalizePlaybackSong(song: Song, resolveAudioURL: (url: string) => string): Song {
  return { ...song, audio_url: resolveAudioURL(song.audio_url) }
}

export function hasPlayableAudio(song: Song | null | undefined) {
  if (!song) return false
  if (song.source_type && song.source_type !== 'music') {
    return Boolean(song.audio_url?.trim())
  }
  return hasPlayableMusicAudio(song)
}

export function compactPlaybackSong(song: Song): Song {
  const { lyrics: _lyrics, waveform_peaks: _waveformPeaks, ...compact } = song
  return compact as Song
}

export function playbackItemKey(song: Song) {
  const sourceType = song.source_type || 'music'
  return `${sourceType}:${song.source_id || song.id}`
}
