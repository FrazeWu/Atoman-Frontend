import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'

const user = {
  uuid: '7f9c8c54-2e8c-42b0-b61c-e4f52ce4d71f',
  id: 1,
  username: 'alice',
  email: 'alice@example.com',
  onboarding_completed_at: null,
}

describe('onboarding store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  const authenticate = () => {
    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
    auth.user = { ...user }
    return auth
  }

  it('loads enabled RSS recommendations', async () => {
    authenticate()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      items: [{
        id: 'recommendation-1',
        feed_source_id: 'source-1',
        title: 'Example Feed',
        category: 'blog',
        rss_url: 'https://example.com/feed.xml',
        cover_url: '',
        health_status: 'healthy',
        enabled: true,
        sort_order: 1,
      }],
    }), { status: 200 }))

    const store = useOnboardingStore()
    await store.loadRecommendations()

    expect(store.recommendations).toHaveLength(1)
    expect(store.recommendations[0]?.title).toBe('Example Feed')
  })

  it('records server completion before updating the user', async () => {
    const auth = authenticate()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      onboarding_completed_at: '2026-07-12T12:00:00Z',
    }), { status: 200 }))

    const store = useOnboardingStore()
    store.initialize(auth.user)
    const completed = await store.complete()

    expect(completed).toBe(true)
    expect(store.isVisible).toBe(false)
    expect(auth.user?.onboarding_completed_at).toBe('2026-07-12T12:00:00Z')
  })

  it('hides locally and queues synchronization when completion fails', async () => {
    const auth = authenticate()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const store = useOnboardingStore()
    store.initialize(auth.user)
    const completed = await store.complete()

    expect(completed).toBe(false)
    expect(store.isVisible).toBe(false)
    expect(auth.user?.onboarding_completed_at).toBeNull()
    expect(localStorage.getItem(`atoman_onboarding_pending:${user.uuid}`)).toBe('1')
  })

  it('retries a pending completion when initialized again', async () => {
    const auth = authenticate()
    localStorage.setItem(`atoman_onboarding_pending:${user.uuid}`, '1')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      onboarding_completed_at: '2026-07-12T13:00:00Z',
    }), { status: 200 }))

    const store = useOnboardingStore()
    store.initialize(auth.user)
    await vi.waitFor(() => expect(auth.user?.onboarding_completed_at).toBe('2026-07-12T13:00:00Z'))

    expect(localStorage.getItem(`atoman_onboarding_pending:${user.uuid}`)).toBeNull()
    expect(store.isVisible).toBe(false)
  })
})
