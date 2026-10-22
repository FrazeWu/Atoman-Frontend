import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { searchApi, type SearchCapabilities, type SearchResponse, type SearchState } from '@/api/search'
import { useAuthStore } from '@/stores/auth'

// 结果只存于当前组件，不持久化、不跨账号复用。
export function useUnifiedSearch(state: Ref<SearchState>, preview = false) {
  const auth = useAuthStore()
  const capabilities = ref<SearchCapabilities | null>(null)
  const result = ref<SearchResponse | null>(null)
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | undefined
  const selectedModule = computed(() => capabilities.value?.modules.find(m => m.module === state.value.module))
  const selectedType = computed(() => selectedModule.value?.types.find(t => state.value.types.length === 1 && t.key === state.value.types[0]))
  const capability = computed(() => selectedType.value || selectedModule.value)

  function reset() {
    generation++
    controller?.abort()
    result.value = null
    capabilities.value = null
    loading.value = false
    error.value = ''
  }
  async function load() {
    reset()
    const current = generation
    const request = new AbortController()
    controller = request
    const input: SearchState = JSON.parse(JSON.stringify(state.value))
    if (input.scope === 'mine' && !auth.user?.uuid) {
      error.value = '请先登录，再搜索我的内容。'
      return
    }
    loading.value = true
    try {
      const caps = await searchApi.capabilities(input.scope, request.signal)
      if (current !== generation) return
      capabilities.value = caps
      if (preview && Array.from(input.q).length < 2) return
      if (!input.q && (!input.module || !input.types.length || !capability.value?.allow_empty_query)) return
      const response = await searchApi.search(input, request.signal, preview)
      if (current === generation) result.value = response
    } catch {
      if (current === generation && !request.signal.aborted) error.value = '搜索加载失败，请重试或调整筛选。'
    } finally {
      if (current === generation) loading.value = false
    }
  }
  watch([state, () => auth.user?.uuid], () => { void load() }, { deep: true, immediate: true, flush: 'sync' })
  onScopeDispose(reset)
  return { capabilities, result, loading, error, selectedModule, selectedType, capability, reload: load, reset }
}
