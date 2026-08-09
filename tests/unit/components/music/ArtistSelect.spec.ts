import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ArtistSelect from '@/components/music/ArtistSelect.vue'

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: vi.fn(async () => ({
    data: [],
  })),
}))

const openMusicCreationFlow = vi.fn()

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    openMusicCreationFlow,
  }),
}))

describe('ArtistSelect', () => {
  it('opens unified artist creation editor with the typed seed name', async () => {
    openMusicCreationFlow.mockReset()
    const wrapper = mount(ArtistSelect, {
      props: {
        modelValue: [],
      },
      global: {
        stubs: {
          PInput: false,
        },
      },
    })

    await wrapper.get('input').setValue('Sigur Rós & Jónsi')
    await wrapper.get('input').trigger('focus')
    await wrapper.get('.add-artist-link').trigger('mousedown')

    expect(openMusicCreationFlow).toHaveBeenCalledWith({
      startStep: 'artist',
      artistName: 'Sigur Rós & Jónsi',
    })
  })
})
