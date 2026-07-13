import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types'

export type OnboardingFeedRecommendation = {
  id: string
  feed_source_id: string
  enabled: boolean
  sort_order: number
  title: string
  category: string
  rss_url: string
  cover_url: string
  health_status: string
}

const pendingStoragePrefix = 'atoman_onboarding_pending:'

function resolveUserKey(user: User | null) {
  if (!user) return null
  return user.uuid || user.id?.toString() || user.username
}

function pendingStorageKey(user: User | null) {
  const userKey = resolveUserKey(user)
  return userKey ? `${pendingStoragePrefix}${userKey}` : null
}

export const useOnboardingStore = defineStore('onboarding', () => {
  const api = useApi()
  const authStore = useAuthStore()

  const isVisible = ref(false)
  const completing = ref(false)
  const loadingRecommendations = ref(false)
  const recommendations = ref<OnboardingFeedRecommendation[]>([])
  const recommendationError = ref('')
  const initializedForUserKey = ref<string | null>(null)

  const reset = () => {
    isVisible.value = false
    completing.value = false
    loadingRecommendations.value = false
    recommendations.value = []
    recommendationError.value = ''
    initializedForUserKey.value = null
  }

  const syncCompletion = async () => {
    if (!authStore.isAuthenticated || !authStore.user || completing.value) return false
    completing.value = true
    try {
      const response = await fetch(api.auth.onboardingComplete, {
        method: 'POST',
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        credentials: 'include',
      })
      if (!response.ok) return false

      const data = await response.json().catch(() => ({}))
      const completedAt = data.onboarding_completed_at || data.data?.onboarding_completed_at
      if (!completedAt) return false

      const key = pendingStorageKey(authStore.user)
      if (key) localStorage.removeItem(key)
      authStore.updateUser({ onboarding_completed_at: completedAt })
      return true
    } catch {
      return false
    } finally {
      completing.value = false
    }
  }

  const initialize = (user = authStore.user) => {
    const userKey = resolveUserKey(user)
    if (!userKey) {
      reset()
      return
    }
    initializedForUserKey.value = userKey
    if (user?.onboarding_completed_at) {
      isVisible.value = false
      return
    }

    const key = pendingStorageKey(user)
    if (key && localStorage.getItem(key) === '1') {
      isVisible.value = false
      void syncCompletion()
      return
    }
    isVisible.value = true
  }

  const loadRecommendations = async () => {
    if (!authStore.isAuthenticated) return
    loadingRecommendations.value = true
    recommendationError.value = ''
    try {
      const response = await fetch(api.auth.onboardingRecommendations, {
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        credentials: 'include',
      })
      if (!response.ok) throw new Error('加载推荐订阅源失败')
      const data = await response.json().catch(() => ({}))
      recommendations.value = Array.isArray(data.items) ? data.items : []
    } catch (error) {
      recommendationError.value = error instanceof Error ? error.message : '加载推荐订阅源失败'
    } finally {
      loadingRecommendations.value = false
    }
  }

  const complete = async () => {
    if (!authStore.user) return false
    isVisible.value = false
    const key = pendingStorageKey(authStore.user)
    if (key) localStorage.setItem(key, '1')
    const completed = await syncCompletion()
    return completed
  }

  const skip = () => complete()
  const handleSubscriptionSuccess = () => complete()

  return {
    isVisible,
    completing,
    loadingRecommendations,
    recommendations,
    recommendationError,
    initialize,
    loadRecommendations,
    complete,
    skip,
    handleSubscriptionSuccess,
    reset,
  }
})
