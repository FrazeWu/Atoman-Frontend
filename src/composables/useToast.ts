import { readonly, ref } from 'vue'

export type ToastType = 'success' | 'warning' | 'danger' | 'error' | 'info'

export interface ToastOptions {
  id?: string
  message: string
  title?: string
  type?: ToastType
  duration?: number
}

export interface ToastItem {
  id: string
  message: string
  title: string
  type: ToastType
  duration: number
  createdAt: number
}

interface ToastTimerRecord {
  timeoutId: number | null
  remaining: number
  startedAt: number
  duration: number
}

const MAX_TOASTS = 3
const DEFAULT_DURATION = 1800

const activeToasts = ref<ToastItem[]>([])
const timerMap = new Map<string, ToastTimerRecord>()

let counter = 0

function clearToastTimer(id: string) {
  const record = timerMap.get(id)
  if (record?.timeoutId !== null && record?.timeoutId !== undefined) {
    clearTimeout(record.timeoutId)
  }
  timerMap.delete(id)
}

function startToastTimer(id: string, duration: number) {
  if (duration <= 0) return

  clearToastTimer(id)

  const startedAt = Date.now()
  const timeoutId = window.setTimeout(() => {
    dismissToast(id)
  }, duration)

  timerMap.set(id, {
    timeoutId,
    remaining: duration,
    startedAt,
    duration,
  })
}

function dismissToast(id: string) {
  clearToastTimer(id)
  const index = activeToasts.value.findIndex((t) => t.id === id)
  if (index !== -1) {
    activeToasts.value.splice(index, 1)
  }
}

function clearAllToasts() {
  timerMap.forEach((record) => {
    if (record.timeoutId !== null) clearTimeout(record.timeoutId)
  })
  timerMap.clear()
  activeToasts.value = []
}

function pauseToast(id: string) {
  const record = timerMap.get(id)
  if (!record || record.timeoutId === null) return

  clearTimeout(record.timeoutId)
  const elapsed = Date.now() - record.startedAt
  const remaining = Math.max(0, record.remaining - elapsed)

  timerMap.set(id, {
    ...record,
    timeoutId: null,
    remaining,
  })
}

function resumeToast(id: string) {
  const record = timerMap.get(id)
  if (!record || record.timeoutId !== null) return
  if (record.remaining <= 0) {
    dismissToast(id)
    return
  }

  const startedAt = Date.now()
  const timeoutId = window.setTimeout(() => {
    dismissToast(id)
  }, record.remaining)

  timerMap.set(id, {
    ...record,
    timeoutId,
    startedAt,
  })
}

function showToast(options: ToastOptions | string): string {
  const normalized: ToastOptions = typeof options === 'string' ? { message: options } : options
  const id = normalized.id || `toast-${Date.now()}-${++counter}`
  const duration = normalized.duration !== undefined ? normalized.duration : DEFAULT_DURATION
  const type: ToastType = normalized.type || 'info'
  const title = normalized.title || ''

  const item: ToastItem = {
    id,
    message: normalized.message,
    title,
    type,
    duration,
    createdAt: Date.now(),
  }

  // FIFO 队列挤出最早的一条
  if (activeToasts.value.length >= MAX_TOASTS) {
    const oldest = activeToasts.value[0]
    dismissToast(oldest.id)
  }

  activeToasts.value.push(item)
  startToastTimer(id, duration)

  return id
}

export function useToast() {
  return {
    show: showToast,
    success: (message: string, options?: Partial<ToastOptions>) =>
      showToast({ ...options, message, type: 'success' }),
    error: (message: string, options?: Partial<ToastOptions>) =>
      showToast({ ...options, message, type: 'error' }),
    warning: (message: string, options?: Partial<ToastOptions>) =>
      showToast({ ...options, message, type: 'warning' }),
    info: (message: string, options?: Partial<ToastOptions>) =>
      showToast({ ...options, message, type: 'info' }),
    dismiss: dismissToast,
    clear: clearAllToasts,
    pause: pauseToast,
    resume: resumeToast,
    toasts: readonly(activeToasts),
  }
}
