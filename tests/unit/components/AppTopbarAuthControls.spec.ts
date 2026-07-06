import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import AppTopbarAuthControls from '@/components/system/AppTopbarAuthControls.vue'
import { useAuthStore } from '@/stores/auth'
import { afterEach } from 'vitest'

const mountedWrappers: Array<ReturnType<typeof mount>> = []

const defaultChannelsPayload = {
  blog: { id: 'blog-channel-1', name: '博客默认频道', slug: 'blog-default' },
  video: { id: 'video-channel-1', name: '视频默认频道', slug: 'video-default' },
  podcast: { id: 'podcast-channel-1', name: '播客默认频道', slug: 'podcast-default' },
}

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
    { path: '/feed/inbox', component: { template: '<div />' } },
    { path: '/posts/bookmarks', component: { template: '<div />' } },
    { path: '/posts/settings', component: { template: '<div />' } },
    { path: '/posts/channels', component: { template: '<div />' } },
    { path: '/videos/manage', component: { template: '<div />' } },
    { path: '/podcasts/editor', component: { template: '<div />' } },
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
      if (url.endsWith('/users/me/default-channels')) {
        return new Response(JSON.stringify({ data: defaultChannelsPayload }), { status: 200 })
      }
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
    const wrapper = await mountTopbar()

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

    const wrapper = await mountTopbar()

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

  it('shows the current module default channel before notifications in blog and jumps to blog channel management', async () => {
    const wrapper = await mountTopbar('/posts')

    const defaultChannelLink = wrapper.find('[data-testid="default-channel-link"]')
    const inboxButton = wrapper.find('.notif-btn')

    expect(defaultChannelLink.exists()).toBe(true)
    expect(defaultChannelLink.text()).toContain('博客默认频道')
    expect(defaultChannelLink.attributes('href')).toBe('/posts/channels')
    expect(defaultChannelLink.element.compareDocumentPosition(inboxButton.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await defaultChannelLink.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/posts/channels')
  })

  it('shows channel management in the user menu for blog and jumps to the same management entry', async () => {
    const wrapper = await mountTopbar('/posts')

    await wrapper.find('.user-btn').trigger('click')

    const menuLink = wrapper.find('[data-testid="channel-manage-link"]')
    expect(menuLink.exists()).toBe(true)
    expect(menuLink.text()).toBe('频道管理')
    expect(menuLink.attributes('href')).toBe('/posts/channels')

    await menuLink.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/posts/channels')
  })

  it('hides default channel and channel management entry outside blog, podcast, and video modules', async () => {
    const wrapper = await mountTopbar('/feed/inbox')

    expect(wrapper.find('[data-testid="default-channel-link"]').exists()).toBe(false)

    await wrapper.find('.user-btn').trigger('click')

    expect(wrapper.find('[data-testid="channel-manage-link"]').exists()).toBe(false)
  })

  it('hides the default channel entry when the current module has no channel name', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return new Response(JSON.stringify({
          data: {
            ...defaultChannelsPayload,
            video: { id: 'video-channel-1', name: '', slug: 'video-default' },
          },
        }), { status: 200 })
      }
      if (url.endsWith('/notifications/unread-count') || url.endsWith('/dm/unread-count')) {
        return new Response(JSON.stringify({ count: 0 }), { status: 200 })
      }
      throw new Error(`未 mock fetch: ${url}`)
    })

    const wrapper = await mountTopbar('/videos')

    expect(wrapper.find('[data-testid="default-channel-link"]').exists()).toBe(false)
  })
})
