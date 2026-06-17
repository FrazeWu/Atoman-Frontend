import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const authenticate = () => {
  const auth = useAuthStore()
  auth.isAuthenticated = true
  auth.token = 'token'
  auth.user = { username: 'fafa', email: 'fafa@example.com' }
}

describe('feed store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    authenticate()
  })

  it('adds RSS subscriptions through the v1 feed endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'sub-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

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

    const feed = useFeedStore()
    await feed.fetchTimeline()

    expect(feed.timeline).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline', {
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('uses modular toggle star response data to update starred ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { starred: true },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    const result = await feedStore.toggleStar('feed-item-1')

    expect(result).toBe(true)
    expect(feedStore.starredItemIds.has('feed-item-1')).toBe(true)
  })

  it('uses modular reading-list response data to update saved ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { saved: true },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    const result = await feedStore.toggleReadingListItem('feed-item-1')

    expect(result).toBe(true)
    expect(feedStore.readingListItemIds.has('feed-item-1')).toBe(true)
  })

  it('marks feed items unread through the v1 feed endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    authenticate()

    const feed = useFeedStore()
    await feed.markItemsUnread(['feed-item-1'])

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline/mark-unread', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ feed_item_ids: ['feed-item-1'] }),
    }))
  })

  it('moves provider-created subscriptions into the selected group', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'sub-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    authenticate()

    const feed = useFeedStore()
    const result = await feed.createSubscriptionFromProvider({
      provider: 'rsshub',
      template_key: 'bilibili_user_video',
      params: { uid: '123' },
      group_id: 'group-1',
    })

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/feed/subscriptions/sub-1/group', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ group_id: 'group-1' }),
    }))
  })

  it('optimistically updates starred ids while the star request is pending', async () => {
    let resolveRequest!: (response: Response) => void
    const pendingRequest = new Promise<Response>((resolve) => {
      resolveRequest = resolve
    })
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pendingRequest)
    authenticate()

    const feed = useFeedStore()
    const result = feed.toggleStar('feed-item-1')

    expect(feed.starredItemIds.has('feed-item-1')).toBe(true)
    resolveRequest(new Response(JSON.stringify({ starred: true }), { status: 200 }))
    expect(await result).toBe(true)
  })

  it('optimistically updates reading-list ids while the save request is pending', async () => {
    let resolveRequest!: (response: Response) => void
    const pendingRequest = new Promise<Response>((resolve) => {
      resolveRequest = resolve
    })
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pendingRequest)
    authenticate()

    const feed = useFeedStore()
    const result = feed.toggleReadingListItem('feed-item-1')

    expect(feed.readingListItemIds.has('feed-item-1')).toBe(true)
    resolveRequest(new Response(JSON.stringify({ saved: true }), { status: 200 }))
    expect(await result).toBe(true)
  })

  it('serializes rapid star toggles while keeping the latest optimistic state', async () => {
    let resolveFirst!: (response: Response) => void
    let resolveSecond!: (response: Response) => void
    const firstRequest = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })
    const secondRequest = new Promise<Response>((resolve) => {
      resolveSecond = resolve
    })
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest)

    const feed = useFeedStore()
    const fetchMock = vi.mocked(globalThis.fetch)
    const first = feed.toggleStar('feed-item-1')
    expect(feed.starredItemIds.has('feed-item-1')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const second = feed.toggleStar('feed-item-1')
    expect(feed.starredItemIds.has('feed-item-1')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFirst(new Response(JSON.stringify({ data: { starred: true } }), { status: 200 }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(feed.starredItemIds.has('feed-item-1')).toBe(false)

    resolveSecond(new Response(JSON.stringify({ data: { starred: false } }), { status: 200 }))
    expect(await first).toBe(false)
    expect(await second).toBe(false)
    expect(feed.starredItemIds.has('feed-item-1')).toBe(false)
  })

  it('serializes rapid reading-list toggles while keeping the latest optimistic state', async () => {
    let resolveFirst!: (response: Response) => void
    let resolveSecond!: (response: Response) => void
    const firstRequest = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })
    const secondRequest = new Promise<Response>((resolve) => {
      resolveSecond = resolve
    })
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest)

    const feed = useFeedStore()
    const fetchMock = vi.mocked(globalThis.fetch)
    const first = feed.toggleReadingListItem('feed-item-1')
    expect(feed.readingListItemIds.has('feed-item-1')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const second = feed.toggleReadingListItem('feed-item-1')
    expect(feed.readingListItemIds.has('feed-item-1')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFirst(new Response(JSON.stringify({ data: { saved: true } }), { status: 200 }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(feed.readingListItemIds.has('feed-item-1')).toBe(false)

    resolveSecond(new Response(JSON.stringify({ data: { saved: false } }), { status: 200 }))
    expect(await first).toBe(false)
    expect(await second).toBe(false)
    expect(feed.readingListItemIds.has('feed-item-1')).toBe(false)
  })

  it('keeps pending starred ids when a stale starred-id fetch completes', async () => {
    let resolveToggle!: (response: Response) => void
    const pendingToggle = new Promise<Response>((resolve) => {
      resolveToggle = resolve
    })
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(pendingToggle)
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))

    const feed = useFeedStore()
    const result = feed.toggleStar('feed-item-1')
    expect(feed.starredItemIds.has('feed-item-1')).toBe(true)

    await feed.fetchStarredIds()
    expect(feed.starredItemIds.has('feed-item-1')).toBe(true)

    resolveToggle(new Response(JSON.stringify({ data: { starred: true } }), { status: 200 }))
    expect(await result).toBe(true)
    expect(feed.starredItemIds.has('feed-item-1')).toBe(true)
  })

  it('keeps pending reading-list ids when a stale reading-list-id fetch completes', async () => {
    let resolveToggle!: (response: Response) => void
    const pendingToggle = new Promise<Response>((resolve) => {
      resolveToggle = resolve
    })
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(pendingToggle)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const feed = useFeedStore()
    const result = feed.toggleReadingListItem('feed-item-1')
    expect(feed.readingListItemIds.has('feed-item-1')).toBe(true)

    await feed.fetchReadingListIds()
    expect(feed.readingListItemIds.has('feed-item-1')).toBe(true)

    resolveToggle(new Response(JSON.stringify({ data: { saved: true } }), { status: 200 }))
    expect(await result).toBe(true)
    expect(feed.readingListItemIds.has('feed-item-1')).toBe(true)
  })
})
