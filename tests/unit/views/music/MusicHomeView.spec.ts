import { mount, flushPromises } from '@vue/test-utils'
import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import HomeView from '@/views/music/HomeView.vue'

const mocks = vi.hoisted(() => ({
  listMusicAlbums: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
  openNestedAction: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicAlbums: mocks.listMusicAlbums,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    isMainShifted: computed(() => false),
    openAlbum: mocks.openAlbum,
    openArtist: mocks.openArtist,
    openNestedAction: mocks.openNestedAction,
  }),
}))

describe('Music HomeView.vue (Album Discovery)', () => {
  beforeEach(() => {
    mocks.listMusicAlbums.mockReset()
    mocks.openAlbum.mockReset()
    mocks.openArtist.mockReset()
    mocks.openNestedAction.mockReset()
    mocks.listMusicAlbums.mockResolvedValue({
      data: [
        {
          id: 'album-1',
          title: 'Hot Album',
          cover_url: '/covers/hot.jpg',
          release_date: '2026-05-29T00:00:00Z',
          year: 2026,
          album_type: 'album',
          entry_status: 'open',
          hot_score: 91.5,
          artists: [{ id: 'artist-1', name: 'Hot Artist' }],
        },
      ],
      meta: { page: 1, page_size: 48, total: 1, has_more: false },
    })
  })

  it('loads hot albums by default and renders an album grid', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: { plugins: [pinia], stubs: ['RouterLink', 'ArtistDrawer', 'AlbumDrawer', 'NestedActionDrawer'] }
    })
    await flushPromises()

    expect(mocks.listMusicAlbums).toHaveBeenCalledWith({ q: undefined, page: 1, page_size: 48, sort: 'hot' })
    expect(wrapper.find('h1').text()).toContain('专辑')
    expect(wrapper.find('.search-input').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="album-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Hot Album')
    expect(wrapper.text()).toContain('Hot Artist')
    expect(wrapper.text()).toContain('热度 91.5')
  })

  it('reloads albums in random mode when the random tab is selected', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: { plugins: [pinia], stubs: ['RouterLink', 'ArtistDrawer', 'AlbumDrawer', 'NestedActionDrawer'] }
    })
    await flushPromises()

    await wrapper.find('[data-testid="mode-random"]').trigger('click')
    await flushPromises()

    expect(mocks.listMusicAlbums).toHaveBeenLastCalledWith({ q: undefined, page: 1, page_size: 48, sort: 'random' })
  })

  it('opens album and artist drawers from album cards', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: { plugins: [pinia], stubs: ['RouterLink', 'ArtistDrawer', 'AlbumDrawer', 'NestedActionDrawer'] }
    })
    await flushPromises()

    await wrapper.find('[data-testid="album-card"]').trigger('click')
    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')

    await wrapper.find('[data-testid="album-artist"]').trigger('click')
    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
  })

  it('offers wiki edit actions when no albums match', async () => {
    mocks.listMusicAlbums.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, page_size: 48, total: 0, has_more: false },
    })
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: { plugins: [pinia], stubs: ['RouterLink', 'ArtistDrawer', 'AlbumDrawer', 'NestedActionDrawer'] }
    })
    await flushPromises()

    await wrapper.find('[data-testid="empty-add-artist"]').trigger('click')
    await wrapper.find('[data-testid="empty-add-album"]').trigger('click')

    expect(mocks.openNestedAction).toHaveBeenCalledWith('add_artist')
    expect(mocks.openNestedAction).toHaveBeenCalledWith('add_album')
  })
})
