interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()
const defaultStaleTime = 1000 * 60 * 5
let cacheGeneration = 0

export function clearQueryCache() {
  cacheGeneration += 1
  cache.clear()
}

export type QueryCacheOptions = {
  force?: boolean
  staleTime?: number
}

export function useQueryCache() {
  const fetchWithCache = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: QueryCacheOptions,
  ): Promise<T> => {
    const cached = cache.get(key)
    const now = Date.now()
    const staleTime = options?.staleTime ?? defaultStaleTime

    if (cached && !options?.force && now - cached.timestamp < staleTime) {
      return cached.data as T
    }

    const running = inFlight.get(key)
    if (running) return running as Promise<T>

    const requestGeneration = cacheGeneration
    const request = Promise.resolve()
      .then(fetcher)
      .then((data) => {
        if (requestGeneration === cacheGeneration) cache.set(key, { data, timestamp: Date.now() })
        return data
      })
      .finally(() => {
        inFlight.delete(key)
      })
    inFlight.set(key, request)
    return request
  }

  const invalidate = (keyOrPrefix: string) => {
    for (const key of cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        cache.delete(key)
      }
    }
  }

  const clear = clearQueryCache

  return {
    fetchWithCache,
    invalidate,
    clear
  }
}
