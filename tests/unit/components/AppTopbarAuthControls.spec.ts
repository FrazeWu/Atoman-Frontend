import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import AppTopbarAuthControls from '@/components/system/AppTopbarAuthControls.vue'
import { useAuthStore } from '@/stores/auth'
import { nextTick, ref } from 'vue'
import { afterEach } from 'vitest'

const loadChannelsMock = vi.fn()
const clearChannelsMock = vi.fn()
const channelsMock = ref<Array<{ id: string; name: string }>>([])
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

vi.mock('@/composables/useMediaChannel', () => ({
  useMediaChannel: () => ({
    channels: channelsMock,
    currentMediaChannelId: ref(null),
    switchChannel: vi.fn(),
    clearChannels: clearChannelsMock,
    loadChannels: loadChannelsMock,
  }),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/media', component: { template: '<div />' } },
    { path: '/feed/inbox', component: { template: '<div />' } },
    { path: '/posts/bookmarks', component: { template: '<div />' } },
    { path: '/posts/settings', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ],
})

describe('AppTopbarAuthControls', () => {
  beforeEach(() => {
    loadChannelsMock.mockReset()
    loadChannelsMock.mockResolvedValue(undefined)
    clearChannelsMock.mockReset()
    channelsMock.value = []
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

  it('shows site settings entry for moderator', async () => {
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'mod', email: 'mod@example.com', role: 'moderator' }
    const wrapper = mountTopbar()
    await wrapper.find('.user-btn').trigger('click')
    expect(wrapper.find('a[href="/setting"]').exists()).toBe(true)
  })

  it('loads media channels with current user uuid when switch is visible', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token-1'
    authStore.user = {
      id: 1,
      uuid: 'user-uuid-1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'user',
    }

    await router.push('/media')

    mountTopbar()

    expect(loadChannelsMock).toHaveBeenCalledWith('token-1', 'user-uuid-1')
  })

  it('does not load media channels without current user id', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token-1'
    authStore.user = {
      username: 'anonymous-shape',
      email: 'alice@example.com',
      role: 'user',
    }

    await router.push('/media')

    mountTopbar()

    expect(loadChannelsMock).not.toHaveBeenCalled()
  })

  it('reloads media channels when the current user changes', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token-1'
    authStore.user = {
      id: 1,
      uuid: 'user-uuid-1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'user',
    }
    channelsMock.value = [{ id: 'old-channel', name: '旧频道' }]

    await router.push('/media')

    mountTopbar()

    loadChannelsMock.mockClear()
    authStore.user = {
      id: 2,
      uuid: 'user-uuid-2',
      username: 'bob',
      email: 'bob@example.com',
      role: 'user',
    }
    await nextTick()

    expect(loadChannelsMock).toHaveBeenCalledWith('token-1', 'user-uuid-2')
  })

  it('treats media path as the media module context', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token-1'
    authStore.user = {
      id: 1,
      uuid: 'user-uuid-1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'user',
    }

    await router.push('/media')

    mountTopbar()

    expect(loadChannelsMock).toHaveBeenCalledWith('token-1', 'user-uuid-1')
  })

  it('does not lock same user retries before media channels finish loading', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token-1'
    authStore.user = {
      id: 1,
      uuid: 'user-uuid-1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'user',
    }
    channelsMock.value = [{ id: 'old-channel', name: '旧频道' }]
    loadChannelsMock.mockReturnValue(new Promise(() => {}))

    await router.push('/media')

    mountTopbar()

    expect(loadChannelsMock).toHaveBeenCalledTimes(1)

    await router.push('/inbox')
    await nextTick()
    await router.push('/media')
    await nextTick()

    expect(loadChannelsMock).toHaveBeenCalledTimes(2)
    expect(loadChannelsMock).toHaveBeenLastCalledWith('token-1', 'user-uuid-1')
  })

  it('waits for logout to finish before redirecting to login', async () => {
    const authStore = useAuthStore()
    let resolveLogout: (() => void) | null = null
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve
    })
    const logoutSpy = vi.spyOn(authStore, 'logout').mockReturnValue(logoutPromise)

    await router.push('/media')
    const wrapper = mountTopbar()

    await wrapper.find('.user-btn').trigger('click')
    await wrapper.find('.dropdown-item-danger').trigger('click')

    expect(logoutSpy).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/media')

    resolveLogout?.()
    await logoutPromise
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
  })
})
