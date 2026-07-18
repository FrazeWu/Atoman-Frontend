import { beforeEach, describe, expect, it } from 'vitest'
import { listPodcastProgress, readPodcastProgress, writePodcastProgress } from '@/composables/usePodcastProgress'

describe('usePodcastProgress', () => {
  beforeEach(() => localStorage.clear())

  it('persists and reads local podcast progress', () => {
    writePodcastProgress({
      episode_id: 'episode-1',
      position_sec: 42,
      duration_sec: 120,
      completed: false,
      last_played_at: '2026-07-18T00:00:00.000Z',
    })

    expect(readPodcastProgress('episode-1')).toEqual({
      episode_id: 'episode-1',
      position_sec: 42,
      duration_sec: 120,
      completed: false,
      last_played_at: '2026-07-18T00:00:00.000Z',
    })
    expect(listPodcastProgress()).toHaveLength(1)
  })

  it('ignores malformed progress records', () => {
    localStorage.setItem('atoman:podcast-progress:broken', '{bad')
    expect(readPodcastProgress('broken')).toBeNull()
    expect(listPodcastProgress()).toEqual([])
  })
})
