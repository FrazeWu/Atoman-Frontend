import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import type { Collection } from '@/types'

export type KanboCollectionType = 'article' | 'podcast' | 'video'

export type KanboCollection = {
  id: string
  type: KanboCollectionType
  name: string
  count?: number
}

const selectedChannelId = ref<string | null>(null)
const selectedCollectionId = ref<string | null>(null)
const selectedCollection = ref<KanboCollection | null>(null)
const collections = ref<KanboCollection[]>([])
const loadingCollections = ref(false)

export function useKanboCollections() {
  const selectCollection = (id: string, type: KanboCollectionType = 'article', name = '') => {
    selectedCollectionId.value = id
    selectedCollection.value = { id, type, name }
  }

  const resetForChannel = (channelId: string | null) => {
    selectedChannelId.value = channelId
    selectedCollectionId.value = null
    selectedCollection.value = null
  }

  const loadCollections = async (channelId: string | null) => {
    if (!channelId) {
      collections.value = []
      return
    }

    loadingCollections.value = true
    try {
      const api = useApi()
      const res = await fetch(api.blog.channelCollections(channelId))
      if (!res.ok) return
      const data = await res.json()
      const rows: Collection[] = Array.isArray(data) ? data : (data.data || [])
      collections.value = rows.map(collection => ({
        id: collection.id,
        type: 'article',
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
