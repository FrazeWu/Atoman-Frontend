import { ref, type Ref } from 'vue'
import { apiRequest, apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type {
  AutoAddSubscriptionPayload,
  FeedDiscoveryCandidate,
  FeedSourceProvider,
  ResolvedSubscriptionInput,
  Subscription,
} from '@/types'
import { reportError } from '@/utils/logger'

const api = useApi()

const apiErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') return fallback
  const errorPayload = (payload as { error?: unknown }).error
  if (typeof errorPayload === 'string' && errorPayload.trim()) return errorPayload
  if (errorPayload && typeof errorPayload === 'object') {
    const message = (errorPayload as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  const message = (payload as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message : fallback
}

const readJsonErrorPayload = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => '')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

const isAlreadySubscribedPayload = (payload: unknown) => {
  const message = apiErrorMessage(payload, '').toLowerCase()
  if (message.includes('already subscribed')) return true
  if (payload && typeof payload === 'object') {
    const errorPayload = (payload as { error?: unknown }).error
    if (errorPayload && typeof errorPayload === 'object') {
      return (errorPayload as { code?: unknown }).code === 'subscription.already_exists'
    }
  }
  return false
}

const normalizeRssUrl = (url: string) => url.trim().replace(/\/+$/, '')

export interface FeedOPMLImportResult {
  message: string
  imported: number
  reused: number
  failed: number
  failed_sources?: Array<{ url: string; reason: string }>
}

interface FeedSourcesDependencies {
  subscriptions: Ref<Subscription[]>
  fetchSubscriptions: () => Promise<boolean>
  fetchGroups: () => Promise<boolean>
}

export const createFeedSourcesState = ({
  subscriptions,
  fetchSubscriptions,
  fetchGroups,
}: FeedSourcesDependencies) => {
  const error = ref<string | null>(null)
  let sessionGeneration = 0
  const isCurrentSession = (generation: number) => generation === sessionGeneration

  const requestEntitySubscription = async (entity: 'channel' | 'collection', id: string, method: 'POST' | 'DELETE') => {
    const authStore = useAuthStore()
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscribe/${entity}/${id}`, {
        method,
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return isCurrentSession(generation) && res.ok
    } catch (e) {
      reportError(e, `Failed to ${method === 'POST' ? 'subscribe to' : 'unsubscribe from'} ${entity}`)
      return false
    }
  }

  const subscribeToChannel = (channelId: string) => requestEntitySubscription('channel', channelId, 'POST')
  const unsubscribeFromChannel = (channelId: string) => requestEntitySubscription('channel', channelId, 'DELETE')
  const subscribeToCollection = (collectionId: string) => requestEntitySubscription('collection', collectionId, 'POST')
  const unsubscribeFromCollection = (collectionId: string) => requestEntitySubscription('collection', collectionId, 'DELETE')

  const isSubscribedToEntity = async (entity: 'channel' | 'collection', id: string): Promise<boolean> => {
    const authStore = useAuthStore()
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscribe/${entity}/${id}/status`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = res.data
        return isCurrentSession(generation) && (data.subscribed || false)
      }
    } catch (e) {
      reportError(e, `Failed to check ${entity} subscription status`)
    }
    return false
  }

  const isSubscribedToChannel = (channelId: string) => isSubscribedToEntity('channel', channelId)
  const isSubscribedToCollection = (collectionId: string) => isSubscribedToEntity('collection', collectionId)

  const subscribeToRSS = async (rssUrl: string, title?: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const normalized = normalizeRssUrl(rssUrl)
    if (!normalized) return false
    const generation = sessionGeneration

    try {
      const res = await apiRequestResult(`${api.url}/feed/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ target_type: 'external_rss', rss_url: normalized, title }),
      })
      if (res.ok && isCurrentSession(generation)) {
        await fetchSubscriptions()
        return true
      }
      if (res.status === 400 || res.status === 409) {
        const data = res.data
        if (isCurrentSession(generation) && isAlreadySubscribedPayload(data)) {
          await fetchSubscriptions()
          return true
        }
      }
    } catch (e) {
      reportError(e, 'Failed to subscribe to RSS')
    }
    return false
  }

  const addSubscription = async (payload: { rss_url: string; title?: string; group_id?: string }) => {
    const authStore = useAuthStore()
    const generation = sessionGeneration
    error.value = null
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ target_type: 'external_rss', rss_url: payload.rss_url, title: payload.title }),
      })
      if (!res.ok) {
        const data = res.data
        if (isCurrentSession(generation)) error.value = apiErrorMessage(data, '添加失败')
        return false
      }
      const subscriptionId = res.data.data?.id
      if (!isCurrentSession(generation)) return false
      if (payload.group_id && subscriptionId) {
        const moveRes = await apiRequestResult(`${api.url}/feed/subscriptions/${subscriptionId}/group`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
          body: JSON.stringify({ group_id: payload.group_id }),
        })
        if (!isCurrentSession(generation)) return false
        if (!moveRes.ok) {
          error.value = '订阅已添加，但移动分组失败'
          await fetchSubscriptions()
          return false
        }
      }
      await fetchSubscriptions()
      return true
    } catch (e) {
      reportError(e, 'Failed to add subscription')
      if (isCurrentSession(generation)) error.value = '网络错误'
      return false
    }
  }

  const discoverFeedCandidates = async (url: string): Promise<FeedDiscoveryCandidate[]> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return []
    const generation = sessionGeneration
    error.value = null
    try {
      const res = await apiRequestResult(`${api.url}/feed/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const data = res.data
        if (isCurrentSession(generation)) error.value = apiErrorMessage(data, '发现订阅源失败')
        return []
      }
      const data = res.data
      return isCurrentSession(generation) ? data.candidates || [] : []
    } catch (e) {
      reportError(e, 'Failed to discover feed candidates')
      if (isCurrentSession(generation)) error.value = '网络错误'
      return []
    }
  }

  const resolveSubscriptionInput = async (input: string): Promise<ResolvedSubscriptionInput | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    const generation = sessionGeneration
    error.value = null
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscriptions/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ input }),
      })
      const data = res.data
      if (!isCurrentSession(generation)) return null
      if (!res.ok) {
        error.value = apiErrorMessage(data, '检测订阅源失败')
        return null
      }
      return data as ResolvedSubscriptionInput
    } catch (e) {
      reportError(e, 'Failed to resolve subscription input')
      if (isCurrentSession(generation)) error.value = '网络错误'
      return null
    }
  }

  const autoAddSubscription = async (payload: AutoAddSubscriptionPayload): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = sessionGeneration
    error.value = null
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscriptions/auto-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify(payload),
      })
      const data = res.data
      if (!isCurrentSession(generation)) return false
      if (!res.ok) {
        error.value = apiErrorMessage(data, '添加失败')
        return false
      }
      await fetchSubscriptions()
      return true
    } catch (e) {
      reportError(e, 'Failed to auto add subscription')
      if (isCurrentSession(generation)) error.value = '网络错误'
      return false
    }
  }

  const batchSubscribeSources = async (sourceIds: string[]): Promise<{ created: number; reusedIds: string[]; missingIds: string[] } | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !sourceIds.length) return null
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/sources/batch-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ source_ids: sourceIds }),
      })
      if (!res.ok) return null
      const data = res.data
      if (!isCurrentSession(generation)) return null
      await fetchSubscriptions()
      return {
        created: Number(data.data?.created || 0),
        reusedIds: data.data?.reused_ids || [],
        missingIds: data.data?.missing_ids || [],
      }
    } catch {
      return null
    }
  }

  const importOPML = async (file: File): Promise<FeedOPMLImportResult | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    const generation = sessionGeneration
    error.value = null
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await apiRequestResult(`${api.url}/feed/opml/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        body: form,
      })
      if (!res.ok) {
        const data = res.data
        if (isCurrentSession(generation)) error.value = apiErrorMessage(data, '导入 OPML 失败')
        return null
      }
      const result = res.data
      if (!isCurrentSession(generation)) return null
      await Promise.all([fetchGroups(), fetchSubscriptions()])
      return result
    } catch (e) {
      reportError(e, 'Failed to import OPML')
      if (isCurrentSession(generation)) error.value = '网络错误'
      return null
    }
  }

  const exportOPML = async (): Promise<Blob> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('Login required')
    const generation = sessionGeneration
    const res = await apiRequest(`${api.url}/feed/opml/export`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!isCurrentSession(generation)) throw new Error('登录状态已变更')
    if (!res.ok) {
      throw new Error(apiErrorMessage(await readJsonErrorPayload(res), '导出 OPML 失败'))
    }
    const blob = await res.blob()
    if (!isCurrentSession(generation)) throw new Error('登录状态已变更')
    return blob
  }

  const createSubscriptionFromProvider = async (payload: {
    provider: Extract<FeedSourceProvider, 'rsshub'>
    template_key: string
    params: Record<string, string>
    title?: string
    group_id?: string
  }): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = sessionGeneration
    error.value = null
    try {
      const res = await apiRequestResult(`${api.url}/feed/sources/create-from-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = res.data
        if (isCurrentSession(generation)) error.value = apiErrorMessage(data, '创建来源失败')
        return false
      }
      const subscriptionId = res.data.data?.id
      if (!isCurrentSession(generation)) return false
      if (payload.group_id && subscriptionId) {
        const moveRes = await apiRequestResult(`${api.url}/feed/subscriptions/${subscriptionId}/group`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
          body: JSON.stringify({ group_id: payload.group_id }),
        })
        if (!isCurrentSession(generation)) return false
        if (!moveRes.ok) {
          error.value = '订阅已创建，但移动分组失败'
          await fetchSubscriptions()
          return false
        }
      }
      await fetchSubscriptions()
      return true
    } catch (e) {
      reportError(e, 'Failed to create subscription from provider')
      if (isCurrentSession(generation)) error.value = '网络错误'
      return false
    }
  }

  const unsubscribeFromRSS = async (rssUrl: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const normalized = normalizeRssUrl(rssUrl)
    if (!normalized) return false
    const generation = sessionGeneration
    try {
      let subscription = subscriptions.value.find((item) =>
        item.feed_source?.source_type === 'external_rss'
        && normalizeRssUrl(item.feed_source.rss_url || '') === normalized,
      )
      if (!subscription) {
        await fetchSubscriptions()
        if (!isCurrentSession(generation)) return false
        subscription = subscriptions.value.find((item) =>
          item.feed_source?.source_type === 'external_rss'
          && normalizeRssUrl(item.feed_source.rss_url || '') === normalized,
        )
        if (!subscription) return true
      }
      const res = await apiRequestResult(`${api.url}/feed/subscriptions/${subscription.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!res.ok || !isCurrentSession(generation)) return false
      await fetchSubscriptions()
      return true
    } catch (e) {
      reportError(e, 'Failed to unsubscribe from RSS')
      return false
    }
  }

  const isSubscribedToRSS = async (rssUrl: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const normalized = normalizeRssUrl(rssUrl)
    if (!normalized) return false
    const generation = sessionGeneration
    try {
      if (!subscriptions.value.length) await fetchSubscriptions()
      if (!isCurrentSession(generation)) return false
      return subscriptions.value.some((item) =>
        item.feed_source?.source_type === 'external_rss'
        && normalizeRssUrl(item.feed_source.rss_url || '') === normalized,
      )
    } catch (e) {
      reportError(e, 'Failed to check RSS subscription status')
      return false
    }
  }

  const clearSourcesState = () => {
    sessionGeneration += 1
    error.value = null
  }

  return {
    error,
    subscribeToChannel,
    unsubscribeFromChannel,
    subscribeToCollection,
    unsubscribeFromCollection,
    isSubscribedToChannel,
    isSubscribedToCollection,
    subscribeToRSS,
    addSubscription,
    discoverFeedCandidates,
    resolveSubscriptionInput,
    autoAddSubscription,
    batchSubscribeSources,
    importOPML,
    exportOPML,
    createSubscriptionFromProvider,
    unsubscribeFromRSS,
    isSubscribedToRSS,
    clearSourcesState,
  }
}
