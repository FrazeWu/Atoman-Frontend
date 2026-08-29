import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequestResult } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import type { Subscription, TimelineItem } from '@/types'
import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'
import { reportError } from '@/utils/logger'

type FeedSourceTypeFilter = 'all' | 'internal' | 'blog' | 'podcast'

interface FeedTimelineControllerOptions {
  subscriptions: ComputedRef<Subscription[]>
  sourceTypeFilter: Ref<FeedSourceTypeFilter>
  applyAutomationRules: (items: TimelineItem[]) => Promise<void>
  scrollToTop: () => Promise<void>
}

const normalizePage = (value: unknown) => {
  const parsed = Number.parseInt(String(value || '1'), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function useFeedTimelineController({
  subscriptions,
  sourceTypeFilter,
  applyAutomationRules,
  scrollToTop,
}: FeedTimelineControllerOptions) {
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const feedStore = useFeedStore()
  const apiURL = useApiUrl()

  const querySourceId = computed(() => typeof route.query.source_id === 'string' ? route.query.source_id : null)
  const queryGroupId = computed(() => typeof route.query.group_id === 'string' ? route.query.group_id : null)
  const queryPage = computed(() => normalizePage(route.query.page))
  const querySearch = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
  const queryMergeDuplicates = computed(() => route.query.merge_duplicates !== 'false')
  const timelineMode = computed<'chronological' | 'priority'>(() => route.query.sort === 'priority' ? 'priority' : 'chronological')
  const searchInput = ref(querySearch.value)
  const mergeDuplicates = ref(queryMergeDuplicates.value)
  const activeSearchLabel = computed(() => querySearch.value.trim())
  const currentSourceSubscription = computed(() => {
    if (!querySourceId.value) return null
    return subscriptions.value.find((subscription) => subscription.id === querySourceId.value) || null
  })
  const sourceViewMode = computed(() => Boolean(querySourceId.value))
  const canCheckTimelineUpdates = computed(() => {
    if (!authStore.isAuthenticated || querySearch.value.trim() || timelineMode.value === 'priority') return false
    if (sourceTypeFilter.value !== 'all') return false
    const sourceType = currentSourceSubscription.value?.feed_source?.source_type
    return !sourceType || sourceType === 'external_rss'
  })

  const timeline = ref<TimelineItem[]>([])
  const totalItems = ref(0)
  const currentPage = ref(1)
  const pageLimit = 20
  const unreadOnly = ref(false)
  const loadingTimeline = ref(false)
  const timelineError = ref('')
  const markingAllRead = ref(false)
  const timelineUpdatesCursor = ref('')
  const hasNewTimelineContent = ref(false)
  const checkingTimelineUpdates = ref(false)
  const allRead = ref(false)
  const bulkReadLabel = computed(() => {
    if (sourceViewMode.value) return allRead.value ? '当前来源未读' : '当前来源已读'
    return allRead.value ? '全部未读' : '全部已读'
  })
  const emptyTimelineText = computed(() => {
    if (timelineMode.value === 'priority') return '今日精选暂无未读内容'
    if (querySearch.value.trim()) return `没有找到“${querySearch.value.trim()}”`
    if (querySourceId.value || queryGroupId.value) return '当前筛选暂无更新'
    return subscriptions.value.length ? '订阅源暂无更新' : '订阅后开始探索'
  })

  let timelineRequestSequence = 0
  let timelineUpdatesTimer: ReturnType<typeof setInterval> | null = null
  const timelineUpdatesPollInterval = 60_000
  const authHeaders = () => ({ Authorization: `Bearer ${authStore.token}` })

  const setPageInRoute = async (page: number, replace = false) => {
    const normalizedPage = normalizePage(page)
    const query = {
      ...route.query,
      page: normalizedPage > 1 ? String(normalizedPage) : undefined,
    }
    if (replace) {
      await router.replace({ query })
      return
    }
    await router.push({ query })
  }

  const setSearchInRoute = async (value: string) => {
    const search = value.trim()
    await router.replace({
      query: { ...route.query, q: search || undefined, page: undefined },
    })
  }

  const clearSourceFilter = async () => {
    await router.push({
      query: {
        ...route.query,
        source_id: undefined,
        group_id: undefined,
        page: undefined,
      },
    })
  }

  const submitSearch = () => setSearchInRoute(searchInput.value)

  const clearSearch = async () => {
    searchInput.value = ''
    await setSearchInRoute('')
  }

  const updateMergeDuplicates = async () => {
    await router.replace({
      query: {
        ...route.query,
        merge_duplicates: mergeDuplicates.value ? undefined : 'false',
        page: undefined,
      },
    })
  }

  const setTimelineMode = async (mode: 'chronological' | 'priority') => {
    if (mode === timelineMode.value) return
    await router.replace({
      query: {
        ...route.query,
        sort: mode === 'priority' ? 'priority' : undefined,
        page: undefined,
      },
    })
  }

  const changePage = async (page: number) => {
    const normalizedPage = normalizePage(page)
    if (normalizedPage === currentPage.value) return
    await setPageInRoute(normalizedPage)
    await scrollToTop()
  }

  const buildTimelineUpdatesQuery = () => {
    const params = new URLSearchParams()
    if (timelineUpdatesCursor.value) params.set('since', timelineUpdatesCursor.value)
    if (querySourceId.value) params.set('source_id', querySourceId.value)
    if (queryGroupId.value) params.set('group_id', queryGroupId.value)
    return params
  }

  const checkTimelineUpdates = async () => {
    if (
      checkingTimelineUpdates.value
      || !canCheckTimelineUpdates.value
      || typeof document === 'undefined'
      || document.visibilityState === 'hidden'
    ) return

    checkingTimelineUpdates.value = true
    try {
      const response = await apiRequestResult(`${apiURL}/feed/timeline/updates?${buildTimelineUpdatesQuery()}`, {
        headers: authHeaders(),
      })
      if (!response.ok) return
      const payload = response.data
      const update = payload.data ?? payload
      if (typeof update.checked_at !== 'string') return
      if (!timelineUpdatesCursor.value) {
        timelineUpdatesCursor.value = update.checked_at
        return
      }
      if (update.has_updates) {
        hasNewTimelineContent.value = true
        return
      }
      timelineUpdatesCursor.value = update.checked_at
    } catch {
      // The next polling interval retries update checks.
    } finally {
      checkingTimelineUpdates.value = false
    }
  }

  const stopTimelineUpdatesPolling = () => {
    if (!timelineUpdatesTimer) return
    clearInterval(timelineUpdatesTimer)
    timelineUpdatesTimer = null
  }

  const startTimelineUpdatesPolling = () => {
    stopTimelineUpdatesPolling()
    if (
      !canCheckTimelineUpdates.value
      || typeof document === 'undefined'
      || document.visibilityState === 'hidden'
    ) return
    timelineUpdatesTimer = setInterval(() => {
      void checkTimelineUpdates()
    }, timelineUpdatesPollInterval)
  }

  const handleTimelineVisibilityChange = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'hidden') {
      stopTimelineUpdatesPolling()
      return
    }
    void checkTimelineUpdates()
    startTimelineUpdatesPolling()
  }

  const fetchTimeline = async () => {
    const requestSequence = ++timelineRequestSequence
    loadingTimeline.value = true
    timelineError.value = ''
    try {
      if (!authStore.isAuthenticated) {
        timeline.value = []
        feedStore.timeline = []
        totalItems.value = 0
        return
      }

      const params = buildFeedTimelineQuery({
        page: currentPage.value,
        limit: pageLimit,
        sort: timelineMode.value === 'priority' ? 'priority' : undefined,
        sourceId: querySourceId.value,
        groupId: queryGroupId.value,
        unreadOnly: unreadOnly.value,
        hideDuplicates: mergeDuplicates.value && !querySourceId.value,
        q: querySearch.value,
      })
      const response = await apiRequestResult(`${apiURL}/feed/timeline?${params}`, { headers: authHeaders() })
      if (requestSequence !== timelineRequestSequence) return
      if (!response.ok) {
        timelineError.value = '订阅内容加载失败，请稍后重试'
        return
      }

      const data = response.data
      if (requestSequence !== timelineRequestSequence) return
      const items: TimelineItem[] = data.data || []
      const total = data.total ?? data.meta?.total ?? 0
      const totalPages = Math.max(1, Math.ceil(total / pageLimit))
      if (total > 0 && currentPage.value > totalPages) {
        await setPageInRoute(totalPages, true)
        return
      }

      timeline.value = items
      feedStore.timeline = items
      totalItems.value = total
      if (typeof data.meta?.checked_at === 'string') {
        timelineUpdatesCursor.value = data.meta.checked_at
        hasNewTimelineContent.value = false
      }
      await applyAutomationRules(items)
      if (requestSequence !== timelineRequestSequence) return
      if (sourceViewMode.value) {
        const sourceUnreadCount = currentSourceSubscription.value?.unread_count
        allRead.value = typeof sourceUnreadCount === 'number'
          ? sourceUnreadCount === 0
          : !items.some((item) => item.type === 'feed_item' && !item.is_read)
      } else {
        const unreadCount = await feedStore.fetchUnreadFeedItemCount()
        if (requestSequence === timelineRequestSequence && unreadCount !== null) {
          allRead.value = unreadCount === 0
        }
      }
    } catch (error) {
      reportError(error)
      if (requestSequence === timelineRequestSequence) {
        timelineError.value = '订阅内容加载失败，请稍后重试'
      }
    } finally {
      if (requestSequence === timelineRequestSequence) loadingTimeline.value = false
    }
  }

  const refreshNewTimelineContent = async () => {
    if (loadingTimeline.value) return
    hasNewTimelineContent.value = false
    currentPage.value = 1
    await setPageInRoute(1, true)
    await fetchTimeline()
    await scrollToTop()
  }

  const toggleUnreadOnly = () => {
    if (!authStore.isAuthenticated) return
    unreadOnly.value = !unreadOnly.value
    currentPage.value = 1
    void fetchTimeline()
  }

  const toggleAllRead = async () => {
    if (markingAllRead.value) return
    markingAllRead.value = true
    const nextAllRead = !allRead.value
    try {
      if (sourceViewMode.value) {
        const success = nextAllRead
          ? await feedStore.markSubscriptionRead(querySourceId.value!)
          : await feedStore.markSubscriptionUnread(querySourceId.value!)
        if (!success) return
        timeline.value.forEach((item) => {
          if (item.type === 'feed_item') item.is_read = nextAllRead
        })
        await Promise.all([fetchTimeline(), feedStore.fetchSubscriptions()])
        allRead.value = nextAllRead
        return
      }

      const success = nextAllRead
        ? await feedStore.markAllFeedRead()
        : await feedStore.markAllFeedUnread()
      if (!success) return
      timeline.value.forEach((item) => {
        if (item.type === 'feed_item') item.is_read = nextAllRead
      })
      await feedStore.fetchSubscriptions()
      allRead.value = nextAllRead
    } finally {
      markingAllRead.value = false
    }
  }

  watch(querySearch, (next) => {
    searchInput.value = next
  })

  watch([querySourceId, queryGroupId, queryPage, querySearch, queryMergeDuplicates, timelineMode], async () => {
    mergeDuplicates.value = queryMergeDuplicates.value
    currentPage.value = queryPage.value
    await fetchTimeline()
  }, { immediate: true })

  watch(canCheckTimelineUpdates, (canCheck) => {
    if (!canCheck) {
      hasNewTimelineContent.value = false
      timelineUpdatesCursor.value = ''
    }
    startTimelineUpdatesPolling()
  })

  return {
    querySourceId,
    queryGroupId,
    querySearch,
    timelineMode,
    searchInput,
    mergeDuplicates,
    activeSearchLabel,
    currentSourceSubscription,
    sourceViewMode,
    timeline,
    totalItems,
    currentPage,
    pageLimit,
    unreadOnly,
    loadingTimeline,
    timelineError,
    markingAllRead,
    hasNewTimelineContent,
    allRead,
    bulkReadLabel,
    emptyTimelineText,
    clearSourceFilter,
    submitSearch,
    clearSearch,
    updateMergeDuplicates,
    setTimelineMode,
    changePage,
    refreshNewTimelineContent,
    fetchTimeline,
    toggleUnreadOnly,
    toggleAllRead,
    handleTimelineVisibilityChange,
    startTimelineUpdatesPolling,
    stopTimelineUpdatesPolling,
  }
}
