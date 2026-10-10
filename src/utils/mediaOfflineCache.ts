export const MEDIA_OFFLINE_CACHE_NAME = 'atoman-media-v1'

function supportsCacheStorage() {
  return typeof window !== 'undefined' && 'caches' in window
}

export async function isMediaCached(url: string): Promise<boolean> {
  if (!url || !supportsCacheStorage()) return false
  try {
    const cache = await caches.open(MEDIA_OFFLINE_CACHE_NAME)
    return Boolean(await cache.match(url))
  } catch {
    return false
  }
}

export async function cacheMediaForOffline(url: string): Promise<boolean> {
  if (!url || !supportsCacheStorage()) return false
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return false
    const cache = await caches.open(MEDIA_OFFLINE_CACHE_NAME)
    await cache.put(url, response.clone())
    return true
  } catch {
    return false
  }
}

export async function getCachedMediaObjectURL(url: string): Promise<string | null> {
  if (!url || !supportsCacheStorage() || typeof URL.createObjectURL !== 'function') return null
  try {
    const cache = await caches.open(MEDIA_OFFLINE_CACHE_NAME)
    const response = await cache.match(url)
    if (!response) return null
    return URL.createObjectURL(await response.blob())
  } catch {
    return null
  }
}

export async function removeCachedMedia(url: string): Promise<void> {
  if (!url || !supportsCacheStorage()) return
  try {
    const cache = await caches.open(MEDIA_OFFLINE_CACHE_NAME)
    await cache.delete(url)
  } catch {
    // Offline cleanup is best effort.
  }
}
