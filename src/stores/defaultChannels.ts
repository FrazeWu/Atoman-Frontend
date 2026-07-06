import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { apiGet, apiPatchJson } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

export type DefaultChannelModule = 'blog' | 'podcast' | 'video'

export type DefaultChannelSummary = {
  id: string
  name: string
  slug?: string
}

export type DefaultChannelMap = Record<DefaultChannelModule, DefaultChannelSummary | null>

const defaultChannelModules: DefaultChannelModule[] = ['blog', 'podcast', 'video']

function emptyChannels(): DefaultChannelMap {
  return {
    blog: null,
    podcast: null,
    video: null,
  }
}

function normalizeChannel(value: unknown): DefaultChannelSummary | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return null

  return {
    id: candidate.id,
    name: candidate.name,
    slug: typeof candidate.slug === 'string' ? candidate.slug : undefined,
  }
}

function normalizeChannelMap(payload: unknown): DefaultChannelMap {
  const base = emptyChannels()
  if (!payload || typeof payload !== 'object') return base

  const candidate = payload as Partial<Record<DefaultChannelModule, unknown>>
  for (const module of defaultChannelModules) {
    base[module] = normalizeChannel(candidate[module])
  }
  return base
}

export function isDefaultChannelModule(value: string): value is DefaultChannelModule {
  return defaultChannelModules.includes(value as DefaultChannelModule)
}

export function defaultChannelManagePath(module: DefaultChannelModule) {
  switch (module) {
    case 'blog':
      return '/posts/channels'
    case 'video':
      return '/videos/manage'
    case 'podcast':
      return '/podcasts/editor'
  }
}

export const useDefaultChannelsStore = defineStore('defaultChannels', () => {
  const api = useApi()
  const authStore = useAuthStore()

  const channels = ref<DefaultChannelMap>(emptyChannels())
  const loaded = ref(false)
  const loading = ref(false)
  let loadPromise: Promise<void> | null = null

  const hasAnyChannel = computed(() => defaultChannelModules.some((module) => !!channels.value[module]?.name.trim()))

  function reset() {
    channels.value = emptyChannels()
    loaded.value = false
    loading.value = false
    loadPromise = null
  }

  async function load(force = false) {
    if (!authStore.isAuthenticated || !authStore.user) {
      reset()
      return
    }

    if (!force && loaded.value) return
    if (!force && loadPromise) return loadPromise

    loading.value = true
    const request = apiGet<Partial<Record<DefaultChannelModule, DefaultChannelSummary | null>>>(api.users.meDefaultChannels)
      .then((payload) => {
        channels.value = normalizeChannelMap(payload)
        loaded.value = true
      })
      .finally(() => {
        loading.value = false
        loadPromise = null
      })

    loadPromise = request
    return request
  }

  async function setDefaultChannel(module: DefaultChannelModule, channelId: string) {
    const channel = await apiPatchJson<DefaultChannelSummary>(
      api.users.meDefaultChannel(module),
      { channel_id: channelId },
    )
    channels.value = {
      ...channels.value,
      [module]: normalizeChannel(channel),
    }
    loaded.value = true
  }

  function channelFor(module: DefaultChannelModule) {
    return channels.value[module]
  }

  return {
    channels,
    loaded,
    loading,
    hasAnyChannel,
    reset,
    load,
    setDefaultChannel,
    channelFor,
  }
})
