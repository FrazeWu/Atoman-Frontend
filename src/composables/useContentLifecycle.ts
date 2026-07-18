import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { StudioModule } from '@/types'

export type ContentLifecycleEvent = 'impression' | 'open' | 'engaged' | 'complete' | 'like' | 'comment' | 'bookmark' | 'share' | 'follow'

export interface ContentEventInput {
  module: StudioModule
  content_id: string
  event: ContentLifecycleEvent
  source?: string
  session_id?: string
  client_event_id?: string
  position_sec?: number
  duration_sec?: number
  progress?: number
}

export interface ContentProgressInput {
  module: StudioModule
  content_id: string
  position_sec: number
  duration_sec: number
  progress: number
  completed: boolean
  source?: string
}

export interface ContentProgress extends ContentProgressInput {
  id?: string
  updated_at?: string
}

export interface ContinueContentItem {
  content_id: string
  module: StudioModule
  title: string
  path: string
  cover_url: string
  position_sec: number
  duration_sec: number
  progress: number
  updated_at: string
}

export interface ScheduledContent {
  module?: StudioModule
  content_id?: string
  status: string
  publish_at?: string
}

export interface ContentNotificationPreference {
  id?: string
  source_type: 'internal_user' | 'internal_channel'
  source_id: string
  mode: 'feed_only' | 'all' | 'daily'
}

type ClientOptions = {
  baseUrl: string
  token: () => string | null | undefined
}

type ConsumptionTrackerOptions = {
  onEvent: (event: 'open' | 'engaged' | 'complete') => void
  onProgress: (progress: number) => void
  now?: () => number
  progressIntervalMs?: number
}

export function createContentConsumptionTracker(options: ConsumptionTrackerOptions) {
  const now = options.now || Date.now
  const interval = options.progressIntervalMs ?? 10_000
  let opened = false
  let engaged = false
  let completed = false
  let lastProgressAt = Number.NEGATIVE_INFINITY

  const emit = (event: 'open' | 'engaged' | 'complete') => options.onEvent(event)
  return {
    open() {
      if (opened) return
      opened = true
      emit('open')
    },
    update(rawProgress: number) {
      const progress = Math.max(0, Math.min(1, rawProgress))
      if (!engaged && progress >= 0.1) {
        engaged = true
        emit('engaged')
      }
      if (!completed && progress >= 0.95) {
        completed = true
        emit('complete')
      }
      const timestamp = now()
      if (timestamp - lastProgressAt < interval || progress <= 0) return
      lastProgressAt = timestamp
      options.onProgress(progress)
    },
  }
}

function eventID() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function request<T>(url: string, token: string | null | undefined, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || body?.error || '请求失败')
  return (body?.data ?? body) as T
}

export function createContentLifecycleClient(options: ClientOptions) {
  const auth = () => options.token()
  return {
    recordEvent(input: ContentEventInput) {
      return request<{ recorded: boolean }>(`${options.baseUrl}/events`, auth(), {
        method: 'POST', body: JSON.stringify({ ...input, client_event_id: input.client_event_id || eventID() }),
      })
    },
    saveProgress(input: ContentProgressInput) {
      return request<ContentProgress>(`${options.baseUrl}/progress`, auth(), { method: 'PUT', body: JSON.stringify(input) })
    },
    getProgress(module: StudioModule, contentID: string) {
      return request<ContentProgress | null>(`${options.baseUrl}/progress/${module}/${contentID}`, auth())
    },
    listContinue(module: StudioModule, limit = 12) {
      const query = new URLSearchParams({ module, limit: String(limit) })
      return request<ContinueContentItem[]>(`${options.baseUrl}/continue?${query}`, auth())
    },
    schedule(module: StudioModule, contentID: string, publishAt: string) {
      return request<ScheduledContent>(`${options.baseUrl}/${module}/${contentID}/schedule`, auth(), {
        method: 'POST', body: JSON.stringify({ publish_at: publishAt }),
      })
    },
    cancelSchedule(module: StudioModule, contentID: string) {
      return request<{ cancelled: boolean }>(`${options.baseUrl}/${module}/${contentID}/schedule`, auth(), { method: 'DELETE' })
    },
    listNotificationPreferences() {
      return request<ContentNotificationPreference[]>(`${options.baseUrl}/notification-preferences`, auth())
    },
    saveNotificationPreference(input: ContentNotificationPreference) {
      return request<ContentNotificationPreference>(`${options.baseUrl}/notification-preferences`, auth(), {
        method: 'PUT', body: JSON.stringify(input),
      })
    },
  }
}

export function useContentLifecycle() {
  const api = useApi()
  const auth = useAuthStore()
  return createContentLifecycleClient({ baseUrl: `${api.url}/content`, token: () => auth.token })
}
