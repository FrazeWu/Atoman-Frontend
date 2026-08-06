import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MusicSquareImageCropSheet from '@/components/music/MusicSquareImageCropSheet.vue'

describe('MusicSquareImageCropSheet.vue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

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
    expect(wrapper.text()).not.toContain('固定 1:1 裁剪')

    wrapper.unmount()
    expect(createObjectURLMock).toHaveBeenCalledOnce()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:crop-test')
  })

  it('loads a remote cover as a blob for cropping', async () => {
    const coverBlob = new Blob(['cover'], { type: 'image/jpeg' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(coverBlob),
    })
    vi.stubGlobal('fetch', fetchMock)
    const createObjectURLMock = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:remote-cover')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const wrapper = mount(MusicSquareImageCropSheet, {
      props: {
        show: true,
        sourceUrl: 'https://assets.atoman.org/covers/test.jpg',
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

    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/media/cover?url=https%3A%2F%2Fassets.atoman.org%2Fcovers%2Ftest.jpg')
    expect(createObjectURLMock).toHaveBeenCalledWith(coverBlob)
    expect(wrapper.get('img').attributes('src')).toBe('blob:remote-cover')
    wrapper.unmount()
  })

  it('shows a concise message when a remote cover cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network Error')))
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const wrapper = mount(MusicSquareImageCropSheet, {
      props: {
        show: true,
        sourceUrl: 'https://assets.atoman.org/covers/missing.jpg',
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

    await flushPromises()

    expect(wrapper.text()).toContain('封面加载失败，请重新选择图片')
    expect(wrapper.text()).not.toContain('Network Error')
  })
})
