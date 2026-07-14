import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { Notification, NotificationFilterType } from '@/types'

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
    unreadCount.value = data.data?.count || 0
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
      total.value = data.meta?.total || 0
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
    const nextUnreadCount = data?.data?.unread_total ?? data?.data?.unread_count ?? data?.data?.count
    const readAt = new Date().toISOString()
    notifications.value = notifications.value.map((item) =>
      !type || item.type === type ? { ...item, read_at: item.read_at || readAt } : item,
    )
    unreadCount.value = typeof nextUnreadCount === 'number'
      ? nextUnreadCount
      : Math.max(0, unreadCount.value - unreadMarkedRead)
  }

  const receiveNotification = (notification: Notification) => {
    unreadCount.value += 1
    if (!currentType.value || currentType.value === notification.type) {
      notifications.value = [notification, ...notifications.value]
      total.value += 1
    }
  }

  const resetStore = () => {
    unreadCount.value = 0
    notifications.value = []
    loading.value = false
    total.value = 0
    page.value = 1
    currentType.value = ''
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
    resetStore,
  }
})
