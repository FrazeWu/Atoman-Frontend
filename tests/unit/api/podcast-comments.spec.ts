import { describe, expect, it } from 'vitest'

import { useApi } from '@/composables/useApi'

describe('Podcast comment API endpoints', () => {
  it('uses the registered unified discussion and comment paths', () => {
    const env = import.meta.env as ImportMetaEnv
    env.VITE_API_URL = '/api'
    const api = useApi()

    expect(api.podcast.comments('episode/1')).toBe('/api/v1/discussions/podcast_episode/episode%2F1/comments')
    expect(api.podcast.comment('comment/1')).toBe('/api/v1/comments/comment%2F1')
  })
})
