import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { apiRequest } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import type { Collection } from '@/types'
import { normalizeBlogCollectionSelection } from '@/utils/blogCollectionSelection'
import { reportError } from '@/utils/logger'
import type {
  PostEditorDraftForm,
  SaveTarget,
} from '@/composables/blog/usePostEditorDraftSession'

interface PostEditorCollectionsOptions {
  isEdit: ComputedRef<boolean>
  form: Ref<PostEditorDraftForm>
  preferredPublishStatus: Ref<SaveTarget>
  error: Ref<string>
}

export function usePostEditorCollections({
  isEdit,
  form,
  preferredPublishStatus,
  error,
}: PostEditorCollectionsOptions) {
  const route = useRoute()
  const api = useApi()
  const authStore = useAuthStore()
  const studio = useStudioStore()

  const channelCollections = ref<Collection[]>([])
  const selectedCollectionIds = ref<string[]>([])
  const existingCollectionIds = ref<string[]>([])
  const currentChannelId = computed(() => studio.currentChannel?.id || '')
  const defaultCollectionId = computed(() => channelCollections.value.find((collection) => collection.is_default)?.id)
  const selectedNonDefaultCollectionId = computed(() => (
    channelCollections.value.find((collection) => (
      !collection.is_default && selectedCollectionIds.value.includes(collection.id)
    ))?.id || ''
  ))
  const primaryCollectionId = computed(() => (
    selectedNonDefaultCollectionId.value
    || channelCollections.value.find((collection) => (
      collection.is_default && selectedCollectionIds.value.includes(collection.id)
    ))?.id
    || ''
  ))
  const derivedChannelId = computed(() => (
    channelCollections.value.find((collection) => selectedCollectionIds.value.includes(collection.id))?.channel_id || ''
  ))
  const authHeaders = computed(() => {
    const headers: Record<string, string> = {}
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
    return headers
  })

  const ensureDefaultSelection = () => {
    selectedCollectionIds.value = normalizeBlogCollectionSelection(
      channelCollections.value,
      selectedNonDefaultCollectionId.value,
    )
  }

  const loadChannelCollections = async () => {
    if (!authStore.isAuthenticated) {
      channelCollections.value = []
      selectedCollectionIds.value = []
      existingCollectionIds.value = []
      return
    }

    if (!currentChannelId.value) {
      channelCollections.value = []
      selectedCollectionIds.value = []
      return
    }

    try {
      await Promise.all([studio.loadCollections('blog'), studio.loadSettings('blog')])
      channelCollections.value = studio.collections.blog
      if (!isEdit.value) {
        const queryCollection = typeof route.query.collection === 'string' ? route.query.collection : ''
        const settings = studio.settings.blog
        preferredPublishStatus.value = settings?.default_publish_status || 'published'
        if (settings?.default_visibility) {
          form.value.visibility = settings.default_visibility === 'subscribers'
            ? 'followers'
            : settings.default_visibility
        }
        selectedCollectionIds.value = normalizeBlogCollectionSelection(
          channelCollections.value,
          queryCollection || settings?.default_collection_id || null,
        )
      } else {
        const ordinaryCollection = channelCollections.value.find((collection) => (
          !collection.is_default && existingCollectionIds.value.includes(collection.id)
        ))
        selectedCollectionIds.value = normalizeBlogCollectionSelection(
          channelCollections.value,
          ordinaryCollection?.id,
        )
      }
    } catch (cause) {
      reportError(cause)
      error.value = '加载合集失败'
    }
  }

  const onCollectionSelect = (id: string) => {
    selectedCollectionIds.value = normalizeBlogCollectionSelection(channelCollections.value, id || null)
  }

  const syncPostCollections = async (postId: string) => {
    const target = Array.from(new Set(selectedCollectionIds.value))
    const existing = Array.from(new Set(existingCollectionIds.value))
    const toAdd = target.filter((id) => !existing.includes(id))
    const toRemove = existing.filter((id) => !target.includes(id))

    for (const id of toAdd) {
      const response = await apiRequest(api.blog.postCollections(postId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders.value },
        body: JSON.stringify({ collection_id: id }),
      })
      if (!response.ok) throw new Error('添加文章合集失败')
    }
    for (const id of toRemove) {
      const response = await apiRequest(api.blog.postCollection(postId, id), {
        method: 'DELETE',
        headers: authHeaders.value,
      })
      if (!response.ok) throw new Error('移除文章合集失败')
    }
    existingCollectionIds.value = [...target]
  }

  return {
    channelCollections,
    selectedCollectionIds,
    existingCollectionIds,
    currentChannelId,
    defaultCollectionId,
    selectedNonDefaultCollectionId,
    primaryCollectionId,
    derivedChannelId,
    authHeaders,
    ensureDefaultSelection,
    loadChannelCollections,
    onCollectionSelect,
    syncPostCollections,
  }
}
