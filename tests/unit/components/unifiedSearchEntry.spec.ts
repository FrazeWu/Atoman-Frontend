import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ModuleSearch from '@/components/search/ModuleSearch.vue'
import { searchApi } from '@/api/search'
import { useGlobalSearch } from '@/composables/useGlobalSearch'

vi.mock('@/api/search', () => ({ searchApi: { search: vi.fn() } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: null }) }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('默认统一搜索入口', () => {
  it('艺术家预览和完整结果均保留单类型，选中使用命中地址', async () => {
    vi.useFakeTimers()
    vi.mocked(searchApi.search).mockResolvedValue({ view: 'preview', scope: 'public', query: '艺术', partial: false, items: [], groups: [
      { module: 'music', type: 'artist', label: '艺术家', total: null, has_more: true, error: null, items: [
        { key: 'music:artist:1', module: 'music', type: 'artist', id: '1', title: '艺术家结果', href: '/music/artist/1' },
      ] },
    ] })
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/search', component: { template: '<div />' } },
      { path: '/music/artist/:id', component: { template: '<div />' } },
    ] })
    await router.push('/')
    const wrapper = mount(ModuleSearch, { props: { modelValue: '艺术', targetTypes: ['artist'], searchTypes: ['artist'] }, global: { plugins: [createPinia(), router] } })
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(searchApi.search).toHaveBeenCalledWith(expect.objectContaining({ module: 'music', types: ['artist'], q: '艺术' }), expect.any(AbortSignal), true)
    await wrapper.get('input').trigger('focus')
    await wrapper.get('.module-search__item').trigger('click', { detail: 0 })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/music/artist/1')
    await wrapper.findComponent({ name: 'SearchSurface' }).vm.$emit('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ q: '艺术', module: 'music', type: ['artist'] })
    wrapper.unmount()
  })

  it('全局默认调用统一接口，并遵守模块可见性', async () => {
    vi.mocked(searchApi.search).mockResolvedValue({ view: 'preview', scope: 'public', query: '测试', partial: false, items: [], groups: [
      { module: 'books', type: 'work', label: '作品', total: null, has_more: false, error: null, items: [{ key: 'books:work:1', module: 'books', type: 'work', id: '1', title: '图书', href: '/books/work/1' }] },
      { module: 'video', type: 'video', label: '视频', total: null, has_more: false, error: null, items: [{ key: 'video:video:2', module: 'video', type: 'video', id: '2', title: '隐藏模块', href: '/videos/watch/2' }] },
    ] })
    const { effectScope } = await import('vue')
    const scope = effectScope()
    const search = scope.run(() => useGlobalSearch({ isModuleVisible: module => module !== 'video' }))!
    await search.search('测试')
    expect(searchApi.search).toHaveBeenCalledWith(expect.objectContaining({ module: '', scope: 'public' }), expect.any(AbortSignal), true)
    expect(search.sections.value.map(section => section.type)).toEqual(['books'])
    scope.stop()
  })
})
