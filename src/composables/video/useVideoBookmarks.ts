import { computed, ref } from 'vue'

import { apiDeleteJson, apiGet, apiPostJson } from '@/api/client'
import { useApi } from '@/composables/useApi'
import type { Video } from '@/types'

export type VideoBookmark = { id: string; video_id: string; video?: Video }
export type VideoBookmarkState = 'active' | 'completed' | 'all'
export type VideoBookmarkSort = 'latest' | 'popular'

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

  async function load(state: VideoBookmarkState = 'active', sort: VideoBookmarkSort = 'latest') {
    const sequence = ++loadSequence
    loading.value = true
    errorMessage.value = ''
    try {
      const query = new URLSearchParams({ state, sort })
      const items = await apiGet<VideoBookmark[] | null>(`${endpoints.bookmarks}?${query}`)
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

  async function remove(videoId: string) {
    const bookmark = records.value[videoId]
    if (!bookmark || isPending(videoId)) return
    pendingIds.value = new Set([...pendingIds.value, videoId])
    errorMessage.value = ''
    try {
      await apiDeleteJson(endpoints.bookmark(bookmark.id))
      const next = { ...records.value }
      delete next[videoId]
      records.value = next
      localChanges.set(videoId, null)
    } catch (error) {
      errorMessage.value = '稍后再试'
      throw error
    } finally {
      const next = new Set(pendingIds.value)
      next.delete(videoId)
      pendingIds.value = next
    }
  }

  async function removeMany(videoIds: string[]) {
    for (const videoId of videoIds) await remove(videoId)
  }

  function reset() {
    loadSequence += 1
    records.value = {}
    pendingIds.value = new Set()
    errorMessage.value = ''
    localChanges.clear()
  }

  return { records, loading, errorMessage, isBookmarked, bookmarkId, isPending, load, toggle, remove, removeMany, reset }
}
