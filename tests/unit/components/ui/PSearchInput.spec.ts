import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PSearchInput from '@/components/ui/PSearchInput.vue'

describe('PSearchInput.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders correctly with default props', () => {
    const wrapper = mount(PSearchInput, {
      props: {
        placeholder: '搜索图书、作者...',
      },
    })

    expect(wrapper.attributes('role')).toBe('search')
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('搜索图书、作者...')
    expect(wrapper.find('.p-search-input__icon').exists()).toBe(true)
  })

  it('supports v-model two-way data binding', async () => {
    const wrapper = mount(PSearchInput, {
      props: {
        modelValue: '三体',
        'onUpdate:modelValue': (val: string) => wrapper.setProps({ modelValue: val }),
      },
    })

    const input = wrapper.find('input')
    expect(input.element.value).toBe('三体')

    await input.setValue('流浪地球')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['流浪地球'])
  })

  it('debounces input when debounceMs is specified', async () => {
    const wrapper = mount(PSearchInput, {
      props: {
        modelValue: '',
        debounceMs: 300,
      },
    })

    const input = wrapper.find('input')
    await input.setValue('哈利')

    // Before timer fires, update:modelValue is not yet emitted
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    // Advance timer by 300ms
    vi.advanceTimersByTime(300)

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['哈利'])
  })

  it('renders bar variant (Option 1A) with action button by default', () => {
    const wrapper = mount(PSearchInput, {
      props: {
        variant: 'bar',
        actionButtonText: '探索',
      },
    })

    expect(wrapper.classes()).toContain('p-search-input--bar')
    const actionBtn = wrapper.find('.p-search-input__action-btn')
    expect(actionBtn.exists()).toBe(true)
    expect(actionBtn.text()).toBe('探索')
  })

  it('renders inline variant with shortcut badge when empty', () => {
    const wrapper = mount(PSearchInput, {
      props: {
        variant: 'inline',
        modelValue: '',
        shortcutKey: '⌘K',
      },
    })

    expect(wrapper.classes()).toContain('p-search-input--inline')
    expect(wrapper.find('.p-search-input__action-btn').exists()).toBe(false)
    const badge = wrapper.find('.p-search-input__badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('⌘K')
  })

  it('displays clear button when input has value and clearable is true', async () => {
    const wrapper = mount(PSearchInput, {
      props: {
        modelValue: '百年孤独',
        clearable: true,
      },
    })

    const clearBtn = wrapper.find('.p-search-input__clear-btn')
    expect(clearBtn.exists()).toBe(true)
    expect(clearBtn.attributes('aria-label')).toBe('清空搜索')

    await clearBtn.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('emits search event on Enter key or clicking action button', async () => {
    const wrapper = mount(PSearchInput, {
      props: {
        modelValue: '三体',
        scope: 'title',
        variant: 'bar',
      },
    })

    const input = wrapper.find('input')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('search')?.[0]).toEqual(['三体', 'title'])

    const actionBtn = wrapper.find('.p-search-input__action-btn')
    await actionBtn.trigger('click')

    expect(wrapper.emitted('search')?.[1]).toEqual(['三体', 'title'])
  })

  it('renders scope selector and handles update:scope', async () => {
    const scopes = [
      { label: '全部', value: 'all' },
      { label: '书名', value: 'title' },
      { label: '作者', value: 'author' },
    ]

    const wrapper = mount(PSearchInput, {
      props: {
        variant: 'bar',
        scopes,
        scope: 'all',
      },
    })

    const select = wrapper.find('.p-search-input__scope-select')
    expect(select.exists()).toBe(true)
    const options = select.findAll('option')
    expect(options).toHaveLength(3)
    expect(options[1].text()).toBe('书名')

    await select.setValue('author')
    expect(wrapper.emitted('update:scope')?.[0]).toEqual(['author'])
  })

  it('shows loading indicator when loading is true', () => {
    const wrapper = mount(PSearchInput, {
      props: {
        loading: true,
      },
    })

    expect(wrapper.find('.p-search-input__loader').exists()).toBe(true)
  })

  it('disables input and buttons when disabled is true', () => {
    const wrapper = mount(PSearchInput, {
      props: {
        disabled: true,
        variant: 'bar',
        scopes: [{ label: '全部', value: 'all' }],
      },
    })

    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.p-search-input__scope-select').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.p-search-input__action-btn').attributes('disabled')).toBeDefined()
  })

  it('focuses input on global shortcut keydown when enableGlobalShortcut is true', async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus')
    const wrapper = mount(PSearchInput, {
      props: {
        enableGlobalShortcut: true,
      },
    })

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(event)

    expect(focusSpy).toHaveBeenCalled()
    wrapper.unmount()
    focusSpy.mockRestore()
  })

  it('renders dropdown slot when showDropdown is true', () => {
    const wrapper = mount(PSearchInput, {
      props: {
        showDropdown: true,
      },
      slots: {
        dropdown: '<div class="test-dropdown-content">Instant Results</div>',
      },
    })

    const dropdown = wrapper.find('.p-search-input__dropdown')
    expect(dropdown.exists()).toBe(true)
    expect(dropdown.text()).toContain('Instant Results')
  })

  it('does not render dropdown container when showDropdown is false', () => {
    const wrapper = mount(PSearchInput, {
      props: {
        showDropdown: false,
      },
      slots: {
        dropdown: '<div class="test-dropdown-content">Instant Results</div>',
      },
    })

    expect(wrapper.find('.p-search-input__dropdown').exists()).toBe(false)
  })

  it('emits keydown event when key pressed in input', async () => {
    const wrapper = mount(PSearchInput)
    const input = wrapper.find('input')

    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('keydown')).toBeTruthy()
    expect((wrapper.emitted('keydown')?.[0]?.[0] as KeyboardEvent).key).toBe('ArrowDown')
  })
})
