import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationAlbumSeedStep from '@/components/music/MusicCreationAlbumSeedStep.vue'
import * as musicApi from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

describe('MusicCreationAlbumImportStep.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    const drawers = useMusicDrawers()
    drawers.closeAll()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded', startStep: 'albumImport' })
    drawers.setMusicCreationStep('albumImport')
  })

  it('shows upload progress and speed after a zip upload starts', async () => {
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue({
      importId: 'import-1',
      status: 'pending_upload',
      archiveName: '',
      uploadProgress: 0,
      uploadSpeed: 0,
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })
    vi.spyOn(musicApi, 'uploadMusicAlbumArchive').mockImplementation(async (_importId, _file, options) => {
      options?.onProgress?.({ loaded: 512_000, total: 1_024_000, bytesPerSecond: 256_000 })
    })
    vi.spyOn(musicApi, 'getMusicAlbumImport').mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'late-registration.zip',
      uploadProgress: 100,
      uploadSpeed: 0,
      derivedAlbumTitle: 'Late Registration',
      derivedCover: 'https://cdn.example.com/cover.jpg',
      derivedTracks: [
        { title: 'Wake Up Mr. West', audioKey: 'imports/import-1/01.mp3', origin: '01 Wake Up Mr. West.mp3' },
      ],
      coverUrl: 'https://cdn.example.com/cover.jpg',
      coverKey: 'imports/import-1/cover.jpg',
      lastSyncedAt: '2026-06-30T10:00:00Z',
      errorMessage: '',
    })

    const wrapper = mount(MusicCreationAlbumSeedStep)
    const file = new File(['zip'], 'late-registration.zip', { type: 'application/zip' })
    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')

    expect(wrapper.text()).toContain('上传进度 50%')
    expect(wrapper.text()).toContain('250 KB/s')
  })
})
