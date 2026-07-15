import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { commentNotificationLocation, useNotificationStore } from '@/stores/notification'
import type { Notification } from '@/types'

const makeNotification = (id: string, type: Notification['type'], read_at: string | null = null): Notification => ({
  id,
  recipient_id: 'user-1',
  actor_id: null,
  actor: null,
  type,
  source_type: type,
  source_id: `${id}-source`,
  meta: {},
  read_at,
  created_at: '2026-06-30T00:00:00.000Z',
  updated_at: '2026-06-30T00:00:00.000Z',
})

describe('notification store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setActivePinia(createPinia())

    const auth = useAuthStore()
    auth.token = 'token'
  })

  it('keeps unread from other notification types when marking one type read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const store = useNotificationStore()
    store.unreadCount = 5
    store.notifications = [
      makeNotification('reply-1', 'forum_reply'),
      makeNotification('reply-2', 'forum_reply'),
      makeNotification('reply-read', 'forum_reply', '2026-06-29T00:00:00.000Z'),
    ]

    await store.markAllRead('forum_reply')

    expect(store.unreadCount).toBe(3)
    expect(store.notifications.every((item) => item.read_at)).toBe(true)
  })

  it('only marks notification types whose mark-all requests succeed', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'failed' }), { status: 500 }))
    const store = useNotificationStore()
    store.unreadCount = 2
    store.notifications = [
      makeNotification('forum', 'forum_reply'),
      makeNotification('comment', 'comment_reply'),
    ]

    await store.markAllRead(['forum_reply', 'comment_reply'])

    expect(store.notifications.find(({ id }) => id === 'forum')?.read_at).toBeTruthy()
    expect(store.notifications.find(({ id }) => id === 'comment')?.read_at).toBeNull()
    expect(store.unreadCount).toBe(1)
  })

  it('does not fake local success when every mark-all request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }))
    const store = useNotificationStore()
    store.unreadCount = 1
    store.notifications = [makeNotification('comment', 'comment_reply')]

    await expect(store.markAllRead(['comment_reply'])).rejects.toThrow('标记通知失败')
    expect(store.notifications[0]?.read_at).toBeNull()
    expect(store.unreadCount).toBe(1)
  })

  it('uses backend unread total when mark all read returns it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ unread_total: 7 }), { status: 200 }))

    const store = useNotificationStore()
    store.unreadCount = 5
    store.notifications = [
      makeNotification('reply-1', 'forum_reply'),
      makeNotification('reply-2', 'forum_reply'),
    ]

    await store.markAllRead('forum_reply')

    expect(store.unreadCount).toBe(7)
  })

  it('replaces unread aggregate notifications without incrementing unread twice', () => {
    const store = useNotificationStore()
    store.unreadCount = 1
    store.notifications = [{ ...makeNotification('like-1', 'comment_like'), aggregation_key: 'comment:1:likes' }]

    store.receiveNotification({
      ...makeNotification('like-2', 'comment_like'),
      aggregation_key: 'comment:1:likes',
      meta: { target_kind: 'blog_post', resource_id: 'post-1', comment_id: 'child', root_id: 'root', like_count: 3 },
    })

    expect(store.unreadCount).toBe(1)
    expect(store.total).toBe(0)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toMatchObject({ id: 'like-2', meta: { like_count: 3 } })
  })

  it('moves a realtime aggregate update to its newest chronological position', () => {
    const store = useNotificationStore()
    store.notifications = [
      { ...makeNotification('first', 'comment_reply'), created_at: '2026-06-30T05:00:00.000Z' },
      { ...makeNotification('aggregate-old', 'comment_like'), aggregation_key: 'comment:1:likes', created_at: '2026-06-30T01:00:00.000Z' },
      { ...makeNotification('last', 'comment_reply'), created_at: '2026-06-30T00:00:00.000Z' },
    ]

    store.receiveNotification({
      ...makeNotification('aggregate-new', 'comment_like'),
      aggregation_key: 'comment:1:likes',
      created_at: '2026-06-30T06:00:00.000Z',
    })

    expect(store.notifications.map(({ id }) => id)).toEqual(['aggregate-new', 'first', 'last'])
  })

  it('replaces duplicate realtime notification ids', () => {
    const store = useNotificationStore()
    store.receiveNotification(makeNotification('same', 'comment_reply'))
    store.receiveNotification({ ...makeNotification('same', 'comment_reply'), meta: { comment_id: 'new' } })
    expect(store.notifications).toHaveLength(1)
    expect(store.unreadCount).toBe(1)
    expect(store.notifications[0]?.meta.comment_id).toBe('new')
  })

  it.each([
    ['blog_post', 'post-1', '/posts/post/post-1', {}],
    ['video', 'video-1', '/videos/videos/watch/video-1', {}],
    ['podcast_episode', 'episode-1', '/podcasts/episode/episode-1', {}],
    ['feed_article', 'article-1', '/feed/item/article-1', {}],
    ['music_artist', 'artist-1', '/music/artist/artist-1', {}],
    ['music_album', 'album-1', '/music/album/album-1', {}],
    ['music_song', 'song-1', '/music', { song_id: 'song-1' }],
    ['forum_topic', 'topic-1', '/forum/topic/topic-1', {}],
    ['debate', 'debate-1', '/debate/debate-1', {}],
    ['timeline_person', 'person-1', '/timeline/person/person-1', {}],
    ['timeline_event', 'event-1', '/timeline', { event_id: 'event-1' }],
  ] as const)('builds %s locations through module public paths', (kind, resourceId, path, extraQuery) => {
    const location = commentNotificationLocation({
      ...makeNotification(`notice-${kind}`, 'comment_reply'),
      meta: { target_kind: kind, resource_id: resourceId, comment_id: 'child', root_id: 'root' },
    })
    expect(location).toEqual({ path, query: { comment_id: 'child', ...extraQuery }, hash: '#comment-root' })
  })

  it('fetches and combines staged old and unified notification types', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { ...makeNotification('old', 'forum_reply'), created_at: '2026-06-30T03:00:00.000Z' },
        { ...makeNotification('old-tie', 'forum_reply'), created_at: '2026-06-30T02:00:00.000Z' },
      ], meta: { total: 2 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { ...makeNotification('new', 'comment_reply'), created_at: '2026-06-30T04:00:00.000Z' },
      ], meta: { total: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { ...makeNotification('marked', 'comment_marked'), created_at: '2026-06-30T02:00:00.000Z' },
      ], meta: { total: 1 } }), { status: 200 }))
    const store = useNotificationStore()
    await store.fetchNotifications(['forum_reply', 'comment_reply', 'comment_marked'], 1)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('type=forum_reply'), expect.stringContaining('type=comment_reply'), expect.stringContaining('type=comment_marked'),
    ])
    expect(store.notifications.map(({ id }) => id)).toEqual(['new', 'old', 'marked', 'old-tie'])
    expect(store.total).toBe(4)
  })

  it('does not let an old selection overwrite a newer notification request', async () => {
    let resolveOld!: (value: Response) => void
    let resolveNew!: (value: Response) => void
    const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve })
    const newResponse = new Promise<Response>((resolve) => { resolveNew = resolve })
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      String(url).includes('forum_reply') ? oldResponse : newResponse,
    )
    const store = useNotificationStore()

    const oldRequest = store.fetchNotifications('forum_reply', 1)
    const newRequest = store.fetchNotifications('comment_reply', 1)
    resolveOld(new Response(JSON.stringify({ data: [makeNotification('old', 'forum_reply')], meta: { total: 1 } }), { status: 200 }))
    await oldRequest
    expect(store.loading).toBe(true)
    expect(store.notifications).toEqual([])

    resolveNew(new Response(JSON.stringify({ data: [makeNotification('new', 'comment_reply')], meta: { total: 1 } }), { status: 200 }))
    await newRequest
    expect(store.loading).toBe(false)
    expect(store.currentType).toBe('comment_reply')
    expect(store.notifications.map(({ id }) => id)).toEqual(['new'])
    expect(store.total).toBe(1)
  })
})
