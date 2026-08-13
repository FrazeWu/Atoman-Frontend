import { apiRequestResult } from '@/api/client'
import { onScopeDispose, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'
import type { TimelineItem } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { loadUnreadFeedItemCount } from '@/api/feedMembership'
import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'
import { reportError } from '@/utils/logger'
import { registerSessionReset } from '@/stores/sessionReset'
import { createFeedMembershipState } from '@/stores/feed/membership'
import { createFeedCoreState } from '@/stores/feed/core'
import { createFeedRulesState } from '@/stores/feed/rules'
import { createFeedSourcesState } from '@/stores/feed/sources'
export type { FeedOPMLImportResult } from '@/stores/feed/sources'

const api = useApi()

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
  const pinia = getActivePinia()
  if (!pinia) throw new Error('Feed 状态必须在 Pinia 实例中创建')
  // Feed state
  const timeline = ref<TimelineItem[]>([])
  // Legacy local-only rule state kept for gradual migration in a later task.
  const filterRules = ref<FeedFilterRules>(readFilterRules())
  const automationRules = ref<FeedAutomationRules>(readAutomationRules())
  const activeSource = ref<{ type: string; id: string } | null>(null)

  const {
    subscriptions,
    groups,
    starGroups,
    healthChecking,
    syncingSubscriptionIds,
    syncingAllSubscriptions,
    subscriptionSyncResults,
    fetchSubscriptions,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    fetchStarGroups,
    createStarGroup,
    updateSubscription,
    setSubscriptionGroup,
    subscribe,
    unsubscribe,
    checkSubscriptionHealth,
    checkAllSubscriptionsHealth,
    syncSubscription,
    syncAllSubscriptions,
    clearCoreState,
  } = createFeedCoreState()

  const {
    subscriptionRules,
    ruleApplySummary,
    fetchSubscriptionRules,
    createSubscriptionRule,
    updateSubscriptionRule,
    deleteSubscriptionRule,
    reorderSubscriptionRules,
    applySubscriptionRules,
    clearRulesState,
  } = createFeedRulesState(fetchSubscriptions)

  const {
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
  } = createFeedSourcesState({ subscriptions, fetchSubscriptions, fetchGroups })

  const {
    starredItemIds,
    bookmarkedPostIds,
    readingListItemIds,
    toggleStar,
    fetchStarredIds,
    fetchBookmarkedPostIds,
    togglePostBookmark,
    moveStarToGroup,
    syncStarredPageIds,
    toggleReadingListItem,
    fetchReadingListIds,
    syncReadingListPageIds,
    mergeReadingListPageIds,
    clearMembershipState,
  } = createFeedMembershipState()

  let pollInterval: ReturnType<typeof setInterval> | null = null
  let timelineGeneration = 0
  let preferenceGeneration = 0
  // --- Feed Actions ---

  const clearUserState = () => {
    timelineGeneration += 1
    preferenceGeneration += 1
    clearCoreState()
    clearRulesState()
    timeline.value = []
    clearMembershipState()
    clearSourcesState()
    activeSource.value = null
    filterRules.value = { mutedSourceIds: [], hiddenKeywords: [] }
    automationRules.value = { autoMarkReadSourceIds: [], autoAddReadingListSourceIds: [] }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FEED_FILTER_RULES_STORAGE_KEY)
      localStorage.removeItem(FEED_AUTOMATION_RULES_STORAGE_KEY)
    }
  }
  const unregisterSessionReset = registerSessionReset(pinia, clearUserState)
  onScopeDispose(() => {
    clearUserState()
    unregisterSessionReset()
  })

  const setFilterRules = (rules: Partial<FeedFilterRules>) => {
    const nextRules: FeedFilterRules = {
      mutedSourceIds: normalizeRuleList(rules.mutedSourceIds ?? filterRules.value.mutedSourceIds),
      hiddenKeywords: normalizeRuleList(rules.hiddenKeywords ?? filterRules.value.hiddenKeywords),
    }
    applyFilterRules(nextRules)
    const authStore = useAuthStore()
    if (authStore.isAuthenticated) {
      void apiRequestResult(`${api.url}/feed/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ hidden_keywords: nextRules.hiddenKeywords }),
      }).catch(() => {})
    }
  }

  const applyFilterRules = (rules: FeedFilterRules) => {
    filterRules.value = rules
    writeFilterRules(rules)
  }

  const fetchFilterPreferences = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = preferenceGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/preferences`, { headers: { Authorization: `Bearer ${authStore.token}` } })
      if (!res.ok) return false
      const data = res.data
      if (generation !== preferenceGeneration) return false
      applyFilterRules({ hiddenKeywords: normalizeRuleList(data.data?.hidden_keywords), mutedSourceIds: [] })
      return true
    } catch { return false }
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

  const fetchTimeline = async (
    sourceTypeOrOptions?: string | FeedTimelineFetchOptions,
    sourceId?: number,
    unreadOnly = false,
  ) => {
    const authStore = useAuthStore()
    const generation = timelineGeneration
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
      const res = await apiRequestResult(url, {
        headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
      })
      if (res.ok) {
        const data = res.data
        if (generation !== timelineGeneration) return
        timeline.value = data.data || []
      }
    } catch (e) {
      reportError(e, 'Failed to fetch timeline')
    }
  }

  const markItemsRead = async (feedItemIds: string[]): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!feedItemIds.length) return false
    try {
      const res = await apiRequestResult(`${api.url}/feed/timeline/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_ids: feedItemIds }),
      })
      return res.ok
    } catch (e) {
      reportError(e, 'Failed to mark items read')
    }
    return false
  }

  const markItemsUnread = async (feedItemIds: string[]): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!feedItemIds.length) return false
    try {
      const res = await apiRequestResult(`${api.url}/feed/timeline/mark-unread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ feed_item_ids: feedItemIds }),
      })
      return res.ok
    } catch (e) {
      reportError(e, 'Failed to mark items unread')
    }
    return false
  }

  const markSubscriptionRead = async (subscriptionId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!subscriptionId) return false
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscriptions/${subscriptionId}/mark-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      reportError(e, 'Failed to mark subscription read')
    }
    return false
  }

  const markSubscriptionUnread = async (subscriptionId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!subscriptionId) return false
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscriptions/${subscriptionId}/mark-unread`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      reportError(e, 'Failed to mark subscription unread')
    }
    return false
  }

  const markAllRead = async (): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequestResult(`${api.url}/feed/timeline/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      reportError(e, 'Failed to mark all read')
    }
    return false
  }

  const markAllUnread = async (): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequestResult(`${api.url}/feed/timeline/mark-all-unread`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      return res.ok
    } catch (e) {
      reportError(e, 'Failed to mark all unread')
    }
    return false
  }

  const fetchUnreadFeedItemCount = async (): Promise<number | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return null
    try {
      return await loadUnreadFeedItemCount(api.url, authStore.token)
    } catch (e) {
      reportError(e, 'Failed to fetch unread feed item count')
    }
    return null
  }

  return {
    // Feed
    subscriptions,
    subscriptionRules,
    ruleApplySummary,
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
    fetchFilterPreferences,
    fetchSubscriptionRules,
    fetchGroups,
    createSubscriptionRule,
    createGroup,
    fetchStarGroups,
    createStarGroup,
    updateSubscription,
    updateSubscriptionRule,
    updateGroup,
    deleteSubscriptionRule,
    deleteGroup,
    reorderSubscriptionRules,
    applySubscriptionRules,
    setSubscriptionGroup,
    fetchTimeline,
    subscribe,
    unsubscribe,
    markItemsRead,
    markItemsUnread,
    markSubscriptionRead,
    markSubscriptionUnread,
    markAllFeedRead: markAllRead,
    markAllFeedUnread: markAllUnread,
    fetchUnreadFeedItemCount,
    // Health check
    healthChecking,
    checkSubscriptionHealth,
    checkAllSubscriptionsHealth,
    syncingSubscriptionIds,
    syncingAllSubscriptions,
    subscriptionSyncResults,
    syncSubscription,
    syncAllSubscriptions,
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
    mergeReadingListPageIds,
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
    batchSubscribeSources,
    importOPML,
    exportOPML,
    createSubscriptionFromProvider,
    unsubscribeFromRSS,
    isSubscribedToRSS,
  }
})
