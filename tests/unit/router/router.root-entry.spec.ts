import { createPinia, setActivePinia } from 'pinia'

const makeToken = (expSecondsFromNow: number) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }))
  return `${header}.${payload}.signature`
}

const importRouter = async (sitePath: string | null = null) => {
  vi.resetModules()

  if (sitePath) {
    window.history.replaceState(null, '', `/?site=${sitePath}`)
  } else {
    window.history.replaceState(null, '', '/')
  }

  const { default: router } = await import('@/router')
  return router
}

describe('router root entry routing', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }))
    setActivePinia(createPinia())
  })

  it('keeps anonymous feed root traffic on the public feed home path', async () => {
    const router = await importRouter()

    await router.replace('/')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('keeps blog root traffic on the blog home path', async () => {
    const router = await importRouter('blog')

    await router.replace('/')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('keeps authenticated feed root traffic on the feed home path', async () => {
    localStorage.setItem('token', makeToken(3600))
    localStorage.setItem('user', JSON.stringify({ username: 'demo', role: 'user' }))

    const router = await importRouter()

    await router.replace('/')

    expect(router.currentRoute.value.path).toBe('/')
  })
})
