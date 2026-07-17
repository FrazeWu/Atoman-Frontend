// web/tests/unit/MusicLayout.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import MusicLayout from '@/views/music/MusicLayout.vue'

describe('MusicLayout.vue', () => {
  it('renders only the simplified sidebar items', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(MusicLayout, {
      global: {
        plugins: [router],
        stubs: {
          'router-view': true,
          'PSidebar': { template: '<div><slot /></div>' },
          'PSidebarItem': {
            props: ['to'],
            template: '<div class="sidebar-item" :data-to="to"><slot /></div>',
          },
          MusicSidebarPlaylists: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
          PlaylistDrawer: true,
        },
      },
    })
    const items = wrapper.findAll('.sidebar-item')
    expect(items.length).toBe(4)
    expect(items[0].text()).toContain('发现')
    expect(items[0].attributes('data-to')).toBe('/music/discover')
    expect(items[1].text()).toContain('专辑')
    expect(items[1].attributes('data-to')).toBe('/music')
    expect(items[2].text()).toContain('艺人')
    expect(items[2].attributes('data-to')).toBe('/music/artists')
    expect(items[3].text()).toContain('收藏')
    expect(items[3].attributes('data-to')).toBe('/music/starred')
  })

  it('marks the music main content area for module-specific scroll behavior', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(MusicLayout, {
      global: {
        plugins: [router],
        stubs: {
          'router-view': true,
          'PSidebar': { template: '<div><slot /></div>' },
          'PSidebarItem': {
            props: ['to'],
            template: '<div class="sidebar-item" :data-to="to"><slot /></div>',
          },
          MusicSidebarPlaylists: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
          PlaylistDrawer: true,
        },
      },
    })

    expect(wrapper.find('main').classes()).toContain('music-main-content')
  })

  it('mounts one semantic music sheet stack', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(MusicLayout, {
      global: {
        plugins: [router],
        stubs: {
          'router-view': true,
          'PSidebar': { template: '<div><slot /></div>' },
          'PSidebarItem': {
            props: ['to'],
            template: '<div class="sidebar-item" :data-to="to"><slot /></div>',
          },
          MusicSidebarPlaylists: true,
          MusicSheetStack: { template: '<div data-testid="music-sheet-stack-stub" />' },
        },
      },
    })

    expect(wrapper.findAll('[data-testid="music-sheet-stack-stub"]')).toHaveLength(1)
  })
})
