import { ref } from 'vue'
import { apiRequest } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type {
  FeedStarGroup,
  Subscription,
  SubscriptionGroup,
  SubscriptionSyncResult,
  SubscriptionSyncSummary,
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

export const createFeedCoreState = () => {
  const subscriptions = ref<Subscription[]>([])
  const groups = ref<SubscriptionGroup[]>([])
  const starGroups = ref<FeedStarGroup[]>([])
  const healthChecking = ref(false)
  const syncingSubscriptionIds = ref<Set<string>>(new Set())
  const syncingAllSubscriptions = ref(false)
  const subscriptionSyncResults = ref<Record<string, SubscriptionSyncResult>>({})

  let subscriptionsRequestGeneration = 0
  let groupsRequestGeneration = 0
  let sessionGeneration = 0

  const fetchSubscriptions = async () => {
    const authStore = useAuthStore()
    const generation = ++subscriptionsRequestGeneration
    const userId = authStore.user?.uuid
    const token = authStore.token
    if (!authStore.isAuthenticated) {
      subscriptions.value = []
      return false
    }
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (
        generation !== subscriptionsRequestGeneration
        || authStore.user?.uuid !== userId
        || authStore.token !== token
      ) return false
      if (res.ok) {
        const data = await res.json()
        if (
          generation !== subscriptionsRequestGeneration
          || authStore.user?.uuid !== userId
          || authStore.token !== token
        ) return false
        subscriptions.value = data.data || []
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to fetch subscriptions')
    }
    return false
  }

  const fetchGroups = async () => {
    const authStore = useAuthStore()
    const generation = ++groupsRequestGeneration
    const userId = authStore.user?.uuid
    const token = authStore.token
    if (!authStore.isAuthenticated) {
      groups.value = []
      return false
    }
    try {
      const res = await apiRequest(`${api.url}/feed/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (
        generation !== groupsRequestGeneration
        || authStore.user?.uuid !== userId
        || authStore.token !== token
      ) return false
      if (res.ok) {
        const data = await res.json()
        if (
          generation !== groupsRequestGeneration
          || authStore.user?.uuid !== userId
          || authStore.token !== token
        ) return false
        groups.value = data.data || []
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to fetch groups')
    }
    return false
  }

  const createGroup = async (name: string) => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequest(`${api.url}/feed/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        await fetchGroups()
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to create group')
    }
    return false
  }

  const updateGroup = async (id: string, name: string) => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequest(`${api.url}/feed/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        await fetchGroups()
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to update group')
    }
    return false
  }

  const deleteGroup = async (id: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequest(`${api.url}/feed/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!res.ok) return false
      await fetchGroups()
      await fetchSubscriptions()
      return true
    } catch (e) {
      reportError(e, 'Failed to delete group')
    }
    return false
  }

  const fetchStarGroups = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      starGroups.value = []
      return
    }
    const generation = sessionGeneration
    try {
      const res = await apiRequest(`${api.url}/feed/star-groups`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (generation !== sessionGeneration) return
        starGroups.value = data.data || []
      }
    } catch (e) {
      reportError(e, 'Failed to fetch star groups')
    }
  }

  const createStarGroup = async (name: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = sessionGeneration
    try {
      const res = await apiRequest(`${api.url}/feed/star-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ name }),
      })
      if (res.ok && generation === sessionGeneration) {
        await fetchStarGroups()
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to create star group')
    }
    return false
  }

  const updateSubscription = async (
    id: string,
    payload: {
      title?: string
      group_id?: string
      is_muted?: boolean
      auto_mark_read?: boolean
      auto_add_reading_list?: boolean
    },
  ): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await fetchSubscriptions()
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to update subscription')
    }
    return false
  }

  const setSubscriptionGroup = async (subId: string, groupId: string | null): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions/${subId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ group_id: groupId }),
      })
      if (!res.ok) return false
      await fetchSubscriptions()
      return true
    } catch (e) {
      reportError(e, 'Failed to set subscription group')
    }
    return false
  }

  const subscribe = async (targetType: string, targetId: string, title?: string) => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, title }),
      })
      if (res.ok) await fetchSubscriptions()
    } catch (e) {
      reportError(e, 'Failed to subscribe')
    }
  }

  const unsubscribe = async (subscriptionId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!res.ok) return false
      await fetchSubscriptions()
      return true
    } catch (e) {
      reportError(e, 'Failed to unsubscribe')
    }
    return false
  }

  const checkSubscriptionHealth = async (subscriptionId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = sessionGeneration
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions/${subscriptionId}/health`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok && generation === sessionGeneration) {
        await fetchSubscriptions()
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to check subscription health')
    }
    return false
  }

  const checkAllSubscriptionsHealth = async (): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = sessionGeneration
    healthChecking.value = true
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions/health/check-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (res.ok && generation === sessionGeneration) {
        await fetchSubscriptions()
        return true
      }
    } catch (e) {
      reportError(e, 'Failed to check all subscriptions health')
    } finally {
      if (generation === sessionGeneration) healthChecking.value = false
    }
    return false
  }

  const syncSubscription = async (subscriptionId: string): Promise<SubscriptionSyncResult | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || syncingAllSubscriptions.value || syncingSubscriptionIds.value.has(subscriptionId)) return null
    const generation = sessionGeneration
    syncingSubscriptionIds.value.add(subscriptionId)
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions/${subscriptionId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      const payload = await res.json().catch(() => ({}))
      if (generation !== sessionGeneration) return null
      if (!res.ok) {
        const failed: SubscriptionSyncResult = {
          subscription_id: subscriptionId,
          feed_source_id: '',
          fetched_items: 0,
          new_items: 0,
          synced_at: new Date().toISOString(),
          success: false,
          error: apiErrorMessage(payload, '刷新失败，请重试'),
        }
        subscriptionSyncResults.value = { ...subscriptionSyncResults.value, [subscriptionId]: failed }
        await fetchSubscriptions()
        return failed
      }
      const result = (payload.data ?? payload) as SubscriptionSyncResult
      subscriptionSyncResults.value = { ...subscriptionSyncResults.value, [subscriptionId]: result }
      await fetchSubscriptions()
      return result
    } catch (e) {
      reportError(e, 'Failed to sync subscription')
      return null
    } finally {
      if (generation === sessionGeneration) syncingSubscriptionIds.value.delete(subscriptionId)
    }
  }

  const syncAllSubscriptions = async (): Promise<SubscriptionSyncSummary | null> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || syncingAllSubscriptions.value || syncingSubscriptionIds.value.size > 0) return null
    const generation = sessionGeneration
    syncingAllSubscriptions.value = true
    try {
      const res = await apiRequest(`${api.url}/feed/subscriptions/sync-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      const payload = await res.json().catch(() => ({}))
      if (generation !== sessionGeneration) return null
      if (!res.ok) return null
      const summary = (payload.data ?? payload) as SubscriptionSyncSummary
      subscriptionSyncResults.value = {
        ...subscriptionSyncResults.value,
        ...Object.fromEntries(summary.results.map((result) => [result.subscription_id, result])),
      }
      await fetchSubscriptions()
      return summary
    } catch (e) {
      reportError(e, 'Failed to sync all subscriptions')
      return null
    } finally {
      if (generation === sessionGeneration) syncingAllSubscriptions.value = false
    }
  }

  const clearCoreState = () => {
    sessionGeneration += 1
    subscriptionsRequestGeneration += 1
    groupsRequestGeneration += 1
    subscriptions.value = []
    groups.value = []
    starGroups.value = []
    healthChecking.value = false
    syncingSubscriptionIds.value = new Set()
    syncingAllSubscriptions.value = false
    subscriptionSyncResults.value = {}
  }

  return {
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
  }
}
