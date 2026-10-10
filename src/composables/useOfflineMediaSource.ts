import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { cacheMediaForOffline, getCachedMediaObjectURL, isMediaCached, removeCachedMedia } from '@/utils/mediaOfflineCache'

export function useOfflineMediaSource(source: Readonly<Ref<string>>) {
  const playbackUrl = ref(source.value)
  const isCached = ref(false)
  const isCaching = ref(false)
  const cacheError = ref('')
  let objectUrl = ''
  let requestID = 0

  function releaseObjectURL() {
    if (!objectUrl) return
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }

  async function refresh() {
    const url = source.value
    const request = ++requestID
    releaseObjectURL()
    playbackUrl.value = url
    isCached.value = await isMediaCached(url)
    if (!isCached.value || request !== requestID) return
    const cachedUrl = await getCachedMediaObjectURL(url)
    if (request !== requestID) {
      if (cachedUrl) URL.revokeObjectURL(cachedUrl)
      return
    }
    if (cachedUrl) {
      objectUrl = cachedUrl
      playbackUrl.value = cachedUrl
    }
  }

  async function cacheCurrentMedia() {
    const url = source.value
    if (!url || isCaching.value) return false
    isCaching.value = true
    cacheError.value = ''
    try {
      const cached = await cacheMediaForOffline(url)
      if (!cached) {
        cacheError.value = '当前媒体无法保存离线副本'
        return false
      }
      await refresh()
      return true
    } finally {
      isCaching.value = false
    }
  }

  async function removeCurrentMedia() {
    const url = source.value
    if (!url) return false
    await removeCachedMedia(url)
    requestID += 1
    releaseObjectURL()
    playbackUrl.value = url
    isCached.value = false
    return true
  }

  watch(source, () => { void refresh() }, { immediate: true })
  onBeforeUnmount(releaseObjectURL)

  return { playbackUrl, isCached, isCaching, cacheError, cacheCurrentMedia, removeCurrentMedia, refresh }
}
