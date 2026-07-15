import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

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

  it('resumes the feed subscription step after a cross-module handoff', () => {
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    }

    const store = useOnboardingStore()
    store.initialize(auth.user, 'feed-subscribe')

    expect(store.isVisible).toBe(true)
    expect(store.currentStep).toBe('feed-subscribe')
  })

  it.each([
    ['network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['non-2xx', () => Promise.resolve(new Response('', { status: 500 }))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('keeps onboarding retryable after %s', async (_case, response) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(response)

    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
    auth.user = {
      uuid: '7f9c8c54-2e8c-42b0-b61c-e4f52ce4d71f',
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    }

    const store = useOnboardingStore()
    store.initialize(auth.user, 'feed-subscribe')
    await expect(store.complete()).resolves.toBeUndefined()

    expect(store.isVisible).toBe(true)
    expect(store.currentStep).toBe('feed-subscribe')
    expect(store.completing).toBe(false)
    expect(auth.user?.onboarding_completed_at).toBeNull()
    expect(localStorage.getItem('atoman_onboarding_completed_at:7f9c8c54-2e8c-42b0-b61c-e4f52ce4d71f')).toBeNull()
  })

  it('ignores and removes the current user legacy completion key', () => {
    const userId = '7f9c8c54-2e8c-42b0-b61c-e4f52ce4d71f'
    const legacyKey = `atoman_onboarding_completed_at:${userId}`
    localStorage.setItem(legacyKey, '2026-06-02T10:00:00Z')
    localStorage.setItem('unrelated', 'keep')

    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = {
      uuid: userId,
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    }

    const store = useOnboardingStore()
    store.initialize(auth.user)

    expect(store.isVisible).toBe(true)
    expect(auth.user.onboarding_completed_at).toBeNull()
    expect(localStorage.getItem(legacyKey)).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })

  it.each([
    ['numeric string', '2026'],
    ['date only', '2026-06-02'],
    ['invalid month', '2026-13-02T12:00:00Z'],
    ['normalized invalid date', '2026-02-30T12:00:00Z'],
    ['invalid leap day', '2026-02-29T12:00:00Z'],
    ['invalid hour', '2026-06-02T24:00:00Z'],
    ['invalid minute', '2026-06-02T12:60:00Z'],
    ['invalid second', '2026-06-02T12:00:60Z'],
    ['invalid timezone offset', '2026-06-02T12:00:00+24:00'],
    ['invalid timezone offset minute', '2026-06-02T12:00:00+08:60'],
  ])('keeps onboarding retryable for %s completion time', async (_case, completedAt) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      onboarding_completed_at: completedAt,
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
    store.initialize(auth.user, 'feed-subscribe')
    await store.complete()

    expect(store.isVisible).toBe(true)
    expect(store.currentStep).toBe('feed-subscribe')
    expect(auth.user.onboarding_completed_at).toBeNull()
  })

  it.each([
    '2026-06-02T12:00:00Z',
    '2026-06-02T12:00:00.123Z',
    '2026-06-02T12:00:00+08:30',
  ])('accepts RFC3339 completion time %s', async (completedAt) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      onboarding_completed_at: completedAt,
    }), { status: 200 }))

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
    await store.complete()

    expect(store.isVisible).toBe(false)
    expect(auth.user.onboarding_completed_at).toBe(completedAt)
  })

  it('does not let a completion response update the same user after reset', async () => {
    const oldResponse = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(oldResponse.promise)

    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = {
      uuid: 'alice-id',
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    }
    const store = useOnboardingStore()
    store.initialize(auth.user)
    const oldCompletion = store.complete()

    store.reset()
    store.initialize(auth.user)

    oldResponse.resolve(new Response(JSON.stringify({
      onboarding_completed_at: '2026-06-02T12:00:00Z',
    }), { status: 200 }))
    await oldCompletion

    expect(auth.user.onboarding_completed_at).toBeNull()
    expect(store.isVisible).toBe(true)
  })

  it('keeps completing true when an old request finishes during a new request', async () => {
    const oldResponse = deferred<Response>()
    const newResponse = deferred<Response>()
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise)

    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = {
      uuid: 'alice-id',
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    }
    const store = useOnboardingStore()
    store.initialize(auth.user)
    const oldCompletion = store.complete()

    store.reset()
    store.initialize(auth.user)
    const newCompletion = store.complete()

    oldResponse.resolve(new Response(JSON.stringify({
      onboarding_completed_at: '2026-06-02T12:00:00Z',
    }), { status: 200 }))
    await oldCompletion
    expect(store.completing).toBe(true)
    expect(auth.user.onboarding_completed_at).toBeNull()

    newResponse.resolve(new Response(JSON.stringify({
      onboarding_completed_at: '2026-06-03T12:00:00Z',
    }), { status: 200 }))
    await newCompletion
    expect(store.completing).toBe(false)
    expect(auth.user.onboarding_completed_at).toBe('2026-06-03T12:00:00Z')
  })

  it('sends only one completion request while completing', async () => {
    const response = deferred<Response>()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise)

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

    const firstCompletion = store.complete()
    const duplicateCompletion = store.complete()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    response.resolve(new Response(JSON.stringify({
      onboarding_completed_at: '2026-06-02T12:00:00Z',
    }), { status: 200 }))
    await Promise.all([firstCompletion, duplicateCompletion])
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
