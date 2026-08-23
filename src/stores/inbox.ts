import { computed, onScopeDispose, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { useWebSocketUrl } from '@/composables/useApi'
import { normalizeDMRealtimeEvent } from '@/api/dm'
import { useDMStore } from '@/stores/dm'
import { registerSessionReset } from '@/stores/sessionReset'

export const useInboxStore = defineStore('inbox', () => {
  const pinia = getActivePinia()
  if (!pinia) throw new Error('收件箱状态必须在 Pinia 实例中创建')
  const authStore = useAuthStore()
  const notificationStore = useNotificationStore()
  const connected = ref(false)
  const polling = ref(false)
  const initialized = ref(false)
  let socket: WebSocket | null = null
  let pollingTimer: number | null = null
  let reconnectTimer: number | null = null
  let reconnectAttempt = 0
  let disconnecting = false
  let lifecycleGeneration = 0

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
      await useDMStore().reconcileFromServer()
    }, 60000)
  }

  const scheduleReconnect = (generation: number) => {
    if (generation !== lifecycleGeneration || disconnecting || reconnectTimer || !authStore.isAuthenticated) return
    const delay = [1000, 2000, 4000, 8000, 16000, 30000][Math.min(reconnectAttempt, 5)]
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      if (generation !== lifecycleGeneration || disconnecting || !authStore.isAuthenticated) return
      reconnectAttempt += 1
      void connect()
    }, delay)
  }

  const disconnect = () => {
    lifecycleGeneration += 1
    disconnecting = true
    stopPolling()
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    connected.value = false
    if (socket) {
      const activeSocket = socket
      socket = null
      activeSocket.onopen = null
      activeSocket.onclose = null
      activeSocket.onerror = null
      activeSocket.onmessage = null
      activeSocket.close()
    }
  }
  const resetStore = () => {
    disconnect()
    initialized.value = false
    reconnectAttempt = 0
  }
  onScopeDispose(registerSessionReset(pinia, resetStore))

  const connect = async () => {
    if (!authStore.token || socket) return
    disconnecting = false
    const generation = lifecycleGeneration
    const activeSocket = new WebSocket(useWebSocketUrl('/ws/user'))
    socket = activeSocket

    activeSocket.onopen = () => {
      if (generation !== lifecycleGeneration || socket !== activeSocket || disconnecting) return
      connected.value = true
      reconnectAttempt = 0
      stopPolling()
      void (async () => {
        if (generation !== lifecycleGeneration || socket !== activeSocket || disconnecting) return
        await Promise.all([useDMStore().reconcileFromServer(), notificationStore.fetchUnreadCounts()])
      })().catch(() => {
        if (generation === lifecycleGeneration && socket === activeSocket && !disconnecting) startPolling()
      })
    }
    activeSocket.onclose = () => {
      if (generation !== lifecycleGeneration || socket !== activeSocket || disconnecting) return
      connected.value = false
      socket = null
      startPolling()
      scheduleReconnect(generation)
    }
    activeSocket.onerror = () => {
      if (generation !== lifecycleGeneration || socket !== activeSocket || disconnecting) return
      connected.value = false
      const failedSocket = activeSocket
      socket = null
      failedSocket?.close()
      startPolling()
      scheduleReconnect(generation)
    }
    activeSocket.onmessage = async (event) => {
      if (generation !== lifecycleGeneration || socket !== activeSocket || disconnecting) return
      if (typeof event.data !== 'string') return
      let payload: unknown
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }
      if (!payload || typeof payload !== 'object') return
      if (generation !== lifecycleGeneration || socket !== activeSocket || disconnecting) return
      const message = payload as { event?: unknown; data?: unknown }
      if (message.event === 'notification') {
        notificationStore.receiveNotification(message.data as never)
      }
      const dmEvent = normalizeDMRealtimeEvent(message)
      if (dmEvent) {
        if (generation !== lifecycleGeneration || socket !== activeSocket || disconnecting) return
        const dmStore = useDMStore()
        dmStore.receiveEvent(dmEvent)
        notificationStore.setDMUnread(dmEvent.data.dm_unread)
        if (dmEvent.event === 'dm.message.created' && dmStore.activeConversationId === dmEvent.data.conversation.id) {
          await dmStore.markRead()
        }
      }
    }
  }

  const bootstrap = async () => {
    const generation = lifecycleGeneration
    if (!authStore.isAuthenticated) {
      disconnect()
      initialized.value = false
      return
    }
    await notificationStore.fetchUnreadCounts()
    if (generation !== lifecycleGeneration || !authStore.isAuthenticated) return
    await connect()
    if (generation !== lifecycleGeneration || !authStore.isAuthenticated) return
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
