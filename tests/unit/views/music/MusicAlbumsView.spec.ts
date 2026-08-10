import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, reactive } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AlbumsView from '@/views/music/AlbumsView.vue'
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
}))

const authStore = reactive({
  isAuthenticated: false,
  token: null as string | null,
  user: null as null | { uuid: string },
})

vi.mock('@/views/music/DiscoverView.vue', () => ({
  default: {
    name: 'DiscoverViewStub',
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
  useAuthStore: () => authStore,
}))

vi.mock('@/router', () => ({
  default: { push: mocks.routerPush },
}))

const mountedWrappers: Array<ReturnType<typeof mount>> = []

function mountHome() {
  const wrapper = mount(AlbumsView, { global: { plugins: [createPinia()] } })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('Music AlbumsView.vue (Album Landing)', () => {
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
    mocks.listPendingMusicLyricsAnnotations.mockResolvedValue([])
    mocks.routerPush.mockReset()
    authStore.isAuthenticated = false
    authStore.token = null
    authStore.user = null
    mocks.routeQuery = {}
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('renders the album landing content for the music module entry', () => {
    const wrapper = mountHome()

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

    mountHome()

    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')
    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
  })

  it('opens the album editor from route query state on mount', () => {
    mocks.routeQuery = {
      album: 'album-9',
      editor: 'album-edit',
    }

    mountHome()

    expect(mocks.openMusicCreationFlow).toHaveBeenCalledWith({
      mode: 'edit',
      entity: 'album',
      albumId: 'album-9',
      startStep: 'albumDetails',
    })
    expect(mocks.openMusicEditor).not.toHaveBeenCalled()
  })

  it('opens the unified artist creation entry from route query state on mount', () => {
    mocks.routeQuery = {
      editor: 'artist-create',
      name: 'Seed Artist',
    }

    mountHome()

    expect(mocks.openMusicCreationFlow).toHaveBeenCalledWith({
      startStep: 'artist',
      artistName: 'Seed Artist',
    })
    expect(mocks.openMusicEditor).not.toHaveBeenCalled()
  })

  it('shows the authenticated user exact pending rebind count and opens the first task', async () => {
    authStore.isAuthenticated = true
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1' }
    mocks.listPendingMusicLyricsAnnotations.mockResolvedValue([
      { annotation_id: 'annotation-1', song_id: 'song-1', album_id: 'album-1' },
      { annotation_id: 'annotation-2', song_id: 'song-2', album_id: 'album-2' },
    ])

    const wrapper = mountHome()
    await nextTick()
    await nextTick()

    expect(mocks.listPendingMusicLyricsAnnotations).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="music-pending-rebind"]').text()).toContain('2')

    await wrapper.get('[data-testid="music-pending-rebind"]').trigger('click')
    await flushPromises()

    expect(mocks.routerPush).toHaveBeenCalledWith({
      path: '/music/album/album-1',
      query: { song_id: 'song-1', annotation_id: 'annotation-1', rebind: '1' },
    })
  })

  it('does not show a pending rebind entry when the authenticated user has no tasks', async () => {
    authStore.isAuthenticated = true
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1' }
    mocks.listPendingMusicLyricsAnnotations.mockResolvedValue([])

    const wrapper = mountHome()
    await nextTick()
    await nextTick()

    expect(mocks.listPendingMusicLyricsAnnotations).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="music-pending-rebind"]').exists()).toBe(false)
  })

  it('removes the pending rebind entry after the annotation is rebound', async () => {
    authStore.isAuthenticated = true
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1' }
    mocks.listPendingMusicLyricsAnnotations.mockResolvedValue([
      { annotation_id: 'annotation-1', song_id: 'song-1', album_id: 'album-1' },
    ])

    const wrapper = mountHome()
    await flushPromises()
    expect(wrapper.find('[data-testid="music-pending-rebind"]').exists()).toBe(true)

    removePendingMusicLyricsAnnotation('annotation-1')
    await nextTick()
    expect(wrapper.find('[data-testid="music-pending-rebind"]').exists()).toBe(false)
  })

  it('clears the pending rebind entry when the user logs out', async () => {
    authStore.isAuthenticated = true
    authStore.token = 'token-a'
    authStore.user = { uuid: 'user-a' }
    mocks.listPendingMusicLyricsAnnotations.mockResolvedValue([
      { annotation_id: 'annotation-a', song_id: 'song-a', album_id: 'album-a' },
    ])

    const wrapper = mountHome()
    await flushPromises()
    expect(wrapper.find('[data-testid="music-pending-rebind"]').exists()).toBe(true)

    authStore.isAuthenticated = false
    authStore.token = null
    authStore.user = null
    await nextTick()

    expect(wrapper.find('[data-testid="music-pending-rebind"]').exists()).toBe(false)
  })
})
