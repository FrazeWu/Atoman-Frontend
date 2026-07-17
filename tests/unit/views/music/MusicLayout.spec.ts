// web/tests/unit/MusicLayout.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { vi } from 'vitest'
import MusicLayout from '@/views/music/MusicLayout.vue'

describe('MusicLayout.vue', () => {
  it('renders the four music library destinations', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(MusicLayout, {
      global: { 
        plugins: [router, createPinia()],
        stubs: {
          'router-view': true,
          'PSidebar': { template: '<div><slot /></div>' },
          'PSidebarItem': { template: '<p-sidebar-item-stub><slot /></p-sidebar-item-stub>' },
          PlaylistDrawer: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
          MusicCreationFlowDrawer: true,
          NestedActionDrawer: true,
        }
      }
    })
    const items = wrapper.findAll('p-sidebar-item-stub')
    expect(items.length).toBe(4)
    expect(items[0].text()).toContain('发现')
    expect(items[1].text()).toContain('专辑')
    expect(items[2].text()).toContain('艺人')
    expect(items[3].text()).toContain('收藏')
  })

  it('does not render personal playlists for guests', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(MusicLayout, {
      global: {
        plugins: [router, createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { isAuthenticated: false } },
        })],
        stubs: {
          'router-view': true,
          PSidebar: { template: '<div><slot /><slot name="bottom" /></div>' },
          PSidebarItem: true,
          MusicSidebarPlaylists: { template: '<div data-testid="personal-playlists" />' },
          PlaylistDrawer: true,
        },
      },
    })

    expect(wrapper.find('[data-testid="personal-playlists"]').exists()).toBe(false)
  })

  it('renders playback history in the personal area for authenticated users', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(MusicLayout, {
      global: {
        plugins: [router, createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { isAuthenticated: true } },
        })],
        stubs: {
          'router-view': true,
          PSidebar: { template: '<div><slot /><slot name="bottom" /></div>' },
          PSidebarItem: { template: '<p-sidebar-item-stub><slot /></p-sidebar-item-stub>' },
          MusicSidebarPlaylists: { template: '<div data-testid="personal-playlists" />' },
          PlaylistDrawer: true,
        },
      },
    })

    expect(wrapper.get('[data-testid="music-history-link"]').text()).toContain('播放历史')
    expect(wrapper.find('[data-testid="personal-playlists"]').exists()).toBe(true)
  })
})
