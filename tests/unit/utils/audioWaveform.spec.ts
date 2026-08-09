import { describe, expect, it } from 'vitest'

import { calculateWaveformPeaks, generateWaveformPlaceholder } from '@/utils/audioWaveform'

describe('calculateWaveformPeaks', () => {
  it('compresses audio samples into normalized peaks', () => {
    const peaks = calculateWaveformPeaks([
      new Float32Array([0, 0.1, -0.2, 0.4, -0.8, 1, 0.3, 0.2]),
    ], 4)

    expect(peaks).toHaveLength(4)
    expect(peaks.every((peak) => peak >= 0.08 && peak <= 1)).toBe(true)
    expect(peaks[2]).toBe(1)
    expect(peaks[0]).toBeLessThan(peaks[1])
  })

  it('keeps silent audio visible without inventing loud peaks', () => {
    expect(calculateWaveformPeaks([new Float32Array(16)], 4)).toEqual([0.08, 0.08, 0.08, 0.08])
  })
})

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
