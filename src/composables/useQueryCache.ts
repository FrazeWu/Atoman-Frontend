interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<any>>()

export function useQueryCache() {
  const staleTime = 1000 * 60 * 5 // 5 minutes

  const fetchWithCache = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { force?: boolean }
  ): Promise<T> => {
    const cached = cache.get(key)
    const now = Date.now()

    if (cached && !options?.force && now - cached.timestamp < staleTime) {
      // Background revalidate (stale-while-revalidate)
      fetcher().then(data => {
        cache.set(key, { data, timestamp: Date.now() })
      }).catch(err => {
        console.warn('Background revalidation failed for', key, err)
      })
      
      return cached.data
    }

    // Force fetch or stale
    const data = await fetcher()
    cache.set(key, { data, timestamp: now })
    return data
  }

  const invalidate = (keyOrPrefix: string) => {
    for (const key of cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        cache.delete(key)
      }
    }
  }

  const clear = () => cache.clear()

  return {
    fetchWithCache,
    invalidate,
    clear
  }
}
