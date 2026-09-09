import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { apiRequestResult } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import type { SubscriptionHubType, TimelineItem } from '@/types'

export function useModuleSubscriptionTimeline(subscriptionType: SubscriptionHubType, pageSize = 20) {
  const route = useRoute()
  const authStore = useAuthStore()
  const feedStore = useFeedStore()
  const apiURL = useApiUrl()
  const items = ref<TimelineItem[]>([])
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const total = ref(0)
  const hasMore = ref(false)
  const unreadOnly = ref(false)
  const markingAllRead = ref(false)
  const lastSyncedAt = ref('')
  const groupId = computed(() => typeof route.query.hub_group_id === 'string' ? route.query.hub_group_id : '')
  const membershipId = computed(() => typeof route.query.hub_membership_id === 'string' ? route.query.hub_membership_id : '')
  let requestSequence = 0

  const fetchPage = async (targetPage = 1, append = false) => {
    if (!authStore.isAuthenticated) {
      items.value = []
      loading.value = false
      return false
    }
    if (append && loading.value) return false

    const sequence = ++requestSequence
    loading.value = true
    error.value = ''
    try {
      const params = new URLSearchParams({
        type: subscriptionType,
        page: String(targetPage),
        limit: String(pageSize),
      })
      if (unreadOnly.value) params.set('is_read', 'false')
      if (groupId.value) params.set('group_id', groupId.value)
      if (membershipId.value) params.set('membership_id', membershipId.value)

      const response = await apiRequestResult(`${apiURL}/feed/subscription-hub/updates?${params}`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (sequence !== requestSequence) return false
      if (!response.ok) throw new Error('subscription updates request failed')

      const payload = response.data as {
        data?: TimelineItem[]
        total?: number
        meta?: { total?: number; has_more?: boolean; checked_at?: string }
      }
      const nextItems = Array.isArray(payload.data) ? payload.data : []
      items.value = append ? [...items.value, ...nextItems] : nextItems
      page.value = targetPage
      total.value = payload.total ?? payload.meta?.total ?? nextItems.length
      hasMore.value = payload.meta?.has_more ?? nextItems.length === pageSize
      lastSyncedAt.value = payload.meta?.checked_at || new Date().toISOString()
      return true
    } catch {
      if (sequence !== requestSequence) return false
      error.value = '订阅内容加载失败'
      return false
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  const loadMore = () => fetchPage(page.value + 1, true)
  const changePage = (targetPage: number) => {
    if (targetPage < 1 || targetPage === page.value || loading.value) return Promise.resolve(false)
    return fetchPage(targetPage)
  }
  const retry = () => fetchPage(page.value)
  const refresh = () => fetchPage(1)
  const toggleUnread = () => {
    unreadOnly.value = !unreadOnly.value
  }
  const markAllRead = async () => {
    if (!authStore.isAuthenticated || markingAllRead.value) return false
    markingAllRead.value = true
    try {
      const endpoint = membershipId.value
        ? `${apiURL}/feed/subscriptions/${membershipId.value}/mark-read`
        : `${apiURL}/feed/timeline/mark-all-read`
      const response = await apiRequestResult(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!response.ok) throw new Error('mark all read failed')
      items.value.forEach((item) => { item.is_read = true })
      await Promise.all([fetchPage(1), feedStore.fetchSubscriptions()])
      return true
    } catch {
      error.value = '标记已读失败，请重试'
      return false
    } finally {
      markingAllRead.value = false
    }
  }

  watch(
    [() => authStore.isAuthenticated, () => authStore.token, groupId, membershipId, unreadOnly],
    () => { void fetchPage(1) },
    { immediate: true },
  )

  onUnmounted(() => {
    requestSequence += 1
  })

  return {
    items,
    loading,
    error,
    page,
    pageSize,
    total,
    hasMore,
    unreadOnly,
    markingAllRead,
    lastSyncedAt,
    fetchPage,
    loadMore,
    changePage,
    retry,
    refresh,
    toggleUnread,
    markAllRead,
  }
}
