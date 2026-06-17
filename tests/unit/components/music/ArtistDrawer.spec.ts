// web/tests/unit/ArtistDrawer.spec.ts
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: ref({ artistId: '1' }),
    closeArtist: vi.fn(),
    isArtistShifted: ref(false),
    openNestedAction: vi.fn(),
    openAlbum: vi.fn()
  })
}))

describe('ArtistDrawer.vue', () => {
  it('renders artist information and albums when artistId is present', () => {
    const wrapper = mount(ArtistDrawer, {
      global: { 
        stubs: {
          PaperSheet: {
            template: '<div><slot name="header" /><slot /></div>'
          }
        }
      }
    })
    
    // Check if artist title is rendered (artistId is '1' in mock)
    expect(wrapper.text()).toContain('Artist 1')
    expect(wrapper.text()).toContain('ARTIST ENTRY')
    
    // Check if album list is rendered
    expect(wrapper.text()).toContain('专辑列表')
    expect(wrapper.text()).toContain('The Dark Side of the Moon')
    expect(wrapper.text()).toContain('Wish You Were Here')
    expect(wrapper.text()).toContain('1973')
    expect(wrapper.text()).toContain('1975')
  })
})
