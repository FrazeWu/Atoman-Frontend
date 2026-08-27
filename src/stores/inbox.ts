import { computed, onScopeDispose, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { useWebSocketUrl } from '@/composables/useApi'
import { normalizeDMRealtimeEvent, mailboxKey } from '@/api/dm'
import type { InboxTab, Notification } from '@/types'
import { useDMStore } from '@/stores/dm'
import { registerSessionReset } from '@/stores/sessionReset'

export type InboxToastItem = {
  id: string
  kind: 'notification' | 'dm'
  category: InboxTab
  title: string
  body: string
  href: string
  isAnnouncement: boolean
}

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
  const toastItems = ref<InboxToastItem[]>([])
  let toastSequence = 0

  const dismissToast = (id: string) => {
    toastItems.value = toastItems.value.filter((item) => item.id !== id)
  }

  const queueToast = (item: Omit<InboxToastItem, 'id'>) => {
    toastSequence += 1
    toastItems.value = [{ ...item, id: `${item.kind}-${toastSequence}` }, ...toastItems.value].slice(0, 3)
  }

  const notificationToastTitle = (notification: Notification) => {
    if (typeof notification.meta.title === 'string' && notification.meta.title) return notification.meta.title
    if (notification.type === 'site_announcement') return '站点公告'
    const actor = notification.actor?.display_name || notification.actor?.username || '有人'
    if (notification.type.includes('reply')) return `${actor} 回复了你`
    if (notification.type.includes('mention')) return `${actor} 提到了你`
    if (notification.type.includes('like')) return `${actor} 赞了你`
    return '新通知'
  }

  const queueNotificationToast = (notification: Notification) => {
    queueToast({
      kind: 'notification',
      category: notification.category,
      title: notificationToastTitle(notification),
      body: typeof notification.meta.body === 'string'
        ? notification.meta.body
        : notification.reason || (typeof notification.meta.reply_excerpt === 'string' ? notification.meta.reply_excerpt : '点击查看详情'),
      href: `/inbox?tab=${encodeURIComponent(notification.category)}`,
      isAnnouncement: notification.type === 'site_announcement',
    })
  }

  const queueDMToast = (event: ReturnType<typeof normalizeDMRealtimeEvent>) => {
    if (!event || event.event !== 'dm.message.created') return
    const { message, conversation, mailbox } = event.data
    queueToast({
      kind: 'dm',
      category: 'dm',
      title: `${message.sender.display_name || conversation.other_party.display_name} 发来新消息`,
      body: message.content || '发送了一张图片',
      href: `/inbox?tab=dm&mailbox=${encodeURIComponent(mailboxKey(mailbox))}&conversation=${encodeURIComponent(conversation.id)}`,
      isAnnouncement: false,
    })
  }

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
    toastItems.value = []
    toastSequence = 0
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
        const notification = message.data as Notification
        notificationStore.receiveNotification(notification)
        queueNotificationToast(notification)
      }
      const dmEvent = normalizeDMRealtimeEvent(message)
      if (dmEvent) {
        if (generation !== lifecycleGeneration || socket !== activeSocket || disconnecting) return
        const dmStore = useDMStore()
        const isActiveConversation = dmEvent.event === 'dm.message.created'
          && dmStore.activeConversationId === dmEvent.data.message.conversation_id
        dmStore.receiveEvent(dmEvent)
        notificationStore.setDMUnread(dmEvent.data.dm_unread)
        if (dmEvent.event === 'dm.message.created' && !isActiveConversation && dmEvent.data.message.sender.id !== authStore.user?.uuid) {
          queueDMToast(dmEvent)
        }
        if (dmEvent.event === 'dm.message.created' && isActiveConversation) {
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
    toastItems,
    bootstrap,
    connect,
    disconnect,
    dismissToast,
  }
})
