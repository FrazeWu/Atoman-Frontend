import { describe, expect, it } from 'vitest'

import { useApi } from '@/composables/useApi'
import { getPodcastEpisode, getPodcastRecommendations, getPodcastShowEpisodes } from '@/api/podcast'

describe('Podcast comment API endpoints', () => {
  it('uses the registered unified discussion and comment paths', () => {
    const env = import.meta.env as ImportMetaEnv
    env.VITE_API_URL = '/api'
    const api = useApi()

    expect(api.podcast.comments('episode/1')).toBe('/api/v1/discussions/podcast_episode/episode%2F1/comments')
    expect(api.podcast.comment('comment/1')).toBe('/api/v1/comments/comment%2F1')
  })

  it('encodes podcast path segments and query values', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await getPodcastEpisode('episode/one?draft=true')
    await getPodcastShowEpisodes('show/one?private=true')
    await getPodcastRecommendations('for-you&limit=100')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/podcast/episodes/episode%2Fone%3Fdraft%3Dtrue',
      '/api/v1/podcast/shows/show%2Fone%3Fprivate%3Dtrue/episodes',
      '/api/v1/podcast/recommend/episodes?mode=for-you%26limit%3D100&page=1&page_size=8',
    ])
  })
})
