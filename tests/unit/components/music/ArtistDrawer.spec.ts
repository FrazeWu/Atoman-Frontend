// web/tests/unit/ArtistDrawer.spec.ts
import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'

const drawerState = ref({ artistId: '1', artistRefreshToken: 0 })

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerState,
    closeArtist: vi.fn(),
    isArtistShifted: ref(false),
    openNestedAction: vi.fn(),
    openAlbum: vi.fn(),
    openMusicCreationFlow: vi.fn(),
  })
}))

const {
  getMusicArtist,
  listMusicAlbums,
  listArtistBookmarks,
  createArtistBookmark,
  deleteArtistBookmark,
} = vi.hoisted(() => ({
  getMusicArtist: vi.fn(),
  listMusicAlbums: vi.fn(),
  listArtistBookmarks: vi.fn(),
  createArtistBookmark: vi.fn(),
  deleteArtistBookmark: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicArtist,
  listMusicAlbums,
  listArtistBookmarks,
  createArtistBookmark,
  deleteArtistBookmark,
}))

describe('ArtistDrawer.vue', () => {
  beforeEach(() => {
    drawerState.value = { artistId: '1', artistRefreshToken: 0 }
    getMusicArtist.mockReset()
    listMusicAlbums.mockReset()
    listArtistBookmarks.mockReset()
    createArtistBookmark.mockReset()
    deleteArtistBookmark.mockReset()

    getMusicArtist.mockResolvedValue({
      id: '1',
      name: 'Ye',
      legal_name: 'Kanye Omari West',
      aliases: [
        { alias: 'Kanye West' },
        { alias: 'kanye' },
      ],
      bio: 'English rock band',
      entry_status: 'open',
    })
    listMusicAlbums.mockResolvedValue({
      data: [
        { id: '1', title: 'The Dark Side of the Moon', release_date: '1973-03-01', songs: new Array(10).fill(null), album_type: 'album', entry_status: 'open' },
        { id: '2', title: 'Wish You Were Here', release_date: '1975-09-12', songs: new Array(5).fill(null), album_type: 'album', entry_status: 'open' },
      ],
      meta: { page: 1, page_size: 20, total: 2, has_more: false },
    })
    listArtistBookmarks.mockResolvedValue({ data: [] })
    createArtistBookmark.mockResolvedValue({ id: 'artist-bookmark-1', artist_id: '1', created_at: '2026-07-02T00:00:00Z' })
    deleteArtistBookmark.mockResolvedValue({ deleted: true })
  })

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
    expect(wrapper.text()).toContain('Ye')
    expect(wrapper.text()).toContain('本名：Kanye Omari West')
    expect(wrapper.text()).toContain('曾用名：Kanye West / kanye')
    
    // Check if album list is rendered
    expect(wrapper.text()).toContain('专辑列表')
    expect(wrapper.text()).toContain('The Dark Side of the Moon')
    expect(wrapper.text()).toContain('Wish You Were Here')
    expect(wrapper.text()).toContain('1973')
    expect(wrapper.text()).toContain('1975')
  })

  it('creates an artist bookmark when clicking 订阅 and reflects the state', async () => {
    const wrapper = mount(ArtistDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
        },
      },
    })

    await vi.dynamicImportSettled()

    const bookmarkButton = wrapper.get('[data-testid="artist-bookmark-toggle"]')
    expect(bookmarkButton.text()).toContain('订阅')

    await bookmarkButton.trigger('click')
    await vi.dynamicImportSettled()

    expect(createArtistBookmark).toHaveBeenCalledWith('1')
    expect(wrapper.get('[data-testid="artist-bookmark-toggle"]').text()).toContain('已订阅')
  })

  it('re-fetches artist data when artistRefreshToken changes', async () => {
    const wrapper = mount(ArtistDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
        },
      },
    })

    await vi.dynamicImportSettled()
    const artistCallsBeforeRefresh = getMusicArtist.mock.calls.length
    const albumCallsBeforeRefresh = listMusicAlbums.mock.calls.length

    drawerState.value = { artistId: '1', artistRefreshToken: 1 }
    await nextTick()
    await vi.dynamicImportSettled()

    expect(getMusicArtist.mock.calls.length).toBeGreaterThan(artistCallsBeforeRefresh)
    expect(listMusicAlbums.mock.calls.length).toBeGreaterThan(albumCallsBeforeRefresh)
    wrapper.unmount()
  })
})
