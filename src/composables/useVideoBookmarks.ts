import { computed, ref } from 'vue'

import { apiDeleteJson, apiGet, apiPostJson } from '@/api/client'
import { useApi } from '@/composables/useApi'

type VideoBookmark = { id: string; video_id: string }

const records = ref<Record<string, VideoBookmark>>({})
const loading = ref(false)
const pendingIds = ref(new Set<string>())
const errorMessage = ref('')

export function useVideoBookmarks() {
  const endpoints = useApi().videos
  const bookmarkedIds = computed(() => new Set(Object.keys(records.value)))
  const isBookmarked = (videoId: string) => bookmarkedIds.value.has(videoId)
  const bookmarkId = (videoId: string) => records.value[videoId]?.id ?? null
  const isPending = (videoId: string) => pendingIds.value.has(videoId)

  async function load() {
    loading.value = true
    errorMessage.value = ''
    try {
      const items = await apiGet<VideoBookmark[]>(endpoints.bookmarks)
      records.value = Object.fromEntries(items.map(item => [String(item.video_id), item]))
    } finally {
      loading.value = false
    }
  }

  async function toggle(videoId: string) {
    if (isPending(videoId)) return
    pendingIds.value = new Set([...pendingIds.value, videoId])
    errorMessage.value = ''
    const existing = records.value[videoId]
    try {
      if (existing) {
        await apiDeleteJson(endpoints.bookmark(existing.id))
        const next = { ...records.value }
        delete next[videoId]
        records.value = next
      } else {
        const created = await apiPostJson<VideoBookmark>(endpoints.bookmarks, { video_id: videoId })
        records.value = { ...records.value, [videoId]: created }
      }
    } catch (error) {
      errorMessage.value = '稍后再试'
      throw error
    } finally {
      const next = new Set(pendingIds.value)
      next.delete(videoId)
      pendingIds.value = next
    }
  }

  function reset() {
    records.value = {}
    pendingIds.value = new Set()
    errorMessage.value = ''
  }

  return { records, loading, errorMessage, isBookmarked, bookmarkId, isPending, load, toggle, reset }
}
