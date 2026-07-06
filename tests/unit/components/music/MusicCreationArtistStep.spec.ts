import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationArtistStep from '@/components/music/MusicCreationArtistStep.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { uploadMusicAsset } from '@/api/musicV1'

vi.mock('@/api/musicV1', () => ({
  uploadMusicAsset: vi.fn(),
}))

vi.mock('@/components/music/MusicSquareImageCropSheet.vue', () => ({
  default: {
    props: ['show'],
    emits: ['confirm', 'cancel'],
    template: `
      <div v-if="show" data-testid="music-square-crop-sheet">
        <button data-testid="music-square-crop-confirm" @click="$emit('confirm', { type: 'image/png', name: 'avatar-cropped.png' })">confirm</button>
        <button data-testid="music-square-crop-cancel" @click="$emit('cancel')">cancel</button>
      </div>
    `,
  },
}))

describe('MusicCreationArtistStep.vue', () => {
  beforeEach(() => {
    const drawers = useMusicDrawers()
    drawers.closeAll()
    drawers.openMusicCreationFlow()
    drawers.setMusicCreationStep('artist')
    vi.mocked(uploadMusicAsset).mockReset()
  })

  it('blocks moving forward when an additional stage name has no duration', async () => {
    const drawers = useMusicDrawers()
    vi.mocked(uploadMusicAsset).mockResolvedValue({
      key: 'music/avatar-cropped.png',
      url: 'https://img.example/avatar-cropped.png',
    })
    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `
              <input
                data-testid="artist-nationality-input"
                :value="modelValue"
                @input="$emit('update:modelValue', $event.target.value)"
              />
            `,
          },
        },
      },
    })

    await wrapper.get('[data-testid="artist-legal-name-input"]').setValue('Kanye Omari West')
    await wrapper.get('[data-testid="artist-stage-name-input-0"]').setValue('Kanye West')
    await wrapper.get('[data-testid="artist-nationality-input"]').setValue('US')
    await wrapper.get('[data-testid="artist-birth-year-input"]').setValue('1977')
    await wrapper.get('[data-testid="artist-birth-month-input"]').setValue('6')
    await wrapper.get('[data-testid="artist-birth-day-input"]').setValue('8')
    await wrapper.get('[data-testid="artist-source-input"]').setValue('https://example.com/source')
    const input = wrapper.get('[data-testid="artist-avatar-input"]').element as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })
    await wrapper.get('[data-testid="artist-avatar-input"]').trigger('change')
    await wrapper.get('[data-testid="music-square-crop-confirm"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="artist-add-stage-name-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-stage-name-input-1"]').setValue('Ye')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(wrapper.get('[data-testid="artist-stage-name-error"]').text()).toContain('请为追加艺名补充持续时间')
    expect(drawers.state.value.creationFlow?.step).toBe('artist')
  })

  it('uses birthDateParts as the primary birthday draft and derives birthDate', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input data-testid="artist-nationality-input" :value="modelValue" />',
          },
        },
      },
    })

    await wrapper.get('[data-testid="artist-birth-year-input"]').setValue('2001')
    await wrapper.get('[data-testid="artist-birth-month-input"]').setValue('6')
    await wrapper.get('[data-testid="artist-birth-day-input"]').setValue('8')

    expect(drawers.state.value.creationFlow?.draft.artist.birthDateParts).toEqual({
      year: '2001',
      month: '6',
      day: '8',
    })
    expect(drawers.state.value.creationFlow?.draft.artist.birthDate).toBe('2001-06-08')
  })

  it('requires personal mandatory fields before moving forward', async () => {
    const drawers = useMusicDrawers()
    vi.mocked(uploadMusicAsset).mockResolvedValue({
      key: 'music/avatar-cropped.png',
      url: 'https://img.example/avatar-cropped.png',
    })

    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: `
              <input
                data-testid="artist-nationality-input"
                :value="modelValue"
                @input="$emit('update:modelValue', $event.target.value)"
              />
            `,
          },
        },
      },
    })

    await wrapper.get('[data-testid="artist-legal-name-input"]').setValue('Kanye Omari West')
    await wrapper.get('[data-testid="artist-stage-name-input-0"]').setValue('Kanye West')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.step).toBe('artist')

    await wrapper.get('[data-testid="artist-nationality-input"]').setValue('US')
    await wrapper.get('[data-testid="artist-birth-year-input"]').setValue('1977')
    await wrapper.get('[data-testid="artist-birth-month-input"]').setValue('6')
    await wrapper.get('[data-testid="artist-birth-day-input"]').setValue('8')
    await wrapper.get('[data-testid="artist-source-input"]').setValue('https://example.com/source')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.step).toBe('artist')

    const input = wrapper.get('[data-testid="artist-avatar-input"]').element as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })
    await wrapper.get('[data-testid="artist-avatar-input"]').trigger('change')
    await wrapper.get('[data-testid="music-square-crop-confirm"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.step).toBe('albumImport')
  })

  it('switches to group mode, hides person-only fields, and requires at least two members', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input data-testid="artist-nationality-input" :value="modelValue" />',
          },
        },
      },
    })

    await wrapper.get('[data-testid="artist-kind-group-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-group-name-input"]').setValue('Daft Punk')
    await wrapper.get('[data-testid="artist-group-start-year-input"]').setValue('1993')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-member-name-input-0"]').setValue('Thomas Bangalter')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.draft.artist.kind).toBe('group')
    expect(wrapper.find('[data-testid="artist-legal-name-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="artist-nationality-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="artist-add-stage-name-button"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="artist-members-error"]').text()).toContain('组合至少需要 2 名成员')
    expect(drawers.state.value.creationFlow?.step).toBe('artist')
  })

  it('stores group member join and leave date parts with the existing segmented date pattern', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input data-testid="artist-nationality-input" :value="modelValue" />',
          },
        },
      },
    })

    await wrapper.get('[data-testid="artist-kind-group-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-group-name-input"]').setValue('The xx')
    await wrapper.get('[data-testid="artist-group-start-year-input"]').setValue('2005')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-member-name-input-0"]').setValue('Romy')
    await wrapper.get('[data-testid="artist-member-join-year-input-0"]').setValue('2005')
    await wrapper.get('[data-testid="artist-member-join-month-input-0"]').setValue('6')
    await wrapper.get('[data-testid="artist-member-join-day-input-0"]').setValue('1')
    await wrapper.get('[data-testid="artist-member-name-input-1"]').setValue('Oliver')
    await wrapper.get('[data-testid="artist-member-leave-year-input-1"]').setValue('2014')
    await wrapper.get('[data-testid="artist-member-leave-month-input-1"]').setValue('8')
    await wrapper.get('[data-testid="artist-member-leave-day-input-1"]').setValue('31')

    expect(drawers.state.value.creationFlow?.draft.artist.members).toEqual([
      expect.objectContaining({
        name: 'Romy',
        joinDateParts: {
          year: '2005',
          month: '6',
          day: '1',
        },
        leaveDateParts: {
          year: '',
          month: '',
          day: '',
        },
      }),
      expect.objectContaining({
        name: 'Oliver',
        joinDateParts: {
          year: '',
          month: '',
          day: '',
        },
        leaveDateParts: {
          year: '2014',
          month: '8',
          day: '31',
        },
      }),
    ])
  })

  it('requires group mandatory fields before moving forward', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input data-testid="artist-nationality-input" :value="modelValue" />',
          },
        },
      },
    })

    await wrapper.get('[data-testid="artist-kind-group-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-group-name-input"]').setValue('The xx')
    await wrapper.get('[data-testid="artist-group-start-year-input"]').setValue('2005')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-member-name-input-0"]').setValue('Romy')
    await wrapper.get('[data-testid="artist-member-name-input-1"]').setValue('Oliver')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(wrapper.get('[data-testid="artist-members-error"]').text()).toContain('请为每位成员填写加入时间')
    expect(drawers.state.value.creationFlow?.step).toBe('artist')

    await wrapper.get('[data-testid="artist-member-join-year-input-0"]').setValue('2005')
    await wrapper.get('[data-testid="artist-member-join-year-input-1"]').setValue('2005')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.step).toBe('artist')

    await wrapper.get('[data-testid="artist-source-input"]').setValue('https://example.com/group-source')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.step).toBe('albumImport')
  })

  it('opens square crop sheet before applying artist avatar preview', async () => {
    vi.mocked(uploadMusicAsset).mockResolvedValue({
      key: 'music/avatar-cropped.png',
      url: 'https://img.example/avatar-cropped.png',
    })

    const drawers = useMusicDrawers()
    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<input data-testid="artist-nationality-input" :value="modelValue" />',
          },
        },
      },
    })

    const input = wrapper.get('[data-testid="artist-avatar-input"]').element as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="artist-avatar-input"]').trigger('change')

    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(true)
    expect(vi.mocked(uploadMusicAsset)).not.toHaveBeenCalled()
    expect(drawers.state.value.creationFlow?.draft.artist.avatarUrl).toBe('')

    await wrapper.get('[data-testid="music-square-crop-confirm"]').trigger('click')
    await flushPromises()

    expect(vi.mocked(uploadMusicAsset)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadMusicAsset).mock.calls[0]?.[1]).toBe('music.cover')
    expect(drawers.state.value.creationFlow?.draft.artist.avatarUrl).toBe('https://img.example/avatar-cropped.png')
    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(false)
  })
})
