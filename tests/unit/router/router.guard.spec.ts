import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'
import { vi } from 'vitest'
import type { ModuleRoomKey } from '@/config/moduleRooms'
import { installRouteGuards } from '@/router/guards'
import { buildAppRoutes } from '@/router/buildAppRoutes'
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

async function createMusicAppGuardRouter() {
  window.history.replaceState(null, '', '/music')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: stubRouteComponents(buildAppRoutes()),
  })
  installRouteGuards(router)
  await router.replace('/music')
  return router as Router
}

function createPendingPromise<T>() {
  return new Promise<T>(() => {})
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

    await router.push('/bookmarks')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/bookmarks')
  })

  it('allows unauthenticated users to open public content reading routes', async () => {
    const router = await createGuardRouter('feed')
    const auth = useAuthStore()
    auth.logout()

    await router.push('/explore')
    expect(router.currentRoute.value.path).toBe('/explore')

    await router.push('/item/feed-item-1')
    expect(router.currentRoute.value.path).toBe('/item/feed-item-1')

    const blogRouter = await createGuardRouter('blog')
    await blogRouter.push('/post/123')
    expect(blogRouter.currentRoute.value.path).toBe('/post/123')
  })

  it('does not block the public music home route on a pending session restore', async () => {
    window.history.replaceState(null, '', '/music')
    const auth = useAuthStore()
    const restoreSessionSpy = vi.spyOn(auth, 'restoreSession').mockReturnValue(createPendingPromise<boolean>())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: stubRouteComponents(moduleRoutes.music),
    })
    installRouteGuards(router)

    let navigationFinished = false
    void router.push('/').then(() => {
      navigationFinished = true
    })

    await new Promise(resolve => setTimeout(resolve, 20))

    expect(navigationFinished).toBe(true)
    expect(router.currentRoute.value.path).toBe('/')
    expect(restoreSessionSpy).not.toHaveBeenCalled()
  })

  it('continues to wait for session restoration on protected music routes', async () => {
    const router = await createGuardRouter('music')
    const auth = useAuthStore()
    const restoreSessionSpy = vi.spyOn(auth, 'restoreSession').mockReturnValue(createPendingPromise<boolean>())

    let navigationFinished = false
    void router.push('/history').then(() => {
      navigationFinished = true
    })

    await new Promise(resolve => setTimeout(resolve, 20))

    expect(navigationFinished).toBe(false)
    expect(restoreSessionSpy).toHaveBeenCalled()
  })

  it.each([
    ['artist creation', '/music?editor=artist-create&name=Seed%20Artist'],
    ['album editing', '/music?editor=album-edit&album=album-42'],
  ])('redirects unauthenticated users from direct music %s queries', async (_editor, target) => {
    const router = await createMusicAppGuardRouter()
    const auth = useAuthStore()
    await auth.logout()

    await router.push(target)

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe(target)
  })

  it('keeps the artist name while redirecting the legacy creation route through login', async () => {
    const router = await createMusicAppGuardRouter()
    const auth = useAuthStore()
    await auth.logout()

    await router.push('/music/artist/new?name=Seed%20Artist')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/music?editor=artist-create&name=Seed+Artist')
  })

  it('keeps the album id while redirecting the legacy edit route through login', async () => {
    const router = await createMusicAppGuardRouter()
    const auth = useAuthStore()
    await auth.logout()

    await router.push('/music/album/album-42/edit')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/music?editor=album-edit&album=album-42')
  })

  it('allows a direct artist creation query after restoring a cookie session', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/auth/session')) {
        return new Response(JSON.stringify({
          csrf_token: 'csrf-restored',
          user: { username: 'cookie-user', email: 'cookie@example.com', role: 'user' },
        }), { status: 200 })
      }
      if (url.endsWith('/site/access')) {
        return new Response(JSON.stringify({ modules: {} }), { status: 200 })
      }
      return new Response('', { status: 401 })
    })
    const router = await createMusicAppGuardRouter()
    const auth = useAuthStore()
    const restoreSessionSpy = vi.spyOn(auth, 'restoreSession')

    await router.push('/music?editor=artist-create&name=Cookie%20Artist')

    expect(restoreSessionSpy).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.fullPath).toBe('/music?editor=artist-create&name=Cookie%20Artist')
    expect(auth.isAuthenticated).toBe(true)
  })

  it('allows an authenticated user to access a direct album edit query without restoring', async () => {
    const router = await createMusicAppGuardRouter()
    const auth = useAuthStore()
    auth.token = makeToken(3600)
    auth.user = { username: 'member', role: 'user' } as never
    auth.isAuthenticated = true
    const restoreSessionSpy = vi.spyOn(auth, 'restoreSession')

    await router.push('/music?editor=album-edit&album=album-42')

    expect(restoreSessionSpy).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/music?editor=album-edit&album=album-42')
  })

  it('redirects unauthenticated users away from blog subscriptions', async () => {
    const router = await createGuardRouter('blog')
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

    await router.push('/site/setting')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('allows admin to open the unified site setting route', async () => {
    const router = await createGuardRouter('music')
    const auth = useAuthStore()
    auth.token = makeToken(3600)
    auth.user = { username: 'admin', role: 'admin' } as never
    auth.isAuthenticated = true

    await router.push('/site/setting')

    expect(router.currentRoute.value.path).toBe('/site/setting')
  })

  it('keeps internal route pushes path-only', async () => {
    const router = await createGuardRouter('blog')

    await router.push('/post/123')

    expect(router.currentRoute.value.path).toBe('/post/123')
  })

  it('checks module access against the target route path', async () => {
    const router = await createGuardRouter('feed')
    const siteAccess = useSiteAccessStore()
    siteAccess.access.modules.podcast.enabled = false

    await router.push('/podcasts')

    expect(router.currentRoute.value.path).toBe('/__disabled__')
  })

  it('keeps module routes reachable with default access when site access loading fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }))
    const router = await createGuardRouter('feed')

    await router.push('/podcasts')

    expect(router.currentRoute.value.path).toBe('/podcasts')
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

})
