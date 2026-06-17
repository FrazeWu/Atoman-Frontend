import { ref } from 'vue'
import { defineStore } from 'pinia'

import { useApi } from '@/composables/useApi'

export interface AdminFeedFulltextHealth {
  enabled_sources: number
  disabled_sources: number
  pending_items: number
  fetching_items: number
  retry_items: number
  success_items: number
  failed_items: number
  success_rate: number
  enabled: boolean
  concurrency: number
  timeout_seconds: number
  max_attempts: number
  latest_success_at?: string
  latest_failure_at?: string
  oldest_pending_at?: string
}

export interface AdminFeedFulltextSettings {
  auto_sync_enabled: boolean
  auto_sync_interval_minutes: number
}

export interface AdminFeedOPMLImportResult {
  message: string
  imported: number
  reused: number
  failed: number
}

export interface AdminFeedFulltextSourceRow {
  id: string
  title: string
  rss_url: string
  full_text_enabled: boolean
  success_count: number
  retry_count: number
  failed_count: number
  pending_count: number
  success_rate: number
  status: 'healthy' | 'degraded' | 'failing' | 'disabled'
  last_success_at?: string
  last_failure_at?: string
  last_error_code?: string
  last_error?: string
  last_sync_status?: 'success' | 'failed' | 'idle'
  last_sync_error?: string
  last_sync_failed_at?: string
  consecutive_sync_failures?: number
}

export type AdminFeedFulltextItemStatus = 'pending' | 'fetching' | 'retry' | 'success' | 'failed'

export interface AdminFeedFulltextItemRow {
  id: string
  title: string
  link: string
  source_id: string
  source_title: string
  full_text_status: AdminFeedFulltextItemStatus
  attempt_count: number
  error_code?: string
  error_message?: string
  last_attempt_at?: string
  next_attempt_at?: string
  published_at: string
}

interface AdminListMeta {
  total: number
  page: number
  limit: number
}

interface FetchSourcesOptions {
  enabled?: boolean
  status?: string
  q?: string
  page?: number
  limit?: number
}

interface FetchItemsOptions {
  status?: AdminFeedFulltextItemStatus
  errorCode?: string
  sourceId?: string
  q?: string
  page?: number
  limit?: number
}

interface AdminFeedSourcePayload {
  title: string
  rss_url: string
}

function buildHeaders(token: string | null, withJson = false): HeadersInit {
  return {
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({} as Record<string, unknown>))
  return typeof data.error === 'string' ? data.error : fallback
}

export const useAdminFeedFulltextStore = defineStore('adminFeedFulltext', () => {
  const api = useApi()

  const health = ref<AdminFeedFulltextHealth | null>(null)
  const settings = ref<AdminFeedFulltextSettings | null>(null)
  const sources = ref<AdminFeedFulltextSourceRow[]>([])
  const items = ref<AdminFeedFulltextItemRow[]>([])
  const sourcesMeta = ref<AdminListMeta>({ total: 0, page: 1, limit: 20 })
  const itemsMeta = ref<AdminListMeta>({ total: 0, page: 1, limit: 20 })
  const loadingHealth = ref(false)
  const loadingSources = ref(false)
  const loadingItems = ref(false)
  const loadingSettings = ref(false)

  async function fetchHealth(token: string | null) {
    loadingHealth.value = true
    try {
      const response = await fetch(api.admin.feedFulltext.health, {
        headers: buildHeaders(token),
      })
      if (!response.ok) {
        throw new Error(await parseError(response, '加载概览失败'))
      }
      health.value = await response.json()
      return health.value
    } finally {
      loadingHealth.value = false
    }
  }

  async function fetchSettings(token: string | null) {
    loadingSettings.value = true
    try {
      const response = await fetch(api.admin.feedFulltext.settings, {
        headers: buildHeaders(token),
      })
      if (!response.ok) {
        throw new Error(await parseError(response, '加载抓取设置失败'))
      }
      settings.value = await response.json()
      return settings.value
    } finally {
      loadingSettings.value = false
    }
  }

  async function fetchSources(token: string | null, options: FetchSourcesOptions = {}) {
    loadingSources.value = true
    try {
      const query = new URLSearchParams({
        page: String(options.page ?? 1),
        limit: String(options.limit ?? 20),
        sort: 'pending_count',
      })
      if (typeof options.enabled === 'boolean') query.set('enabled', String(options.enabled))
      if (options.status) query.set('status', options.status)
      if (options.q) query.set('q', options.q)
      const response = await fetch(`${api.admin.feedFulltext.sources}?${query.toString()}`, {
        headers: buildHeaders(token),
      })
      if (!response.ok) {
        throw new Error(await parseError(response, '加载订阅源失败'))
      }
      const payload = await response.json()
      sources.value = payload.data || []
      sourcesMeta.value = payload.meta || sourcesMeta.value
      return sources.value
    } finally {
      loadingSources.value = false
    }
  }

  async function fetchItems(token: string | null, options: FetchItemsOptions = {}) {
    loadingItems.value = true
    try {
      const query = new URLSearchParams({
        page: String(options.page ?? 1),
        limit: String(options.limit ?? 20),
        sort: 'last_attempt_at',
      })
      if (options.status) query.set('status', options.status)
      if (options.errorCode) query.set('error_code', options.errorCode)
      if (options.sourceId) query.set('source_id', options.sourceId)
      if (options.q) query.set('q', options.q)

      const response = await fetch(`${api.admin.feedFulltext.items}?${query.toString()}`, {
        headers: buildHeaders(token),
      })
      if (!response.ok) {
        throw new Error(await parseError(response, '加载条目失败'))
      }
      const payload = await response.json()
      items.value = payload.data || []
      itemsMeta.value = payload.meta || itemsMeta.value
      return items.value
    } finally {
      loadingItems.value = false
    }
  }

  async function updateSourceEnabled(sourceId: string, enabled: boolean, token: string | null) {
    const response = await fetch(api.admin.feedFulltext.sourceSettings(sourceId), {
      method: 'PUT',
      headers: buildHeaders(token, true),
      body: JSON.stringify({ full_text_enabled: enabled }),
    })

    if (!response.ok) {
      throw new Error(await parseError(response, '更新订阅源失败'))
    }

    const payload = await response.json()
    const row = sources.value.find((source) => source.id === sourceId)
    if (row) {
      row.full_text_enabled = Boolean(payload.full_text_enabled)
      row.status = row.full_text_enabled ? (row.status === 'disabled' ? 'healthy' : row.status) : 'disabled'
    }
    return payload
  }

  async function createSource(payload: AdminFeedSourcePayload, token: string | null) {
    const response = await fetch(api.admin.feedFulltext.sources, {
      method: 'POST',
      headers: buildHeaders(token, true),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(await parseError(response, '新增订阅源失败'))
    }

    return response.json()
  }

  async function updateSource(sourceId: string, payload: AdminFeedSourcePayload, token: string | null) {
    const response = await fetch(api.admin.feedFulltext.source(sourceId), {
      method: 'PUT',
      headers: buildHeaders(token, true),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(await parseError(response, '更新订阅源失败'))
    }

    return response.json()
  }

  async function importGlobalOPML(file: File, token: string | null): Promise<AdminFeedOPMLImportResult> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(api.admin.feed.opmlImport, {
      method: 'POST',
      headers: buildHeaders(token),
      body: formData,
    })

    if (!response.ok) {
      throw new Error(await parseError(response, '导入 OPML 失败'))
    }

    return response.json()
  }

  async function exportGlobalOPML(token: string | null): Promise<Blob> {
    const response = await fetch(api.admin.feed.opmlExport, {
      headers: buildHeaders(token),
    })

    if (!response.ok) {
      throw new Error(await parseError(response, '导出 OPML 失败'))
    }

    return response.blob()
  }

  async function syncSource(sourceId: string, token: string | null) {
    const response = await fetch(api.admin.feedFulltext.syncSource(sourceId), {
      method: 'POST',
      headers: buildHeaders(token),
    })

    if (!response.ok) {
      throw new Error(await parseError(response, '手工爬取失败'))
    }

    return response.json()
  }

  async function retryItem(itemId: string, token: string | null) {
    const response = await fetch(api.admin.feedFulltext.retryItem(itemId), {
      method: 'POST',
      headers: buildHeaders(token),
    })

    if (!response.ok) {
      throw new Error(await parseError(response, '重试条目失败'))
    }

    const payload = await response.json()
    const row = items.value.find((item) => item.id === itemId)
    if (row) {
      row.full_text_status = payload.full_text_status
      row.next_attempt_at = undefined
    }
    return payload
  }

  async function updateSettings(nextSettings: AdminFeedFulltextSettings, token: string | null) {
    const response = await fetch(api.admin.feedFulltext.settings, {
      method: 'PUT',
      headers: buildHeaders(token, true),
      body: JSON.stringify(nextSettings),
    })

    if (!response.ok) {
      throw new Error(await parseError(response, '更新抓取设置失败'))
    }

    settings.value = await response.json()
    return settings.value
  }

  return {
    health,
    settings,
    sources,
    items,
    sourcesMeta,
    itemsMeta,
    loadingHealth,
    loadingSources,
    loadingItems,
    loadingSettings,
    fetchHealth,
    fetchSettings,
    fetchSources,
    fetchItems,
    createSource,
    updateSource,
    importGlobalOPML,
    exportGlobalOPML,
    syncSource,
    updateSourceEnabled,
    retryItem,
    updateSettings,
  }
})
