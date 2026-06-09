import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'
import { vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'

const makeToken = (expSecondsFromNow: number) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }))
  return `${header}.${payload}.signature`
}

async function importRouter(site: string) {
  vi.resetModules()
  window.history.replaceState(null, '', `/?site=${site}`)
  const { default: router } = await import('@/router')
  await router.replace('/')
  return router as Router
}

describe('router auth guards', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }))
    setActivePinia(createPinia())
  })

  it('redirects unauthenticated user to login for protected short routes', async () => {
    const router = await importRouter('blog')
    const auth = useAuthStore()
    auth.logout()

    await router.push('/post/new')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/post/new?site=blog')
  })

  it('redirects non-admin user away from setting admin routes', async () => {
    const router = await importRouter('music')
    const auth = useAuthStore()
    auth.token = makeToken(3600)
    auth.user = { username: 'member', role: 'user' } as never
    auth.isAuthenticated = true

    await router.push('/setting/feed-fulltext')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirects admin away from owner-only setting routes', async () => {
    const router = await importRouter('music')
    const auth = useAuthStore()
    auth.token = makeToken(3600)
    auth.user = { username: 'admin', role: 'admin' } as never
    auth.isAuthenticated = true

    await router.push('/setting/roles')

    expect(router.currentRoute.value.path).toBe('/setting/access')
  })

  it('preserves explicit site context on short internal route pushes', async () => {
    const router = await importRouter('blog')

    await router.push('/post/123')

    expect(router.currentRoute.value.path).toBe('/post/123')
    expect(router.currentRoute.value.query.site).toBe('blog')
  })

  it('initializes onboarding after restoring authenticated session', async () => {
    const auth = useAuthStore()
    const onboarding = useOnboardingStore()
    const initializeSpy = vi.spyOn(onboarding, 'initialize')
    const router = await importRouter('feed')

    auth.token = makeToken(3600)
    auth.user = {
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    } as never
    auth.isAuthenticated = true

    await router.push('/subscriptions')

    expect(initializeSpy).toHaveBeenCalled()
  })
})
