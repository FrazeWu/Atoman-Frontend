import { useApiUrl } from '@/composables/useApi'
import { apiRequest } from '@/api/client'

export const BOOK_OFFLINE_CACHE_NAME = 'atoman-books-offline-v1'

const cachedRevisionIds = new Set<string>()
let isCacheInitialized = false

export function supportsCacheStorage(): boolean {
  return typeof window !== 'undefined' && 'caches' in window
}

export function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)
  return `${formatted} ${units[i] || 'MB'}`
}

export function getRevisionContentUrl(revisionId: string): string {
  return `${useApiUrl()}/books/asset-revisions/${encodeURIComponent(revisionId)}/content`
}

export async function initBookOfflineCache(): Promise<Set<string>> {
  if (!supportsCacheStorage()) return cachedRevisionIds
  if (isCacheInitialized) return cachedRevisionIds

  try {
    const cache = await caches.open(BOOK_OFFLINE_CACHE_NAME)
    const requests = await cache.keys()
    cachedRevisionIds.clear()
    for (const req of requests) {
      const match = req.url.match(/\/asset-revisions\/([^/]+)\/content/)
      if (match && match[1]) {
        try {
          cachedRevisionIds.add(decodeURIComponent(match[1]))
        } catch {
          cachedRevisionIds.add(match[1])
        }
      }
    }
    isCacheInitialized = true
  } catch {
    // 离线缓存索引构建失败为容错降级
  }
  return cachedRevisionIds
}

export function isRevisionCachedSync(revisionId: string): boolean {
  if (!revisionId || !supportsCacheStorage()) return false
  return cachedRevisionIds.has(revisionId)
}

export async function isRevisionCached(revisionId: string): Promise<boolean> {
  if (!revisionId || !supportsCacheStorage()) return false
  if (cachedRevisionIds.has(revisionId)) return true
  try {
    const cache = await caches.open(BOOK_OFFLINE_CACHE_NAME)
    const match = await cache.match(getRevisionContentUrl(revisionId))
    const cached = Boolean(match)
    if (cached) {
      cachedRevisionIds.add(revisionId)
    } else {
      cachedRevisionIds.delete(revisionId)
    }
    return cached
  } catch {
    return false
  }
}

export async function cacheBookRevision(revisionId: string): Promise<boolean> {
  if (!revisionId || !supportsCacheStorage()) return false
  const contentUrl = getRevisionContentUrl(revisionId)
  try {
    const response = await apiRequest(contentUrl, { cache: 'no-store' })
    if (!response.ok) return false
    const cache = await caches.open(BOOK_OFFLINE_CACHE_NAME)
    await cache.put(contentUrl, response.clone())
    cachedRevisionIds.add(revisionId)
    return true
  } catch {
    return false
  }
}

export async function removeCachedBookRevision(revisionId: string): Promise<boolean> {
  if (!revisionId || !supportsCacheStorage()) return false
  cachedRevisionIds.delete(revisionId)
  try {
    const cache = await caches.open(BOOK_OFFLINE_CACHE_NAME)
    const deleted = await cache.delete(getRevisionContentUrl(revisionId))
    return deleted
  } catch {
    return false
  }
}

export interface BookOfflineStorageInfo {
  count: number
  totalBytes: number
  revisionIds: string[]
}

export async function getBookOfflineStorageInfo(): Promise<BookOfflineStorageInfo> {
  if (!supportsCacheStorage()) {
    return { count: 0, totalBytes: 0, revisionIds: [] }
  }
  try {
    const cache = await caches.open(BOOK_OFFLINE_CACHE_NAME)
    const requests = await cache.keys()
    let totalBytes = 0
    const revisionIds: string[] = []

    for (const req of requests) {
      const match = req.url.match(/\/asset-revisions\/([^/]+)\/content/)
      if (match && match[1]) {
        try {
          revisionIds.push(decodeURIComponent(match[1]))
        } catch {
          revisionIds.push(match[1])
        }
      }
      try {
        const response = await cache.match(req)
        if (response) {
          const blob = await response.blob()
          totalBytes += blob.size
        }
      } catch {
        // 单个响应计算容错
      }
    }

    return {
      count: revisionIds.length,
      totalBytes,
      revisionIds,
    }
  } catch {
    return { count: 0, totalBytes: 0, revisionIds: [] }
  }
}

export async function clearAllBookOfflineCache(): Promise<boolean> {
  if (!supportsCacheStorage()) return false
  cachedRevisionIds.clear()
  try {
    return await caches.delete(BOOK_OFFLINE_CACHE_NAME)
  } catch {
    return false
  }
}
