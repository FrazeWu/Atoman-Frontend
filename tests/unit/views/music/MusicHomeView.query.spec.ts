import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import HomeView from '@/views/music/HomeView.vue'

vi.mock('@/components/music/ArtistDrawer.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/music/AlbumDrawer.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/music/NestedActionDrawer.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/music/MusicEntityEditorDrawer.vue', () => ({ default: { template: '<div />' } }))

const mocks = vi.hoisted(() => ({
  listMusicArtists: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
  openMusicCreationFlow: vi.fn(),
  openMusicEditor: vi.fn(),
  routeQuery: {} as Record<string, string>,
}))

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: mocks.listMusicArtists,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    isMainShifted: computed(() => false),
    openAlbum: mocks.openAlbum,
    closeAlbum: vi.fn(),
    openArtist: mocks.openArtist,
    closeArtist: vi.fn(),
    openMusicEditor: mocks.openMusicEditor,
    openMusicCreationFlow: mocks.openMusicCreationFlow,
    closeMusicEditor: vi.fn(),
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
    mocks.listMusicArtists.mockReset()
    mocks.listMusicArtists.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 48, total: 0, has_more: false },
    })
  })

  it('uses route query q as initial search keyword', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    expect(mocks.listMusicArtists).toHaveBeenCalledWith({ q: 'blur', page: 1, page_size: 48 })
    expect((wrapper.find('[data-testid="music-search-input"]').element as HTMLInputElement).value).toBe('blur')
  })
})
