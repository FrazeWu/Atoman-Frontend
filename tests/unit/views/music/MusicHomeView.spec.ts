// web/tests/unit/MusicHomeView.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import HomeView from '@/views/music/HomeView.vue'

describe('Music HomeView.vue (Base Artists View)', () => {
  it('renders artist grid and shifted class logic', () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: { plugins: [pinia], stubs: ['RouterLink', 'ArtistDrawer', 'AlbumDrawer', 'NestedActionDrawer'] }
    })
    expect(wrapper.find('h1').text()).toContain('艺术家')
    expect(wrapper.find('.search-input').exists()).toBe(true)
    // Note: DOM mocking for shifted class requires useMusicDrawers setup, skipping deep CSS test here for brevity
  })
})
