import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppTopbarGlobalSearch from '@/components/system/AppTopbarGlobalSearch.vue'
import { searchApi } from '@/api/search'

vi.mock('@/api/search', () => ({
  searchApi: {
    search: vi.fn(),
  },
}))

describe('AppTopbarGlobalSearch a11y & keynav', () => {
  const wrappers: Array<ReturnType<typeof mount>> = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount()
    vi.useRealTimers()
  })

  const mountSearch = async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/feed', component: { template: '<div />' } },
        { path: '/posts/post/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/feed')
    await router.isReady()
    const wrapper = mount(AppTopbarGlobalSearch, {
      global: { plugins: [router] },
    })
    document.body.appendChild(wrapper.element)
    wrappers.push(wrapper)
    return { wrapper, router }
  }

  const mockSearchResults = () => {
    vi.mocked(searchApi.search).mockResolvedValue({
      view: 'preview',
      scope: 'public',
      query: 'atom',
      partial: false,
      items: [],
      groups: [
        {
          module: 'blog',
          type: 'post',
          label: '文章',
          total: 2,
          has_more: false,
          error: null,
          items: [
            { key: 'post:first', type: 'post', id: 'first', title: 'First', module: 'blog', href: '/posts/post/first' },
            { key: 'post:second', type: 'post', id: 'second', title: 'Second', module: 'blog', href: '/posts/post/second' },
          ],
        },
      ],
    })
  }

  it('provides standard combobox attributes on input when opened', async () => {
    const { wrapper } = await mountSearch()
    const pill = wrapper.get('[data-testid="topbar-search-pill"]')
    await pill.trigger('click')
    await nextTick()

    const input = wrapper.get('[data-testid="topbar-search-input"]')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-autocomplete')).toBe('list')
    expect(input.attributes('aria-haspopup')).toBe('listbox')
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(input.attributes('aria-controls')).toBe('topbar-search-results-listbox')
  })

  it('renders listbox, groups, options and updates aria-activedescendant with arrow navigation', async () => {
    mockSearchResults()
    const { wrapper } = await mountSearch()
    await wrapper.get('[data-testid="topbar-search-pill"]').trigger('click')

    const input = wrapper.get('[data-testid="topbar-search-input"]')
    await input.setValue('atom')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    await vi.dynamicImportSettled()
    await nextTick()

    const listbox = wrapper.get('#topbar-search-results-listbox')
    expect(listbox.attributes('role')).toBe('listbox')
    expect(listbox.attributes('aria-label')).toBe('全局搜索建议')

    const section = wrapper.get('.topbar-search-section')
    expect(section.attributes('role')).toBe('group')
    expect(section.attributes('aria-label')).toBe('博客')

    const options = wrapper.findAll('.topbar-search-section__item')
    expect(options).toHaveLength(2)
    expect(options[0].attributes('role')).toBe('option')
    expect(options[0].attributes('id')).toBe('search-option-blog:post:first')
    expect(options[0].attributes('aria-selected')).toBe('true')
    expect(options[1].attributes('role')).toBe('option')
    expect(options[1].attributes('id')).toBe('search-option-blog:post:second')
    expect(options[1].attributes('aria-selected')).toBe('false')

    expect(input.attributes('aria-activedescendant')).toBe('search-option-blog:post:first')

    // Navigate down
    await input.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()

    expect(options[0].attributes('aria-selected')).toBe('false')
    expect(options[1].attributes('aria-selected')).toBe('true')
    expect(input.attributes('aria-activedescendant')).toBe('search-option-blog:post:second')

    // Navigate down wraps to first
    await input.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(input.attributes('aria-activedescendant')).toBe('search-option-blog:post:first')
  })

  it('navigates to active item href on Enter keypress', async () => {
    mockSearchResults()
    const { wrapper, router } = await mountSearch()
    await wrapper.get('[data-testid="topbar-search-pill"]').trigger('click')

    const input = wrapper.get('[data-testid="topbar-search-input"]')
    await input.setValue('atom')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    await vi.dynamicImportSettled()
    await nextTick()

    // Select second item and press enter
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/posts/post/second')
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(false)
  })

  it('prevents slash shortcut when focus is inside an input, textarea, or contenteditable element', async () => {
    const { wrapper } = await mountSearch()

    // 1. Inside regular input
    const inputEl = document.createElement('input')
    document.body.appendChild(inputEl)
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(false)
    inputEl.remove()

    // 2. Inside textarea
    const textareaEl = document.createElement('textarea')
    document.body.appendChild(textareaEl)
    textareaEl.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(false)
    textareaEl.remove()

    // 3. Inside contenteditable
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.appendChild(editable)
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(false)
    editable.remove()

    // 4. In document body (outside editable context) opens search
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(true)
  })

  it('toggles search on Cmd+K / Ctrl+K and closes on Escape', async () => {
    const { wrapper } = await mountSearch()

    // Open via Ctrl+K
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(true)

    // Close via Ctrl+K toggle
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(false)

    // Open via Cmd+K
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(true)

    // Close via Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(false)
  })
})
