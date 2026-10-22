import { computed, onScopeDispose, ref, watch } from 'vue'
import { searchApi, type SearchHit } from '@/api/search'
import { useAuthStore } from '@/stores/auth'

export function useUnifiedSearchPreview(module = '') {
  const auth = useAuthStore()
  const items = ref<SearchHit[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const partial = ref(false)
  let generation = 0
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  function cancelPending() {
    generation++
    controller?.abort()
    clearTimeout(timer)
  }
  function reset() {
    cancelPending()
    items.value = []
    loading.value = false
    failed.value = false
    partial.value = false
  }
  async function search(q: string, _limit?: number) {
    reset()
    q = q.trim()
    if (Array.from(q).length < 2) return
    const current = generation
    controller = new AbortController()
    loading.value = true
    try {
      const result = await searchApi.search({ q, scope: 'public', module, types: [], sort: '', page: 1, filters: {} }, controller.signal, true)
      if (current !== generation) return
      items.value = (result.groups || []).flatMap(group => group.items || [])
      partial.value = result.partial
    } catch {
      if (current === generation) failed.value = true
    } finally {
      if (current === generation) loading.value = false
    }
  }
  function schedule(q: string, _limit?: number) {
    reset()
    if (Array.from(q.trim()).length < 2) return
    loading.value = true
    timer = setTimeout(() => { void search(q) }, 250)
  }
  watch(() => auth.user?.uuid, reset, { flush: 'sync' })
  onScopeDispose(reset)
  return { items, loading, failed, partial, search, schedule, cancelPending, reset,
    results: computed(() => items.value.map(item => ({
      id: item.id, type: item.type, module: item.module, label: item.title,
      subtitle: item.subtitle, path: item.href, available: true,
    }))),
  }
}
