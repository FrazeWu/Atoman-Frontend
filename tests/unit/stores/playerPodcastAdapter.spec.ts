import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayerStore } from '@/stores/player'
import { recordMusicSongPlay } from '@/api/musicV1'
import type { PodcastEpisode } from '@/types'

vi.mock('@/api/musicV1', () => ({
  recordMusicSongPlay: vi.fn().mockResolvedValue({ recorded: true }),
}))

vi.mock('@/composables/useApi', () => ({
  useApiUrl: () => 'http://localhost:8081/api/v1',
  useApi: () => ({ url: 'http://localhost:8081/api/v1' }),
}))

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

function podcastEpisode(overrides: Partial<PodcastEpisode> = {}): PodcastEpisode {
  return {
    id: 'episode-1',
    post_id: 'post-1',
    post: {
      id: 'post-1',
      user_id: 'user-1',
      title: '第一期',
      content: '00:10 开场',
      status: 'published',
      visibility: 'public',
      allow_comments: true,
      pinned: false,
      collections: [{ id: 'collection-1', channel_id: 'channel-1', name: '第一季', cover_url: 'collection.jpg', created_at: '', updated_at: '' }],
      created_at: '',
      updated_at: '',
    },
    channel_id: 'channel-1',
    channel: { id: 'channel-1', user_id: 'user-1', name: '原子播客', slug: 'atoman-podcast', cover_url: 'channel.jpg', created_at: '', updated_at: '' },
    audio_url: 'episode.mp3',
    duration_sec: 3600,
    episode_cover_url: '',
    season_number: 1,
    episode_number: 2,
    created_at: '2026-07-09T00:00:00Z',
    updated_at: '2026-07-09T00:00:00Z',
    ...overrides,
  }
}

describe('player podcast adapter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(recordMusicSongPlay).mockClear()
  })

  it('creates podcast player item with podcast source metadata', () => {
    const player = usePlayerStore()
    const song = player.createPodcastEpisodeSong(podcastEpisode())

    expect(song).toMatchObject({
      id: 'podcast:episode-1',
      source_type: 'podcast_episode',
      source_id: 'episode-1',
      title: '第一期',
      artist: '原子播客',
      album: '第一季',
      album_id: 'collection-1',
      audio_url: 'episode.mp3',
      cover_url: 'collection.jpg',
      track_number: 2,
    })
  })

  it('resolves uploaded podcast media against the API origin', () => {
    const player = usePlayerStore()
    const song = player.createPodcastEpisodeSong(podcastEpisode({
      audio_url: '/uploads/podcast/audio/smoke.wav',
      episode_cover_url: '/uploads/podcast/covers/smoke.jpg',
    }))

    expect(song.audio_url).toBe('http://localhost:8081/uploads/podcast/audio/smoke.wav')
    expect(song.cover_url).toBe('http://localhost:8081/uploads/podcast/covers/smoke.jpg')
  })

  it('does not record music play for podcast source', () => {
    const player = usePlayerStore()
    const song = player.createPodcastEpisodeSong(podcastEpisode())

    player.playQueuedSong(song)

    expect(recordMusicSongPlay).not.toHaveBeenCalled()
  })
})
