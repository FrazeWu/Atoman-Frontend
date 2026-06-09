import { ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  FeedDiscoveryCandidate,
  FeedSourceProvider,
  FeedStarGroup,
  Subscription,
  SubscriptionGroup,
} from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const useFeedStore = defineStore('feed', () => {
  const api = useApi()

  // Feed state
  const subscriptions = ref<Subscription[]>([])
  const groups = ref<SubscriptionGroup[]>([])
  const starGroups = ref<FeedStarGroup[]>([])
  const timeline = ref<any[]>([])
  const activeSource = ref<{ type: string; id: string } | null>(null)
  const error = ref<string | null>(null)


  let pollInterval: ReturnType<typeof setInterval> | null = null

  // --- Feed Actions ---

  const fetchSubscriptions = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    try {
      const res = await fetch(`${API_URL}/feed/subscriptions`, {
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
    if (!authStore.isAuthenticated) return
    try {
      const res = await fetch(`${API_URL}/feed/groups`, {
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
      const res = await fetch(`${API_URL}/feed/groups`, {
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
    if (!authStore.isAuthenticated) return
    try {
      const res = await fetch(`${API_URL}/feed/star-groups`, {
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
      const res = await fetch(`${API_URL}/feed/star-groups`, {
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
      const res = await fetch(`${API_URL}/feed/subscriptions/${id}`, {
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
      const res = await fetch(`${API_URL}/feed/groups/${id}`, {
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
      await fetch(`${API_URL}/feed/groups/${id}`, {
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
      await fetch(`${API_URL}/feed/subscriptions/${subId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ group_id: groupId }),
      })
      await fetchSubscriptions()
    } catch (e) {
      console.error('Failed to set subscription group', e)
    }
  }

  const fetchTimeline = async (sourceType?: string, sourceId?: number, unreadOnly = false) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    try {
      const params = buildFeedTimelineQuery({
        sourceType,
        sourceId,
        unreadOnly,
      })
      const query = params.toString()
      const url = query ? `${API_URL}/feed/timeline?${query}` : `${API_URL}/feed/timeline`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authStore.token}` },
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
      const res = await fetch(`${API_URL}/feed/subscriptions`, {
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
      await fetch(`${API_URL}/feed/subscriptions/${subscriptionId}`, {
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
      await fetch(`${API_URL}/feed/timeline/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_ids: feedItemIds }),
      })
    } catch (e) {
      console.error('Failed to mark items read', e)
    }
  }

  const markAllRead = async () => {
    const authStore = useAuthStore()
    try {
      await fetch(`${API_URL}/feed/timeline/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
    } catch (e) {
      console.error('Failed to mark all read', e)
    }
  }

  const markAllUnread = async () => {
    const authStore = useAuthStore()
    try {
      await fetch(`${API_URL}/feed/timeline/mark-all-unread`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
    } catch (e) {
      console.error('Failed to mark all unread', e)
    }
  }

  const subscribeToChannel = async (channelId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await fetch(`${API_URL}/feed/subscribe/channel/${channelId}`, {
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
      const res = await fetch(`${API_URL}/feed/subscribe/channel/${channelId}`, {
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
      const res = await fetch(`${API_URL}/feed/subscribe/collection/${collectionId}`, {
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
      const res = await fetch(`${API_URL}/feed/subscribe/collection/${collectionId}`, {
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
      const res = await fetch(`${API_URL}/feed/subscribe/channel/${channelId}/status`, {
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
      const res = await fetch(`${API_URL}/feed/subscribe/collection/${collectionId}/status`, {
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
      const res = await fetch(`${API_URL}/feed/subscriptions`, {
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
        const message = String(data?.error || '').toLowerCase()
        if (message.includes('already subscribed')) {
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
      const res = await fetch(`${API_URL}/feed/subscriptions`, {
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
        const err = await res.json()
        error.value = err.error || '添加失败'
        return false
      }

      const data = await res.json()
      const subscriptionId = data.data?.id

      if (payload.group_id && subscriptionId) {
        const moveRes = await fetch(`${API_URL}/feed/subscriptions/${subscriptionId}/group`, {
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
      const res = await fetch(`${API_URL}/feed/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        error.value = err.error || '发现订阅源失败'
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
      const res = await fetch(`${API_URL}/feed/sources/create-from-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        error.value = err.error || '创建来源失败'
        return false
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

      const res = await fetch(`${API_URL}/feed/subscriptions/${sub.id}`, {
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
      const res = await fetch(`${API_URL}/feed/subscriptions/${subscriptionId}/health`, {
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
      const res = await fetch(`${API_URL}/feed/subscriptions/health/check-all`, {
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
  const readingListItemIds = ref<Set<string>>(new Set())

  const toggleStar = async (feedItemId: string): Promise<boolean | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    try {
      const res = await fetch(`${API_URL}/feed/timeline/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_id: feedItemId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.starred) {
          const newSet = new Set(starredItemIds.value)
          newSet.add(feedItemId)
          starredItemIds.value = newSet
        } else {
          const newSet = new Set(starredItemIds.value)
          newSet.delete(feedItemId)
          starredItemIds.value = newSet
        }
        return data.starred
      }
    } catch (e) {
      console.error('Failed to toggle star', e)
    }
    return null
  }

  const fetchStarredIds = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    try {
      const res = await fetch(`${API_URL}/feed/stars?limit=500`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const ids = (data.items || []).map((item: any) => item.id as string)
        starredItemIds.value = new Set(ids)
      }
    } catch (e) {
      console.error('Failed to fetch starred ids', e)
    }
  }

  // Store does not own paged starred lists; callers should update local lists or refetch after success.
  const moveStarToGroup = async (feedItemId: string, groupId: string | null): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    try {
      const res = await fetch(`${API_URL}/feed/stars/${feedItemId}/group`, {
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

  const toggleReadingListItem = async (feedItemId: string): Promise<boolean | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    try {
      const res = await fetch(`${API_URL}/feed/reading-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_id: feedItemId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.saved) {
          const newSet = new Set(readingListItemIds.value)
          newSet.add(feedItemId)
          readingListItemIds.value = newSet
        } else {
          const newSet = new Set(readingListItemIds.value)
          newSet.delete(feedItemId)
          readingListItemIds.value = newSet
        }
        return data.saved
      }
    } catch (e) {
      console.error('Failed to toggle reading list item', e)
    }
    return null
  }

  const fetchReadingListIds = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    try {
      const res = await fetch(`${API_URL}/feed/reading-list?limit=500`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const ids = (data.items || [])
          .map((item: any) => item.feed_item_id as string)
          .filter(Boolean)
        readingListItemIds.value = new Set(ids)
      }
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
    activeSource,
    error,
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
    markAllFeedRead: markAllRead,
    markAllFeedUnread: markAllUnread,
    // Health check
    healthChecking,
    checkSubscriptionHealth,
    checkAllSubscriptionsHealth,
    // Star
    starredItemIds,
    toggleStar,
    fetchStarredIds,
    moveStarToGroup,
    readingListItemIds,
    toggleReadingListItem,
    fetchReadingListIds,
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
    createSubscriptionFromProvider,
    unsubscribeFromRSS,
    isSubscribedToRSS,
  }
})
