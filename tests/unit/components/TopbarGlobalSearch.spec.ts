import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppTopbarGlobalSearch from '@/components/system/AppTopbarGlobalSearch.vue'
import { referenceApi } from '@/api/references'

vi.mock('@/api/references', () => ({
  referenceApi: {
    search: vi.fn(),
  },
}))

describe('AppTopbarGlobalSearch', () => {
  const wrappers: Array<ReturnType<typeof mount>> = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
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
    const wrapper = mount(AppTopbarGlobalSearch, { global: { plugins: [router] } })
    wrappers.push(wrapper)
    return { wrapper, router }
  }

  it('opens from the topbar and from the global keyboard shortcut', async () => {
    const { wrapper } = await mountSearch()

    await wrapper.find('[data-testid="topbar-search-pill"]').trigger('click')
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(true)

    await wrapper.find('.search-close-btn').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(true)
  })

  it('debounces input and opens the keyboard-selected result with Enter', async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([
      { type: 'post', id: 'first', label: 'First', module: 'blog', path: '/post/first', available: true },
      { type: 'post', id: 'second', label: 'Second', module: 'blog', path: '/post/second', available: true },
    ])
    const { wrapper, router } = await mountSearch()
    await wrapper.find('[data-testid="topbar-search-pill"]').trigger('click')

    const input = wrapper.find('[data-testid="topbar-search-input"]')
    await input.setValue('atom')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(referenceApi.search).toHaveBeenCalledOnce()
    expect(wrapper.findAll('.topbar-search-section__item')).toHaveLength(2)
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/posts/post/second')
    expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(false)
  })
})
