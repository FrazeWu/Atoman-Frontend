import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationArtistStep from '@/components/music/MusicCreationArtistStep.vue'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { uploadMusicAsset } from '@/api/musicV1'

vi.mock('@/api/musicV1', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/musicV1')>()
  return {
    ...actual,
    uploadMusicAsset: vi.fn(),
  }
})

vi.mock('naive-ui', () => ({
  NDatePicker: {
    inheritAttrs: false,
    props: ['formattedValue', 'formatted-value'],
    emits: ['update:formattedValue', 'update:formatted-value'],
    template: `
      <input
        type="text"
        data-testid="artist-birth-input"
        :value="formattedValue || $props['formatted-value']"
        @input="
          $emit('update:formattedValue', $event.target.value);
          $emit('update:formatted-value', $event.target.value)
        "
      />
    `,
  },
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

const countryRegionFieldStub = {
  props: ['modelValue', 'label', 'placeholder', 'triggerTestId', 'searchTestId', 'optionPrefix'],
  emits: ['update:modelValue'],
  template: `
    <label>{{ label }}</label>
    <input
      data-testid="artist-nationality-input"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
}

describe('MusicCreationArtistStep.vue', () => {
  let consoleWarn: ReturnType<typeof vi.spyOn>
  let wrappers: Array<{ unmount: () => void }> = []

  function mountArtistStep() {
    const wrapper = mount(MusicCreationArtistStep, {
      global: {
        stubs: {
          PCountryRegionField: countryRegionFieldStub,
        },
      },
    })
    wrappers.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    wrappers = []
    const drawers = useMusicDrawers()
    drawers.closeAll()
    drawers.openMusicCreationFlow()
    drawers.setMusicCreationStep('artist')
    vi.mocked(uploadMusicAsset).mockReset()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:artist-avatar-preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    try {
      expect(consoleWarn).not.toHaveBeenCalled()
    } finally {
      consoleWarn.mockRestore()
    }
  })

  it('blocks moving forward when an additional stage name has no duration', async () => {
    const drawers = useMusicDrawers()
    vi.mocked(uploadMusicAsset).mockResolvedValue({
      key: 'music/avatar-cropped.png',
      url: 'https://img.example/avatar-cropped.png',
    })
    const wrapper = mountArtistStep()

    await wrapper.get('[data-testid="artist-legal-name-input"]').setValue('Kanye Omari West')
    await wrapper.get('[data-testid="artist-stage-name-input-0"]').setValue('Kanye West')
    await wrapper.get('[data-testid="artist-nationality-input"]').setValue('US')
    drawers.state.value.creationFlow!.draft.artist.birthDateParts = { year: '1977', month: '06', day: '08' }
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

  it('shows a single birthday input and auto-formats digits with segmented placeholders', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mountArtistStep()

    expect(wrapper.find('[data-testid="artist-birth-input"]').exists()).toBe(true)
    await wrapper.get('[data-testid="artist-birth-input"]').setValue('20010608')
    await flushPromises()

    expect((wrapper.get('[data-testid="artist-birth-input"]').element as HTMLInputElement).value).toBe('2001/06/08')
    expect(drawers.state.value.creationFlow?.draft.artist.birthDateParts).toEqual({
      year: '2001',
      month: '06',
      day: '08',
    })
    expect(drawers.state.value.creationFlow?.draft.artist.birthDate).toBe('2001-06-08')
  })

  it('fills the remaining birthday segments with placeholders while typing', async () => {
    const wrapper = mountArtistStep()

    await wrapper.get('[data-testid="artist-birth-input"]').setValue('1987')
    await flushPromises()

    expect((wrapper.get('[data-testid="artist-birth-input"]').element as HTMLInputElement).value).toBe('1987/mm/dd')
  })

  it('places nationality and birthday on the same row', () => {
    const wrapper = mountArtistStep()

    const row = wrapper.find('.field-grid--duo')
    expect(row.exists()).toBe(true)
    expect(row.find('[data-testid="artist-nationality-input"]').exists()).toBe(true)
    expect(row.find('[data-testid="artist-birth-input"]').exists()).toBe(true)
  })

  it('keeps single-line labels inline and removes disambiguation fields', async () => {
    const wrapper = mountArtistStep()

    expect(wrapper.get('[data-testid="artist-legal-name-input"]').element.closest('.single-line-field')).not.toBeNull()
    expect(wrapper.get('[data-testid="artist-birth-input"]').element.closest('.single-line-field')).not.toBeNull()
    expect(wrapper.find('[data-testid="artist-disambiguation-input"]').exists()).toBe(false)

    await wrapper.get('[data-testid="artist-kind-group-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')

    expect(wrapper.find('[data-testid="artist-member-disambiguation-input-0"]').exists()).toBe(false)
  })

  it('shows required markers for mandatory personal artist fields', () => {
    const wrapper = mountArtistStep()

    expect(wrapper.text()).toContain('头像*')
    expect(wrapper.text()).toContain('本名*')
    expect(wrapper.text()).toContain('主艺名*')
    expect(wrapper.text()).toContain('国籍*')
    expect(wrapper.text()).toContain('生日*')
    expect(wrapper.text()).toContain('来源*')
  })

  it('requires personal mandatory fields before moving forward', async () => {
    const drawers = useMusicDrawers()
    vi.mocked(uploadMusicAsset).mockResolvedValue({
      key: 'music/avatar-cropped.png',
      url: 'https://img.example/avatar-cropped.png',
    })

    const wrapper = mountArtistStep()

    await wrapper.get('[data-testid="artist-legal-name-input"]').setValue('Kanye Omari West')
    await wrapper.get('[data-testid="artist-stage-name-input-0"]').setValue('Kanye West')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.step).toBe('artist')

    await wrapper.get('[data-testid="artist-nationality-input"]').setValue('US')
    drawers.state.value.creationFlow!.draft.artist.birthDateParts = { year: '1977', month: '06', day: '08' }
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
    const wrapper = mountArtistStep()

    await wrapper.get('[data-testid="artist-kind-group-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-group-name-input"]').setValue('Daft Punk')
    await wrapper.get('[data-testid="artist-group-start-date-input"]').setValue('1993/01/01')
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

  it('stores group member join and leave date parts from masked date inputs', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mountArtistStep()

    await wrapper.get('[data-testid="artist-kind-group-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-group-name-input"]').setValue('The xx')
    await wrapper.get('[data-testid="artist-group-start-date-input"]').setValue('2005/01/01')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-member-name-input-0"]').setValue('Romy')
    await wrapper.get('[data-testid="artist-member-join-input-0"]').setValue('2005/06/01')
    await wrapper.get('[data-testid="artist-member-name-input-1"]').setValue('Oliver')
    await wrapper.get('[data-testid="artist-member-leave-input-1"]').setValue('2014/08/31')

    expect(drawers.state.value.creationFlow?.draft.artist.members).toEqual([
      expect.objectContaining({
        name: 'Romy',
        joinDateParts: {
          year: '2005',
          month: '06',
          day: '01',
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
          month: '08',
          day: '31',
        },
      }),
    ])
  })

  it('stores group active dates from the shared masked date inputs', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mountArtistStep()

    await wrapper.get('[data-testid="artist-kind-group-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-group-start-date-input"]').setValue('2005/06/01')
    await wrapper.get('[data-testid="artist-group-end-date-input"]').setValue('2014/08/31')

    expect(drawers.state.value.creationFlow?.draft.artist.activeStartDateParts).toEqual({
      year: '2005',
      month: '06',
      day: '01',
    })
    expect(drawers.state.value.creationFlow?.draft.artist.activeEndDateParts).toEqual({
      year: '2014',
      month: '08',
      day: '31',
    })
  })

  it('requires group mandatory fields before moving forward', async () => {
    const drawers = useMusicDrawers()
    const wrapper = mountArtistStep()

    await wrapper.get('[data-testid="artist-kind-group-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-group-name-input"]').setValue('The xx')
    await wrapper.get('[data-testid="artist-group-start-date-input"]').setValue('2005/01/01')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-add-member-button"]').trigger('click')
    await wrapper.get('[data-testid="artist-member-name-input-0"]').setValue('Romy')
    await wrapper.get('[data-testid="artist-member-name-input-1"]').setValue('Oliver')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(wrapper.get('[data-testid="artist-members-error"]').text()).toContain('请为每位成员填写加入时间')
    expect(drawers.state.value.creationFlow?.step).toBe('artist')

    await wrapper.get('[data-testid="artist-member-join-input-0"]').setValue('2005/01/01')
    await wrapper.get('[data-testid="artist-member-join-input-1"]').setValue('2005/01/01')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.step).toBe('artist')

    await wrapper.get('[data-testid="artist-source-input"]').setValue('https://example.com/group-source')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(drawers.state.value.creationFlow?.step).toBe('albumImport')
  })

  it('opens square crop sheet before applying artist avatar preview', async () => {
    let resolveUpload: ((value: { key: string; url: string }) => void) | null = null
    vi.mocked(uploadMusicAsset).mockImplementation(() => new Promise((resolve) => {
      resolveUpload = resolve
    }))

    const drawers = useMusicDrawers()
    const wrapper = mountArtistStep()

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

    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="artist-avatar-preview-image"]').attributes('src')).toBe('blob:artist-avatar-preview')
    expect(wrapper.get('[data-testid="artist-avatar-preview"]').classes()).toContain('is-uploading')
    expect(drawers.state.value.creationFlow?.draft.artist.avatarUrl).toBe('')
    expect(drawers.state.value.creationFlow?.assetUploading).toBe(true)

    resolveUpload?.({
      key: 'music/avatar-cropped.png',
      url: 'https://img.example/avatar-cropped.png',
    })
    await flushPromises()

    expect(vi.mocked(uploadMusicAsset)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadMusicAsset).mock.calls[0]?.[1]).toBe('music.cover')
    expect(drawers.state.value.creationFlow?.draft.artist.avatarUrl).toBe('https://img.example/avatar-cropped.png')
    expect(drawers.state.value.creationFlow?.assetUploading).toBe(false)
    expect(wrapper.get('[data-testid="artist-avatar-preview"]').classes()).toContain('is-square')
  })
})
