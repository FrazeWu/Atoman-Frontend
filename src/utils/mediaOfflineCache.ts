export const MEDIA_OFFLINE_CACHE_NAME = 'atoman-media-v1'

const cachedMediaUrlIndex = new Set<string>()
let isIndexInitialized = false

function supportsCacheStorage() {
  return typeof window !== 'undefined' && 'caches' in window
}

export async function initMediaOfflineCacheIndex(): Promise<Set<string>> {
  if (!supportsCacheStorage()) return cachedMediaUrlIndex
  if (isIndexInitialized) return cachedMediaUrlIndex

  try {
    const cache = await caches.open(MEDIA_OFFLINE_CACHE_NAME)
    if (typeof cache.keys === 'function') {
      const requests = await cache.keys()
      cachedMediaUrlIndex.clear()
      for (const req of requests) {
        cachedMediaUrlIndex.add(req.url)
      }
    }
    isIndexInitialized = true
  } catch {
    // Cache indexing is best effort.
  }
  return cachedMediaUrlIndex
}

export function isMediaCachedSync(url: string): boolean {
  if (!url || !supportsCacheStorage()) return false
  if (cachedMediaUrlIndex.has(url)) return true
  try {
    const parsed = new URL(url, window.location.href)
    return cachedMediaUrlIndex.has(parsed.href)
  } catch {
    return false
  }
}

export async function isMediaCached(url: string): Promise<boolean> {
  if (!url || !supportsCacheStorage()) return false
  if (isMediaCachedSync(url)) return true
  try {
    const cache = await caches.open(MEDIA_OFFLINE_CACHE_NAME)
    const match = await cache.match(url)
    const cached = Boolean(match)
    if (cached) {
      cachedMediaUrlIndex.add(url)
    } else {
      cachedMediaUrlIndex.delete(url)
    }
    return cached
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
    cachedMediaUrlIndex.add(url)
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
    cachedMediaUrlIndex.add(url)
    return URL.createObjectURL(await response.blob())
  } catch {
    return null
  }
}

export async function removeCachedMedia(url: string): Promise<void> {
  if (!url || !supportsCacheStorage()) return
  cachedMediaUrlIndex.delete(url)
  try {
    const cache = await caches.open(MEDIA_OFFLINE_CACHE_NAME)
    await cache.delete(url)
  } catch {
    // Offline cleanup is best effort.
  }
}
