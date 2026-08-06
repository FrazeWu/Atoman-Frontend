import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicEntityEditorDrawer from '@/components/music/MusicEntityEditorDrawer.vue'

const drawerState = ref({
  artistId: null as string | null,
  albumId: null as string | null,
  musicEditor: null as null | {
    entity: 'artist' | 'album'
    mode: 'create' | 'edit'
    id?: string
    seed?: Record<string, unknown>
  },
  creationFlow: null as null | {
    step: 'artist' | 'albumImport' | 'albumDetails' | 'preview'
    draft: {
      artist: {
        id: string | null
        avatarUrl: string
        legalName: string
        stageNames: Array<{
          id: string
          name: string
          isPrimary: boolean
          startDateText: string
          endDateText: string
        }>
        birthPlace: string
      }
      albumImport: {
        importId: string | null
        status: 'pending_upload' | 'ready'
      }
      albumDetails: {
        title: string
        coverUrl: string
        releaseYear: string
      }
      tracks: Array<{ title: string }>
    }
    dirty: boolean
    submitting: boolean
    errorMessage: string
  },
})

const mocks = vi.hoisted(() => ({
  closeMusicEditor: vi.fn(),
  refreshAlbum: vi.fn(),
  refreshArtist: vi.fn(),
  openMusicCreationFlow: vi.fn(),
  closeMusicCreationFlow: vi.fn(),
  setMusicCreationStep: vi.fn(),
  routerReplace: vi.fn(),
  getMusicArtist: vi.fn(),
  getMusicAlbum: vi.fn(),
  uploadMusicAsset: vi.fn(),
  submitMusicEdit: vi.fn(),
  buildUpdateArtistEdit: vi.fn(),
  buildUpdateAlbumEdit: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
  }),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerState,
    closeMusicEditor: mocks.closeMusicEditor,
    refreshAlbum: mocks.refreshAlbum,
    refreshArtist: mocks.refreshArtist,
    openMusicCreationFlow: mocks.openMusicCreationFlow,
    closeMusicCreationFlow: mocks.closeMusicCreationFlow,
    setMusicCreationStep: mocks.setMusicCreationStep,
  }),
}))

vi.mock('@/components/music', () => ({
  AlbumEditorShell: {
    name: 'AlbumEditorShell',
    emits: ['update:cover'],
    template: '<div data-testid="album-editor-shell-stub" />',
  },
  MusicArtistForm: { name: 'MusicArtistForm', emits: ['submit'], template: '<div data-testid="music-artist-form-stub" />' },
}))

vi.mock('@/components/music/MusicCreationArtistStep.vue', () => ({
  default: { template: '<div data-testid="music-creation-artist-step-stub" />' },
}))

vi.mock('@/components/music/MusicCreationAlbumSeedStep.vue', () => ({
  default: { template: '<div data-testid="music-creation-album-seed-step-stub" />' },
}))

vi.mock('@/components/music/MusicCreationAlbumDetailsStep.vue', () => ({
  default: { template: '<div data-testid="music-creation-album-details-step-stub" />' },
}))

vi.mock('@/components/music/MusicCreationAlbumPreviewStep.vue', () => ({
  default: { template: '<div data-testid="music-creation-album-preview-step-stub" />' },
}))

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    props: ['show'],
    template: '<div v-if="show"><slot /></div>',
  },
}))

vi.mock('@/components/ui/PButton.vue', () => ({
  default: {
    template: '<button><slot /></button>',
  },
}))

vi.mock('@/api/musicV1', () => ({
  createMusicArtist: vi.fn(),
  getMusicArtist: mocks.getMusicArtist,
  getMusicAlbum: mocks.getMusicAlbum,
  submitMusicEdit: mocks.submitMusicEdit,
  uploadMusicAsset: mocks.uploadMusicAsset,
  commitMusicAlbumImport: vi.fn(),
  buildUpdateArtistEdit: mocks.buildUpdateArtistEdit,
  buildUpdateAlbumEdit: mocks.buildUpdateAlbumEdit,
}))

function createFlowState(step: 'artist' | 'albumImport' | 'albumDetails' | 'preview' = 'artist') {
  return {
    step,
    draft: {
      artist: {
        id: null,
        avatarUrl: '',
        legalName: 'Seed Artist',
        stageNames: [
          {
            id: 'primary',
            name: 'Seed Artist',
            isPrimary: true,
            startDateText: '',
            endDateText: '',
          },
        ],
        birthPlace: '',
      },
      albumImport: {
        importId: null,
        status: 'pending_upload' as const,
      },
      albumDetails: {
        title: '',
        coverUrl: '',
        releaseYear: '',
      },
      tracks: [],
    },
    dirty: false,
    submitting: false,
    errorMessage: '',
  }
}

describe('MusicEntityEditorDrawer.vue', () => {
  let consoleError: ReturnType<typeof vi.spyOn>
  const mountedWrappers: VueWrapper[] = []

  function mountDrawer() {
    const wrapper = mount(MusicEntityEditorDrawer)
    mountedWrappers.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    drawerState.value = {
      artistId: null,
      albumId: null,
      musicEditor: null,
      creationFlow: null,
    }
    mocks.closeMusicEditor.mockReset()
    mocks.refreshAlbum.mockReset()
    mocks.refreshArtist.mockReset()
    mocks.openMusicCreationFlow.mockReset()
    mocks.closeMusicCreationFlow.mockReset()
    mocks.setMusicCreationStep.mockReset()
    mocks.routerReplace.mockReset()
    mocks.getMusicArtist.mockReset()
    mocks.getMusicAlbum.mockReset()
    mocks.uploadMusicAsset.mockReset()
    mocks.submitMusicEdit.mockReset()
    mocks.buildUpdateArtistEdit.mockReset()
    mocks.buildUpdateAlbumEdit.mockReset()
    mocks.getMusicArtist.mockResolvedValue({ id: 'artist-1', name: 'Test Artist' })
    mocks.getMusicAlbum.mockResolvedValue({
      id: 'album-1',
      title: 'Test Album',
      entry_status: 'open',
      songs: [],
    })
    mocks.uploadMusicAsset.mockResolvedValue({
      url: 'https://assets.example.test/covers/new.webp',
      key: 'music/covers/new.webp',
      content_type: 'image/webp',
      size: 1,
    })
    mocks.submitMusicEdit.mockResolvedValue({})
    mocks.buildUpdateArtistEdit.mockReturnValue({ id: 'artist-edit-request' })
    mocks.buildUpdateAlbumEdit.mockReturnValue({ id: 'edit-request' })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    consoleError.mockRestore()
  })

  it('uses the artist form in artist create mode', () => {
    drawerState.value.musicEditor = { entity: 'artist', mode: 'create' }

    const wrapper = mountDrawer()

    expect(wrapper.find('[data-testid="music-artist-form-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="music-creation-artist-step-stub"]').exists()).toBe(false)
    expect(mocks.openMusicCreationFlow).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('新建艺术家')
  })

  it('keeps artist edit mode on the legacy artist form path', async () => {
    drawerState.value.musicEditor = { entity: 'artist', mode: 'edit', id: 'artist-1' }

    const wrapper = mountDrawer()

    expect(wrapper.find('[data-testid="music-artist-form-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="music-creation-artist-step-stub"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('编辑艺术家')

    await flushPromises()
    expect(mocks.getMusicArtist).toHaveBeenCalledWith('artist-1')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('submits artist edits through the auditable music edit flow', async () => {
    drawerState.value.musicEditor = { entity: 'artist', mode: 'edit', id: 'artist-1' }
    const wrapper = mountDrawer()
    await flushPromises()

    wrapper.getComponent({ name: 'MusicArtistForm' }).vm.$emit('submit', {
      name: 'Updated Artist',
      bio: 'Updated biography',
    })
    await flushPromises()

    expect(mocks.buildUpdateArtistEdit).toHaveBeenCalledWith('artist-1', {
      name: 'Updated Artist',
      bio: 'Updated biography',
      reason: '编辑艺术家',
      sources: [],
    })
    expect(mocks.submitMusicEdit).toHaveBeenCalledWith({ id: 'artist-edit-request' })
  })

  it('uploads the selected replacement cover when saving an album', async () => {
    drawerState.value.musicEditor = { entity: 'album', mode: 'edit', id: 'album-1' }
    const file = new File(['cover'], 'cover.webp', { type: 'image/webp' })
    const wrapper = mountDrawer()

    await flushPromises()
    wrapper.getComponent({ name: 'AlbumEditorShell' }).vm.$emit('update:cover', {
      file,
      previewUrl: 'data:image/webp;base64,Y292ZXI=',
      asset: null,
    })
    await nextTick()

    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存全部')
    await saveButton?.trigger('click')
    await flushPromises()

    expect(mocks.uploadMusicAsset).toHaveBeenCalledWith(file, 'music.cover')
    expect(mocks.buildUpdateAlbumEdit).toHaveBeenCalledWith('album-1', expect.objectContaining({
      cover: expect.objectContaining({ url: 'https://assets.example.test/covers/new.webp' }),
    }))
  })
})
