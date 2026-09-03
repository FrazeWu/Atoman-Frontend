import { computed, ref } from 'vue'

import { apiDeleteJson, apiGet, apiPostJson } from '@/api/client'
import { useApi } from '@/composables/useApi'

type VideoBookmark = { id: string; video_id: string }

const records = ref<Record<string, VideoBookmark>>({})
const loading = ref(false)
const pendingIds = ref(new Set<string>())
const errorMessage = ref('')
const localChanges = new Map<string, VideoBookmark | null>()
let loadSequence = 0

export function useVideoBookmarks() {
  const endpoints = useApi().videos
  const bookmarkedIds = computed(() => new Set(Object.keys(records.value)))
  const isBookmarked = (videoId: string) => bookmarkedIds.value.has(videoId)
  const bookmarkId = (videoId: string) => records.value[videoId]?.id ?? null
  const isPending = (videoId: string) => pendingIds.value.has(videoId)

  async function load() {
    const sequence = ++loadSequence
    loading.value = true
    errorMessage.value = ''
    try {
      const items = await apiGet<VideoBookmark[] | null>(endpoints.bookmarks)
      if (sequence !== loadSequence) return

      const next = Object.fromEntries((items ?? []).map(item => [String(item.video_id), item]))
      for (const [videoId, change] of localChanges) {
        if (change) next[videoId] = change
        else delete next[videoId]
      }
      records.value = next
      localChanges.clear()
    } catch (error) {
      if (sequence === loadSequence) errorMessage.value = '稍后看加载失败，请重试'
      throw error
    } finally {
      if (sequence === loadSequence) loading.value = false
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
        localChanges.set(videoId, null)
      } else {
        const created = await apiPostJson<VideoBookmark>(endpoints.bookmarks, { video_id: videoId })
        records.value = { ...records.value, [videoId]: created }
        localChanges.set(videoId, created)
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
    loadSequence += 1
    records.value = {}
    pendingIds.value = new Set()
    errorMessage.value = ''
    localChanges.clear()
  }

  return { records, loading, errorMessage, isBookmarked, bookmarkId, isPending, load, toggle, reset }
}
