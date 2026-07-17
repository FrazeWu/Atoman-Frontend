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
    { path: '/posts/post/new', component: { template: '<div />' } },
    { path: '/videos', component: { template: '<div />' } },
    { path: '/podcasts', component: { template: '<div />' } },
    { path: '/inbox', component: { template: '<div />' } },
    { path: '/posts/bookmarks', component: { template: '<div />' } },
    { path: '/site/setting', component: { template: '<div />' } },
    { path: '/users/:handle/settings', component: { template: '<div />' } },
    { path: '/channels', component: { template: '<div />' } },
    { path: '/videos/manage', component: { template: '<div />' } },
    { path: '/podcasts/editor', component: { template: '<div />' } },
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
      if (url.endsWith('/users/me/default-channels')) {
        return new Response(JSON.stringify({ data: defaultChannelsPayload }), { status: 200 })
      }
      if (url.endsWith('/blog/channels?user_id=user-1')) {
        return new Response(JSON.stringify({ data: [
          defaultChannelsPayload.blog,
          { id: 'blog-channel-2', name: '第二频道', slug: 'blog-second' },
        ] }), { status: 200 })
      }
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

  it('switches the active blog channel from the topbar', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/users/me/default-channels')) {
        return new Response(JSON.stringify({ data: defaultChannelsPayload }), { status: 200 })
      }
      if (url.endsWith('/blog/channels?user_id=user-1')) {
        return new Response(JSON.stringify({ data: [
          defaultChannelsPayload.blog,
          { id: 'blog-channel-2', name: '第二频道', slug: 'blog-second' },
        ] }), { status: 200 })
      }
      if (url.endsWith('/users/me/default-channels/blog') && init?.method === 'PATCH') {
        return new Response(JSON.stringify({ data: { id: 'blog-channel-2', name: '第二频道', slug: 'blog-second' } }), { status: 200 })
      }
      if (url.endsWith('/notifications/unread-counts')) {
        return new Response(JSON.stringify({ data: { total: 0, items: {} } }), { status: 200 })
      }
      throw new Error(`未 mock fetch: ${url}`)
    })

    const wrapper = await mountTopbar('/posts')

    const switcher = wrapper.find('[data-testid="blog-channel-switcher"]')
    const inboxButton = wrapper.find('.notif-btn')

    expect(switcher.exists()).toBe(true)
    expect(switcher.text()).toContain('博客默认频道')
    expect(switcher.attributes('aria-expanded')).toBe('false')
    expect(inboxButton.element.compareDocumentPosition(switcher.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await switcher.trigger('click')
    await flushPromises()
    expect(switcher.attributes('aria-expanded')).toBe('true')

    await wrapper.find('[data-testid="blog-channel-option-blog-channel-2"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="blog-channel-switcher"]').text()).toContain('第二频道')
  })

  it('locks the blog channel switcher in the article editor', async () => {
    const wrapper = await mountTopbar('/posts/post/new')

    const switcher = wrapper.find('[data-testid="blog-channel-switcher"]')
    expect(switcher.attributes('disabled')).toBeDefined()
    expect(switcher.attributes('aria-label')).toContain('编辑文章时不可切换频道')
  })

  it('shows channel management in the user menu for blog and jumps to global channel management', async () => {
    const wrapper = await mountTopbar('/posts')

    await wrapper.find('.user-btn').trigger('click')

    const menuLink = wrapper.find('[data-testid="channel-manage-link"]')
    expect(menuLink.exists()).toBe(true)
    expect(menuLink.text()).toBe('频道管理')
    expect(menuLink.attributes('href')).toBe('/channels')

    await menuLink.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/channels')
  })

  it('shows a fallback default channel and channel management entry outside content modules', async () => {
    const wrapper = await mountTopbar('/inbox')

    const defaultChannelLink = wrapper.find('[data-testid="default-channel-link"]')
    const inboxButton = wrapper.find('.notif-btn')

    expect(defaultChannelLink.exists()).toBe(true)
    expect(defaultChannelLink.text()).toBe('博客默认频道')
    expect(defaultChannelLink.attributes('href')).toBe('/channels')
    expect(inboxButton.element.compareDocumentPosition(defaultChannelLink.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await wrapper.find('.user-btn').trigger('click')

    expect(wrapper.find('[data-testid="channel-manage-link"]').attributes('href')).toBe('/channels')
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
      if (url.endsWith('/notifications/unread-counts')) {
        return new Response(JSON.stringify({ data: { total: 0, items: {} } }), { status: 200 })
      }
      throw new Error(`未 mock fetch: ${url}`)
    })

    const wrapper = await mountTopbar('/videos')

    expect(wrapper.find('[data-testid="default-channel-link"]').text()).toContain('博客默认频道')
  })

  it('routes notification entry directly to inbox without opening a category dropdown', async () => {
    const wrapper = await mountTopbar('/posts')

    const notificationLink = wrapper.find('[data-testid="notification-link"]')

    expect(notificationLink.attributes('href')).toBe('/inbox')
    expect(wrapper.find('[data-testid="notification-menu-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notification-menu-dm"]').exists()).toBe(false)
  })
})
