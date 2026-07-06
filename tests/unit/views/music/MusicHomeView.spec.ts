import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeView from '@/views/music/HomeView.vue'

const mocks = vi.hoisted(() => ({
  openAlbum: vi.fn(),
  closeAlbum: vi.fn(),
  openArtist: vi.fn(),
  closeArtist: vi.fn(),
  openMusicEditor: vi.fn(),
  closeMusicEditor: vi.fn(),
  routeQuery: {} as Record<string, string>,
}))

vi.mock('@/views/music/ExploreView.vue', () => ({
  default: {
    name: 'ExploreViewStub',
    props: ['pageTitle', 'contentMode'],
    template: '<div data-testid="music-explore-view-stub" :data-page-title="pageTitle" :data-content-mode="contentMode">专辑首页</div>',
  },
}))

vi.mock('@/components/music/ArtistDrawer.vue', () => ({ default: { template: '<div data-testid="artist-drawer-stub" />' } }))
vi.mock('@/components/music/AlbumDrawer.vue', () => ({ default: { template: '<div data-testid="album-drawer-stub" />' } }))
vi.mock('@/components/music/NestedActionDrawer.vue', () => ({ default: { template: '<div data-testid="nested-action-drawer-stub" />' } }))
vi.mock('@/components/music/MusicEntityEditorDrawer.vue', () => ({ default: { template: '<div data-testid="music-entity-editor-drawer-stub" />' } }))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    isMainShifted: computed(() => false),
    openAlbum: mocks.openAlbum,
    closeAlbum: mocks.closeAlbum,
    openArtist: mocks.openArtist,
    closeArtist: mocks.closeArtist,
    openMusicEditor: mocks.openMusicEditor,
    closeMusicEditor: mocks.closeMusicEditor,
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mocks.routeQuery,
  }),
}))

describe('Music HomeView.vue (Album Landing)', () => {
  beforeEach(() => {
    mocks.openAlbum.mockReset()
    mocks.closeAlbum.mockReset()
    mocks.openArtist.mockReset()
    mocks.closeArtist.mockReset()
    mocks.openMusicEditor.mockReset()
    mocks.closeMusicEditor.mockReset()
    mocks.routeQuery = {}
  })

  it('renders the album landing content for the music module entry', () => {
    const wrapper = mount(HomeView)

    expect(wrapper.find('[data-testid="music-explore-view-stub"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('专辑首页')
    expect(wrapper.find('[data-testid="music-explore-view-stub"]').attributes('data-page-title')).toBe('专辑')
    expect(wrapper.find('[data-testid="music-explore-view-stub"]').attributes('data-content-mode')).toBe('albums')
    expect(wrapper.find('[data-testid="artist-drawer-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="album-drawer-stub"]').exists()).toBe(true)
  })

  it('opens drawers from route query state on mount', () => {
    mocks.routeQuery = {
      album: 'album-1',
      artist: 'artist-1',
    }

    mount(HomeView)

    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')
    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
  })

  it('opens the album editor from route query state on mount', () => {
    mocks.routeQuery = {
      album: 'album-9',
      editor: 'album-edit',
    }

    mount(HomeView)

    expect(mocks.openMusicEditor).toHaveBeenCalledWith({
      entity: 'album',
      mode: 'edit',
      id: 'album-9',
    })
  })

  it('opens the unified artist creation entry from route query state on mount', () => {
    mocks.routeQuery = {
      editor: 'artist-create',
      name: 'Seed Artist',
    }

    mount(HomeView)

    expect(mocks.openMusicEditor).toHaveBeenCalledWith({
      entity: 'artist',
      mode: 'create',
      seed: { name: 'Seed Artist' },
    })
  })
})
