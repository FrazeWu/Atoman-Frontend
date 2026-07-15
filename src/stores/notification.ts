import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { Notification, NotificationFilterType } from '@/types'
import type { RouteLocationRaw } from 'vue-router'
import { modulePathUrl } from '@/router/siteUrls'

const commentNotificationTypes = new Set<Notification['type']>([
  'comment_reply', 'comment_mention', 'comment_marked', 'comment_like',
])

const sortNotifications = (items: Notification[]) => [...items].sort((left, right) =>
  right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id),
)

export function isCommentNotification(notification: Notification) {
  return commentNotificationTypes.has(notification.type)
}

export function commentNotificationLocation(notification: Notification): RouteLocationRaw | null {
  const { target_kind: kind, resource_id: id, comment_id: commentId, root_id: rootId } = notification.meta
  if (!kind || !id || !rootId) return null
  const paths: Partial<Record<NonNullable<typeof kind>, string>> = {
    blog_post: modulePathUrl('blog', `/post/${id}`),
    video: modulePathUrl('video', `/videos/watch/${id}`),
    podcast_episode: modulePathUrl('podcast', `/episode/${id}`),
    feed_article: modulePathUrl('feed', `/item/${id}`),
    music_artist: modulePathUrl('music', `/artist/${id}`),
    music_album: modulePathUrl('music', `/album/${id}`),
    forum_topic: modulePathUrl('forum', `/topic/${id}`),
    debate: modulePathUrl('debate', `/${id}`),
    timeline_person: modulePathUrl('timeline', `/person/${id}`),
    music_song: modulePathUrl('music', '/'),
    timeline_event: modulePathUrl('timeline', '/'),
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
  const currentTypes = ref<Notification['type'][]>([])

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

  type TypeSelection = NotificationFilterType | readonly Notification['type'][]

  const fetchNotifications = async (type: TypeSelection = currentType.value, nextPage = 1) => {
    if (!authStore.token) return
    loading.value = true
    try {
      const types = Array.isArray(type) ? [...type] : type ? [type] : []
      currentTypes.value = types
      currentType.value = Array.isArray(type) ? '' : type as NotificationFilterType
      page.value = nextPage
      const requestedTypes: NotificationFilterType[] = types.length ? types : ['']
      const responses = await Promise.all(requestedTypes.map(async (requestedType) => {
        const params = new URLSearchParams({ page: String(nextPage) })
        if (requestedType) params.set('type', requestedType)
        const res = await fetch(`${api.notifications.list}?${params.toString()}`, { headers: authHeaders() })
        if (!res.ok) throw new Error('获取通知失败')
        return res.json()
      }))
      notifications.value = sortNotifications(responses.flatMap((data) => data.data || []))
      total.value = responses.reduce((sum, data) => sum + (data.total || 0), 0)
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

  const markAllRead = async (type: TypeSelection = currentTypes.value.length ? currentTypes.value : currentType.value) => {
    if (!authStore.token) return
    const types = Array.isArray(type) ? [...type] : type ? [type] : []
    const responses = []
    for (const requestedType of types.length ? types : ['']) {
      const query = requestedType ? `?type=${encodeURIComponent(requestedType)}` : ''
      const res = await fetch(`${api.notifications.markAllRead}${query}`, { method: 'PUT', headers: authHeaders() })
      if (!res.ok) continue
      responses.push(await res.json().catch(() => null))
    }
    const selected = new Set(types)
    const unreadMarkedRead = notifications.value.filter((item) => !item.read_at && (!selected.size || selected.has(item.type))).length
    const data = responses.at(-1)
    const nextUnreadCount = data?.unread_total ?? data?.unread_count ?? data?.count
    const readAt = new Date().toISOString()
    notifications.value = notifications.value.map((item) =>
      !selected.size || selected.has(item.type) ? { ...item, read_at: item.read_at || readAt } : item,
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
      notifications.value = sortNotifications(notifications.value)
      return
    }
    if ((!currentType.value && !currentTypes.value.length) || currentType.value === notification.type || currentTypes.value.includes(notification.type)) {
      notifications.value.unshift(notification)
      notifications.value = sortNotifications(notifications.value)
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
