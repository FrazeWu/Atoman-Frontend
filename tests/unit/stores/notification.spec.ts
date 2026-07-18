import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { commentNotificationLocation, contentPublishedLocation, forumNotificationLocation, isCommentNotification, useNotificationStore } from '@/stores/notification'
import type { Notification, NotificationCategory } from '@/types'

const makeNotification = (id: string, category: NotificationCategory, read_at: string | null = null, type = `content.${category}`): Notification => ({
  id,
  recipient_id: 'user-1',
  actor_id: null,
  actor: null,
  type,
  category,
  reason: '',
  source_type: category,
  source_id: `${id}-source`,
  actor_count: 1,
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
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const store = useNotificationStore()
    store.unreadCounts.reply = 2
    store.unreadCounts.like = 3
    store.notifications = [
      makeNotification('reply-1', 'reply'),
      makeNotification('reply-2', 'reply'),
      makeNotification('reply-read', 'reply', '2026-06-29T00:00:00.000Z'),
    ]

    await store.markAllRead('reply')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/notifications/read-all?type=reply', expect.objectContaining({ method: 'PUT' }))
    expect(store.unreadCount).toBe(3)
    expect(store.notifications.every((item) => item.read_at)).toBe(true)
  })

  it('replaces unread counts from the categorized API contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { total: 4, items: { like: 2, reply: 1, dm: 1 } },
    }), { status: 200 }))
    const store = useNotificationStore()
    store.unreadCounts.mention = 7
    await store.fetchUnreadCounts()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/notifications/unread-counts', expect.anything())
    expect(store.unreadCounts.like).toBe(2)
    expect(store.unreadCounts.mention).toBe(0)
    expect(store.unreadCounts.dm).toBe(1)
    expect(store.unreadCount).toBe(4)
  })

  it('accepts forum follow notifications', () => {
    expect(makeNotification('follow-1', 'reply', null, 'forum_follow').type).toBe('forum_follow')
  })

  it('locates published content notifications and rejects external meta paths', () => {
    const published = { ...makeNotification('published-1', 'system', null, 'content_published'), meta: { path: '/videos/watch/video-1' } }
    expect(contentPublishedLocation(published)).toEqual({ path: '/videos/watch/video-1', query: { source: 'notification' } })
    expect(contentPublishedLocation({ ...published, meta: { path: 'https://evil.example' } })).toBeNull()
  })

  it('treats forum topic comments as comment notifications and locates forum follows', () => {
    const comment = {
      ...makeNotification('forum-comment', 'reply', null, 'forum_topic_comment'),
      meta: { target_kind: 'forum_topic' as const, resource_id: 'topic-1', comment_id: 'child-1', root_id: 'root-1' },
    }
    expect(isCommentNotification(comment)).toBe(true)
    expect(commentNotificationLocation(comment)).toEqual({
      path: '/forum/topic/topic-1', query: { comment_id: 'child-1' }, hash: '#comment-root-1',
    })
    expect(forumNotificationLocation({
      ...makeNotification('follow', 'reply', null, 'forum_follow'), meta: { topic_id: 'topic-2', topic_title: 'Topic' },
    })).toEqual({ path: '/forum/topic/topic-2' })
  })

  it('inserts realtime forum notifications in the selected forum tab', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 }))
    const store = useNotificationStore()
    await store.fetchNotifications(['forum_topic_comment', 'forum_follow'], 1)

    store.receiveNotification(makeNotification('live-forum', 'reply', null, 'forum_topic_comment'))

    expect(store.notifications.map(({ id }) => id)).toEqual(['live-forum'])
    expect(store.unreadCount).toBe(1)
  })

  it('marks both forum notification types read', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const store = useNotificationStore()
    store.notifications = [
      makeNotification('topic-comment', 'reply', null, 'forum_topic_comment'),
      makeNotification('new-topic', 'reply', null, 'forum_follow'),
    ]

    await store.markAllRead(['forum_topic_comment', 'forum_follow'])

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('type=forum_topic_comment'), expect.stringContaining('type=forum_follow'),
    ])
    expect(store.notifications.every(({ read_at }) => Boolean(read_at))).toBe(true)
  })

  it('clears forum realtime filters when resetting the store', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 }))
    const store = useNotificationStore()
    await store.fetchNotifications(['forum_topic_comment', 'forum_follow'], 1)

    store.resetStore()
    store.receiveNotification(makeNotification('next-mention', 'mention', null, 'comment_mention'))

    expect(store.notifications.map(({ id }) => id)).toEqual(['next-mention'])
  })

  it('does not call unregistered notification preference or mute endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const store = useNotificationStore()

    await expect(store.savePreferences([{ category: 'like', event_type: 'content.liked', enabled: false }])).resolves.toBe(false)
    await expect(store.savePreference('like', 'content.liked', false)).resolves.toBe(false)
    await expect(store.createMute('blog_post', 'post-1', 'reason')).resolves.toBe(false)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
