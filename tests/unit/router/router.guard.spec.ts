import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'
import { vi } from 'vitest'
import type { ModuleRoomKey } from '@/config/moduleRooms'
import { installRouteGuards } from '@/router/guards'
import { moduleRoutes } from '@/router/routes/modules'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
import { useSiteAccessStore } from '@/stores/siteAccess'
import ModuleUnavailableView from '@/views/system/ModuleUnavailableView.vue'

const RouteStub = { template: '<main data-test-route-stub />' }

function stubRouteComponents(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => {
    const stubbed: RouteRecordRaw = { ...route }
    if (route.component) stubbed.component = RouteStub
    if (route.components) {
      stubbed.components = Object.fromEntries(Object.keys(route.components).map((name) => [name, RouteStub]))
    }
    if (route.children) stubbed.children = stubRouteComponents(route.children)
    return stubbed
  })
}

const makeToken = (expSecondsFromNow: number) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }))
  return `${header}.${payload}.signature`
}

async function createGuardRouter(site: ModuleRoomKey) {
  const sitePath = site === 'blog' ? '/posts' : `/${site}`
  window.history.replaceState(null, '', sitePath)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...stubRouteComponents(moduleRoutes[site]),
      { path: '/__disabled__', component: ModuleUnavailableView },
    ],
  })
  installRouteGuards(router)
  await router.replace('/')
  return router as Router
}

describe('router auth guards', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.endsWith('/site/access')) {
        return new Response(JSON.stringify({ modules: {} }), { status: 200 })
      }
      return new Response('', { status: 401 })
    })
    setActivePinia(createPinia())
  })

  it('redirects unauthenticated user to login for protected short routes', async () => {
    const router = await createGuardRouter('blog')
    const auth = useAuthStore()
    auth.logout()

    await router.push('/post/new')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/post/new')
  })

  it('allows unauthenticated users to open public content reading routes', async () => {
    const router = await createGuardRouter('feed')
    const auth = useAuthStore()
    auth.logout()

    await router.push('/explore')
    expect(router.currentRoute.value.path).toBe('/explore')

    await router.push('/item/feed-item-1')
    expect(router.currentRoute.value.path).toBe('/item/feed-item-1')

    const mediaRouter = await createGuardRouter('media')
    await mediaRouter.push('/articles')
    expect(mediaRouter.currentRoute.value.path).toBe('/articles')

    await mediaRouter.push('/videos')
    expect(mediaRouter.currentRoute.value.path).toBe('/videos')

    await mediaRouter.push('/podcasts')
    expect(mediaRouter.currentRoute.value.path).toBe('/podcasts')
  })

  it('redirects unauthenticated users away from media subscriptions', async () => {
    const router = await createGuardRouter('media')
    const auth = useAuthStore()
    auth.logout()

    await router.push('/subscriptions')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/subscriptions')
  })

  it('redirects non-admin user away from setting admin routes', async () => {
    const router = await createGuardRouter('music')
    const auth = useAuthStore()
    auth.token = makeToken(3600)
    auth.user = { username: 'member', role: 'user' } as never
    auth.isAuthenticated = true

    await router.push('/setting/feed-fulltext')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirects admin away from owner-only setting routes', async () => {
    const router = await createGuardRouter('music')
    const auth = useAuthStore()
    auth.token = makeToken(3600)
    auth.user = { username: 'admin', role: 'admin' } as never
    auth.isAuthenticated = true

    await router.push('/setting/roles')

    expect(router.currentRoute.value.path).toBe('/setting/access')
  })

  it('keeps internal route pushes path-only', async () => {
    const router = await createGuardRouter('blog')

    await router.push('/post/123')

    expect(router.currentRoute.value.path).toBe('/post/123')
  })

  it('checks module access against the target route path', async () => {
    const router = await createGuardRouter('feed')
    const siteAccess = useSiteAccessStore()
    siteAccess.access.modules.media.enabled = false

    await router.push('/media')

    expect(router.currentRoute.value.path).toBe('/__disabled__')
  })

  it('keeps module routes reachable with default access when site access loading fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }))
    const router = await createGuardRouter('feed')

    await router.push('/media')

    expect(router.currentRoute.value.path).toBe('/media')
  })

  it('keeps login reachable when site access loading fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }))
    const router = await createGuardRouter('feed')

    await router.push('/login')

    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('initializes onboarding after restoring authenticated session', async () => {
    const auth = useAuthStore()
    const onboarding = useOnboardingStore()
    const initializeSpy = vi.spyOn(onboarding, 'initialize')
    const router = await createGuardRouter('feed')

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

  it('resumes onboarding from a route handoff step', async () => {
    const router = await createGuardRouter('feed')
    const auth = useAuthStore()
    const onboarding = useOnboardingStore()

    auth.token = makeToken(3600)
    auth.user = {
      username: 'alice',
      email: 'alice@example.com',
      onboarding_completed_at: null,
    } as never
    auth.isAuthenticated = true

    await router.push({ path: '/', query: { onboarding_step: 'feed-subscribe' } })

    expect(onboarding.isVisible).toBe(true)
    expect(onboarding.currentStep).toBe('feed-subscribe')
  })
})
