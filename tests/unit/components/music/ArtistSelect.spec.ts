import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ArtistSelect from '@/components/music/ArtistSelect.vue'

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: vi.fn(async () => ({
    data: [],
  })),
}))

const openMusicEditor = vi.fn()

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    openMusicEditor,
  }),
}))

describe('ArtistSelect', () => {
  it('opens unified artist creation editor with the typed seed name', async () => {
    openMusicEditor.mockReset()
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

    expect(openMusicEditor).toHaveBeenCalledWith({
      entity: 'artist',
      mode: 'create',
      seed: { name: 'Sigur Rós & Jónsi' },
    })
  })
})
