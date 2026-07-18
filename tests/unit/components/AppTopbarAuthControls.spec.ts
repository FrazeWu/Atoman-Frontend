import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import AppTopbarAuthControls from '@/components/system/AppTopbarAuthControls.vue'
import { useAuthStore } from '@/stores/auth'
import { afterEach } from 'vitest'

const mountedWrappers: Array<ReturnType<typeof mount>> = []

const mountTopbar = async (path = '/posts') => {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AppTopbarAuthControls, {
    global: {
      plugins: [router],
    },
  })
  mountedWrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/posts', component: { template: '<div />' } },
    { path: '/videos', component: { template: '<div />' } },
    { path: '/podcasts', component: { template: '<div />' } },
    { path: '/inbox', component: { template: '<div />' } },
    { path: '/posts/bookmarks', component: { template: '<div />' } },
    { path: '/site/setting', component: { template: '<div />' } },
    { path: '/users/:handle/settings', component: { template: '<div />' } },
    { path: '/studio', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ],
})

describe('AppTopbarAuthControls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.user = { id: 1, uuid: 'user-1', username: 'alice', email: 'alice@example.com', role: 'user' }
    authStore.isAuthenticated = true
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/notifications/unread-counts')) {
        return new Response(JSON.stringify({ data: { total: 0, items: {} } }), { status: 200 })
      }
      throw new Error(`未 mock fetch: ${url}`)
    })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('renders authenticated inbox and user controls', async () => {
    const wrapper = await mountTopbar()

    await wrapper.find('.user-btn').trigger('click')

    expect(wrapper.text()).toContain('alice')
    expect(wrapper.find('[data-testid="notification-link"]').attributes('href')).toBe('/inbox')
    expect(wrapper.find('[data-testid="notification-menu-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="user-settings-link"]').attributes('href')).toBe('/users/alice/settings')
    expect(wrapper.find('[data-testid="notification-link"]').text()).not.toContain('◌')
    expect(wrapper.find('a[href="/users/alice"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/posts/bookmarks"]').exists()).toBe(false)
    expect(wrapper.findAll('a[href="/users/alice/settings"]').length).toBeGreaterThan(0)
	expect(wrapper.find('a[href="/site/setting"]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('/blog/bookmarks')
  })

  it('renders one creator entry that points to Studio', async () => {
    const wrapper = await mountTopbar()

    const links = wrapper.findAll('a[href="/studio"]')
    expect(links).toHaveLength(1)
    expect(links[0]?.text()).toContain('创作中心')
    expect(wrapper.html()).not.toContain('data-testid="channel-manage-link"')
    expect(wrapper.html()).not.toContain('data-testid="blog-channel-switcher"')
  })

  it('shows site settings entry for owner', async () => {
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'owner', email: 'owner@example.com', role: 'owner' }

    const wrapper = await mountTopbar()

    await wrapper.find('.user-btn').trigger('click')

    expect(wrapper.find('a[href="/site/setting"]').exists()).toBe(true)
  })

  it('waits for logout to finish before redirecting to login', async () => {
    const authStore = useAuthStore()
    let resolveLogout: (() => void) | null = null
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve
    })
    const logoutSpy = vi.spyOn(authStore, 'logout').mockReturnValue(logoutPromise)

    const wrapper = await mountTopbar('/posts')

    await wrapper.find('.user-btn').trigger('click')
    await wrapper.find('.dropdown-item-danger').trigger('click')

    expect(logoutSpy).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/posts')

    resolveLogout?.()
    await logoutPromise
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('routes notification entry directly to inbox without opening a category dropdown', async () => {
    const wrapper = await mountTopbar('/posts')

    const notificationLink = wrapper.find('[data-testid="notification-link"]')

    expect(notificationLink.attributes('href')).toBe('/inbox')
    expect(wrapper.find('[data-testid="notification-menu-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notification-menu-dm"]').exists()).toBe(false)
  })
})
