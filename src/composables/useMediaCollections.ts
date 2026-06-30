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

type BackendMediaCollection = Collection & {
  type?: unknown
}

const normalizeMediaCollectionType = (type: unknown): MediaCollectionType => (
  type === 'podcast' || type === 'video' ? type : 'article'
)

const selectedChannelId = ref<string | null>(null)
const selectedCollectionId = ref<string | null>(null)
const selectedCollection = ref<MediaCollection | null>(null)
const collections = ref<MediaCollection[]>([])
const loadingCollections = ref(false)

export function useMediaCollections() {
  const selectCollection = (id: string, type: MediaCollectionType = 'article', name = '') => {
    selectedCollectionId.value = id
    selectedCollection.value = { id, type, name }
  }

  const resetForChannel = (channelId: string | null) => {
    selectedChannelId.value = channelId
    selectedCollectionId.value = null
    selectedCollection.value = null
    collections.value = []
  }

  const loadCollections = async (channelId: string | null) => {
    if (!channelId) {
      collections.value = []
      return
    }

    loadingCollections.value = true
    try {
      const api = useApi()
      const data = await apiGetRaw<BackendMediaCollection[] | { data?: BackendMediaCollection[] }>(api.blog.channelCollections(channelId))
      const rows: BackendMediaCollection[] = Array.isArray(data) ? data : (data.data || [])
      collections.value = rows.map(collection => ({
        id: collection.id,
        type: normalizeMediaCollectionType(collection.type),
        name: collection.name,
      }))
    } finally {
      loadingCollections.value = false
    }
  }

  const clearSelectionForTest = () => {
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
