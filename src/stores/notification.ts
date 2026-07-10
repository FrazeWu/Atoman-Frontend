import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { InboxTab, Notification, NotificationCategory, NotificationPreference } from '@/types'

const notificationCategories: InboxTab[] = ['like', 'interaction', 'mention', 'reply', 'collaboration', 'system', 'dm']

const emptyUnreadCounts = (): Record<InboxTab, number> => ({
  like: 0,
  interaction: 0,
  mention: 0,
  reply: 0,
  collaboration: 0,
  system: 0,
  dm: 0,
})

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
    unreadCounts.value = { ...unreadCounts.value, ...(payload.items || {}) }
  }

  const fetchUnreadCount = fetchUnreadCounts

  const fetchNotifications = async (category: NotificationCategory = currentCategory.value as NotificationCategory, nextPage = 1) => {
    if (!authStore.token) return
    loading.value = true
    try {
      currentCategory.value = category
      page.value = nextPage
      const params = new URLSearchParams({ page: String(nextPage), category })
      const res = await fetch(`${api.notifications.list}?${params.toString()}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('获取通知失败')
      const data = await res.json()
      notifications.value = data.data || []
      total.value = data.meta?.total ?? data.total ?? 0
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

  const markAllRead = async (category: NotificationCategory = currentCategory.value as NotificationCategory) => {
    if (!authStore.token) return
    const res = await fetch(api.notifications.markCategoryRead(category), {
      method: 'PUT',
      headers: authHeaders(),
    })
    if (!res.ok) return
    const readAt = new Date().toISOString()
    notifications.value = notifications.value.map((item) =>
      item.category === category ? { ...item, read_at: item.read_at || readAt } : item,
    )
    unreadCounts.value[category] = 0
  }

  const receiveNotification = (notification: Notification) => {
    unreadCounts.value[notification.category] = (unreadCounts.value[notification.category] || 0) + 1
    if (currentCategory.value === notification.category) {
      notifications.value = [notification, ...notifications.value]
      total.value += 1
    }
  }

  const savePreference = async (category: NotificationCategory, eventType: string, enabled: boolean) => {
    if (!authStore.token) return
    const res = await fetch(api.notifications.preferences, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ items: [{ category, event_type: eventType, enabled }] }),
    })
    if (!res.ok) throw new Error('保存通知设置失败')
  }

  const savePreferences = async (items: NotificationPreference[]) => {
    if (!authStore.token) return
    const res = await fetch(api.notifications.preferences, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ items }),
    })
    if (!res.ok) throw new Error('保存通知设置失败')
  }

  const createMute = async (sourceType: string, sourceId: string, reason: string) => {
    if (!authStore.token) return
    const res = await fetch(api.notifications.mutes, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ source_type: sourceType, source_id: sourceId, reason }),
    })
    if (!res.ok) throw new Error('不再提醒失败')
    return await res.json()
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
  }
})
