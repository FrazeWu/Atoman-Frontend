import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    step: 'artist' | 'albumImport' | 'albumDetails'
    draft: {
      artist: {
        id: string | null
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
  AlbumEditorShell: { template: '<div data-testid="album-editor-shell-stub" />' },
  MusicArtistForm: { template: '<div data-testid="music-artist-form-stub" />' },
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

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    props: ['show'],
    template: '<div v-if="show"><slot /></div>',
  },
}))

vi.mock('@/components/ui/PPageHeader.vue', () => ({
  default: {
    props: ['title'],
    template: '<div data-testid="page-header">{{ title }}</div>',
  },
}))

vi.mock('@/components/ui/PButton.vue', () => ({
  default: {
    template: '<button><slot /></button>',
  },
}))

vi.mock('@/api/musicV1', () => ({
  getMusicArtist: vi.fn(),
  getMusicAlbum: vi.fn(),
  updateMusicArtist: vi.fn(),
  submitMusicEdit: vi.fn(),
  uploadMusicAsset: vi.fn(),
  commitMusicAlbumImport: vi.fn(),
  buildUpdateAlbumEdit: vi.fn(),
}))

function createFlowState(step: 'artist' | 'albumImport' | 'albumDetails' = 'artist') {
  return {
    step,
    draft: {
      artist: {
        id: null,
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
  beforeEach(() => {
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
  })

  it('prefers unified creation flow over legacy artist form in artist create mode', () => {
    drawerState.value.musicEditor = { entity: 'artist', mode: 'create' }
    drawerState.value.creationFlow = createFlowState('artist')

    const wrapper = mount(MusicEntityEditorDrawer)

    expect(wrapper.find('[data-testid="music-creation-artist-step-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="music-artist-form-stub"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('新建艺术家')
  })

  it('keeps artist edit mode on the legacy artist form path', () => {
    drawerState.value.musicEditor = { entity: 'artist', mode: 'edit', id: 'artist-1' }

    const wrapper = mount(MusicEntityEditorDrawer)

    expect(wrapper.find('[data-testid="music-artist-form-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="music-creation-artist-step-stub"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('编辑艺术家')
  })
})
