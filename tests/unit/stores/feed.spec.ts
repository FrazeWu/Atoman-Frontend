import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const authenticate = () => {
  const auth = useAuthStore()
  auth.isAuthenticated = true
  auth.token = 'token'
}

describe('feed store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  it('adds RSS subscriptions through the v1 feed endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'sub-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    authenticate()

    const feed = useFeedStore()
    const result = await feed.addSubscription({ rss_url: 'http://www.ruanyifeng.com/blog/atom.xml' })

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/feed/subscriptions', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('discovers feed candidates through the v1 feed endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ feed_url: 'http://www.ruanyifeng.com/blog/atom.xml', title: '阮一峰的网络日志' }],
    }), { status: 200 }))
    authenticate()

    const feed = useFeedStore()
    const candidates = await feed.discoverFeedCandidates('http://www.ruanyifeng.com/blog/atom.xml')

    expect(candidates).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/discover', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('loads the authenticated feed timeline through the v1 feed endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ type: 'feed_item', feed_item: { id: 'feed-item-1', title: 'Public item' } }],
    }), { status: 200 }))
    authenticate()

    const feed = useFeedStore()
    await feed.fetchTimeline()

    expect(feed.timeline).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline', {
      headers: { Authorization: 'Bearer token' },
    })
  })
})
