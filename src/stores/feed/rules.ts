import { ref } from 'vue'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type {
  ApplySubscriptionRulesSummary,
  FeedSubscriptionRule,
  FeedSubscriptionRuleMatchType,
} from '@/types'
import { reportError } from '@/utils/logger'

const api = useApi()
const SUBSCRIPTION_RULES_AVAILABLE = true

interface SubscriptionRulePayload {
  name: string
  enabled: boolean
  match_type: FeedSubscriptionRuleMatchType
  conditions_json: Record<string, unknown>
  action_group_id?: string | null
  action_muted?: boolean | null
  action_auto_mark_read?: boolean | null
  action_auto_add_reading_list?: boolean | null
  position?: number
}

interface ApplySubscriptionRulesPayload {
  rule_id?: string
  all?: boolean
}

const hasSubscriptionRuleAction = (payload: Partial<SubscriptionRulePayload>) =>
  Boolean(payload.action_group_id)
  || Boolean(payload.action_muted)
  || Boolean(payload.action_auto_mark_read)
  || Boolean(payload.action_auto_add_reading_list)

const hasNonEmptyListValue = (value: unknown) =>
  Array.isArray(value) && value.some((entry) => String(entry).trim().length > 0)

const hasSubscriptionRuleConditions = (payload: Partial<SubscriptionRulePayload>) => {
  const conditions = payload.conditions_json || {}
  if (payload.match_type === 'source_category') {
    return hasNonEmptyListValue(conditions.categories) || String(conditions.category || '').trim().length > 0
  }
  if (payload.match_type === 'source_ids') return hasNonEmptyListValue(conditions.source_ids)
  if (payload.match_type === 'keywords') return hasNonEmptyListValue(conditions.keywords)
  return false
}

export const createFeedRulesState = (refreshSubscriptions: () => Promise<boolean>) => {
  const subscriptionRules = ref<FeedSubscriptionRule[]>([])
  const ruleApplySummary = ref<ApplySubscriptionRulesSummary | null>(null)
  let sessionGeneration = 0

  const fetchSubscriptionRules = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      subscriptionRules.value = []
      ruleApplySummary.value = null
      return false
    }
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscription-rules`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!res.ok) return false
      const data = res.data
      if (generation !== sessionGeneration) return false
      subscriptionRules.value = data.data || []
      return true
    } catch (e) {
      reportError(e, 'Failed to fetch subscription rules')
      return false
    }
  }

  const createSubscriptionRule = async (payload: SubscriptionRulePayload): Promise<boolean> => {
    if (!SUBSCRIPTION_RULES_AVAILABLE) return false
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !hasSubscriptionRuleAction(payload) || !hasSubscriptionRuleConditions(payload)) return false
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscription-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok || generation !== sessionGeneration) return false
      await fetchSubscriptionRules()
      return true
    } catch (e) {
      reportError(e, 'Failed to create subscription rule')
    }
    return false
  }

  const updateSubscriptionRule = async (id: string, payload: Partial<SubscriptionRulePayload>): Promise<boolean> => {
    if (!SUBSCRIPTION_RULES_AVAILABLE) return false
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !hasSubscriptionRuleAction(payload) || !hasSubscriptionRuleConditions(payload)) return false
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscription-rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok || generation !== sessionGeneration) return false
      await fetchSubscriptionRules()
      return true
    } catch (e) {
      reportError(e, 'Failed to update subscription rule')
    }
    return false
  }

  const deleteSubscriptionRule = async (id: string): Promise<boolean> => {
    if (!SUBSCRIPTION_RULES_AVAILABLE) return false
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscription-rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!res.ok || generation !== sessionGeneration) return false
      await fetchSubscriptionRules()
      return true
    } catch (e) {
      reportError(e, 'Failed to delete subscription rule')
    }
    return false
  }

  const reorderSubscriptionRules = async (ruleIds: string[]): Promise<boolean> => {
    if (!SUBSCRIPTION_RULES_AVAILABLE) return false
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscription-rules/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ rule_ids: ruleIds }),
      })
      if (!res.ok || generation !== sessionGeneration) return false
      await fetchSubscriptionRules()
      return true
    } catch (e) {
      reportError(e, 'Failed to reorder subscription rules')
    }
    return false
  }

  const applySubscriptionRules = async (payload: ApplySubscriptionRulesPayload): Promise<boolean> => {
    if (!SUBSCRIPTION_RULES_AVAILABLE) return false
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const generation = sessionGeneration
    try {
      const res = await apiRequestResult(`${api.url}/feed/subscription-rules/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok || generation !== sessionGeneration) return false
      const data = res.data
      if (generation !== sessionGeneration) return false
      ruleApplySummary.value = data.data || null
      await refreshSubscriptions()
      return true
    } catch (e) {
      reportError(e, 'Failed to apply subscription rules')
    }
    return false
  }

  const clearRulesState = () => {
    sessionGeneration += 1
    subscriptionRules.value = []
    ruleApplySummary.value = null
  }

  return {
    subscriptionRules,
    ruleApplySummary,
    fetchSubscriptionRules,
    createSubscriptionRule,
    updateSubscriptionRule,
    deleteSubscriptionRule,
    reorderSubscriptionRules,
    applySubscriptionRules,
    clearRulesState,
  }
}
