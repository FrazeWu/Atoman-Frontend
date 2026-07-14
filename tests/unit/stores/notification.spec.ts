import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
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

  it('replaces duplicate realtime notification ids', () => {
    const store = useNotificationStore()
    store.receiveNotification(makeNotification('same', 'comment_reply'))
    store.receiveNotification({ ...makeNotification('same', 'comment_reply'), meta: { comment_id: 'new' } })
    expect(store.notifications).toHaveLength(1)
    expect(store.unreadCount).toBe(1)
    expect(store.notifications[0]?.meta.comment_id).toBe('new')
  })
})
