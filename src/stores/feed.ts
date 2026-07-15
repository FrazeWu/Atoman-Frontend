import { ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  AutoAddSubscriptionPayload,
  FeedDiscoveryCandidate,
  FeedSourceProvider,
  FeedStarGroup,
  ResolvedSubscriptionInput,
  Subscription,
  SubscriptionGroup,
} from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'

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
  if (typeof message === 'string' && message.trim()) return message
  return fallback
}

const isAlreadySubscribedPayload = (payload: unknown) => {
  const message = apiErrorMessage(payload, '').toLowerCase()
  if (message.includes('already subscribed')) return true
  if (payload && typeof payload === 'object') {
    const errorPayload = (payload as { error?: unknown }).error
    if (errorPayload && typeof errorPayload === 'object') {
      const code = (errorPayload as { code?: unknown }).code
      return code === 'subscription.already_exists'
    }
  }
  return false
}

export interface FeedOPMLImportResult {
  message: string
  imported: number
  reused: number
  failed: number
}

interface FeedTimelineFetchOptions {
  q?: string | null
  sourceType?: string
  sourceId?: string | number | null
  unreadOnly?: boolean
}

export interface FeedFilterRules {
  mutedSourceIds: string[]
  hiddenKeywords: string[]
}

export interface FeedAutomationRules {
  autoMarkReadSourceIds: string[]
  autoAddReadingListSourceIds: string[]
}

const FEED_FILTER_RULES_STORAGE_KEY = 'atoman.feed.filter-rules'
const FEED_AUTOMATION_RULES_STORAGE_KEY = 'atoman.feed.automation-rules'

const normalizeRuleList = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
}

const readFilterRules = (): FeedFilterRules => {
  if (typeof localStorage === 'undefined') {
    return { mutedSourceIds: [], hiddenKeywords: [] }
  }

  try {
    const raw = localStorage.getItem(FEED_FILTER_RULES_STORAGE_KEY)
    if (!raw) return { mutedSourceIds: [], hiddenKeywords: [] }
    const parsed = JSON.parse(raw) as {
      mutedSourceIds?: unknown
      hiddenKeywords?: unknown
    }
    return {
      mutedSourceIds: normalizeRuleList(parsed.mutedSourceIds),
      hiddenKeywords: normalizeRuleList(parsed.hiddenKeywords),
    }
  } catch {
    return { mutedSourceIds: [], hiddenKeywords: [] }
  }
}

const writeFilterRules = (rules: FeedFilterRules) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FEED_FILTER_RULES_STORAGE_KEY, JSON.stringify(rules))
}

const readAutomationRules = (): FeedAutomationRules => {
  if (typeof localStorage === 'undefined') {
    return { autoMarkReadSourceIds: [], autoAddReadingListSourceIds: [] }
  }

  try {
    const raw = localStorage.getItem(FEED_AUTOMATION_RULES_STORAGE_KEY)
    if (!raw) return { autoMarkReadSourceIds: [], autoAddReadingListSourceIds: [] }
    const parsed = JSON.parse(raw) as {
      autoMarkReadSourceIds?: unknown
      autoAddReadingListSourceIds?: unknown
    }
    return {
      autoMarkReadSourceIds: normalizeRuleList(parsed.autoMarkReadSourceIds),
      autoAddReadingListSourceIds: normalizeRuleList(parsed.autoAddReadingListSourceIds),
    }
  } catch {
    return { autoMarkReadSourceIds: [], autoAddReadingListSourceIds: [] }
  }
}

const writeAutomationRules = (rules: FeedAutomationRules) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FEED_AUTOMATION_RULES_STORAGE_KEY, JSON.stringify(rules))
}

export const useFeedStore = defineStore('feed', () => {
  // Feed state
  const subscriptions = ref<Subscription[]>([])
  const groups = ref<SubscriptionGroup[]>([])
  const starGroups = ref<FeedStarGroup[]>([])
  const timeline = ref<any[]>([])
  const filterRules = ref<FeedFilterRules>(readFilterRules())
  const automationRules = ref<FeedAutomationRules>(readAutomationRules())
  const activeSource = ref<{ type: string; id: string } | null>(null)
  const error = ref<string | null>(null)


  let pollInterval: ReturnType<typeof setInterval> | null = null

  // --- Feed Actions ---

  const clearUserState = () => {
    subscriptions.value = []
    groups.value = []
    starGroups.value = []
    timeline.value = []
    starredItemIds.value = new Set()
    bookmarkedPostIds.value = new Set()
    readingListItemIds.value = new Set()
    activeSource.value = null
    error.value = null
  }

  const setFilterRules = (rules: Partial<FeedFilterRules>) => {
    const nextRules: FeedFilterRules = {
      mutedSourceIds: normalizeRuleList(rules.mutedSourceIds ?? filterRules.value.mutedSourceIds),
      hiddenKeywords: normalizeRuleList(rules.hiddenKeywords ?? filterRules.value.hiddenKeywords),
    }
    filterRules.value = nextRules
    writeFilterRules(nextRules)
  }

  const setAutomationRules = (rules: Partial<FeedAutomationRules>) => {
    const nextRules: FeedAutomationRules = {
      autoMarkReadSourceIds: normalizeRuleList(
        rules.autoMarkReadSourceIds ?? automationRules.value.autoMarkReadSourceIds,
      ),
      autoAddReadingListSourceIds: normalizeRuleList(
        rules.autoAddReadingListSourceIds ?? automationRules.value.autoAddReadingListSourceIds,
      ),
    }
    automationRules.value = nextRules
    writeAutomationRules(nextRules)
  }

  const fetchSubscriptions = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      subscriptions.value = []
      return
    }
    try {
      const res = await fetch(`${api.url}/feed/subscriptions`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        subscriptions.value = data.data || []
      }
    } catch (e) {
      console.error('Failed to fetch subscriptions', e)
    }
  }

  const fetchGroups = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      groups.value = []
      return
    }
    try {
      const res = await fetch(`${api.url}/feed/groups`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        groups.value = data.data || []
      }
    } catch (e) {
      console.error('Failed to fetch groups', e)
    }
  }

  const createGroup = async (name: string) => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        await fetchGroups()
        return true
      }
    } catch (e) {
      console.error('Failed to create group', e)
    }
    return false
  }

  const fetchStarGroups = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      starGroups.value = []
      return
    }
    try {
      const res = await fetch(`${api.url}/feed/star-groups`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        starGroups.value = data.data || []
      }
    } catch (e) {
      console.error('Failed to fetch star groups', e)
    }
  }

  const createStarGroup = async (name: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    try {
      const res = await fetch(`${api.url}/feed/star-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        await fetchStarGroups()
        return true
      }
    } catch (e) {
      console.error('Failed to create star group', e)
    }
    return false
  }

  // Only sets an explicit group UUID; use setSubscriptionGroup or a default group UUID to clear/reset.
  const updateSubscription = async (
    id: string,
    payload: { title?: string; group_id?: string },
  ): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    try {
      const res = await fetch(`${api.url}/feed/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await fetchSubscriptions()
        return true
      }
    } catch (e) {
      console.error('Failed to update subscription', e)
    }
    return false
  }

  const updateGroup = async (id: string, name: string) => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        await fetchGroups()
        return true
      }
    } catch (e) {
      console.error('Failed to update group', e)
    }
    return false
  }

  const deleteGroup = async (id: string) => {
    const authStore = useAuthStore()
    try {
      await fetch(`${api.url}/feed/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      await fetchGroups()
      await fetchSubscriptions()
    } catch (e) {
      console.error('Failed to delete group', e)
    }
  }

  const setSubscriptionGroup = async (subId: string, groupId: string | null) => {
    const authStore = useAuthStore()
    try {
      await fetch(`${api.url}/feed/subscriptions/${subId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ group_id: groupId }),
      })
      await fetchSubscriptions()
    } catch (e) {
      console.error('Failed to set subscription group', e)
    }
  }

  const fetchTimeline = async (
    sourceTypeOrOptions?: string | FeedTimelineFetchOptions,
    sourceId?: number,
    unreadOnly = false,
  ) => {
    const authStore = useAuthStore()
    try {
      const options: FeedTimelineFetchOptions = typeof sourceTypeOrOptions === 'object' && sourceTypeOrOptions !== null
        ? sourceTypeOrOptions
        : {
            sourceType: typeof sourceTypeOrOptions === 'string' ? sourceTypeOrOptions : undefined,
            sourceId,
            unreadOnly,
          }
      const params = buildFeedTimelineQuery({
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        unreadOnly: options.unreadOnly,
        q: options.q,
      })
      const query = params.toString()
      const url = query ? `${api.url}/feed/timeline?${query}` : `${api.url}/feed/timeline`
      const res = await fetch(url, {
        headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        timeline.value = data.data || []
      }
    } catch (e) {
      console.error('Failed to fetch timeline', e)
    }
  }

  const subscribe = async (targetType: string, targetId: string, title?: string) => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, title }),
      })
      if (res.ok) {
        await fetchSubscriptions()
      }
    } catch (e) {
      console.error('Failed to subscribe', e)
    }
  }

  const unsubscribe = async (subscriptionId: string) => {
    const authStore = useAuthStore()
    try {
      await fetch(`${api.url}/feed/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      await fetchSubscriptions()
    } catch (e) {
      console.error('Failed to unsubscribe', e)
    }
  }

  const markItemsRead = async (feedItemIds: string[]) => {
    const authStore = useAuthStore()
    if (!feedItemIds.length) return
    try {
      await fetch(`${api.url}/feed/timeline/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_ids: feedItemIds }),
      })
    } catch (e) {
      console.error('Failed to mark items read', e)
    }
  }

  const markItemsUnread = async (feedItemIds: string[]) => {
    const authStore = useAuthStore()
    if (!feedItemIds.length) return
    try {
      await fetch(`${api.url}/feed/timeline/mark-unread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_ids: feedItemIds }),
      })
    } catch (e) {
      console.error('Failed to mark items unread', e)
    }
  }

  const markAllRead = async (): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/timeline/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      console.error('Failed to mark all read', e)
    }
    return false
  }

  const markAllUnread = async (): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/timeline/mark-all-unread`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      console.error('Failed to mark all unread', e)
    }
    return false
  }

  const fetchUnreadFeedItemCount = async (): Promise<number | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    try {
      const res = await fetch(`${api.url}/feed/timeline?source_type=external_rss&unread_only=true&limit=1`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      const total = data.meta?.total
      return typeof total === 'number' && Number.isFinite(total) && total >= 0 ? total : null
    } catch (e) {
      console.error('Failed to fetch unread feed item count', e)
    }
    return null
  }

  const subscribeToChannel = async (channelId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/subscribe/channel/${channelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      console.error('Failed to subscribe to channel', e)
    }
    return false
  }

  const unsubscribeFromChannel = async (channelId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/subscribe/channel/${channelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      console.error('Failed to unsubscribe from channel', e)
    }
    return false
  }

  const subscribeToCollection = async (collectionId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/subscribe/collection/${collectionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      console.error('Failed to subscribe to collection', e)
    }
    return false
  }

  const unsubscribeFromCollection = async (collectionId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/subscribe/collection/${collectionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      console.error('Failed to unsubscribe from collection', e)
    }
    return false
  }

  const isSubscribedToChannel = async (channelId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/subscribe/channel/${channelId}/status`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        return data.subscribed || false
      }
    } catch (e) {
      console.error('Failed to check channel subscription status', e)
    }
    return false
  }

  const isSubscribedToCollection = async (collectionId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/subscribe/collection/${collectionId}/status`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        return data.subscribed || false
      }
    } catch (e) {
      console.error('Failed to check collection subscription status', e)
    }
    return false
  }

  const normalizeRssUrl = (url: string) =>
    url.trim().replace(/\/+$/, '')

  const subscribeToRSS = async (rssUrl: string, title?: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false

    const normalized = normalizeRssUrl(rssUrl)
    if (!normalized) return false

    try {
      const res = await fetch(`${api.url}/feed/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({
          target_type: 'external_rss',
          rss_url: normalized,
          title,
        }),
      })

      if (res.ok) {
        await fetchSubscriptions()
        return true
      }

      // Treat "already subscribed" as success for idempotent UX.
      if (res.status === 400 || res.status === 409) {
        const data = await res.json().catch(() => ({}))
        if (isAlreadySubscribedPayload(data)) {
          await fetchSubscriptions()
          return true
        }
      }
    } catch (e) {
      console.error('Failed to subscribe to RSS', e)
    }

    return false
  }

  const addSubscription = async (payload: { rss_url: string; title?: string; group_id?: string }) => {
    const authStore = useAuthStore()
    error.value = null
    try {
      const res = await fetch(`${api.url}/feed/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({
          target_type: 'external_rss',
          rss_url: payload.rss_url,
          title: payload.title,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        error.value = apiErrorMessage(err, '添加失败')
        return false
      }

      const data = await res.json()
      const subscriptionId = data.data?.id

      if (payload.group_id && subscriptionId) {
        const moveRes = await fetch(`${api.url}/feed/subscriptions/${subscriptionId}/group`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authStore.token}`,
          },
          body: JSON.stringify({ group_id: payload.group_id }),
        })
        if (!moveRes.ok) {
          error.value = '订阅已添加，但移动分组失败'
          await fetchSubscriptions()
          return false
        }
      }

      await fetchSubscriptions()
      return true
    } catch (e) {
      console.error('Failed to add subscription', e)
      error.value = '网络错误'
    }
    return false
  }

  const discoverFeedCandidates = async (url: string): Promise<FeedDiscoveryCandidate[]> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return []

    error.value = null
    try {
      const res = await fetch(`${api.url}/feed/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        error.value = apiErrorMessage(err, '发现订阅源失败')
        return []
      }

      const data = await res.json()
      return data.candidates || []
    } catch (e) {
      console.error('Failed to discover feed candidates', e)
      error.value = '网络错误'
      return []
    }
  }

  const resolveSubscriptionInput = async (input: string): Promise<ResolvedSubscriptionInput | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null

    error.value = null
    try {
      const res = await fetch(`${api.url}/feed/subscriptions/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ input }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        error.value = apiErrorMessage(data, '检测订阅源失败')
        return null
      }

      return data as ResolvedSubscriptionInput
    } catch (e) {
      console.error('Failed to resolve subscription input', e)
      error.value = '网络错误'
      return null
    }
  }

  const autoAddSubscription = async (payload: AutoAddSubscriptionPayload): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false

    error.value = null
    try {
      const res = await fetch(`${api.url}/feed/subscriptions/auto-add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        error.value = apiErrorMessage(data, '添加失败')
        return false
      }

      await fetchSubscriptions()
      return true
    } catch (e) {
      console.error('Failed to auto add subscription', e)
      error.value = '网络错误'
      return false
    }
  }

  const importOPML = async (file: File): Promise<FeedOPMLImportResult | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null

    error.value = null
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${api.url}/feed/opml/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        error.value = apiErrorMessage(err, '导入 OPML 失败')
        return null
      }
      const result = await res.json()
      await Promise.all([fetchGroups(), fetchSubscriptions()])
      return result
    } catch (e) {
      console.error('Failed to import OPML', e)
      error.value = '网络错误'
      return null
    }
  }

  const exportOPML = async (): Promise<Blob> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      throw new Error('Login required')
    }
    const res = await fetch(`${api.url}/feed/opml/export`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(apiErrorMessage(err, '导出 OPML 失败'))
    }
    return res.blob()
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

    error.value = null
    try {
      const res = await fetch(`${api.url}/feed/sources/create-from-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        error.value = apiErrorMessage(err, '创建来源失败')
        return false
      }

      const data = await res.json().catch(() => ({}))
      const subscriptionId = data.data?.id

      if (payload.group_id && subscriptionId) {
        const moveRes = await fetch(`${api.url}/feed/subscriptions/${subscriptionId}/group`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authStore.token}`,
          },
          body: JSON.stringify({ group_id: payload.group_id }),
        })
        if (!moveRes.ok) {
          error.value = '订阅已创建，但移动分组失败'
          await fetchSubscriptions()
          return false
        }
      }

      await fetchSubscriptions()
      return true
    } catch (e) {
      console.error('Failed to create subscription from provider', e)
      error.value = '网络错误'
      return false
    }
  }

  const unsubscribeFromRSS = async (rssUrl: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false

    const normalized = normalizeRssUrl(rssUrl)
    if (!normalized) return false

    try {
      let sub = subscriptions.value.find((item) => {
        const source = item.feed_source
        return source?.source_type === 'external_rss' && normalizeRssUrl(source.rss_url || '') === normalized
      })

      if (!sub) {
        await fetchSubscriptions()
        sub = subscriptions.value.find((item) => {
          const source = item.feed_source
          return source?.source_type === 'external_rss' && normalizeRssUrl(source.rss_url || '') === normalized
        })
        if (!sub) return true
      }

      const res = await fetch(`${api.url}/feed/subscriptions/${sub.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })

      if (!res.ok) return false

      await fetchSubscriptions()
      return true
    } catch (e) {
      console.error('Failed to unsubscribe from RSS', e)
      return false
    }
  }

  const isSubscribedToRSS = async (rssUrl: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false

    const normalized = normalizeRssUrl(rssUrl)
    if (!normalized) return false

    try {
      if (!subscriptions.value.length) {
        await fetchSubscriptions()
      }

      return subscriptions.value.some((item) => {
        const source = item.feed_source
        return source?.source_type === 'external_rss' && normalizeRssUrl(source.rss_url || '') === normalized
      })
    } catch (e) {
      console.error('Failed to check RSS subscription status', e)
      return false
    }
  }

  // --- Health Check ---
  const healthChecking = ref(false)

  const checkSubscriptionHealth = async (subscriptionId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    try {
      const res = await fetch(`${api.url}/feed/subscriptions/${subscriptionId}/health`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        await fetchSubscriptions()
        return true
      }
    } catch (e) {
      console.error('Failed to check subscription health', e)
    }
    return false
  }

  const checkAllSubscriptionsHealth = async (): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    healthChecking.value = true
    try {
      const res = await fetch(`${api.url}/feed/subscriptions/health/check-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        await fetchSubscriptions()
        return true
      }
    } catch (e) {
      console.error('Failed to check all subscriptions health', e)
    } finally {
      healthChecking.value = false
    }
    return false
  }


  // --- Star Actions ---

  const starredItemIds = ref<Set<string>>(new Set())
  const bookmarkedPostIds = ref<Set<string>>(new Set())
  const readingListItemIds = ref<Set<string>>(new Set())
  type PendingMembershipToggle = {
    confirmed: boolean
    desired: boolean
    inFlight: boolean
    waiters: Array<(value: boolean | null) => void>
  }
  const starToggleStates = new Map<string, PendingMembershipToggle>()
  const readingListToggleStates = new Map<string, PendingMembershipToggle>()

  const setMembership = (ids: typeof starredItemIds, id: string, shouldInclude: boolean) => {
    const next = new Set(ids.value)
    if (shouldInclude) {
      next.add(id)
    } else {
      next.delete(id)
    }
    ids.value = next
  }

  const mergePendingMembership = (
    ids: Set<string>,
    states: Map<string, PendingMembershipToggle>,
  ) => {
    const next = new Set(ids)
    states.forEach((state, id) => {
      if (state.desired) {
        next.add(id)
      } else {
        next.delete(id)
      }
    })
    return next
  }

  const enqueueMembershipToggle = (
    states: Map<string, PendingMembershipToggle>,
    ids: typeof starredItemIds,
    id: string,
    requestToggle: (fallback: boolean) => Promise<boolean | null>,
  ): Promise<boolean | null> => {
    const currentLocal = ids.value.has(id)
    let state = states.get(id)
    if (!state) {
      state = {
        confirmed: currentLocal,
        desired: currentLocal,
        inFlight: false,
        waiters: [],
      }
      states.set(id, state)
    }

    state.desired = !currentLocal
    setMembership(ids, id, state.desired)

    const result = new Promise<boolean | null>((resolve) => {
      state?.waiters.push(resolve)
    })
    if (!state.inFlight) {
      void drainMembershipToggle(states, ids, id, state, requestToggle)
    }
    return result
  }

  const drainMembershipToggle = async (
    states: Map<string, PendingMembershipToggle>,
    ids: typeof starredItemIds,
    id: string,
    state: PendingMembershipToggle,
    requestToggle: (fallback: boolean) => Promise<boolean | null>,
  ) => {
    state.inFlight = true
    let finalState: boolean | null = state.confirmed

    while (state.desired !== state.confirmed) {
      const fallback = !state.confirmed
      const serverState = await requestToggle(fallback)
      if (serverState === null) {
        finalState = null
        state.desired = state.confirmed
        setMembership(ids, id, state.confirmed)
        break
      }

      state.confirmed = serverState
      finalState = serverState
      if (state.desired !== state.confirmed) {
        setMembership(ids, id, state.desired)
      }
    }

    if (finalState !== null) {
      setMembership(ids, id, state.confirmed)
      finalState = state.confirmed
    }
    state.inFlight = false
    const waiters = state.waiters.splice(0)
    waiters.forEach((resolve) => resolve(finalState))
    if (state.desired === state.confirmed && state.waiters.length === 0) {
      states.delete(id)
    }
  }

  const requestStarToggle = async (feedItemId: string, fallback: boolean): Promise<boolean | null> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/timeline/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_id: feedItemId }),
      })
      if (res.ok) {
        const data = await res.json()
        const starred = data.data?.starred ?? data.starred ?? fallback
        return Boolean(starred)
      }
    } catch (e) {
      console.error('Failed to toggle star', e)
    }
    return null
  }

  const toggleStar = async (feedItemId: string): Promise<boolean | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    return enqueueMembershipToggle(
      starToggleStates,
      starredItemIds,
      feedItemId,
      (fallback) => requestStarToggle(feedItemId, fallback),
    )
  }

  const fetchStarredIds = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      starredItemIds.value = new Set()
      return
    }
    try {
      const res = await fetch(`${api.url}/feed/stars?limit=500`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const ids = (data.items || []).map((item: any) => item.id as string)
        starredItemIds.value = mergePendingMembership(new Set(ids), starToggleStates)
      }
    } catch (e) {
      console.error('Failed to fetch starred ids', e)
    }
  }

  const fetchBookmarkedPostIds = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      bookmarkedPostIds.value = new Set()
      return
    }
    try {
      const res = await fetch(`${api.url}/blog/bookmarks`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const ids = (data.data || [])
          .map((bookmark: any) => bookmark.post_id as string)
          .filter(Boolean)
        bookmarkedPostIds.value = new Set(ids)
      }
    } catch (e) {
      console.error('Failed to fetch bookmarked post ids', e)
    }
  }

  const togglePostBookmark = async (postId: string): Promise<boolean | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    try {
      if (bookmarkedPostIds.value.has(postId)) {
        const res = await fetch(`${api.url}/blog/bookmarks`, {
          headers: { Authorization: `Bearer ${authStore.token}` },
        })
        if (!res.ok) return null
        const data = await res.json()
        const bookmark = (data.data || []).find((item: any) => item.post_id === postId)
        if (!bookmark?.id) return null
        const deleteRes = await fetch(`${api.url}/blog/bookmarks/${bookmark.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authStore.token}` },
        })
        if (!deleteRes.ok) return null
        const newSet = new Set(bookmarkedPostIds.value)
        newSet.delete(postId)
        bookmarkedPostIds.value = newSet
        return false
      }

      const res = await fetch(`${api.url}/blog/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ post_id: postId }),
      })
      if (res.ok) {
        const newSet = new Set(bookmarkedPostIds.value)
        newSet.add(postId)
        bookmarkedPostIds.value = newSet
        return true
      }
    } catch (e) {
      console.error('Failed to toggle post bookmark', e)
    }
    return null
  }

  // Store does not own paged starred lists; callers should update local lists or refetch after success.
  const moveStarToGroup = async (feedItemId: string, groupId: string | null): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    try {
      const res = await fetch(`${api.url}/feed/stars/${feedItemId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ group_id: groupId }),
      })
      return res.ok
    } catch (e) {
      console.error('Failed to move star to group', e)
    }
    return false
  }

  const syncStarredPageIds = (previousIds: string[], nextIds: string[]) => {
    const next = new Set(starredItemIds.value)
    previousIds.forEach((id) => next.delete(id))
    nextIds.forEach((id) => next.add(id))
    starredItemIds.value = mergePendingMembership(
      next,
      starToggleStates,
    )
  }

  const syncReadingListPageIds = (previousIds: string[], nextIds: string[]) => {
    const next = new Set(readingListItemIds.value)
    previousIds.forEach((id) => next.delete(id))
    nextIds.forEach((id) => next.add(id))
    readingListItemIds.value = mergePendingMembership(
      next,
      readingListToggleStates,
    )
  }

  const requestReadingListToggle = async (
    targetId: string,
    targetType: 'feed_item' | 'post',
    fallback: boolean,
  ): Promise<boolean | null> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${api.url}/feed/reading-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      })
      if (res.ok) {
        const data = await res.json()
        const saved = data.data?.saved ?? data.saved ?? fallback
        return Boolean(saved)
      }
    } catch (e) {
      console.error('Failed to toggle reading list item', e)
    }
    return null
  }

  const toggleReadingListItem = async (
    targetId: string,
    targetType: 'feed_item' | 'post' = 'feed_item',
  ): Promise<boolean | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    return enqueueMembershipToggle(
      readingListToggleStates,
      readingListItemIds,
      targetId,
      (fallback) => requestReadingListToggle(targetId, targetType, fallback),
    )
  }

  const fetchReadingListIds = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      readingListItemIds.value = new Set()
      return
    }
    try {
      const pageSize = 100
      const entries: any[] = []
      for (let page = 1; ; page += 1) {
        const res = await fetch(`${api.url}/feed/reading-list?page=${page}&limit=${pageSize}`, {
          headers: { Authorization: `Bearer ${authStore.token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const pageEntries = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.data?.items)
            ? data.data.items
            : Array.isArray(data.items)
              ? data.items
              : []
        entries.push(...pageEntries)

        const total = Number(data.meta?.total ?? data.data?.total ?? data.total)
        if ((Number.isFinite(total) && entries.length >= total) || pageEntries.length < pageSize) break
      }
      const ids = entries
        .map((item: any) => item.target_id as string)
        .filter(Boolean)
      readingListItemIds.value = mergePendingMembership(new Set(ids), readingListToggleStates)
    } catch (e) {
      console.error('Failed to fetch reading list ids', e)
    }
  }

  return {
    // Feed
    subscriptions,
    groups,
    starGroups,
    timeline,
    filterRules,
    automationRules,
    activeSource,
    error,
    clearUserState,
    setFilterRules,
    setAutomationRules,
    fetchSubscriptions,
    fetchGroups,
    createGroup,
    fetchStarGroups,
    createStarGroup,
    updateSubscription,
    updateGroup,
    deleteGroup,
    setSubscriptionGroup,
    fetchTimeline,
    subscribe,
    unsubscribe,
    markItemsRead,
    markItemsUnread,
    markAllFeedRead: markAllRead,
    markAllFeedUnread: markAllUnread,
    fetchUnreadFeedItemCount,
    // Health check
    healthChecking,
    checkSubscriptionHealth,
    checkAllSubscriptionsHealth,
    // Star
    starredItemIds,
    bookmarkedPostIds,
    toggleStar,
    fetchStarredIds,
    fetchBookmarkedPostIds,
    togglePostBookmark,
    moveStarToGroup,
    syncStarredPageIds,
    readingListItemIds,
    toggleReadingListItem,
    fetchReadingListIds,
    syncReadingListPageIds,
    // Channel/Collection subscriptions
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
    importOPML,
    exportOPML,
    createSubscriptionFromProvider,
    unsubscribeFromRSS,
    isSubscribedToRSS,
  }
})
