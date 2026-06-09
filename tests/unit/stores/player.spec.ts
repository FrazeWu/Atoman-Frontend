import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { usePlayerStore } from '@/stores/player'

// Mock Audio
class MockAudio {
  currentTime = 0
  duration = 100
  volume = 1
  src = ''
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  addEventListener = vi.fn()
}

global.Audio = MockAudio as any

describe('player store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    // localStorage.clear()
  })

  it('toggles lyrics', () => {
    const player = usePlayerStore()
    expect(player.showLyrics).toBe(false)
    player.toggleLyrics()
    expect(player.showLyrics).toBe(true)
    player.toggleLyrics()
    expect(player.showLyrics).toBe(false)
  })

  it('skips forward and backward', () => {
    const player = usePlayerStore()
    
    // Setup a fake current song and audio to enable skip
    const mockSong = { id: 1, title: 'Test', audio_url: 'test.mp3' } as any
    player.playSong(mockSong)
    
    player.duration = 100
    player.seek(50)
    
    player.skip(5)
    expect(player.currentTime).toBe(55)
    
    player.skip(-10)
    expect(player.currentTime).toBe(45)
    
    // Test boundaries
    player.skip(100)
    expect(player.currentTime).toBe(100)
    
    player.skip(-200)
    expect(player.currentTime).toBe(0)
  })
})
