import { ref } from 'vue'

import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { SubscriptionHubTree } from '@/types'
import { reportError } from '@/utils/logger'

const emptyTree = (): SubscriptionHubTree => ({ types: [] })

export function createSubscriptionHubState() {
  const subscriptionHubTree = ref<SubscriptionHubTree>(emptyTree())
  const loadingSubscriptionHubTree = ref(false)
  const subscriptionHubTreeError = ref('')
  let requestGeneration = 0

  const clearSubscriptionHubState = () => {
    requestGeneration += 1
    subscriptionHubTree.value = emptyTree()
    loadingSubscriptionHubTree.value = false
    subscriptionHubTreeError.value = ''
  }

  const fetchSubscriptionHubTree = async (): Promise<boolean> => {
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
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (generation !== requestGeneration) return false
      if (!response.ok) {
        subscriptionHubTreeError.value = '订阅树加载失败，请重试'
        return false
      }
      const payload = response.data as { data?: SubscriptionHubTree }
      subscriptionHubTree.value = payload.data ?? (response.data as SubscriptionHubTree)
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

  const unsubscribeSubscriptionHubSource = async (feedSourceId: string): Promise<boolean> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return false

    try {
      const api = useApi()
      const response = await apiRequestResult(
        `${api.url}/feed/subscription-hub/sources/${encodeURIComponent(feedSourceId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authStore.token}` },
        },
      )
      return response.ok
    } catch (error) {
      reportError(error, 'Failed to unsubscribe subscription hub source')
      return false
    }
  }

  return {
    subscriptionHubTree,
    loadingSubscriptionHubTree,
    subscriptionHubTreeError,
    fetchSubscriptionHubTree,
    unsubscribeSubscriptionHubSource,
    clearSubscriptionHubState,
  }
}
