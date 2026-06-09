import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearVideoProgress, getVideoProgress, saveVideoProgress } from '@/composables/useVideoProgress'

describe('useVideoProgress', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('saves and restores playback progress', () => {
    saveVideoProgress('video-1', 92, 600)
    expect(getVideoProgress('video-1')?.time_sec).toBe(92)
  })

  it('clears progress when playback is close to the end', () => {
    saveVideoProgress('video-1', 596, 600)
    expect(getVideoProgress('video-1')).toBeNull()
  })

  it('clears progress when saved time is zero or negative', () => {
    saveVideoProgress('video-1', 92, 600)
    saveVideoProgress('video-1', 0, 600)
    expect(getVideoProgress('video-1')).toBeNull()
    expect(localStorage.getItem('atoman:video-progress:video-1')).toBeNull()

    saveVideoProgress('video-1', -5, 600)
    expect(getVideoProgress('video-1')).toBeNull()
    expect(localStorage.getItem('atoman:video-progress:video-1')).toBeNull()
  })

  it('removes progress explicitly', () => {
    saveVideoProgress('video-1', 92, 600)
    clearVideoProgress('video-1')
    expect(getVideoProgress('video-1')).toBeNull()
  })

  it('returns null for damaged JSON', () => {
    localStorage.setItem('atoman:video-progress:video-1', '{bad')
    expect(getVideoProgress('video-1')).toBeNull()
  })

  it('returns null for invalid duration_sec value', () => {
    localStorage.setItem(
      'atoman:video-progress:video-1',
      JSON.stringify({ time_sec: 10, duration_sec: 'bad', updated_at: '2026-05-27T13:00:00.000Z' }),
    )
    expect(getVideoProgress('video-1')).toBeNull()
  })

  it('returns null for invalid updated_at value', () => {
    localStorage.setItem(
      'atoman:video-progress:video-1',
      JSON.stringify({ time_sec: 10, duration_sec: 600, updated_at: 'not-a-date' }),
    )
    expect(getVideoProgress('video-1')).toBeNull()
  })

  it('does not throw when localStorage is unavailable', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(() => saveVideoProgress('video-1', 92, 600)).not.toThrow()
    expect(() => clearVideoProgress('video-1')).not.toThrow()
    expect(() => getVideoProgress('video-1')).not.toThrow()
    expect(getVideoProgress('video-1')).toBeNull()
  })

  it('does not throw when localStorage methods fail', () => {
    const failingStorage = {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('storage disabled')
      },
      removeItem: () => {
        throw new Error('storage disabled')
      },
    } as unknown as Storage
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(failingStorage)

    expect(() => saveVideoProgress('video-1', 92, 600)).not.toThrow()
    expect(() => clearVideoProgress('video-1')).not.toThrow()
    expect(() => getVideoProgress('video-1')).not.toThrow()
    expect(getVideoProgress('video-1')).toBeNull()
  })
})
