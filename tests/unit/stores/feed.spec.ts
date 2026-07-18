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

  it('clears user subscription state instead of leaking stale data when signed out', async () => {
    const auth = useAuthStore()
    auth.isAuthenticated = false
    auth.token = null
    auth.user = null
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const feed = useFeedStore()
    feed.subscriptions = [{ id: 'sub-1', user_id: 'user-1', feed_source_id: 'source-1' } as never]
    feed.groups = [{ id: 'group-1', user_id: 'user-1', name: 'Old group' } as never]
    feed.starGroups = [{ id: 'star-group-1', user_id: 'user-1', name: 'Old stars' } as never]

    await Promise.all([
      feed.fetchSubscriptions(),
      feed.fetchGroups(),
      feed.fetchStarGroups(),
    ])

    expect(feed.subscriptions).toEqual([])
    expect(feed.groups).toEqual([])
    expect(feed.starGroups).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears timeline and user display state when user state is reset', () => {
    const feed = useFeedStore()
    feed.subscriptions = [{ id: 'sub-1', user_id: 'user-1', feed_source_id: 'source-1' } as never]
    feed.groups = [{ id: 'group-1', user_id: 'user-1', name: 'Old group' } as never]
    feed.starGroups = [{ id: 'star-group-1', user_id: 'user-1', name: 'Old stars' } as never]
    feed.timeline = [{ type: 'feed_item', feed_item: { id: 'feed-item-1', title: 'Old item' } }]
    feed.starredItemIds = new Set(['feed-item-1'])
    feed.bookmarkedPostIds = new Set(['post-1'])
    feed.readingListItemIds = new Set(['feed-item-2'])
    feed.activeSource = { type: 'external_rss', id: 'source-1' }
    feed.error = 'Old error'

    feed.clearUserState()

    expect(feed.subscriptions).toEqual([])
    expect(feed.groups).toEqual([])
    expect(feed.starGroups).toEqual([])
    expect(feed.timeline).toEqual([])
    expect(feed.starredItemIds.size).toBe(0)
    expect(feed.bookmarkedPostIds.size).toBe(0)
    expect(feed.readingListItemIds.size).toBe(0)
    expect(feed.activeSource).toBeNull()
    expect(feed.error).toBeNull()
  })

  it('resolves subscription input through the unified resolve endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'existing_source',
      source: {
        id: 'source-1',
        provider: 'rss',
        source_type: 'external_rss',
        title: 'Example Feed',
        rss_url: 'https://example.com/feed.xml',
        canonical_url: 'https://example.com/feed.xml',
      },
      candidates: [],
      message: '来源已存在，可添加到你的订阅',
    }), { status: 200 }))

    const feed = useFeedStore()
    const result = await feed.resolveSubscriptionInput('https://example.com/feed.xml')

    expect(result?.status).toBe('existing_source')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/subscriptions/resolve', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ input: 'https://example.com/feed.xml' }),
    }))
  })

  it('auto-adds subscriptions through the unified endpoint and moves selected group server-side', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'sub-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const feed = useFeedStore()
    const result = await feed.autoAddSubscription({
      input: 'https://github.com/DIYgod/RSSHub',
      title: 'RSSHub Repo',
      group_id: 'group-1',
    })

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/feed/subscriptions/auto-add', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        input: 'https://github.com/DIYgod/RSSHub',
        title: 'RSSHub Repo',
        group_id: 'group-1',
      }),
    }))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/feed/subscriptions/sub-1/group', expect.anything())
  })

  it('shows nested API error messages when adding RSS subscriptions fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'validation.invalid_request',
        message: 'rss_url must be an absolute http/https URL',
      },
    }), { status: 400 }))

    const feed = useFeedStore()
    const result = await feed.addSubscription({ rss_url: 'not-a-url' })

    expect(result).toBe(false)
    expect(feed.error).toBe('rss_url must be an absolute http/https URL')
  })

  it('treats nested already-subscribed API errors as successful RSS subscription attempts', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: {
          code: 'subscription.already_exists',
          message: 'Already subscribed to this source',
        },
      }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const feed = useFeedStore()
    const result = await feed.subscribeToRSS('https://example.com/feed.xml')

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/feed/subscriptions', expect.objectContaining({
      headers: { Authorization: 'Bearer token' },
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

  it('imports user OPML through multipart upload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      message: 'OPML import completed',
      imported: 2,
      reused: 1,
      failed: 0,
    }), { status: 200 }))

    const feed = useFeedStore()
    const file = new File(['<opml version="2.0"><body /></opml>'], 'feeds.opml', { type: 'text/xml' })
    const result = await feed.importOPML(file)

    expect(result).toEqual({
      message: 'OPML import completed',
      imported: 2,
      reused: 1,
      failed: 0,
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/opml/import', expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    }))
    const body = fetchMock.mock.calls[0][1]?.body
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
  })

  it('exports user OPML as a blob download payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('opml', {
      status: 200,
      headers: { 'Content-Type': 'application/x-opml+xml' },
    }))

    const feed = useFeedStore()
    const result = await feed.exportOPML()

    expect(result.size).toBe(4)
    expect(result.type).toBe('application/x-opml+xml')
    expect(await result.text()).toBe('opml')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/opml/export', {
      headers: { Authorization: 'Bearer token' },
    })
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

  it('loads the feed timeline with search query params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ type: 'feed_item', feed_item: { id: 'feed-item-1', title: 'Citrus item' } }],
    }), { status: 200 }))

    const feed = useFeedStore()
    await feed.fetchTimeline({
      q: '  citrus notes  ',
      unreadOnly: true,
      sourceType: 'external_rss',
      sourceId: 'source-1',
    })

    expect(feed.timeline).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline?source_type=external_rss&source_id=source-1&unread_only=true&q=citrus+notes', {
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('persists feed filter rules in localStorage', () => {
    const feed = useFeedStore()

    feed.setFilterRules({
      mutedSourceIds: ['source-muted-1'],
      hiddenKeywords: ['剧透', '广告'],
    })

    expect(feed.filterRules).toEqual({
      mutedSourceIds: ['source-muted-1'],
      hiddenKeywords: ['剧透', '广告'],
    })
    expect(JSON.parse(localStorage.getItem('atoman.feed.filter-rules') || '{}')).toEqual({
      mutedSourceIds: ['source-muted-1'],
      hiddenKeywords: ['剧透', '广告'],
    })
  })

  it('hydrates feed filter rules from localStorage', () => {
    localStorage.setItem('atoman.feed.filter-rules', JSON.stringify({
      mutedSourceIds: ['source-muted-2'],
      hiddenKeywords: ['推广'],
    }))

    const feed = useFeedStore()

    expect(feed.filterRules).toEqual({
      mutedSourceIds: ['source-muted-2'],
      hiddenKeywords: ['推广'],
    })
  })

  it('persists feed automation rules in localStorage', () => {
    const feed = useFeedStore()

    feed.setAutomationRules({
      autoMarkReadSourceIds: ['source-auto-1'],
      autoAddReadingListSourceIds: ['source-later-1'],
    })

    expect(feed.automationRules).toEqual({
      autoMarkReadSourceIds: ['source-auto-1'],
      autoAddReadingListSourceIds: ['source-later-1'],
    })
    expect(JSON.parse(localStorage.getItem('atoman.feed.automation-rules') || '{}')).toEqual({
      autoMarkReadSourceIds: ['source-auto-1'],
      autoAddReadingListSourceIds: ['source-later-1'],
    })
  })

  it('hydrates feed automation rules from localStorage', () => {
    localStorage.setItem('atoman.feed.automation-rules', JSON.stringify({
      autoMarkReadSourceIds: ['source-auto-2'],
      autoAddReadingListSourceIds: ['source-later-2'],
    }))

    const feed = useFeedStore()

    expect(feed.automationRules).toEqual({
      autoMarkReadSourceIds: ['source-auto-2'],
      autoAddReadingListSourceIds: ['source-later-2'],
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
    expect(await feed.markItemsUnread(['feed-item-1'])).toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/timeline/mark-unread', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ feed_item_ids: ['feed-item-1'] }),
    }))
  })

  it('reports failed read state writes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))

    const feed = useFeedStore()

    expect(await feed.markItemsRead(['feed-item-1'])).toBe(false)
    expect(await feed.markItemsUnread(['feed-item-1'])).toBe(false)
    expect(await feed.markSubscriptionRead('sub-1')).toBe(false)
    expect(await feed.markSubscriptionUnread('sub-1')).toBe(false)
    expect(await feed.markAllFeedRead()).toBe(false)
    expect(await feed.markAllFeedUnread()).toBe(false)
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

  it('reports failed subscription management writes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))

    const feed = useFeedStore()

    expect(await feed.setSubscriptionGroup('sub-1', 'group-1')).toBe(false)
    expect(await feed.unsubscribe('sub-1')).toBe(false)
    expect(await feed.deleteGroup('group-1')).toBe(false)
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

  it('loads server-managed subscription fields when fetching subscriptions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{
        id: 'sub-1',
        user_id: 'user-1',
        feed_source_id: 'source-1',
        is_muted: true,
        auto_mark_read: false,
        auto_add_reading_list: true,
        created_at: '2026-07-07T00:00:00Z',
      }],
    }), { status: 200 }))

    const feed = useFeedStore()
    await feed.fetchSubscriptions()

    expect(feed.subscriptions).toEqual([expect.objectContaining({
      id: 'sub-1',
      is_muted: true,
      auto_mark_read: false,
      auto_add_reading_list: true,
    })])
  })

  it('does not request unavailable subscription rules', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const feed = useFeedStore()
    feed.subscriptionRules = [{ id: 'stale-rule' } as never]
    feed.ruleApplySummary = { updated_count: 1 } as never
    await feed.fetchSubscriptionRules()

    expect(feed.subscriptionRules).toEqual([])
    expect(feed.ruleApplySummary).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send a subscription rule without any action', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const feed = useFeedStore()

    const result = await feed.createSubscriptionRule({
      name: '播客整理',
      enabled: true,
      match_type: 'source_category',
      conditions_json: { categories: ['podcast'] },
    })

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send a subscription rule without any condition', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const feed = useFeedStore()

    const result = await feed.createSubscriptionRule({
      name: '空条件规则',
      enabled: true,
      match_type: 'keywords',
      conditions_json: { keywords: [] },
      action_auto_mark_read: true,
    })

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not create a subscription rule without a registered backend API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const feed = useFeedStore()
    const result = await feed.createSubscriptionRule({
      name: '播客整理',
      enabled: true,
      match_type: 'source_category',
      conditions_json: { categories: ['podcast'] },
      action_auto_mark_read: true,
    })

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not update, reorder, delete, or apply subscription rules', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const feed = useFeedStore()

    expect(await feed.updateSubscriptionRule('rule-1', {
      name: '已更新规则',
      enabled: false,
      position: 2,
      match_type: 'keywords',
      conditions_json: { keywords: ['go'] },
      action_muted: true,
    })).toBe(false)
    expect(await feed.reorderSubscriptionRules(['rule-2', 'rule-1'])).toBe(false)
    expect(await feed.deleteSubscriptionRule('rule-1')).toBe(false)
    expect(await feed.applySubscriptionRules({ all: true })).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
