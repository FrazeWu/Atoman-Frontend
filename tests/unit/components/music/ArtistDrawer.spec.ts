// web/tests/unit/ArtistDrawer.spec.ts
import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { ApiErrorResponseError } from '@/api/client'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    template: '<div><slot name="header" /><slot /></div>',
  },
}))

const drawerState = ref({ artistId: '1', artistRefreshToken: 0 })
const musicDrawerMocks = vi.hoisted(() => ({
  openNestedAction: vi.fn(),
  openArtist: vi.fn(),
  openAlbum: vi.fn(),
  openMusicEditor: vi.fn(),
  openMusicCreationFlow: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerState,
    closeArtist: vi.fn(),
    isArtistShifted: ref(false),
    openNestedAction: musicDrawerMocks.openNestedAction,
    openArtist: musicDrawerMocks.openArtist,
    openAlbum: musicDrawerMocks.openAlbum,
    openMusicEditor: musicDrawerMocks.openMusicEditor,
    openMusicCreationFlow: musicDrawerMocks.openMusicCreationFlow,
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
    musicDrawerMocks.openNestedAction.mockReset()
    musicDrawerMocks.openArtist.mockReset()
    musicDrawerMocks.openAlbum.mockReset()
    musicDrawerMocks.openMusicEditor.mockReset()
    musicDrawerMocks.openMusicCreationFlow.mockReset()

    getMusicArtist.mockResolvedValue({
      id: '1',
      name: 'Ye',
      legal_name: 'Kanye Omari West',
      artist_form: 'group',
      aliases: [
        { alias: 'Kanye West' },
        { alias: 'kanye' },
      ],
      member_groups: {
        current: [
          {
            artist_id: '2',
            name: 'Pusha T',
            image_url: 'https://example.com/pusha-t.jpg',
            join_date: '2020-01-01',
            leave_date: '',
          },
        ],
        former: [
          {
            artist_id: '3',
            name: 'Kid Cudi',
            image_url: '',
            join_date: '2018-01-01',
            leave_date: '2022-06-30',
          },
        ],
      },
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
    const wrapper = mount(ArtistDrawer)
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

  it('renders current and former members for group artists', async () => {
    const wrapper = mount(ArtistDrawer)

    await vi.dynamicImportSettled()

    expect(wrapper.text()).toContain('现成员')
    expect(wrapper.text()).toContain('前成员')
    expect(wrapper.text()).toContain('Pusha T')
    expect(wrapper.text()).toContain('2020-01-01 - 至今')
    expect(wrapper.text()).toContain('Kid Cudi')
    expect(wrapper.text()).toContain('2018-01-01 - 2022-06-30')
  })

  it('opens the member artist page when clicking a member item', async () => {
    const wrapper = mount(ArtistDrawer)

    await vi.dynamicImportSettled()

    await wrapper.get('[data-testid="artist-member-2"]').trigger('click')

    expect(musicDrawerMocks.openArtist).toHaveBeenCalledWith('2')
  })

  it('creates an artist bookmark when clicking 订阅 and reflects the state', async () => {
    const wrapper = mount(ArtistDrawer)

    await vi.dynamicImportSettled()

    const bookmarkButton = wrapper.get('[data-testid="artist-bookmark-toggle"]')
    expect(bookmarkButton.text()).toContain('订阅')

    await bookmarkButton.trigger('click')
    await vi.dynamicImportSettled()

    expect(createArtistBookmark).toHaveBeenCalledWith('1')
    expect(wrapper.get('[data-testid="artist-bookmark-toggle"]').text()).toContain('已订阅')
  })

  it('re-fetches artist data when artistRefreshToken changes', async () => {
    const wrapper = mount(ArtistDrawer)

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

  it('opens unified artist editor from the artist detail action bar', async () => {
    const wrapper = mount(ArtistDrawer)

    await vi.dynamicImportSettled()

    await wrapper.get('button:nth-of-type(2)').trigger('click')

    expect(musicDrawerMocks.openMusicEditor).toHaveBeenCalledWith({
      entity: 'artist',
      mode: 'edit',
      id: '1',
    })
  })

  it('opens unified album creation editor with seeded artist data from the artist detail action bar', async () => {
    const wrapper = mount(ArtistDrawer)

    await vi.dynamicImportSettled()

    await wrapper.get('button:nth-of-type(3)').trigger('click')

    expect(musicDrawerMocks.openMusicEditor).toHaveBeenCalledWith({
      entity: 'album',
      mode: 'create',
      seed: {
        artistId: '1',
        artistName: 'Ye',
        artistLegalName: 'Kanye Omari West',
      },
    })
  })

  it('keeps artist details visible when bookmark loading requires login', async () => {
    listArtistBookmarks.mockRejectedValueOnce(
      new ApiErrorResponseError(401, 'auth.unauthorized', 'Login required'),
    )

    const wrapper = mount(ArtistDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot name="header" /><slot /></div>' },
        },
      },
    })

    await vi.dynamicImportSettled()

    expect(wrapper.text()).toContain('Ye')
    expect(wrapper.text()).not.toContain('艺术家信息加载失败')
  })
})
