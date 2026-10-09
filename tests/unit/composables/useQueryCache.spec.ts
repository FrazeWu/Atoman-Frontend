import { describe, expect, it } from 'vitest'
import { clearQueryCache, useQueryCache } from '@/composables/useQueryCache'

describe('useQueryCache session isolation', () => {
  it('clears cached private data when the session changes', async () => {
    const cache = useQueryCache()
    let calls = 0

    await cache.fetchWithCache('private:user-a', async () => ++calls)
    clearQueryCache()
    const value = await cache.fetchWithCache('private:user-a', async () => ++calls)

    expect(value).toBe(2)
  })

  it('does not let an old request repopulate the cache after clearing', async () => {
    const cache = useQueryCache()
    clearQueryCache()
    let release!: (value: number) => void
    const pending = cache.fetchWithCache('private:user-a', () => new Promise<number>((resolve) => { release = resolve }))

    await Promise.resolve()
    clearQueryCache()
    release(1)
    await pending
    const value = await cache.fetchWithCache('private:user-a', async () => 2)

    expect(value).toBe(2)
  })
})
