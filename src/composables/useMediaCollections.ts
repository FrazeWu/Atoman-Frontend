import { ref } from 'vue'
import { apiGetRaw } from '@/api/client'
import { useApi } from '@/composables/useApi'
import type { Collection } from '@/types'

export type MediaCollectionType = 'article' | 'podcast' | 'video'

export type MediaCollection = {
  id: string
  type: MediaCollectionType
  name: string
  count?: number
}

const selectedChannelId = ref<string | null>(null)
const selectedCollectionId = ref<string | null>(null)
const selectedCollection = ref<MediaCollection | null>(null)
const collections = ref<MediaCollection[]>([])
const loadingCollections = ref(false)
let latestLoadCollectionsRequest = 0

export function useMediaCollections() {
  const selectCollection = (id: string, type: MediaCollectionType = 'article', name = '') => {
    selectedCollectionId.value = id
    selectedCollection.value = { id, type, name }
  }

  const resetForChannel = (channelId: string | null) => {
    latestLoadCollectionsRequest += 1
    selectedChannelId.value = channelId
    selectedCollectionId.value = null
    selectedCollection.value = null
    collections.value = []
    loadingCollections.value = false
  }

  const loadCollections = async (channelId: string | null, type: MediaCollectionType = 'article') => {
    const requestId = ++latestLoadCollectionsRequest
    if (!channelId) {
      collections.value = []
      loadingCollections.value = false
      return
    }

    loadingCollections.value = true
    try {
      const api = useApi()
      const data = await apiGetRaw<Collection[] | { data?: Collection[] }>(api.blog.channelCollections(channelId))
      if (requestId !== latestLoadCollectionsRequest) return
      const rows: Collection[] = Array.isArray(data) ? data : (data.data || [])
      collections.value = rows.map(collection => ({
        id: collection.id,
        type,
        name: collection.name,
      }))
    } catch (error) {
      if (requestId !== latestLoadCollectionsRequest) return
      throw error
    } finally {
      if (requestId === latestLoadCollectionsRequest) loadingCollections.value = false
    }
  }

  const clearSelectionForTest = () => {
    latestLoadCollectionsRequest += 1
    selectedChannelId.value = null
    selectedCollectionId.value = null
    selectedCollection.value = null
    collections.value = []
    loadingCollections.value = false
  }

  return {
    collections,
    loadingCollections,
    selectedChannelId,
    selectedCollectionId,
    selectedCollection,
    selectCollection,
    resetForChannel,
    loadCollections,
    clearSelectionForTest,
  }
}
