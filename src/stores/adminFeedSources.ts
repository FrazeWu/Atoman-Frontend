import { ref } from 'vue'
import { defineStore } from 'pinia'

import { useApi } from '@/composables/useApi'
import type { AdminFeedSourceRow } from '@/types'

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

export const useAdminFeedSourcesStore = defineStore('adminFeedSources', () => {
  const api = useApi()

  const sources = ref<AdminFeedSourceRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSources(token: string | null) {
    if (!token) {
      sources.value = []
      error.value = '缺少登录凭证'
      return []
    }

    loading.value = true
    error.value = null
    try {
      const response = await fetch(api.admin.feed.sources, {
        headers: buildHeaders(token),
      })
      if (!response.ok) {
        throw new Error(await parseError(response, '加载来源失败'))
      }
      const data = await response.json()
      sources.value = data.items || data.data || []
      return sources.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载来源失败'
      return []
    } finally {
      loading.value = false
    }
  }

  async function updateSource(sourceId: string, payload: Partial<AdminFeedSourceRow>, token: string | null) {
    if (!token) {
      error.value = '缺少登录凭证'
      return false
    }

    error.value = null
    const response = await fetch(api.admin.feed.source(sourceId), {
      method: 'PATCH',
      headers: buildHeaders(token, true),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      error.value = await parseError(response, '更新来源失败')
      return false
    }

    return true
  }

  async function deleteSource(sourceId: string, token: string | null) {
    if (!token) {
      error.value = '缺少登录凭证'
      return false
    }

    error.value = null
    const response = await fetch(api.admin.feed.source(sourceId), {
      method: 'DELETE',
      headers: buildHeaders(token),
    })

    if (!response.ok) {
      error.value = await parseError(response, '删除来源失败')
      return false
    }

    return true
  }

  return {
    sources,
    loading,
    error,
    fetchSources,
    updateSource,
    deleteSource,
  }
})
