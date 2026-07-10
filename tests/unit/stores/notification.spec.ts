import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import type { Notification, NotificationCategory } from '@/types'

const makeNotification = (id: string, category: NotificationCategory, read_at: string | null = null): Notification => ({
  id,
  recipient_id: 'user-1',
  actor_id: null,
  actor: null,
  type: `content.${category}`,
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const store = useNotificationStore()
    store.unreadCounts.reply = 2
    store.unreadCounts.like = 3
    store.notifications = [
      makeNotification('reply-1', 'reply'),
      makeNotification('reply-2', 'reply'),
      makeNotification('reply-read', 'reply', '2026-06-29T00:00:00.000Z'),
    ]

    await store.markAllRead('reply')

    expect(store.unreadCount).toBe(3)
    expect(store.notifications.every((item) => item.read_at)).toBe(true)
  })

  it('stores unread counts by notification category', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { total: 9, items: { like: 2, interaction: 1, mention: 1, reply: 2, collaboration: 3, system: 0, dm: 0 } },
    }), { status: 200 }))
    const store = useNotificationStore()
    await store.fetchUnreadCounts()
    expect(store.unreadCounts.like).toBe(2)
    expect(store.unreadCount).toBe(9)
  })
})
