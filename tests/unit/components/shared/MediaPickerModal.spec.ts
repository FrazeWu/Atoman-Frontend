import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MediaPickerModal from '@/components/shared/MediaPickerModal.vue'
import { referenceApi } from '@/api/references'
import type { MediaPickerItem } from '@/types/mediaPicker'

vi.mock('@/api/references', () => ({
  referenceApi: {
    search: vi.fn(),
  },
}))

describe('MediaPickerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tabs and emits select on item click', async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'song',
        label: '晴天',
        subtitle: '周杰伦',
        path: '/music/?song_id=111',
        module: 'music',
        available: true,
      },
    ])

    const wrapper = mount(MediaPickerModal, {
      props: { open: true, initialType: 'song' },
    })

    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    const input = wrapper.find('input[type="text"]')
    await input.setValue('晴天')

    // 等待 debounce
    await new Promise((r) => setTimeout(r, 350))
    expect(referenceApi.search).toHaveBeenCalledWith('song', '晴天', expect.any(Number))

    await wrapper.vm.$nextTick()
    const items = wrapper.findAll('.media-picker-item')
    expect(items.length).toBe(1)
    expect(items[0].text()).toContain('晴天')
    expect(items[0].text()).toContain('周杰伦')

    await items[0].trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    const emittedItem = wrapper.emitted('select')![0][0] as MediaPickerItem
    expect(emittedItem).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      type: 'song',
      title: '晴天',
      subtitle: '周杰伦',
      cover_url: undefined,
    })
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('switches tabs and triggers search with active tab type', async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([
      {
        id: '22222222-2222-2222-2222-222222222222',
        type: 'video',
        label: '演示视频',
        subtitle: 'UP主',
        path: '/video/222',
        module: 'video',
        available: true,
      },
    ])

    const wrapper = mount(MediaPickerModal, {
      props: { open: true, initialType: 'song' },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('演示')

    await new Promise((r) => setTimeout(r, 350))
    expect(referenceApi.search).toHaveBeenCalledWith('song', '演示', expect.any(Number))

    // Switch to video tab
    const tabs = wrapper.findAll('.media-picker-tab')
    const videoTab = tabs.find((t) => t.text().includes('视频'))
    expect(videoTab).toBeDefined()
    await videoTab!.trigger('click')

    await new Promise((r) => setTimeout(r, 350))
    expect(referenceApi.search).toHaveBeenCalledWith('video', '演示', expect.any(Number))
  })

  it('respects initialType prop', async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([])

    const wrapper = mount(MediaPickerModal, {
      props: { open: true, initialType: 'album' },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('范特西')

    await new Promise((r) => setTimeout(r, 350))
    expect(referenceApi.search).toHaveBeenCalledWith('album', '范特西', expect.any(Number))
  })

  it('does not render when open is false', () => {
    const wrapper = mount(MediaPickerModal, {
      props: { open: false },
    })

    expect(wrapper.find('.media-picker-modal').exists()).toBe(false)
  })

  it('emits close when clicking close button or backdrop', async () => {
    const wrapper = mount(MediaPickerModal, {
      props: { open: true },
    })

    const closeBtn = wrapper.find('.media-picker-close')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()

    const backdrop = wrapper.find('.p-modal-backdrop')
    await backdrop.trigger('click')
    expect(wrapper.emitted('close')?.length).toBe(2)
  })

  it('displays empty state when search returns no items', async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([])

    const wrapper = mount(MediaPickerModal, {
      props: { open: true },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('nonexistent')

    await new Promise((r) => setTimeout(r, 350))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.media-picker-empty').exists()).toBe(true)
  })

  it('applies above-player classes when abovePlayer prop is true', () => {
    const wrapper = mount(MediaPickerModal, {
      props: { open: true, abovePlayer: true },
    })

    const backdrop = wrapper.find('.media-picker-backdrop')
    expect(backdrop.classes()).toContain('media-picker-backdrop--above-player')
    expect(backdrop.classes()).toContain('p-modal-backdrop--above-player')
  })

  it('does not apply above-player classes by default', () => {
    const wrapper = mount(MediaPickerModal, {
      props: { open: true },
    })

    const backdrop = wrapper.find('.media-picker-backdrop')
    expect(backdrop.classes()).not.toContain('media-picker-backdrop--above-player')
    expect(backdrop.classes()).not.toContain('p-modal-backdrop--above-player')
  })

  it('cancels pending search and ignores in-flight results when query is cleared', async () => {
    let resolveSearch!: (value: any) => void
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve
    })
    vi.mocked(referenceApi.search).mockReturnValue(searchPromise as any)

    const wrapper = mount(MediaPickerModal, {
      props: { open: true },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('周杰伦')

    // Wait for debounce to fire executeSearch
    await new Promise((r) => setTimeout(r, 350))
    expect(referenceApi.search).toHaveBeenCalledWith('song', '周杰伦', expect.any(Number))

    // Clear input while search is in-flight
    await input.setValue('')
    await wrapper.vm.$nextTick()

    // Resolve the in-flight search promise
    resolveSearch([
      {
        id: '1',
        type: 'song',
        label: '晴天',
        subtitle: '周杰伦',
      },
    ])
    await new Promise((r) => setTimeout(r, 50))
    await wrapper.vm.$nextTick()

    // Results should remain empty, not populated with outdated search results
    expect(wrapper.findAll('.media-picker-item').length).toBe(0)
    expect(wrapper.find('.media-picker-empty').exists()).toBe(false)
  })

  it('cancels pending search when modal is closed', async () => {
    let resolveSearch!: (value: any) => void
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve
    })
    vi.mocked(referenceApi.search).mockReturnValue(searchPromise as any)

    const wrapper = mount(MediaPickerModal, {
      props: { open: true },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('周杰伦')

    await new Promise((r) => setTimeout(r, 350))
    expect(referenceApi.search).toHaveBeenCalledWith('song', '周杰伦', expect.any(Number))

    // Close modal
    await wrapper.setProps({ open: false })

    // In-flight promise resolves
    resolveSearch([
      {
        id: '1',
        type: 'song',
        label: '晴天',
        subtitle: '周杰伦',
      },
    ])
    await new Promise((r) => setTimeout(r, 50))

    // Reopen modal
    await wrapper.setProps({ open: true })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.media-picker-item').length).toBe(0)
  })
})
