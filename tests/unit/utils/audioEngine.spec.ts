import { describe, expect, it, vi } from 'vitest'
import {
  computeActualVolume,
  fadeOutAudio,
  AudioPrefetcher,
  resolvePlaybackAudioUrl,
  audioStartPrefetchBytes,
  audioStartPrefetchConcurrency,
  transitionAudioSource,
} from '@/utils/audioEngine'

describe('audioEngine constants', () => {
  it('defines correct prefetch byte size and concurrency', () => {
    expect(audioStartPrefetchBytes).toBe(512 * 1024)
    expect(audioStartPrefetchConcurrency).toBe(4)
  })
})

describe('computeActualVolume', () => {
  it('maps input volume using perceptual logarithmic quadratic curve', () => {
    expect(computeActualVolume(0)).toBe(0)
    expect(computeActualVolume(1)).toBe(1)
    expect(computeActualVolume(0.5)).toBe(0.25)
    expect(computeActualVolume(-0.2)).toBe(0)
    expect(computeActualVolume(1.5)).toBe(1)
  })
})

describe('fadeOutAudio', () => {
  it('smoothly reduces volume to zero and completes', async () => {
    const mockAudio = {
      volume: 1,
      paused: false,
    } as HTMLAudioElement

    await fadeOutAudio(mockAudio, 60)
    expect(mockAudio.volume).toBe(0)
  })

  it('noops when audio is paused or already silent', async () => {
    const mockAudio = { volume: 0, paused: true } as HTMLAudioElement
    await fadeOutAudio(mockAudio, 60)
    expect(mockAudio.volume).toBe(0)
  })
})

describe('resolvePlaybackAudioUrl', () => {
  it('appends cors cache query to r2 production audio urls', () => {
    const raw = 'https://assets.atoman.org/audio/track-1.mp3'
    const resolved = resolvePlaybackAudioUrl(raw)
    expect(resolved).toContain('track-1.mp3')
    expect(resolved).toContain('cors=1')
  })

  it('returns untouched standard urls', () => {
    const raw = 'http://localhost:8080/audio.mp3'
    expect(resolvePlaybackAudioUrl(raw)).toBe(raw)
  })
})

describe('AudioPrefetcher', () => {
  it('manages prefetch cache and abort controller', () => {
    const prefetcher = new AudioPrefetcher()
    expect(prefetcher.isPrefetched('https://example.com/audio.mp3')).toBe(false)
    prefetcher.markPrefetched('https://example.com/audio.mp3')
    expect(prefetcher.isPrefetched('https://example.com/audio.mp3')).toBe(true)
    prefetcher.reset()
    expect(prefetcher.isPrefetched('https://example.com/audio.mp3')).toBe(false)
  })
})

describe('transitionAudioSource', () => {
  it('smoothly transitions audio source with micro-fadeout when audio is playing', async () => {
    const targetAudio = {
      paused: false,
      currentTime: 10,
      volume: 0.8,
      pause: vi.fn(() => {
        targetAudio.paused = true
      }),
    } as unknown as HTMLAudioElement

    let sourceChanged = false
    await transitionAudioSource(
      targetAudio,
      'https://example.com/next.mp3',
      () => {
        sourceChanged = true
      },
      30,
    )

    expect(sourceChanged).toBe(true)
    expect(targetAudio.pause).toHaveBeenCalled()
  })

  it('immediately executes prepareNext without fade when audio is already paused', async () => {
    const targetAudio = {
      paused: true,
      currentTime: 0,
      volume: 0.8,
      pause: vi.fn(),
    } as unknown as HTMLAudioElement

    let sourceChanged = false
    await transitionAudioSource(
      targetAudio,
      'https://example.com/next.mp3',
      () => {
        sourceChanged = true
      },
      30,
    )

    expect(sourceChanged).toBe(true)
    expect(targetAudio.pause).not.toHaveBeenCalled()
  })

  it('restores targetAudio.volume before calling prepareNext', async () => {
    let volumeDuringPrepareNext = -1
    const targetAudio = {
      paused: false,
      currentTime: 10,
      volume: 0.8,
      pause: vi.fn(() => {
        targetAudio.paused = true
      }),
    } as unknown as HTMLAudioElement

    await transitionAudioSource(
      targetAudio,
      'https://example.com/next.mp3',
      () => {
        volumeDuringPrepareNext = targetAudio.volume
      },
      30,
    )

    expect(volumeDuringPrepareNext).toBe(0.8)
    expect(targetAudio.volume).toBe(0.8)
  })
})

