import { onBeforeUnmount, ref } from 'vue'

import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { TimelineEvent, TimelineRevision } from '@/types'

export function useTimelineHistory() {
  const api = useApi()
  const authStore = useAuthStore()
  const historyEvent = ref<TimelineEvent | null>(null)
  const historyRevisions = ref<TimelineRevision[]>([])
  const loadingHistory = ref(false)
  let historyRequestSequence = 0

  const closeHistory = () => {
    historyRequestSequence += 1
    historyEvent.value = null
    historyRevisions.value = []
    loadingHistory.value = false
  }

  const openHistory = async (event: TimelineEvent) => {
    const requestSequence = ++historyRequestSequence
    const targetEventId = event.id
    const isCurrentRequest = () =>
      requestSequence === historyRequestSequence && historyEvent.value?.id === targetEventId

    historyEvent.value = event
    historyRevisions.value = []
    loadingHistory.value = true
    try {
      const response = await apiRequestResult(`${api.url}/timeline/events/${targetEventId}/history`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!isCurrentRequest() || !response.ok) return

      if (!isCurrentRequest()) return
      historyRevisions.value = response.data.data || []
    } catch {
      if (isCurrentRequest()) historyRevisions.value = []
    } finally {
      if (isCurrentRequest()) loadingHistory.value = false
    }
  }

  onBeforeUnmount(closeHistory)

  return {
    historyEvent,
    historyRevisions,
    loadingHistory,
    closeHistory,
    openHistory,
  }
}
