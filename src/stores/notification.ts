import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { Notification, NotificationFilterType } from '@/types'
import type { RouteLocationRaw } from 'vue-router'

const commentNotificationTypes = new Set<Notification['type']>([
  'comment_reply', 'comment_mention', 'comment_marked', 'comment_like',
])

export function isCommentNotification(notification: Notification) {
  return commentNotificationTypes.has(notification.type)
}

export function commentNotificationLocation(notification: Notification): RouteLocationRaw | null {
  const { target_kind: kind, resource_id: id, comment_id: commentId, root_id: rootId } = notification.meta
  if (!kind || !id || !rootId) return null
  const paths: Partial<Record<NonNullable<typeof kind>, string>> = {
    blog_post: `/post/${id}`,
    video: `/videos/watch/${id}`,
    podcast_episode: `/podcast/episode/${id}`,
    feed_article: `/feed/item/${id}`,
    music_artist: `/music/artist/${id}`,
    music_album: `/music/album/${id}`,
    forum_topic: `/forum/topic/${id}`,
    debate: `/debate/${id}`,
    timeline_person: `/timeline/person/${id}`,
    music_song: '/music',
    timeline_event: '/timeline',
  }
  const path = paths[kind]
  if (!path) return null
  const query: Record<string, string> = {}
  if (commentId) query.comment_id = commentId
  if (kind === 'music_song') query.song_id = id
  if (kind === 'timeline_event') query.event_id = id
  return { path, query, hash: `#comment-${rootId}` }
}

export const useNotificationStore = defineStore('notification', () => {
  const api = useApi()
  const authStore = useAuthStore()

  const unreadCount = ref(0)
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const currentType = ref<NotificationFilterType>('')

  const authHeaders = () => ({
    Authorization: `Bearer ${authStore.token}`,
    'Content-Type': 'application/json',
  })

  const fetchUnreadCount = async () => {
    if (!authStore.token) return
    const res = await fetch(api.notifications.unreadCount, { headers: authHeaders() })
    if (!res.ok) return
    const data = await res.json()
    unreadCount.value = data.count || 0
  }

  const fetchNotifications = async (type: NotificationFilterType = currentType.value, nextPage = 1) => {
    if (!authStore.token) return
    loading.value = true
    try {
      currentType.value = type
      page.value = nextPage
      const params = new URLSearchParams({ page: String(nextPage) })
      if (type) params.set('type', type)
      const res = await fetch(`${api.notifications.list}?${params.toString()}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('获取通知失败')
      const data = await res.json()
      notifications.value = data.data || []
      total.value = data.total || 0
    } finally {
      loading.value = false
    }
  }

  const markRead = async (id: string) => {
    if (!authStore.token) return
    const res = await fetch(api.notifications.markRead(id), {
      method: 'PUT',
      headers: authHeaders(),
    })
    if (!res.ok) return
    const target = notifications.value.find((item) => item.id === id)
    if (target && !target.read_at) {
      target.read_at = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  const markAllRead = async (type: NotificationFilterType = currentType.value) => {
    if (!authStore.token) return
    const query = type ? `?type=${encodeURIComponent(type)}` : ''
    const res = await fetch(`${api.notifications.markAllRead}${query}`, {
      method: 'PUT',
      headers: authHeaders(),
    })
    if (!res.ok) return
    const unreadMarkedRead = notifications.value.filter((item) => !item.read_at && (!type || item.type === type)).length
    const data = await res.json().catch(() => null)
    const nextUnreadCount = data?.unread_total ?? data?.unread_count ?? data?.count
    const readAt = new Date().toISOString()
    notifications.value = notifications.value.map((item) =>
      !type || item.type === type ? { ...item, read_at: item.read_at || readAt } : item,
    )
    unreadCount.value = typeof nextUnreadCount === 'number'
      ? nextUnreadCount
      : Math.max(0, unreadCount.value - unreadMarkedRead)
  }

  const receiveNotification = (notification: Notification) => {
    const existingIndex = notifications.value.findIndex((item) =>
      item.id === notification.id
      || Boolean(notification.aggregation_key && !item.read_at && item.aggregation_key === notification.aggregation_key),
    )
    const existing = existingIndex >= 0 ? notifications.value[existingIndex] : undefined
    if (!notification.read_at && (!existing || Boolean(existing.read_at))) unreadCount.value += 1

    if (existingIndex >= 0) {
      notifications.value.splice(existingIndex, 1, notification)
      return
    }
    if (!currentType.value || currentType.value === notification.type) {
      notifications.value.unshift(notification)
      total.value += 1
    }
  }

  return {
    unreadCount,
    notifications,
    loading,
    total,
    page,
    currentType,
    fetchUnreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    receiveNotification,
  }
})
