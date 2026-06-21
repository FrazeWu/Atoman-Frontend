import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationAlbumSeedStep from '@/components/music/MusicCreationAlbumSeedStep.vue'
import * as musicApi from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

describe('MusicCreationAlbumSeedStep.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    const drawers = useMusicDrawers()
    drawers.closeAll()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumSeed')
  })

  it('uploads multiple files, stores uploaded assets, and advances to album details', async () => {
    vi.spyOn(musicApi, 'uploadMusicAudioBatch').mockResolvedValue([
      { url: 'https://cdn.example.com/01.mp3', key: 'uploads/audio/01.mp3' } as any,
      { url: 'https://cdn.example.com/02.mp3', key: 'uploads/audio/02.mp3' } as any,
    ])

    const drawers = useMusicDrawers()
    const wrapper = mount(MusicCreationAlbumSeedStep)

    await wrapper.get('[data-testid="album-seed-title-input"]').setValue('Late Registration')

    const files = [
      new File(['a'], '01 Intro.mp3', { type: 'audio/mpeg' }),
      new File(['b'], '02 Gold Digger.mp3', { type: 'audio/mpeg' }),
    ]
    const input = wrapper.get('[data-testid="album-seed-batch-upload"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: files })

    await wrapper.get('[data-testid="album-seed-batch-upload"]').trigger('change')

    expect(drawers.state.value.creationFlow?.draft.albumSeed.uploadedAssets).toEqual([
      { id: 'uploads/audio/01.mp3', url: 'https://cdn.example.com/01.mp3' },
      { id: 'uploads/audio/02.mp3', url: 'https://cdn.example.com/02.mp3' },
    ])
    expect(drawers.state.value.creationFlow?.draft.tracks).toEqual([
      { id: 'draft-track-1', sequence: 1, title: '01 Intro', audioUrl: 'https://cdn.example.com/01.mp3' },
      { id: 'draft-track-2', sequence: 2, title: '02 Gold Digger', audioUrl: 'https://cdn.example.com/02.mp3' },
    ])
    expect(drawers.state.value.creationFlow?.draft.artist.id).toBe('artist-seeded')
    expect(drawers.state.value.creationFlow?.step).toBe('albumSeed')

    await wrapper.get('[data-testid="album-seed-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.draft.albumDetails.title).toBe('Late Registration')
    expect(drawers.state.value.creationFlow?.draft.artist.id).toBe('artist-seeded')
    expect(drawers.state.value.creationFlow?.step).toBe('albumDetails')
  })

  it('does not advance before both title and uploaded tracks exist', async () => {
    vi.spyOn(musicApi, 'uploadMusicAudioBatch').mockResolvedValue([])

    const drawers = useMusicDrawers()
    const wrapper = mount(MusicCreationAlbumSeedStep)

    await wrapper.get('[data-testid="album-seed-next-button"]').trigger('click')
    expect(drawers.state.value.creationFlow?.step).toBe('albumSeed')

    await wrapper.get('[data-testid="album-seed-title-input"]').setValue('Graduation')
    await wrapper.get('[data-testid="album-seed-next-button"]').trigger('click')
    expect(drawers.state.value.creationFlow?.step).toBe('albumSeed')
  })
})
