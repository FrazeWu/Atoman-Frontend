import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'

describe('onboarding store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  it('opens onboarding for authenticated user without completion timestamp', () => {
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    }

    const store = useOnboardingStore()
    store.initialize(auth.user)

    expect(store.isVisible).toBe(true)
    expect(store.currentStep).toBe('overview')
  })

  it('does not open onboarding for user already completed', () => {
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: '2026-06-02T10:00:00Z',
    }

    const store = useOnboardingStore()
    store.initialize(auth.user)

    expect(store.isVisible).toBe(false)
  })

  it('marks completion and persists user state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      onboarding_completed_at: '2026-06-02T12:00:00Z',
    }), { status: 200 }))

    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
    auth.user = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    }

    const store = useOnboardingStore()
    store.initialize(auth.user)
    await store.complete()

    expect(store.isVisible).toBe(false)
    expect(auth.user?.onboarding_completed_at).toBe('2026-06-02T12:00:00Z')
    expect(JSON.parse(localStorage.getItem('user') || '{}').onboarding_completed_at).toBe('2026-06-02T12:00:00Z')
  })

  it('completes onboarding after first successful subscription in final step', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      onboarding_completed_at: '2026-06-02T12:00:00Z',
    }), { status: 200 }))

    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.token = 'token'
    auth.user = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    }

    const store = useOnboardingStore()
    store.initialize(auth.user)
    store.currentStep = 'feed-subscribe'
    await store.handleSubscriptionSuccess()

    expect(store.isVisible).toBe(false)
    expect(auth.user?.onboarding_completed_at).toBe('2026-06-02T12:00:00Z')
  })
})
