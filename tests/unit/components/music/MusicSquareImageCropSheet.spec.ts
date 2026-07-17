import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MusicSquareImageCropSheet from '@/components/music/MusicSquareImageCropSheet.vue'

describe('MusicSquareImageCropSheet.vue', () => {
  it('disables confirm before the image has finished loading', async () => {
    const createObjectURLMock = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:crop-test')
    const revokeObjectURLMock = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const wrapper = mount(MusicSquareImageCropSheet, {
      props: {
        show: true,
        sourceFile: { name: 'cover.png', type: 'image/png' },
      },
      global: {
        stubs: {
          PSheet: {
            props: ['show'],
            template: '<div v-if="show"><slot /></div>',
          },
          PButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    const confirmButton = wrapper.get('[data-testid="music-square-crop-confirm"]')
    expect((confirmButton.element as HTMLButtonElement).disabled).toBe(true)

    createObjectURLMock.mockRestore()
    revokeObjectURLMock.mockRestore()
  })
})
