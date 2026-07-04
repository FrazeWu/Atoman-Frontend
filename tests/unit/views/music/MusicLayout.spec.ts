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
          'PSidebarItem': { template: '<div class="sidebar-item"><slot /></div>' },
          MusicSidebarPlaylists: true,
          PlaylistDrawer: true,
        },
      },
    })
    const items = wrapper.findAll('.sidebar-item')
    expect(items.length).toBe(4)
    expect(items[0].text()).toContain('发现')
    expect(items[1].text()).toContain('专辑')
    expect(items[2].text()).toContain('艺人')
    expect(items[3].text()).toContain('收藏')
  })
})
