import { flushPromises, mount } from '@vue/test-utils'
import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlbumsView from '@/views/music/AlbumsView.vue'

const mocks = vi.hoisted(() => ({
  listAlbumBookmarks: vi.fn(),
  listRecommendedAlbums: vi.fn(),
  openAlbum: vi.fn(),
  openMusicCreationFlow: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listAlbumBookmarks: mocks.listAlbumBookmarks,
  listRecommendedAlbums: mocks.listRecommendedAlbums,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    isMainShifted: computed(() => false),
    openAlbum: mocks.openAlbum,
    openMusicCreationFlow: mocks.openMusicCreationFlow,
  }),
}))

vi.mock('@/components/music/AlbumDrawer.vue', () => ({
  default: { template: '<div data-testid="album-drawer-stub" />' },
}))

describe('AlbumsView', () => {
  beforeEach(() => {
    mocks.listAlbumBookmarks.mockReset()
    mocks.listRecommendedAlbums.mockReset()
    mocks.openAlbum.mockReset()
    mocks.openMusicCreationFlow.mockReset()
    mocks.listRecommendedAlbums.mockResolvedValue({ data: [] })
    mocks.listAlbumBookmarks.mockResolvedValue({ data: [] })
  })

  it('opens the album creation flow from the add album action', async () => {
    const wrapper = mount(AlbumsView)
    await flushPromises()

    await wrapper.get('[data-testid="add-album"]').trigger('click')

    expect(mocks.openMusicCreationFlow).toHaveBeenCalledTimes(1)
    expect(mocks.openMusicCreationFlow).toHaveBeenCalledWith()
  })
})
