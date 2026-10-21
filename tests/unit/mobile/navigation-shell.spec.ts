import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import MobileTopbar from '@mobile/components/system/MobileTopbar.vue'
import MobileSpaceDrawer from '@mobile/components/system/MobileSpaceDrawer.vue'
import MobileBottomNav from '@mobile/components/system/MobileBottomNav.vue'
import MobileApp from '@mobile/MobileApp.vue'
import { usePlayerPresenceStore } from '@/stores/playerPresence'

vi.mock('@/api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/utils/analytics', () => ({
  scheduleGoogleAnalytics: vi.fn(),
}))

vi.mock('@/utils/scheduleIdleTask', () => ({
  scheduleIdleTask: vi.fn((cb) => {
    return () => {}
  }),
}))

describe('Mobile Navigation Shell', () => {
  describe('MobileTopbar.vue', () => {
    it('displays currentSpace label and space trigger button with chevron-down MIcon', () => {
      const wrapper = mount(MobileTopbar, {
        props: {
          currentSpace: 'music',
        },
      })

      const trigger = wrapper.find('[data-testid="space-trigger"]')
      expect(trigger.exists()).toBe(true)
      expect(trigger.text()).toContain('音乐')

      const chevron = trigger.findComponent({ name: 'MIcon' })
      expect(chevron.exists()).toBe(true)
      expect(chevron.props('name')).toBe('chevron-down')
    })

    it('emits open-drawer when space trigger is clicked', async () => {
      const wrapper = mount(MobileTopbar, {
        props: {
          currentSpace: 'feed',
        },
      })

      const trigger = wrapper.find('[data-testid="space-trigger"]')
      await trigger.trigger('click')

      expect(wrapper.emitted('open-drawer')).toBeTruthy()
      expect(wrapper.emitted('open-drawer')?.length).toBe(1)
    })

    it('emits search and notifications when right action buttons are clicked', async () => {
      const wrapper = mount(MobileTopbar, {
        props: {
          currentSpace: 'music',
        },
      })

      const searchBtn = wrapper.find('[data-testid="search-button"]')
      expect(searchBtn.exists()).toBe(true)
      await searchBtn.trigger('click')
      expect(wrapper.emitted('search')).toBeTruthy()

      const notifyBtn = wrapper.find('[data-testid="notifications-button"]')
      expect(notifyBtn.exists()).toBe(true)
      await notifyBtn.trigger('click')
      expect(wrapper.emitted('notifications')).toBeTruthy()
    })
  })

  describe('MobileSpaceDrawer.vue', () => {
    it('renders when open is true, renders backdrop and 7 space items', () => {
      const wrapper = mount(MobileSpaceDrawer, {
        props: {
          open: true,
          currentSpace: 'music',
        },
      })

      expect(wrapper.find('[data-testid="drawer-backdrop"]').exists()).toBe(true)
      const items = wrapper.findAll('[data-testid="space-item"]')
      expect(items).toHaveLength(7)

      const keys = items.map((el) => el.attributes('data-space-key'))
      expect(keys).toEqual(['feed', 'music', 'books', 'blog', 'debate', 'messages', 'studio'])
    })

    it('does not render content or drawer when open is false', () => {
      const wrapper = mount(MobileSpaceDrawer, {
        props: {
          open: false,
          currentSpace: 'music',
        },
      })

      expect(wrapper.find('[data-testid="drawer-backdrop"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid="space-item"]')).toHaveLength(0)
    })

    it('highlights the currently active space item', () => {
      const wrapper = mount(MobileSpaceDrawer, {
        props: {
          open: true,
          currentSpace: 'music',
        },
      })

      const activeItem = wrapper.find('[data-space-key="music"]')
      expect(activeItem.classes()).toContain('is-active')

      const feedItem = wrapper.find('[data-space-key="feed"]')
      expect(feedItem.classes()).not.toContain('is-active')
    })

    it('emits select-space with space key and emits update:open false when an item is clicked', async () => {
      const wrapper = mount(MobileSpaceDrawer, {
        props: {
          open: true,
          currentSpace: 'music',
        },
      })

      const feedItem = wrapper.find('[data-space-key="feed"]')
      await feedItem.trigger('click')

      expect(wrapper.emitted('select-space')).toEqual([['feed']])
      expect(wrapper.emitted('update:open')).toEqual([[false]])
    })

    it('emits update:open false when close button or backdrop is clicked', async () => {
      const wrapper = mount(MobileSpaceDrawer, {
        props: {
          open: true,
          currentSpace: 'music',
        },
      })

      const closeBtn = wrapper.find('[data-testid="drawer-close"]')
      await closeBtn.trigger('click')
      expect(wrapper.emitted('update:open')).toEqual([[false]])

      const backdrop = wrapper.find('[data-testid="drawer-backdrop"]')
      await backdrop.trigger('click')
      expect(wrapper.emitted('update:open')?.length).toBe(2)
    })
  })

  describe('MobileBottomNav.vue', () => {
    it('renders scoped tabs for music space', () => {
      const wrapper = mount(MobileBottomNav, {
        props: {
          currentSpace: 'music',
        },
      })

      const tabs = wrapper.findAll('[data-testid="mobile-bottom-nav-tab"]')
      expect(tabs).toHaveLength(4)
      const labels = tabs.map((t) => t.text())
      expect(labels).toEqual(['发现', '搜索', '歌单', '我的'])
    })

    it('renders scoped tabs for feed space', () => {
      const wrapper = mount(MobileBottomNav, {
        props: {
          currentSpace: 'feed',
        },
      })

      const tabs = wrapper.findAll('[data-testid="mobile-bottom-nav-tab"]')
      expect(tabs).toHaveLength(4)
      const labels = tabs.map((t) => t.text())
      expect(labels).toEqual(['精选', '关注', '收藏', '我的'])
    })

    it('renders scoped tabs for blog space', () => {
      const wrapper = mount(MobileBottomNav, {
        props: {
          currentSpace: 'blog',
        },
      })

      const tabs = wrapper.findAll('[data-testid="mobile-bottom-nav-tab"]')
      expect(tabs).toHaveLength(4)
      const labels = tabs.map((t) => t.text())
      expect(labels).toEqual(['发现', '短笺', '长文', '我的'])
    })

    it('renders scoped tabs for books space', () => {
      const wrapper = mount(MobileBottomNav, {
        props: {
          currentSpace: 'books',
        },
      })

      const tabs = wrapper.findAll('[data-testid="mobile-bottom-nav-tab"]')
      expect(tabs).toHaveLength(4)
      const labels = tabs.map((t) => t.text())
      expect(labels).toEqual(['发现', '书架', '书摘', '我的'])
    })

    it('renders MIcon and label for each tab item and supports tab click', async () => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/music', component: { template: '<div>Music</div>' } },
          { path: '/music/playlists', component: { template: '<div>Playlists</div>' } },
        ],
      })
      await router.push('/music')
      await router.isReady()

      const wrapper = mount(MobileBottomNav, {
        props: {
          currentSpace: 'music',
        },
        global: {
          plugins: [router],
        },
      })

      const playlistTab = wrapper.find('[data-tab-key="playlists"]')
      expect(playlistTab.exists()).toBe(true)
      const icon = playlistTab.findComponent({ name: 'MIcon' })
      expect(icon.exists()).toBe(true)
      expect(icon.props('name')).toBe('playlists')

      await playlistTab.trigger('click')
      expect(wrapper.emitted('tab-click')).toBeTruthy()
    })

    it('distinguishes active tab with query params without colliding on base path', async () => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/debate', component: { template: '<div>Debate</div>' } },
        ],
      })
      await router.push('/debate?tab=opinions')
      await router.isReady()

      const wrapper = mount(MobileBottomNav, {
        props: {
          currentSpace: 'debate',
        },
        global: {
          plugins: [router],
        },
      })

      const opinionsTab = wrapper.find('[data-tab-key="opinions"]')
      const discoverTab = wrapper.find('[data-tab-key="discover"]')
      expect(opinionsTab.classes()).toContain('is-active')
      expect(discoverTab.classes()).not.toContain('is-active')
    })
  })

  describe('MobileApp.vue integration', () => {
    it('mounts Topbar, BottomNav, and SpaceDrawer', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/', component: { template: '<div>Home</div>' } },
          { path: '/music', component: { template: '<div>Music</div>' } },
          { path: '/notifications', component: { template: '<div>Notifications</div>' } },
        ],
      })
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

      expect(wrapper.findComponent(MobileTopbar).exists()).toBe(true)
      expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(true)
      expect(wrapper.findComponent(MobileSpaceDrawer).exists()).toBe(true)

      await router.push('/notifications')
      await router.isReady()
      await wrapper.vm.$nextTick()
      const topbar = wrapper.findComponent(MobileTopbar)
      expect(topbar.props('currentSpace')).toBe('messages')
    })

    it('persists MobileAudioPlayer and sets --mobile-app-player-bottom correctly when navigating to route without bottom nav', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const presenceStore = usePlayerPresenceStore()
      presenceStore.setHasCurrentTrack(true)

      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/music', component: { template: '<div>Music</div>' } },
          { path: '/books/read/:id', component: { template: '<div>Book Reader</div>' } },
        ],
      })
      await router.push('/music')
      await router.isReady()

      const wrapper = mount(MobileApp, {
        global: {
          plugins: [router, pinia],
          stubs: {
            RouterView: true,
            MobileAudioPlayer: {
              name: 'MobileAudioPlayer',
              template: '<div data-testid="mobile-audio-player">Player</div>',
            },
          },
        },
      })
      await flushPromises()

      // On /music with bottom nav
      expect(wrapper.find('[data-testid="mobile-audio-player"]').exists()).toBe(true)
      const shellWithNav = wrapper.find('.mobile-app-shell')
      expect(shellWithNav.attributes('style')).toContain('--mobile-app-player-bottom: calc(56px + env(safe-area-inset-bottom, 0px))')

      // Navigate to /books/read/1 (no bottom nav)
      await router.push('/books/read/1')
      await router.isReady()
      await wrapper.vm.$nextTick()
      await flushPromises()

      // Bottom nav is hidden
      expect(wrapper.findComponent(MobileBottomNav).exists()).toBe(false)
      // Mini player is still rendered
      expect(wrapper.find('[data-testid="mobile-audio-player"]').exists()).toBe(true)
      // Player bottom offset adjusted to safe-area
      const shellWithoutNav = wrapper.find('.mobile-app-shell')
      expect(shellWithoutNav.attributes('style')).toContain('--mobile-app-player-bottom: env(safe-area-inset-bottom, 0px)')
    })
  })
})
