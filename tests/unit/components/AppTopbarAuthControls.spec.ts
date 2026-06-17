import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import AppTopbarAuthControls from '@/components/system/AppTopbarAuthControls.vue'
import { useAuthStore } from '@/stores/auth'
import { nextTick, ref } from 'vue'

const loadChannelsMock = vi.fn()
const clearChannelsMock = vi.fn()
const channelsMock = ref<Array<{ id: string; name: string }>>([])

vi.mock('@/composables/useKanboChannel', () => ({
  useKanboChannel: () => ({
    channels: channelsMock,
    currentKanboChannelId: ref(null),
    switchChannel: vi.fn(),
    clearChannels: clearChannelsMock,
    loadChannels: loadChannelsMock,
  }),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/inbox', component: { template: '<div />' } },
    { path: '/bookmarks', component: { template: '<div />' } },
    { path: '/settings', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ],
})

describe('AppTopbarAuthControls', () => {
  beforeEach(() => {
    loadChannelsMock.mockReset()
    clearChannelsMock.mockReset()
    channelsMock.value = []
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' }
    authStore.isAuthenticated = true
  })

  it('renders authenticated inbox and user controls', async () => {
    const wrapper = mount(AppTopbarAuthControls, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.find('.user-btn').trigger('click')

    expect(wrapper.text()).toContain('alice')
    expect(wrapper.find('a[href="/inbox"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/?site=alice"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/bookmarks"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/settings"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/setting"]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('/blog/bookmarks')
  })

  it('shows site settings entry for owner', async () => {
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'owner', email: 'owner@example.com', role: 'owner' }

    const wrapper = mount(AppTopbarAuthControls, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.find('.user-btn').trigger('click')

    expect(wrapper.find('a[href="/setting"]').exists()).toBe(true)
  })

  it('loads kanbo channels with current user uuid when switch is visible', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token-1'
    authStore.user = {
      id: 1,
      uuid: 'user-uuid-1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'user',
    }

    await router.push('/?site=kanbo')

    mount(AppTopbarAuthControls, {
      global: {
        plugins: [router],
      },
    })

    expect(loadChannelsMock).toHaveBeenCalledWith('token-1', 'user-uuid-1')
  })

  it('does not load kanbo channels without current user id', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token-1'
    authStore.user = {
      username: 'anonymous-shape',
      email: 'alice@example.com',
      role: 'user',
    }

    await router.push('/?site=kanbo')

    mount(AppTopbarAuthControls, {
      global: {
        plugins: [router],
      },
    })

    expect(loadChannelsMock).not.toHaveBeenCalled()
  })

  it('reloads kanbo channels when the current user changes', async () => {
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

    await router.push('/?site=kanbo')

    mount(AppTopbarAuthControls, {
      global: {
        plugins: [router],
      },
    })

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
})
