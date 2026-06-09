import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getBlogCommentMode,
  getFeedFullTextMode,
  isForumCategoryRequestEnabled,
  mergeSiteAccess,
  type ModuleFeatureKey,
  type SiteAccess,
} from '@/config/siteAccess'
import { useApi } from '@/composables/useApi'
import type { ModuleRoomKey } from '@/config/moduleRooms'

export const useSiteAccessStore = defineStore('siteAccess', () => {
  const access = ref<SiteAccess>(mergeSiteAccess(null))
  const loaded = ref(false)
  const loading = ref(false)

  async function load() {
    if (loading.value) return
    loading.value = true

    try {
      const api = useApi()
      const response = await fetch(api.settings.publicSiteAccess)
      if (response.ok) {
        const data = await response.json()
        access.value = mergeSiteAccess(data)
      }
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  async function save(nextAccess: SiteAccess, token: string | null) {
    const api = useApi()
    const response = await fetch(api.settings.siteAccess, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(nextAccess),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || '保存失败')
    }

    const data = await response.json()
    access.value = mergeSiteAccess(data)
  }

  function isModuleVisible(module: ModuleRoomKey) {
    return access.value.modules[module]?.enabled ?? true
  }

  function isFeatureEnabled(module: ModuleRoomKey, feature: ModuleFeatureKey) {
    if (!isModuleVisible(module)) return false
    return access.value.modules[module]?.features?.[feature] ?? true
  }

  const visibleModuleKeys = computed(() => (
    Object.keys(access.value.modules).filter((key) => isModuleVisible(key as ModuleRoomKey)) as ModuleRoomKey[]
  ))

  const blogCommentMode = computed(() => getBlogCommentMode(access.value))
  const feedFullTextMode = computed(() => getFeedFullTextMode(access.value))
  const forumCategoryRequestEnabled = computed(() => isForumCategoryRequestEnabled(access.value))

  return {
    access,
    loaded,
    loading,
    visibleModuleKeys,
    blogCommentMode,
    feedFullTextMode,
    forumCategoryRequestEnabled,
    load,
    save,
    isModuleVisible,
    isFeatureEnabled,
  }
})
