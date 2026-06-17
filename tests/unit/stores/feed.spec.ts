import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

describe('feed store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setActivePinia(createPinia())

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('uses modular toggle star response data to update starred ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { starred: true },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    const result = await feedStore.toggleStar('feed-item-1')

    expect(result).toBe(true)
    expect(feedStore.starredItemIds.has('feed-item-1')).toBe(true)
  })

  it('uses modular reading-list response data to update saved ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: { saved: true },
    }), { status: 200 }))

    const feedStore = useFeedStore()
    const result = await feedStore.toggleReadingListItem('feed-item-1')

    expect(result).toBe(true)
    expect(feedStore.readingListItemIds.has('feed-item-1')).toBe(true)
  })
})
