import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeView from '@/views/music/HomeView.vue'
import { removePendingMusicLyricsAnnotation } from '@/composables/usePendingMusicLyricsAnnotations'

const mocks = vi.hoisted(() => ({
  openAlbum: vi.fn(),
  closeAlbum: vi.fn(),
  openArtist: vi.fn(),
  closeArtist: vi.fn(),
  openMusicCreationFlow: vi.fn(),
  closeMusicCreationFlow: vi.fn(),
  openMusicEditor: vi.fn(),
  closeMusicEditor: vi.fn(),
  routeQuery: {} as Record<string, string>,
  listPendingMusicLyricsAnnotations: vi.fn(),
  routerPush: vi.fn(),
  authStore: { isAuthenticated: false, token: null } as { isAuthenticated: boolean; token: string | null },
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
vi.mock('@/components/music/MusicCreationFlowDrawer.vue', () => ({ default: { template: '<div data-testid="music-creation-flow-drawer-stub" />' } }))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    isMainShifted: computed(() => false),
    openAlbum: mocks.openAlbum,
    closeAlbum: mocks.closeAlbum,
    openArtist: mocks.openArtist,
    closeArtist: mocks.closeArtist,
    openMusicCreationFlow: mocks.openMusicCreationFlow,
    closeMusicCreationFlow: mocks.closeMusicCreationFlow,
    openMusicEditor: mocks.openMusicEditor,
    closeMusicEditor: mocks.closeMusicEditor,
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mocks.routeQuery,
  }),
}))

vi.mock('@/api/musicV1', () => ({
  listPendingMusicLyricsAnnotations: mocks.listPendingMusicLyricsAnnotations,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mocks.authStore,
}))

vi.mock('@/router', () => ({
  default: { push: mocks.routerPush },
}))

describe('Music HomeView.vue (Album Landing)', () => {
  beforeEach(() => {
    mocks.openAlbum.mockReset()
    mocks.closeAlbum.mockReset()
    mocks.openArtist.mockReset()
    mocks.closeArtist.mockReset()
    mocks.openMusicCreationFlow.mockReset()
    mocks.closeMusicCreationFlow.mockReset()
    mocks.openMusicEditor.mockReset()
    mocks.closeMusicEditor.mockReset()
    mocks.listPendingMusicLyricsAnnotations.mockReset()
    mocks.routerPush.mockReset()
    mocks.authStore = { isAuthenticated: false, token: null }
    mocks.routeQuery = {}
  })

  it('renders the album landing content for the music module entry', () => {
    const wrapper = mount(HomeView, { global: { plugins: [createPinia()] } })

    expect(wrapper.find('[data-testid="music-explore-view-stub"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('专辑首页')
    expect(wrapper.find('[data-testid="music-explore-view-stub"]').attributes('data-page-title')).toBe('专辑')
    expect(wrapper.find('[data-testid="music-explore-view-stub"]').attributes('data-content-mode')).toBe('albums')
  })

  it('opens drawers from route query state on mount', () => {
    mocks.routeQuery = {
      album: 'album-1',
      artist: 'artist-1',
    }

    mount(HomeView, { global: { plugins: [createPinia()] } })

    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')
    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
  })

  it('opens the album editor from route query state on mount', () => {
    mocks.routeQuery = {
      album: 'album-9',
      editor: 'album-edit',
    }

    mount(HomeView, { global: { plugins: [createPinia()] } })

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

    mount(HomeView, { global: { plugins: [createPinia()] } })

    expect(mocks.openMusicEditor).toHaveBeenCalledWith({
      entity: 'artist',
      mode: 'create',
      seed: { name: 'Seed Artist' },
    })
    expect(mocks.openMusicCreationFlow).not.toHaveBeenCalled()
  })

  it('shows the authenticated user exact pending rebind count and opens the first task', async () => {
    mocks.authStore = { isAuthenticated: true, token: 'token' }
    mocks.listPendingMusicLyricsAnnotations.mockResolvedValue([
      { annotation_id: 'annotation-1', song_id: 'song-1', album_id: 'album-1' },
      { annotation_id: 'annotation-2', song_id: 'song-2', album_id: 'album-2' },
    ])

    const wrapper = mount(HomeView, { global: { plugins: [createPinia()] } })
    await nextTick()
    await nextTick()

    expect(mocks.listPendingMusicLyricsAnnotations).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="music-pending-rebind"]').text()).toContain('2')

    await wrapper.get('[data-testid="music-pending-rebind"]').trigger('click')
    await flushPromises()

    expect(mocks.routerPush).toHaveBeenCalledWith({
      path: '/music/album/album-1',
      query: { song_id: 'song-1', annotation_id: 'annotation-1', rebind: '1' },
    })
  })

  it('does not show a pending rebind entry when the authenticated user has no tasks', async () => {
    mocks.authStore = { isAuthenticated: true, token: 'token' }
    mocks.listPendingMusicLyricsAnnotations.mockResolvedValue([])

    const wrapper = mount(HomeView, { global: { plugins: [createPinia()] } })
    await nextTick()
    await nextTick()

    expect(mocks.listPendingMusicLyricsAnnotations).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="music-pending-rebind"]').exists()).toBe(false)
  })

  it('removes the pending rebind entry after the annotation is rebound', async () => {
    mocks.authStore = { isAuthenticated: true, token: 'token' }
    mocks.listPendingMusicLyricsAnnotations.mockResolvedValue([
      { annotation_id: 'annotation-1', song_id: 'song-1', album_id: 'album-1' },
    ])

    const wrapper = mount(HomeView, { global: { plugins: [createPinia()] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="music-pending-rebind"]').exists()).toBe(true)

    removePendingMusicLyricsAnnotation('annotation-1')
    await nextTick()
    expect(wrapper.find('[data-testid="music-pending-rebind"]').exists()).toBe(false)
  })
})
