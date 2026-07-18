import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { InboxTab, Notification, NotificationCategory, NotificationPreference } from '@/types'
import type { RouteLocationRaw } from 'vue-router'
import { modulePathUrl } from '@/router/siteUrls'

const notificationCategories: InboxTab[] = ['like', 'interaction', 'mention', 'reply', 'collaboration', 'system', 'dm']
const commentNotificationTypes = new Set<Notification['type']>([
  'comment_reply', 'comment_mention', 'comment_marked', 'comment_like', 'forum_topic_comment',
])
type NotificationSelection = NotificationCategory | readonly Notification['type'][]

function isTypeSelection(selection: NotificationSelection): selection is readonly Notification['type'][] {
  return Array.isArray(selection)
}

const emptyUnreadCounts = (): Record<InboxTab, number> => ({
  like: 0,
  interaction: 0,
  mention: 0,
  reply: 0,
  collaboration: 0,
  system: 0,
  dm: 0,
})

export function forumNotificationLocation(notification: Notification): RouteLocationRaw | null {
  const topicId = notification.meta.topic_id
  if (!topicId) return null
  return { path: modulePathUrl('forum', `/topic/${topicId}`) }
}

export function contentPublishedLocation(notification: Notification): RouteLocationRaw | null {
  if (notification.type !== 'content_published') return null
  const path = notification.meta.path
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null
  return { path, query: { source: 'notification' } }
}

export function isCommentNotification(notification: Notification) {
  return commentNotificationTypes.has(notification.type)
}

export function commentNotificationLocation(notification: Notification): RouteLocationRaw | null {
  const { target_kind: kind, resource_id: id, comment_id: commentId, root_id: rootId } = notification.meta
  if (!kind || !id || !rootId) return null
  const paths: Record<string, string> = {
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

  const unreadCounts = ref<Record<InboxTab, number>>(emptyUnreadCounts())
  const unreadCount = computed(() => notificationCategories.reduce((sum, key) => sum + (unreadCounts.value[key] || 0), 0))
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const currentCategory = ref<InboxTab>('mention')
  const currentType = currentCategory
  const currentTypes = ref<Notification['type'][]>([])

  const authHeaders = () => ({
    Authorization: `Bearer ${authStore.token}`,
    'Content-Type': 'application/json',
  })

  const fetchUnreadCounts = async () => {
    if (!authStore.token) return
    const res = await fetch(api.notifications.unreadCounts, { headers: authHeaders() })
    if (!res.ok) return
    const data = await res.json()
    const payload = data.data || data
    unreadCounts.value = { ...emptyUnreadCounts(), ...(payload.items || {}) }
  }

  const fetchUnreadCount = fetchUnreadCounts

  const fetchNotifications = async (selection: NotificationSelection = currentCategory.value as NotificationCategory, nextPage = 1) => {
    if (!authStore.token) return
    loading.value = true
    try {
      page.value = nextPage
      if (isTypeSelection(selection)) {
        currentTypes.value = [...selection]
        const responses = await Promise.all(selection.map(async (type) => {
          const params = new URLSearchParams({ page: String(nextPage), type })
          const res = await fetch(`${api.notifications.list}?${params.toString()}`, { headers: authHeaders() })
          if (!res.ok) throw new Error('获取通知失败')
          return res.json()
        }))
        notifications.value = responses.flatMap((data) => data.data || [])
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
        total.value = responses.reduce((sum, data) => sum + (data.meta?.total ?? data.total ?? 0), 0)
      } else {
        currentTypes.value = []
        currentCategory.value = selection
        const params = new URLSearchParams({ page: String(nextPage), category: selection })
        const res = await fetch(`${api.notifications.list}?${params.toString()}`, { headers: authHeaders() })
        if (!res.ok) throw new Error('获取通知失败')
        const data = await res.json()
        notifications.value = data.data || []
        total.value = data.meta?.total ?? data.total ?? 0
      }
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
      unreadCounts.value[target.category] = Math.max(0, (unreadCounts.value[target.category] || 0) - 1)
    }
  }

  const markAllRead = async (selection: NotificationSelection = currentTypes.value.length ? currentTypes.value : currentCategory.value as NotificationCategory) => {
    if (!authStore.token) return
    if (isTypeSelection(selection)) {
      await Promise.all(selection.map((type) => fetch(`${api.notifications.markAllRead}?type=${encodeURIComponent(type)}`, {
        method: 'PUT', headers: authHeaders(),
      })))
    } else {
      const res = await fetch(`${api.notifications.markAllRead}?type=${encodeURIComponent(selection)}`, {
        method: 'PUT',
        headers: authHeaders(),
      })
      if (!res.ok) return
    }
    const readAt = new Date().toISOString()
    const matches = (item: Notification) => isTypeSelection(selection) ? selection.includes(item.type) : item.category === selection
    notifications.value = notifications.value.map((item) =>
      matches(item) ? { ...item, read_at: item.read_at || readAt } : item,
    )
    if (!isTypeSelection(selection)) unreadCounts.value[selection] = 0
  }

  const receiveNotification = (notification: Notification) => {
    unreadCounts.value[notification.category] = (unreadCounts.value[notification.category] || 0) + 1
    if (currentTypes.value.includes(notification.type) || (!currentTypes.value.length && currentCategory.value === notification.category)) {
      notifications.value = [notification, ...notifications.value]
      total.value += 1
    }
  }

  const savePreference = async (category: NotificationCategory, eventType: string, enabled: boolean) => {
    void category
    void eventType
    void enabled
    return false
  }

  const savePreferences = async (items: NotificationPreference[]) => {
    void items
    return false
  }

  const createMute = async (sourceType: string, sourceId: string, reason: string) => {
    void sourceType
    void sourceId
    void reason
    return false
  }

  const resetStore = () => {
    unreadCounts.value = emptyUnreadCounts()
    notifications.value = []
    loading.value = false
    total.value = 0
    page.value = 1
    currentCategory.value = 'mention'
    currentTypes.value = []
  }

  return {
    unreadCount,
    unreadCounts,
    notifications,
    loading,
    total,
    page,
    currentCategory,
    currentType,
    fetchUnreadCounts,
    fetchUnreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    receiveNotification,
    savePreference,
    savePreferences,
    createMute,
    resetStore,
  }
})
