import { describe, expect, it } from 'vitest'
import {
  isPlaybackStateExpired,
  isPlaybackProgressStale,
  sanitizeResumePosition,
  hasPersistedPlayableState,
  PLAYBACK_STATE_MAX_AGE_MS,
  PLAYBACK_PROGRESS_MAX_AGE_MS,
} from '@/utils/playerState'

describe('playerState utilities', () => {
  it('detects expired playback state after 7 days', () => {
    const now = 1000000000000
    expect(isPlaybackStateExpired({ savedAt: now - 1000 }, now)).toBe(false)
    expect(isPlaybackStateExpired({ savedAt: now - PLAYBACK_STATE_MAX_AGE_MS - 1000 }, now)).toBe(true)
    // Legacy without savedAt is not expired
    expect(isPlaybackStateExpired({}, now)).toBe(false)
  })

  it('detects stale song progress after 24 hours', () => {
    const now = 1000000000000
    expect(isPlaybackProgressStale({ savedAt: now - 3600 * 1000 }, now)).toBe(false)
    expect(isPlaybackProgressStale({ savedAt: now - PLAYBACK_PROGRESS_MAX_AGE_MS - 1000 }, now)).toBe(true)
  })

  it('sanitizes resume position for music tracks', () => {
    // Under 3s becomes 0
    expect(sanitizeResumePosition(2, 200, false)).toBe(0)

    // Normal midway position remains
    expect(sanitizeResumePosition(50, 200, false)).toBe(50)

    // Near end becomes 0
    expect(sanitizeResumePosition(198, 200, false)).toBe(0)
    expect(sanitizeResumePosition(197, 200, false)).toBe(0)

    // 98% becomes 0
    expect(sanitizeResumePosition(99, 100, false)).toBe(0)

    // Podcasts preserve position without music truncation
    expect(sanitizeResumePosition(2, 200, true)).toBe(2)
    expect(sanitizeResumePosition(198, 200, true)).toBe(198)
  })

  it('checks hasPersistedPlayableState', () => {
    expect(hasPersistedPlayableState(null)).toBe(false)
    expect(hasPersistedPlayableState('invalid json')).toBe(false)
    expect(hasPersistedPlayableState(JSON.stringify({ song: null }))).toBe(false)
    expect(
      hasPersistedPlayableState(
        JSON.stringify({
          song: { id: 1, audio_url: 'https://example.com/audio.mp3' },
          savedAt: Date.now(),
        }),
      ),
    ).toBe(true)
  })
})
