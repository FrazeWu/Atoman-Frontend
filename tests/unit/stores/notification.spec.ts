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
})
