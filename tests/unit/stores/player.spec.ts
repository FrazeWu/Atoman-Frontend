import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { usePlayerStore } from '@/stores/player'

const mocks = vi.hoisted(() => ({
	recordMusicSongPlay: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
	recordMusicSongPlay: mocks.recordMusicSongPlay,
}))

// Mock Audio
const audioInstances: MockAudio[] = []

class MockAudio {
  currentTime = 0
  duration = 100
  volume = 1
  src = ''
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  addEventListener = vi.fn()

  constructor() {
    audioInstances.push(this)
  }
}

global.Audio = MockAudio as any

describe('player store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    audioInstances.length = 0
		mocks.recordMusicSongPlay.mockReset()
		mocks.recordMusicSongPlay.mockResolvedValue({ recorded: true })
    // localStorage.clear()
  })

	it('records one play only after five seconds of active playback', async () => {
		vi.useFakeTimers()
		const player = usePlayerStore()
		const song = { id: 'song-5s', title: 'Five Seconds', audio_url: 'five.mp3' } as any

		player.playSong(song)
		await audioInstances[0].play.mock.results[0]?.value
		await vi.advanceTimersByTimeAsync(4999)
		expect(mocks.recordMusicSongPlay).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(1)
		expect(mocks.recordMusicSongPlay).toHaveBeenCalledTimes(1)
		expect(mocks.recordMusicSongPlay).toHaveBeenCalledWith('song-5s')

		await vi.advanceTimersByTimeAsync(5000)
		expect(mocks.recordMusicSongPlay).toHaveBeenCalledTimes(1)
		vi.useRealTimers()
	})

	it('records a restored song after five seconds of resumed playback', async () => {
		vi.useFakeTimers()
		localStorage.setItem('playbackState', JSON.stringify({
			song: { id: 'restored-song', title: 'Restored', audio_url: 'restored.mp3' },
			currentTime: 12,
		}))
		const player = usePlayerStore()

		player.togglePlay()
		await audioInstances[0].play.mock.results[0]?.value
		await vi.advanceTimersByTimeAsync(5000)

		expect(mocks.recordMusicSongPlay).toHaveBeenCalledWith('restored-song')
		vi.useRealTimers()
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

  it('keeps next and previous on the selected single song after an old queue exists', () => {
    const player = usePlayerStore()
    const firstQueuedSong = { id: 1, title: 'Queued 1', audio_url: 'queued-1.mp3' } as any
    const secondQueuedSong = { id: 2, title: 'Queued 2', audio_url: 'queued-2.mp3' } as any
    const singleSong = { id: 3, title: 'Single', audio_url: 'single.mp3' } as any

    player.playAlbum([firstQueuedSong, secondQueuedSong])
    player.playSong(singleSong)

    expect(player.queue.map((song) => song.id)).toEqual([3])

    player.playNext()
    expect(player.currentSong?.id).toBe(3)

    player.playPrevious()
    expect(player.currentSong?.id).toBe(3)
  })

  it('advances to next song in an album queue with uuid ids', () => {
    const player = usePlayerStore()
    const firstSong = { id: 'song-uuid-1', title: 'UUID 1', audio_url: 'uuid-1.wav' } as any
    const secondSong = { id: 'song-uuid-2', title: 'UUID 2', audio_url: 'uuid-2.wav' } as any

    player.playAlbum([firstSong, secondSong])
    player.playNext()

    expect(player.currentSong?.id).toBe('song-uuid-2')
  })

  it('plays a queued feed song without shrinking the current queue', () => {
    const player = usePlayerStore()
    const firstFeedItem = {
      id: '101',
      title: 'Episode 1',
      author: 'Host',
      published_at: '2025-01-01T00:00:00Z',
      summary: 'First episode',
      enclosure_url: 'episode-1.mp3',
    }
    const secondFeedItem = {
      id: '102',
      title: 'Episode 2',
      author: 'Host',
      published_at: '2025-01-02T00:00:00Z',
      summary: 'Second episode',
      enclosure_url: 'episode-2.mp3',
    }

    player.setQueueFromCurrentItems([
      { type: 'feed_item', feed_item: firstFeedItem },
      { type: 'feed_item', feed_item: secondFeedItem },
    ] as any)
    const firstSong = player.createPodcastSong(firstFeedItem as any)
    expect(firstSong).not.toBeNull()
    expect(firstSong?.media_kind).toBe('feed_item')

    player.playQueuedSong(firstSong!)

    expect(player.currentSong?.id).toBe(101)
    expect(player.queue.map((song) => song.id)).toEqual([101, 102])

    player.playNext()
    expect(player.currentSong?.id).toBe(102)
  })

  it('keeps album queue when selecting another song from the same queue', () => {
    const player = usePlayerStore()
    const firstSong = { id: 'song-uuid-1', title: 'UUID 1', audio_url: 'uuid-1.wav' } as any
    const secondSong = { id: 'song-uuid-2', title: 'UUID 2', audio_url: 'uuid-2.wav' } as any
    const thirdSong = { id: 'song-uuid-3', title: 'UUID 3', audio_url: 'uuid-3.wav' } as any

    player.playAlbum([firstSong, secondSong, thirdSong])
    player.playQueuedSong(secondSong)

    expect(player.queue.map((song) => song.id)).toEqual(['song-uuid-1', 'song-uuid-2', 'song-uuid-3'])

    player.playNext()
    expect(player.currentSong?.id).toBe('song-uuid-3')

    player.playPrevious()
    expect(player.currentSong?.id).toBe('song-uuid-2')
  })

  it('keeps current song title populated while moving through album queue', () => {
    const player = usePlayerStore()
    const firstSong = { id: 'song-uuid-1', title: 'UUID 1', audio_url: 'uuid-1.wav' } as any
    const secondSong = { id: 'song-uuid-2', title: 'UUID 2', audio_url: 'uuid-2.wav' } as any

    player.playAlbum([firstSong, secondSong])
    expect(player.currentSong?.title).toBe('UUID 1')

    player.playNext()
    expect(player.currentSong?.title).toBe('UUID 2')

    player.playPrevious()
    expect(player.currentSong?.title).toBe('UUID 1')
  })

  it('does not randomly replay the current song when other queued songs exist', () => {
    const player = usePlayerStore()
    const firstSong = { id: 'song-uuid-1', title: 'UUID 1', audio_url: 'uuid-1.wav' } as any
    const secondSong = { id: 'song-uuid-2', title: 'UUID 2', audio_url: 'uuid-2.wav' } as any
    const thirdSong = { id: 'song-uuid-3', title: 'UUID 3', audio_url: 'uuid-3.wav' } as any

    player.playAlbum([firstSong, secondSong, thirdSong])
    player.playbackMode = 'random'

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    player.playNext()
    randomSpy.mockRestore()

    expect(player.currentSong?.id).not.toBe('song-uuid-1')
    expect(['song-uuid-2', 'song-uuid-3']).toContain(player.currentSong?.id)
  })

  it('persists playback without playing intent and restores paused', async () => {
    const player = usePlayerStore()
    const song = { id: 1, title: 'Persisted', audio_url: 'persisted.mp3' } as any

    player.playSong(song)
    await nextTick()

    const savedState = JSON.parse(localStorage.getItem('playbackState') || '{}')
    expect(savedState).not.toHaveProperty('isPlaying')

    setActivePinia(createPinia())
    const restoredPlayer = usePlayerStore()

    expect(restoredPlayer.currentSong?.id).toBe(1)
    expect(restoredPlayer.isPlaying).toBe(false)
  })

  it('does not mark playSong as playing when audio play fails', async () => {
    const player = usePlayerStore()
    const song = { id: 1, title: 'Rejected', audio_url: 'rejected.mp3' } as any

    player.playSong(song)
    audioInstances[0].play.mockRejectedValueOnce(new Error('play blocked'))
    player.playSong({ id: 2, title: 'Next rejected', audio_url: 'next-rejected.mp3' } as any)
    await audioInstances[0].play.mock.results.at(-1)?.value.catch(() => undefined)

    expect(player.isPlaying).toBe(false)
  })

  it('keeps togglePlay paused when audio play fails', async () => {
    const player = usePlayerStore()
    const song = { id: 1, title: 'Toggle rejected', audio_url: 'toggle-rejected.mp3' } as any

    player.playSong(song)
    await audioInstances[0].play.mock.results[0]?.value
    player.togglePlay()
    audioInstances[0].play.mockRejectedValueOnce(new Error('play blocked'))

    player.togglePlay()
    await audioInstances[0].play.mock.results.at(-1)?.value.catch(() => undefined)

    expect(player.isPlaying).toBe(false)
  })

  it('keeps repeat-one next paused when audio play fails', async () => {
    const player = usePlayerStore()
    const song = { id: 1, title: 'Repeat rejected', audio_url: 'repeat-rejected.mp3' } as any

    player.playSong(song)
    await audioInstances[0].play.mock.results[0]?.value
    player.repeatMode = 'one'
    audioInstances[0].play.mockRejectedValueOnce(new Error('play blocked'))

    player.playNext()
    await audioInstances[0].play.mock.results.at(-1)?.value.catch(() => undefined)

    expect(player.isPlaying).toBe(false)
  })
})
