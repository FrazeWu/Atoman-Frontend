import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import type { ModuleRoomKey } from '@/config/moduleRooms'
import { installRouteGuards } from '@/router/guards'
import { moduleRoutes } from '@/router/routes/modules'

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

const createRootRouter = async (sitePath: ModuleRoomKey | null = null) => {
  if (sitePath) {
    window.history.replaceState(null, '', `/?site=${sitePath}`)
  } else {
    window.history.replaceState(null, '', '/')
  }

  const module = sitePath ?? 'feed'
  const router = createRouter({
    history: createMemoryHistory(),
    routes: stubRouteComponents(moduleRoutes[module]),
  })
  installRouteGuards(router)
  return router
}

describe('router root entry routing', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }))
    setActivePinia(createPinia())
  })

  it('keeps anonymous feed root traffic on the public feed home path', async () => {
    const router = await createRootRouter()

    await router.replace('/')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('keeps blog root traffic on the blog home path', async () => {
    const router = await createRootRouter('blog')

    await router.replace('/')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('keeps authenticated feed root traffic on the feed home path', async () => {
    localStorage.setItem('token', makeToken(3600))
    localStorage.setItem('user', JSON.stringify({ username: 'demo', role: 'user' }))

    const router = await createRootRouter()

    await router.replace('/')

    expect(router.currentRoute.value.path).toBe('/')
  })
})
