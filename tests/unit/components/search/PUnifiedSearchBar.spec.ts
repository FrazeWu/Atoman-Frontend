import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import PUnifiedSearchBar from '@/components/search/PUnifiedSearchBar.vue'
import * as previewModule from '@/composables/useUnifiedSearchPreview'
import type { SearchHit } from '@/api/search'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('PUnifiedSearchBar.vue', () => {
  const sampleHits: SearchHit[] = [
    {
      key: 'books-work-1',
      module: 'books',
      type: 'work',
      id: '1',
      title: '三体',
      subtitle: '刘慈欣',
      href: '/books/work/1',
    },
    {
      key: 'music-song-2',
      module: 'music',
      type: 'song',
      id: '2',
      title: '三体音频原声',
      subtitle: '原声大碟',
      href: '/music/song/2',
    },
  ]

  let mockItems = ref<SearchHit[]>([])
  let mockLoading = ref(false)
  let mockFailed = ref(false)
  let mockPartial = ref(false)
  let mockSchedule = vi.fn()
  let mockReset = vi.fn()
  let mockCancelPending = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockItems.value = []
    mockLoading.value = false
    mockFailed.value = false
    mockPartial.value = false
    mockSchedule = vi.fn()
    mockReset = vi.fn()
    mockCancelPending = vi.fn()

    vi.spyOn(previewModule, 'useUnifiedSearchPreview').mockReturnValue({
      items: mockItems,
      loading: mockLoading,
      failed: mockFailed,
      partial: mockPartial,
      schedule: mockSchedule,
      reset: mockReset,
      cancelPending: mockCancelPending,
      search: vi.fn(),
      results: ref([]) as any,
    })
  })

  it('renders PSearchInput with default props', () => {
    const wrapper = mount(PUnifiedSearchBar, {
      props: {
        placeholder: '全局搜索测试...',
      },
    })

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('全局搜索测试...')
  })

  it('keeps partial failure distinct from a successful empty response', async () => {
    mockPartial.value = true
    const wrapper = mount(PUnifiedSearchBar, { props: { modelValue: '测试' } })
    await wrapper.find('input').trigger('focus')
    expect(wrapper.get('[role="status"]').text()).toContain('部分结果暂不可用')
    expect(wrapper.text()).not.toContain('未找到相关内容')
    wrapper.unmount()
  })

  it('refreshes an open preview after module changes', async () => {
    const wrapper = mount(PUnifiedSearchBar, { props: { modelValue: '测试', module: 'books' } })
    await wrapper.find('input').trigger('focus')
    await wrapper.setProps({ module: 'music' })
    expect(mockReset).toHaveBeenCalled()
    expect(mockSchedule).toHaveBeenCalledWith('测试')
    const module = vi.mocked(previewModule.useUnifiedSearchPreview).mock.calls[0]![0]
    expect(typeof module === 'function' ? module() : module).toBe('music')
    wrapper.unmount()
  })

  it('does not send public previews for private scope', async () => {
    const wrapper = mount(PUnifiedSearchBar, { props: { scope: 'mine' } })
    await wrapper.find('input').setValue('测试')
    expect(mockSchedule).not.toHaveBeenCalled()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('schedules preview when user types >= 2 characters', async () => {
    const wrapper = mount(PUnifiedSearchBar)
    const input = wrapper.find('input')

    await input.setValue('三体')
    expect(mockSchedule).toHaveBeenCalledWith('三体')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['三体'])
  })

  it('resets preview when input is cleared or < 2 characters', async () => {
    const wrapper = mount(PUnifiedSearchBar, {
      props: {
        modelValue: '三体',
      },
    })
    const input = wrapper.find('input')

    await input.setValue('三')
    expect(mockReset).toHaveBeenCalled()
  })

  it('renders preview dropdown results when items exist', async () => {
    mockItems.value = sampleHits
    const wrapper = mount(PUnifiedSearchBar, {
      props: {
        modelValue: '三体',
      },
    })

    const input = wrapper.find('input')
    await input.trigger('focus')

    const items = wrapper.findAll('.p-unified-search-dropdown__item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('图书')
    expect(items[0].text()).toContain('三体')
    expect(items[0].text()).toContain('刘慈欣')
    expect(items[1].text()).toContain('音乐')
  })

  it('navigates to target on item click', async () => {
    mockItems.value = sampleHits
    const wrapper = mount(PUnifiedSearchBar, {
      props: {
        modelValue: '三体',
        autoNavigateOnSelect: true,
      },
    })

    const input = wrapper.find('input')
    await input.trigger('focus')

    const items = wrapper.findAll('.p-unified-search-dropdown__item')
    await items[0].trigger('mousedown')

    expect(wrapper.emitted('select')?.[0]).toEqual([sampleHits[0]])
    expect(mockPush).toHaveBeenCalledWith('/books/work/1')
  })

  it('supports keyboard navigation with ArrowDown, ArrowUp, and Enter', async () => {
    mockItems.value = sampleHits
    const wrapper = mount(PUnifiedSearchBar, {
      props: {
        modelValue: '三体',
        autoNavigateOnSelect: true,
      },
    })

    const input = wrapper.find('input')
    await input.trigger('focus')

    // Arrow down to first item
    await input.trigger('keydown', { key: 'ArrowDown' })
    let items = wrapper.findAll('.p-unified-search-dropdown__item')
    expect(items[0].classes()).toContain('is-active')

    // Arrow down to second item
    await input.trigger('keydown', { key: 'ArrowDown' })
    items = wrapper.findAll('.p-unified-search-dropdown__item')
    expect(items[1].classes()).toContain('is-active')

    // Arrow up back to first item
    await input.trigger('keydown', { key: 'ArrowUp' })
    items = wrapper.findAll('.p-unified-search-dropdown__item')
    expect(items[0].classes()).toContain('is-active')

    // Enter to select first item
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')?.[0]).toEqual([sampleHits[0]])
    expect(mockPush).toHaveBeenCalledWith('/books/work/1')
  })

  it('triggers full search when search action or enter is pressed without active dropdown item', async () => {
    const wrapper = mount(PUnifiedSearchBar, {
      props: {
        modelValue: '量子力学',
        autoNavigateOnSelect: true,
      },
    })

    const actionBtn = wrapper.find('.p-search-input__action-btn')
    await actionBtn.trigger('click')

    expect(wrapper.emitted('search')?.[0]).toEqual(['量子力学', 'public'])
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/search',
        query: expect.objectContaining({
          q: '量子力学',
        }),
      })
    )
  })

  it('passes inputTestId and dropdownTestId to underlying elements', async () => {
    mockItems.value = sampleHits
    const wrapper = mount(PUnifiedSearchBar, {
      props: {
        modelValue: '三体',
        inputTestId: 'custom-search-input',
        dropdownTestId: 'custom-search-dropdown',
      },
    })

    const input = wrapper.find('[data-testid="custom-search-input"]')
    expect(input.exists()).toBe(true)

    await input.trigger('input')
    const dropdown = wrapper.find('[data-testid="custom-search-dropdown"]')
    expect(dropdown.exists()).toBe(true)
  })
})
