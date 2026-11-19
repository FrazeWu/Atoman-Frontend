import { ref } from 'vue'
import { createRequestCoalescer } from '@/utils/coalesceRequest'

import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { SubscriptionHubTree } from '@/types'
import { reportError } from '@/utils/logger'

const emptyTree = (): SubscriptionHubTree => ({ types: [] })

const isSubscriptionHubTree = (value: unknown): value is SubscriptionHubTree => (
  Boolean(value) &&
  typeof value === 'object' &&
  Array.isArray((value as { types?: unknown }).types)
)

export function createSubscriptionHubState(onUnsubscribe?: (feedSourceId: string) => void) {
  const subscriptionHubTree = ref<SubscriptionHubTree>(emptyTree())
  const subscriptionHubTreeLoaded = ref(false)
  const loadingSubscriptionHubTree = ref(false)
  const subscriptionHubTreeError = ref('')
  let requestGeneration = 0
  let invalidationGeneration = 0
  const requests = createRequestCoalescer<boolean>()

  const clearSubscriptionHubState = () => {
    invalidationGeneration += 1
    requestGeneration += 1
    subscriptionHubTree.value = emptyTree()
    subscriptionHubTreeLoaded.value = false
    loadingSubscriptionHubTree.value = false
    subscriptionHubTreeError.value = ''
  }

  const loadSubscriptionHubTree = async (): Promise<boolean> => {
    const authStore = useAuthStore()
    const generation = ++requestGeneration
    if (!authStore.isAuthenticated) {
      clearSubscriptionHubState()
      return false
    }

    loadingSubscriptionHubTree.value = true
    subscriptionHubTreeError.value = ''
    try {
      const api = useApi()
      const response = await apiRequestResult(`${api.url}/feed/subscription-hub/tree`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (generation !== requestGeneration) return false
      if (!response.ok) {
        subscriptionHubTreeError.value = '订阅树加载失败，请重试'
        return false
      }
      const payload = response.data as { data?: unknown }
      const candidate = payload.data ?? response.data
      if (!isSubscriptionHubTree(candidate)) {
        subscriptionHubTreeError.value = '订阅树加载失败，请重试'
        return false
      }
      subscriptionHubTree.value = candidate
      subscriptionHubTreeLoaded.value = true
      return true
    } catch (error) {
      if (generation === requestGeneration) {
        reportError(error, 'Failed to load subscription hub tree')
        subscriptionHubTreeError.value = '订阅树加载失败，请重试'
      }
      return false
    } finally {
      if (generation === requestGeneration) loadingSubscriptionHubTree.value = false
    }
  }

  const fetchSubscriptionHubTree = (force = false) => {
    if (force) {
      requestGeneration += 1
      invalidationGeneration += 1
    }
    const auth = useAuthStore()
    return requests(JSON.stringify([invalidationGeneration, auth.user?.uuid, auth.token, auth.isAuthenticated]), loadSubscriptionHubTree)
  }

  const removeSubscriptionHubSources = (ids: string[]) => {
    // 删除成功后先更新本地，刷新失败也不能重新显示旧的订阅关系。
    requestGeneration += 1
    invalidationGeneration += 1
    loadingSubscriptionHubTree.value = false
    for (const node of subscriptionHubTree.value.types) {
      for (const group of node.groups) {
        group.memberships = group.memberships.filter(entry => !ids.includes(entry.feed_source_id))
      }
    }
  }

  const unsubscribeSubscriptionHubSource = async (feedSourceId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false
    const token = authStore.token

    try {
      const api = useApi()
      const response = await apiRequestResult(
        `${api.url}/feed/subscription-hub/sources/${encodeURIComponent(feedSourceId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authStore.token}` },
        },
      )
      if (!response.ok || authStore.token !== token || !authStore.isAuthenticated) return false
      removeSubscriptionHubSources([feedSourceId])
      onUnsubscribe?.(feedSourceId)
      return true
    } catch (error) {
      reportError(error, 'Failed to unsubscribe subscription hub source')
      return false
    }
  }

  return {
    subscriptionHubTree,
    subscriptionHubTreeLoaded,
    loadingSubscriptionHubTree,
    subscriptionHubTreeError,
    fetchSubscriptionHubTree,
    removeSubscriptionHubSources,
    unsubscribeSubscriptionHubSource,
    clearSubscriptionHubState,
  }
}
