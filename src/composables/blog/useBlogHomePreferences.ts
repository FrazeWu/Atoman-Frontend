import { ref, type Ref, type ComputedRef } from 'vue'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { reportError } from '@/utils/logger'
import type { BlogHomeListItem } from '@/pages/blog/blogHomeTypes'

export interface BlogHomePreferencesContext {
  isSearchMode: Ref<boolean> | ComputedRef<boolean>
  posts: Ref<BlogHomeListItem[]>
  fetchPosts: () => Promise<unknown>
}

export function useBlogHomePreferences(context: BlogHomePreferencesContext) {
  const authStore = useAuthStore()
  const api = useApi()

  const personalizedRecommendations = ref(true)
  const recommendationPreferenceLoading = ref(false)
  const hiddenRecommendation = ref<BlogHomeListItem | null>(null)
  const hidingPostId = ref<string | null>(null)
  const feedbackError = ref('')

  async function loadRecommendationPreference() {
    if (!authStore.isAuthenticated) return
    const response = await apiRequestResult(api.blog.recommendationPreference, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!response.ok) return
    const payload = await Promise.resolve(response.data) as { data?: { enabled?: boolean } }
    personalizedRecommendations.value = payload.data?.enabled !== false
  }

  async function toggleRecommendationPreference() {
    if (!authStore.isAuthenticated || recommendationPreferenceLoading.value) return
    recommendationPreferenceLoading.value = true
    try {
      const next = !personalizedRecommendations.value
      const response = await apiRequestResult(api.blog.recommendationPreference, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({ enabled: next }),
      })
      if (!response.ok) return
      personalizedRecommendations.value = next
      if (!context.isSearchMode.value) await context.fetchPosts()
    } finally {
      recommendationPreferenceLoading.value = false
    }
  }

  async function clearRecommendationData() {
    if (!authStore.isAuthenticated || recommendationPreferenceLoading.value) return
    recommendationPreferenceLoading.value = true
    try {
      const response = await apiRequestResult(api.blog.recommendationData, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (response.ok && !context.isSearchMode.value) await context.fetchPosts()
    } finally {
      recommendationPreferenceLoading.value = false
    }
  }

  const hideRecommendation = async (item: BlogHomeListItem) => {
    if (!authStore.token || hidingPostId.value) return
    hidingPostId.value = item.id
    feedbackError.value = ''
    try {
      const response = await apiRequestResult(api.blog.recommendationFeedback, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ content_id: item.id, action: 'hide' }),
      })
      if (!response.ok) throw new Error('recommendation feedback failed')
      context.posts.value = context.posts.value.filter((post) => post.id !== item.id)
      hiddenRecommendation.value = item
    } catch (error) {
      reportError(error)
      feedbackError.value = '暂时无法更新推荐，请稍后重试'
    } finally {
      hidingPostId.value = null
    }
  }

  const restoreRecommendation = async () => {
    const item = hiddenRecommendation.value
    if (!item || !authStore.token) return
    feedbackError.value = ''
    try {
      const response = await apiRequestResult(api.blog.recommendationFeedbackItem(item.id), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!response.ok) throw new Error('recommendation restore failed')
      hiddenRecommendation.value = null
      await context.fetchPosts()
    } catch (error) {
      reportError(error)
      feedbackError.value = '暂时无法恢复推荐，请稍后重试'
    }
  }

  return {
    personalizedRecommendations,
    recommendationPreferenceLoading,
    hiddenRecommendation,
    hidingPostId,
    feedbackError,
    loadRecommendationPreference,
    toggleRecommendationPreference,
    clearRecommendationData,
    hideRecommendation,
    restoreRecommendation,
  }
}
