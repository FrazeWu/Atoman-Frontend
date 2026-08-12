import { describe, expect, it } from 'vitest'

import { generateWaveformPlaceholder } from '@/utils/audioWaveform'

describe('generateWaveformPlaceholder', () => {
  it('creates a stable visible waveform for the same song', () => {
    const first = generateWaveformPlaceholder('song-1', 12)
    const second = generateWaveformPlaceholder('song-1', 12)

    expect(first).toEqual(second)
    expect(first).toHaveLength(12)
    expect(first.every((peak) => peak >= 0.1 && peak <= 1)).toBe(true)
    expect(new Set(first).size).toBeGreaterThan(1)
  })
})
