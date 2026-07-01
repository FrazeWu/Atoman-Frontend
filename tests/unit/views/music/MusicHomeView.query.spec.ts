import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import HomeView from '@/views/music/HomeView.vue'

const mocks = vi.hoisted(() => ({
  listMusicAlbums: vi.fn(),
  listMusicArtists: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
  openMusicCreationFlow: vi.fn(),
  routeQuery: {} as Record<string, string>,
}))

vi.mock('@/api/musicV1', () => ({
  listMusicAlbums: mocks.listMusicAlbums,
  listMusicArtists: mocks.listMusicArtists,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    isMainShifted: computed(() => false),
    openAlbum: mocks.openAlbum,
    closeAlbum: vi.fn(),
    openArtist: mocks.openArtist,
    closeArtist: vi.fn(),
    openMusicCreationFlow: mocks.openMusicCreationFlow,
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mocks.routeQuery,
  }),
}))

describe('Music HomeView query sync', () => {
  beforeEach(() => {
    mocks.routeQuery = { q: 'blur' }
    mocks.listMusicAlbums.mockReset()
    mocks.listMusicArtists.mockReset()
    mocks.listMusicAlbums.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 48, total: 0, has_more: false },
    })
    mocks.listMusicArtists.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 12, total: 0, has_more: false },
    })
  })

  it('uses route query q as initial search keyword', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: true,
        },
      },
    })

    await flushPromises()

    expect(mocks.listMusicAlbums).toHaveBeenCalledWith({ q: 'blur', page: 1, page_size: 48, sort: 'hot' })
    expect((wrapper.find('[data-testid="music-search-input"]').element as HTMLInputElement).value).toBe('blur')
  })
})
