import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import MobileTopbar from '@mobile/components/system/MobileTopbar.vue'
import MobileBottomNav from '@mobile/components/system/MobileBottomNav.vue'
import MobileApp from '@mobile/MobileApp.vue'
import { useAuthStore } from '@/stores/auth'
import { usePlayerPresenceStore } from '@/stores/playerPresence'

vi.mock('@/api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/utils/analytics', () => ({
  scheduleGoogleAnalytics: vi.fn(),
}))

vi.mock('@/utils/scheduleIdleTask', () => ({
  scheduleIdleTask: vi.fn(() => () => {}),
}))

describe('Mobile Playlist Navigation Robustness', () => {
  function setupTestRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/login', component: { template: '<div>Login</div>' }, meta: { authLayout: true } },
        {
          path: '/music',
          component: { template: '<div><RouterView /></div>' },
          children: [
            { path: '', component: { template: '<div>Music Discover</div>' } },
            { path: 'search', component: { template: '<div>Music Search</div>' } },
            { path: 'playlists', component: { template: '<div>Playlists List</div>' } },
            { path: 'playlist/:playlistId', component: { template: '<div>Playlist Detail</div>' } },
            { path: 'me', component: { template: '<div>Music Me</div>' } },
            { path: 'player', component: { template: '<div>Fullscreen Player</div>' } },
            { path: 'lyrics', component: { template: '<div>Lyrics</div>' } },
          ],
        },
      ],
    })
  }

  it('keeps MobileBottomNav visible on /music/playlists with active tab "playlists"', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = setupTestRouter()
    await router.push('/music/playlists')
    await router.isReady()

    const wrapper = mount(MobileApp, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterView: true,
          MobileAudioPlayer: true,
        },
      },
    })
    await flushPromises()

    const topbar = wrapper.findComponent(MobileTopbar)
    expect(topbar.exists()).toBe(true)
    expect(topbar.props('showBack')).toBe(false)

    const bottomNav = wrapper.findComponent(MobileBottomNav)
    expect(bottomNav.exists()).toBe(true)
    const activeTab = bottomNav.find('.mobile-bottom-nav__tab.is-active')
    expect(activeTab.exists()).toBe(true)
    expect(activeTab.attributes('data-tab-key')).toBe('playlists')
  })

  it('keeps MobileBottomNav visible on /music/playlist/:playlistId while hiding topbar', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = setupTestRouter()
    await router.push('/music/playlist/pl-123')
    await router.isReady()

    const wrapper = mount(MobileApp, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterView: true,
          MobileAudioPlayer: true,
        },
      },
    })
    await flushPromises()

    // Topbar hidden because detail view has its own sticky header
    expect(wrapper.findComponent(MobileTopbar).exists()).toBe(false)

    // BottomNav persists and points to playlists tab
    const bottomNav = wrapper.findComponent(MobileBottomNav)
    expect(bottomNav.exists()).toBe(true)
    const activeTab = bottomNav.find('.mobile-bottom-nav__tab.is-active')
    expect(activeTab.exists()).toBe(true)
    expect(activeTab.attributes('data-tab-key')).toBe('playlists')
  })

  it('retains bottom nav continuously across navigations between /music, /music/playlists and /music/playlist/:id', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = setupTestRouter()
    await router.push('/music')
    await router.isReady()

    const wrapper = mount(MobileApp, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterView: true,
          MobileAudioPlayer: true,
        },
      },
    })
    await flushPromises()

    // 1. Discover
    expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(true)

    // 2. Playlists tab
    await router.push('/music/playlists')
    await router.isReady()
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(true)
    expect(wrapper.findComponent(MobileTopbar).exists()).toBe(true)

    // 3. Playlist detail
    await router.push('/music/playlist/favorites')
    await router.isReady()
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(true)
    expect(wrapper.findComponent(MobileTopbar).exists()).toBe(false)

    // 4. Back to playlists
    await router.push('/music/playlists')
    await router.isReady()
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(true)
    expect(wrapper.findComponent(MobileTopbar).exists()).toBe(true)
  })

  it('hides bottom nav and topbar only on fullscreen player or auth pages', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = setupTestRouter()
    await router.push('/music/playlists')
    await router.isReady()

    const wrapper = mount(MobileApp, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterView: true,
          MobileAudioPlayer: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(true)

    // Enter fullscreen player
    await router.push('/music/player')
    await router.isReady()
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(false)
    expect(wrapper.findComponent(MobileTopbar).exists()).toBe(false)

    // Back to playlist
    await router.push('/music/playlists')
    await router.isReady()
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(true)

    // Enter auth route
    await router.push('/login')
    await router.isReady()
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(false)
  })
})
