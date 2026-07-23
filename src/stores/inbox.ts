import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { useApi } from '@/composables/useApi'
import { normalizeDMRealtimeEvent } from '@/api/dm'

export const useInboxStore = defineStore('inbox', () => {
  const authStore = useAuthStore()
  const notificationStore = useNotificationStore()
  const api = useApi()

  const connected = ref(false)
  const polling = ref(false)
  const initialized = ref(false)
  let socket: WebSocket | null = null
  let pollingTimer: number | null = null

  const totalUnread = computed(() => notificationStore.unreadCount)

  const stopPolling = () => {
    if (pollingTimer) {
      window.clearInterval(pollingTimer)
      pollingTimer = null
    }
    polling.value = false
  }

  const startPolling = () => {
    if (pollingTimer || !authStore.isAuthenticated) return
    polling.value = true
    pollingTimer = window.setInterval(async () => {
      await notificationStore.fetchUnreadCounts()
    }, 60000)
  }

  const disconnect = () => {
    stopPolling()
    connected.value = false
    if (socket) {
      socket.close()
      socket = null
    }
  }

  const connect = async () => {
    if (!authStore.token || socket) return
    const apiBase = api.url.replace(/\/api\/v1$/, '')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = apiBase.startsWith('http')
      ? apiBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
      : `${protocol}//${window.location.host}`
    socket = new WebSocket(`${host}/ws/user`)

    socket.onopen = () => {
      connected.value = true
      stopPolling()
    }
    socket.onclose = () => {
      connected.value = false
      socket = null
      startPolling()
    }
    socket.onerror = () => {
      connected.value = false
      startPolling()
    }
    socket.onmessage = async (event) => {
      if (typeof event.data !== 'string') return
      let payload: unknown
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }
      if (!payload || typeof payload !== 'object') return
      const message = payload as { event?: unknown; data?: unknown }
      if (message.event === 'notification') {
        notificationStore.receiveNotification(message.data as never)
      }
      const dmEvent = normalizeDMRealtimeEvent(message)
      if (dmEvent) {
        const { useDMStore } = await import('@/stores/dm')
        const dmStore = useDMStore()
        dmStore.receiveEvent(dmEvent)
        if (dmEvent.event === 'dm.message.created' && dmStore.activeConversationId === dmEvent.data.conversation.id) {
          await dmStore.markRead()
        }
      }
    }
  }

  const bootstrap = async () => {
    if (!authStore.isAuthenticated) {
      disconnect()
      initialized.value = false
      return
    }
    await notificationStore.fetchUnreadCounts()
    await connect()
    initialized.value = true
  }

  return {
    connected,
    polling,
    initialized,
    totalUnread,
    bootstrap,
    connect,
    disconnect,
  }
})
