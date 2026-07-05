import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import AppTopbarAuthControls from '@/components/system/AppTopbarAuthControls.vue'
import { useAuthStore } from '@/stores/auth'
import { afterEach } from 'vitest'

const mountedWrappers: Array<ReturnType<typeof mount>> = []

const mountTopbar = () => {
  const wrapper = mount(AppTopbarAuthControls, {
    global: {
      plugins: [router],
    },
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/posts', component: { template: '<div />' } },
    { path: '/feed/inbox', component: { template: '<div />' } },
    { path: '/posts/bookmarks', component: { template: '<div />' } },
    { path: '/posts/settings', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ],
})

describe('AppTopbarAuthControls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' }
    authStore.isAuthenticated = true
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/notifications/unread-count') || url.endsWith('/dm/unread-count')) {
        return new Response(JSON.stringify({ count: 0 }), { status: 200 })
      }
      throw new Error(`未 mock fetch: ${url}`)
    })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('renders authenticated inbox and user controls', async () => {
    const wrapper = mountTopbar()

    await wrapper.find('.user-btn').trigger('click')

    expect(wrapper.text()).toContain('alice')
    expect(wrapper.find('a[href="/feed/inbox"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/users/alice"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/posts/bookmarks"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/posts/settings"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/setting"]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('/blog/bookmarks')
  })

  it('shows site settings entry for owner', async () => {
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'owner', email: 'owner@example.com', role: 'owner' }

    const wrapper = mountTopbar()

    await wrapper.find('.user-btn').trigger('click')

    expect(wrapper.find('a[href="/setting"]').exists()).toBe(true)
  })

  it('waits for logout to finish before redirecting to login', async () => {
    const authStore = useAuthStore()
    let resolveLogout: (() => void) | null = null
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve
    })
    const logoutSpy = vi.spyOn(authStore, 'logout').mockReturnValue(logoutPromise)

    await router.push('/posts')
    const wrapper = mountTopbar()

    await wrapper.find('.user-btn').trigger('click')
    await wrapper.find('.dropdown-item-danger').trigger('click')

    expect(logoutSpy).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/posts')

    resolveLogout?.()
    await logoutPromise
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
  })
})
