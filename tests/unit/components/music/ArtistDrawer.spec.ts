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

vi.mock('@/api/musicV1', () => ({
  getMusicArtist: vi.fn(async () => ({
    id: '1',
    name: 'Pink Floyd',
    bio: 'English rock band',
    entry_status: 'open',
  })),
  listMusicAlbums: vi.fn(async () => ({
    data: [
      { id: '1', title: 'The Dark Side of the Moon', release_date: '1973-03-01', songs: new Array(10).fill(null), album_type: 'album', entry_status: 'open' },
      { id: '2', title: 'Wish You Were Here', release_date: '1975-09-12', songs: new Array(5).fill(null), album_type: 'album', entry_status: 'open' },
    ],
    meta: { page: 1, page_size: 20, total: 2, has_more: false },
  })),
}))

describe('ArtistDrawer.vue', () => {
  it('renders artist information and albums when artistId is present', async () => {
    const wrapper = mount(ArtistDrawer, {
      global: { 
        stubs: {
          PSheet: {
            template: '<div><slot name="header" /><slot /></div>'
          }
        }
      }
    })
    await vi.dynamicImportSettled()
    
    // Check if artist title is rendered (artistId is '1' in mock)
    expect(wrapper.text()).toContain('Pink Floyd')
    expect(wrapper.text()).toContain('ARTIST ENTRY')
    
    // Check if album list is rendered
    expect(wrapper.text()).toContain('专辑列表')
    expect(wrapper.text()).toContain('The Dark Side of the Moon')
    expect(wrapper.text()).toContain('Wish You Were Here')
    expect(wrapper.text()).toContain('1973')
    expect(wrapper.text()).toContain('1975')
  })
})
