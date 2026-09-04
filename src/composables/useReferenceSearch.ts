import { ref } from 'vue'
import { referenceApi, type ReferenceTarget, type ReferenceTargetType } from '@/api/references'

type ReferenceSearchOptions = {
  targetTypes: readonly ReferenceTargetType[] | (() => readonly ReferenceTargetType[])
  limit: number | (() => number)
  minQueryLength?: number
  debounceDelay?: number
}

export function useReferenceSearch(options: ReferenceSearchOptions) {
  const results = ref<ReferenceTarget[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const minQueryLength = options.minQueryLength ?? 2
  const debounceDelay = options.debounceDelay ?? 250
  let requestId = 0
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancelPending() {
    requestId += 1
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    controller?.abort()
    controller = null
  }

  function clear() {
    results.value = []
    loading.value = false
    failed.value = false
  }

  const targetTypes = () => typeof options.targetTypes === 'function'
    ? options.targetTypes()
    : options.targetTypes
  const resultLimit = () => typeof options.limit === 'function'
    ? options.limit()
    : options.limit

  async function search(value: string, limit = resultLimit()) {
    cancelPending()
    const currentRequestId = ++requestId
    const query = value.trim()
    if (query.length < minQueryLength) {
      clear()
      return
    }

    const requestController = new AbortController()
    controller = requestController
    loading.value = true
    failed.value = false

    try {
      const targets = await referenceApi.search(
        targetTypes(),
        query,
        limit,
        requestController.signal,
      )
      if (currentRequestId !== requestId) return
      results.value = targets
    } catch {
      if (currentRequestId !== requestId || requestController.signal.aborted) return
      results.value = []
      failed.value = true
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false
        if (controller === requestController) controller = null
      }
    }
  }

  function schedule(value: string, limit = resultLimit()) {
    cancelPending()
    const query = value.trim()
    clear()
    if (query.length < minQueryLength) return

    loading.value = true
    timer = setTimeout(() => {
      timer = null
      void search(query, limit)
    }, debounceDelay)
  }

  function reset() {
    cancelPending()
    clear()
  }

  return { results, loading, failed, search, schedule, cancelPending, reset }
}
