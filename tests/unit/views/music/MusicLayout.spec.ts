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
          'PaperSidebar': { template: '<div><slot /></div>' },
          'PaperSidebarItem': { template: '<paper-sidebar-item-stub><slot /></paper-sidebar-item-stub>' }
        }
      }
    })
    const items = wrapper.findAll('paper-sidebar-item-stub')
    expect(items.length).toBe(3)
    expect(items[0].text()).toContain('探索')
    expect(items[1].text()).toContain('艺术家')
    expect(items[2].text()).toContain('我的收藏')
  })
})
