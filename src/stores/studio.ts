import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { apiDeleteJson, apiGet, apiGetEnvelope, apiPatchJson, apiPostJson } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type {
  StudioAnalytics,
  StudioChannel,
  StudioCollection,
  StudioCollectionInput,
  StudioContentFilters,
  StudioContentItem,
  StudioDashboard,
  StudioInteractionFilters,
  StudioInteractionItem,
  StudioModule,
  StudioPagination,
  StudioSettings,
  StudioSettingsInput,
  StudioState,
} from '@/types'

function emptyModuleRecord<T>(factory: () => T): Record<StudioModule, T> {
  return {
    blog: factory(),
    podcast: factory(),
    video: factory(),
  }
}

function appendQuery(url: string, values: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const encoded = query.toString()
  return encoded ? `${url}?${encoded}` : url
}

export const useStudioStore = defineStore('studio', () => {
  const api = useApi().studio
  const auth = useAuthStore()

  const currentChannel = ref<StudioChannel | null>(null)
  const channels = ref<StudioChannel[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const dashboard = ref<StudioDashboard | null>(null)
  const contents = ref(emptyModuleRecord<StudioContentItem[]>(() => []))
  const contentPagination = ref(emptyModuleRecord<StudioPagination | null>(() => null))
  const collections = ref(emptyModuleRecord<StudioCollection[]>(() => []))
  const analytics = ref(emptyModuleRecord<StudioAnalytics | null>(() => null))
  const interactions = ref(emptyModuleRecord<StudioInteractionItem[]>(() => []))
  const interactionPagination = ref(emptyModuleRecord<StudioPagination | null>(() => null))
  const settings = ref(emptyModuleRecord<StudioSettings | null>(() => null))
  const error = ref('')

  let loadStatePromise: Promise<void> | null = null
  let activeReload: (() => Promise<void>) | null = null

  const hasChannel = computed(() => currentChannel.value !== null)

  function applyState(state: StudioState) {
    currentChannel.value = state.current_channel
    channels.value = state.channels ?? []
    loaded.value = true
  }

  function clearResourceCaches() {
    dashboard.value = null
    contents.value = emptyModuleRecord(() => [])
    contentPagination.value = emptyModuleRecord(() => null)
    collections.value = emptyModuleRecord(() => [])
    analytics.value = emptyModuleRecord(() => null)
    interactions.value = emptyModuleRecord(() => [])
    interactionPagination.value = emptyModuleRecord(() => null)
    settings.value = emptyModuleRecord(() => null)
    error.value = ''
  }

  function reset() {
    currentChannel.value = null
    channels.value = []
    loaded.value = false
    loading.value = false
    loadStatePromise = null
    activeReload = null
    clearResourceCaches()
  }

  function channelID() {
    if (!currentChannel.value?.id) throw new Error('请先创建或选择频道')
    return currentChannel.value.id
  }

  async function loadState(force = false) {
    if (!auth.isAuthenticated || !auth.user) {
      reset()
      return
    }
    if (!force && loaded.value) return
    if (!force && loadStatePromise) return loadStatePromise

    loading.value = true
    error.value = ''
    const request = apiGet<StudioState>(api.state)
      .then(applyState)
      .catch((cause) => {
        error.value = cause instanceof Error ? cause.message : '加载创作频道失败'
        throw cause
      })
      .finally(() => {
        loading.value = false
        loadStatePromise = null
      })
    loadStatePromise = request
    return request
  }

  async function selectChannel(selectedChannelID: string) {
    if (currentChannel.value?.id === selectedChannelID) return
    const reload = activeReload
    const state = await apiPatchJson<StudioState>(api.state, { channel_id: selectedChannelID })
    applyState(state)
    clearResourceCaches()
    if (reload) await reload()
  }

  async function loadDashboard(track = true) {
    if (track) activeReload = () => loadDashboard(false)
    dashboard.value = await apiGet<StudioDashboard>(appendQuery(api.dashboard, { channel_id: channelID() }))
  }

  async function loadContents(module: StudioModule, filters: StudioContentFilters, track = true) {
    const snapshot = { ...filters }
    if (track) activeReload = () => loadContents(module, snapshot, false)
    const response = await apiGetEnvelope<StudioContentItem[], StudioPagination>(appendQuery(api.contents(module), {
      channel_id: channelID(),
      q: filters.q.trim(),
      status: filters.status,
      visibility: filters.visibility,
      collection_id: filters.collection_id,
      page: filters.page,
    }))
    contents.value[module] = response.data ?? []
    contentPagination.value[module] = response.meta ?? null
  }

  async function loadCollections(module: StudioModule) {
    collections.value[module] = await apiGet<StudioCollection[]>(appendQuery(api.collections(module), { channel_id: channelID() }))
  }

  async function createCollection(module: StudioModule, input: StudioCollectionInput) {
    await apiPostJson<StudioCollection>(api.collections(module), { ...input, channel_id: channelID() })
    await loadCollections(module)
  }

  async function updateCollection(module: StudioModule, id: string, input: StudioCollectionInput) {
    await apiPatchJson<StudioCollection>(api.collection(module, id), input)
    await loadCollections(module)
  }

  async function deleteCollection(module: StudioModule, id: string) {
    await apiDeleteJson<{ message: string }>(api.collection(module, id))
    await loadCollections(module)
  }

  async function loadAnalytics(module: StudioModule, range: 7 | 28 | 90, track = true) {
    if (track) activeReload = () => loadAnalytics(module, range, false)
    analytics.value[module] = await apiGet<StudioAnalytics>(appendQuery(api.analytics(module), {
      channel_id: channelID(), range,
    }))
  }

  async function loadInteractions(module: StudioModule, filters: StudioInteractionFilters, track = true) {
    const snapshot = { ...filters }
    if (track) activeReload = () => loadInteractions(module, snapshot, false)
    const response = await apiGetEnvelope<StudioInteractionItem[], StudioPagination>(appendQuery(api.interactions(module), {
      channel_id: channelID(), unreplied: filters.unreplied, anchored: filters.anchored, page: filters.page,
    }))
    interactions.value[module] = response.data ?? []
    interactionPagination.value[module] = response.meta ?? null
  }

  async function loadSettings(module: StudioModule, track = true) {
    if (track) activeReload = () => loadSettings(module, false)
    settings.value[module] = await apiGet<StudioSettings>(appendQuery(api.settings(module), { channel_id: channelID() }))
  }

  async function saveSettings(module: StudioModule, input: StudioSettingsInput) {
    settings.value[module] = await apiPatchJson<StudioSettings>(api.settings(module), {
      ...input,
      channel_id: channelID(),
    })
  }

  watch(
    () => auth.isAuthenticated,
    (isAuthenticated) => {
      if (!isAuthenticated) reset()
    },
  )

  return {
    currentChannel,
    channels,
    loaded,
    loading,
    hasChannel,
    dashboard,
    contents,
    contentPagination,
    collections,
    analytics,
    interactions,
    interactionPagination,
    settings,
    error,
    loadState,
    selectChannel,
    loadDashboard,
    loadContents,
    loadCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    loadAnalytics,
    loadInteractions,
    loadSettings,
    saveSettings,
    reset,
  }
})
