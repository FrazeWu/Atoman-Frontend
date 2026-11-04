import { ref } from 'vue'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { reportError } from '@/utils/logger'
import { unwrapBlogDigest, type BlogDigestPayload } from '@/pages/blog/blogHomeTypes'

export function useBlogHomeDigest() {
  const authStore = useAuthStore()
  const blogSheets = useBlogSheets()
  const api = useApi()

  const digest = ref<BlogDigestPayload | null>(null)
  const digestLoading = ref(false)
  const digestError = ref(false)

  const fetchDigest = async () => {
    if (!authStore.token) {
      digest.value = null
      digestError.value = false
      return
    }
    digestLoading.value = true
    digestError.value = false
    try {
      const response = await apiRequestResult(api.blog.digest, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!response.ok) throw new Error('digest request failed')
      const nextDigest = unwrapBlogDigest(response.data)
      if (!nextDigest) throw new Error('invalid digest response')
      digest.value = nextDigest.total > 0 ? nextDigest : null
    } catch (error) {
      reportError(error)
      digest.value = null
      digestError.value = true
    } finally {
      digestLoading.value = false
    }
  }

  const openDigestItem = (item: BlogDigestPayload['items'][number]) => {
    blogSheets.openPost(item.id, item.title)
  }

  return {
    digest,
    digestLoading,
    digestError,
    fetchDigest,
    openDigestItem,
  }
}
