import { ref, readonly } from 'vue'

const isOnlineRef = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const wasOfflineRef = ref(false)

const listeners = new Set<() => void>()

function handleOnline() {
  isOnlineRef.value = true
  if (wasOfflineRef.value) {
    wasOfflineRef.value = false
    listeners.forEach((cb) => {
      try {
        cb()
      } catch (e) {
        console.warn('[useNetworkResilience] error in recovery listener:', e)
      }
    })
  }
}

function handleOffline() {
  isOnlineRef.value = false
  wasOfflineRef.value = true
}

let isInitialized = false
function initGlobalNetworkListeners() {
  if (isInitialized || typeof window === 'undefined') return
  isInitialized = true
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  isOnlineRef.value = navigator.onLine
}

// 自动初始化全局单例监听
if (typeof window !== 'undefined') {
  initGlobalNetworkListeners()
}

/**
 * 注册网络从离线恢复到在线时的回调（如重试刷新数据、同步队列等）
 */
export function onNetworkRecover(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/**
 * 全局网络连接状态与弱网韧性 Composable
 */
export function useNetworkResilience() {
  initGlobalNetworkListeners()

  return {
    isOnline: readonly(isOnlineRef),
    wasOffline: readonly(wasOfflineRef),
    onNetworkRecover,
  }
}
