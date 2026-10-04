import { describe, expect, it } from 'vitest'

import {
  compactPlaybackSong,
  hasPlayableAudio,
  normalizePlaybackSong,
  playbackItemKey,
} from '@/utils/playerState'

const song = (overrides: Record<string, unknown> = {}) => ({
  id: 'song-1',
  title: 'Track',
  audio_url: '/audio.mp3',
  ...overrides,
}) as any

describe('player state helpers', () => {
  it('normalizes playback URLs without mutating the source song', () => {
    const original = song()
    const normalized = normalizePlaybackSong(original, (url) => `https://cdn.test${url}`)

    expect(normalized.audio_url).toBe('https://cdn.test/audio.mp3')
    expect(original.audio_url).toBe('/audio.mp3')
  })

  it('recognizes playable external audio and builds stable source keys', () => {
    expect(hasPlayableAudio(song({ source_type: 'podcast' }))).toBe(true)
    expect(playbackItemKey(song({ source_type: 'podcast', source_id: 'episode-7' }))).toBe('podcast:episode-7')
  })

  it('compacts persisted songs by dropping heavy media fields', () => {
    const compact = compactPlaybackSong(song({ lyrics: 'lyrics', waveform_peaks: [1, 2, 3] }))

    expect(compact).not.toHaveProperty('lyrics')
    expect(compact).not.toHaveProperty('waveform_peaks')
    expect(compact.title).toBe('Track')
  })
})
