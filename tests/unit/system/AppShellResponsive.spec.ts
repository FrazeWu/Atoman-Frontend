import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App.vue'

const styleSource = readFileSync(resolve(__dirname, '../../../src/style.css'), 'utf8')
const getBlock = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styleSource.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'm'))
  return match?.[1] ?? ''
}

const getMediaBlock = (query: string) => {
  const marker = `@media ${query}`
  const start = styleSource.indexOf(marker)
  if (start === -1) return ''

  const openBrace = styleSource.indexOf('{', start)
  if (openBrace === -1) return ''

  let depth = 1
  let index = openBrace + 1
  while (index < styleSource.length && depth > 0) {
    const char = styleSource[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    index += 1
  }

  return depth === 0 ? styleSource.slice(openBrace + 1, index - 1) : ''
}

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>sidebar route</div>' }, meta: { hasSidebar: true } },
    { path: '/plain', component: { template: '<div>plain route</div>' } },
    { path: '/login', component: { template: '<div>login route</div>' }, meta: { authLayout: true } },
  ],
})

const mountAppAt = async (path: string) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = makeRouter()
  await router.push(path)
  await router.isReady()

  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router],
      stubs: {
        RouterView: { template: '<div class="router-view-stub" />' },
        FirstLoginOnboarding: { template: '<div class="first-login-stub" />' },
        SiteFooter: { template: '<footer class="site-footer-stub" />' },
        AppTopbar: { template: '<header class="topbar-stub" />' },
      },
    },
  })

  await flushPromises()
  return { wrapper, router }
}

describe('App responsive shell', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/site/access')) {
        return new Response(JSON.stringify({ modules: {} }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    })
  })

  it('mounts mobile bottom nav on sidebar module routes', async () => {
    const { wrapper } = await mountAppAt('/')

    expect(wrapper.findComponent({ name: 'MobileBottomNav' }).exists()).toBe(true)
  })

  it('does not mount mobile bottom nav on non-sidebar routes', async () => {
    const { wrapper } = await mountAppAt('/plain')

    expect(wrapper.findComponent({ name: 'MobileBottomNav' }).exists()).toBe(false)
  })

  it('does not mount mobile bottom nav on auth layout routes', async () => {
    const { wrapper } = await mountAppAt('/login')

    expect(wrapper.findComponent({ name: 'MobileBottomNav' }).exists()).toBe(false)
  })
})

describe('shared responsive shell CSS', () => {
  const hasSidebarBlock = getBlock('.has-sidebar')
  const mainContentBlock = getBlock('.a-main-content')
  const tabletBlock = getMediaBlock('(max-width: 1023px)')
  const mobileBlock = getMediaBlock('(max-width: 767px)')

  it('defines a tablet band that narrows sidebar occupancy before mobile', () => {
    expect(tabletBlock).toContain('.has-sidebar')
    expect(tabletBlock).toContain('--a-sidebar-width: 4.5rem;')
  })

  it('collapses sidebar occupancy and shows the mobile shell hook on small screens', () => {
    expect(mobileBlock).toContain('.p-sidebar,')
    expect(mobileBlock).toContain('.a-sidebar')
    expect(mobileBlock).toContain('display: none;')
    expect(mobileBlock).toContain('.mobile-bottom-nav')
    expect(mobileBlock).toContain('display: grid;')
  })

  it('defines shared desktop offsets for the responsive shell', () => {
    expect(hasSidebarBlock).toContain('--a-mobile-nav-offset: 0px;')
    expect(mainContentBlock).toContain('calc(12rem + var(--a-mobile-nav-offset))')
  })

  it('reserves safe-area space for the mobile bottom navigation', () => {
    expect(mobileBlock).toContain('--a-sidebar-width: 0px;')
    expect(mobileBlock).toContain('--a-mobile-nav-offset: 5.5rem;')
    expect(mobileBlock).toContain('calc(7rem + env(safe-area-inset-bottom))')
  })
})
