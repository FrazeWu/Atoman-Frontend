import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import SearchResultsView from '@/views/search/SearchResultsView.vue'
import * as unifiedSearchModule from '@/composables/useUnifiedSearch'
import type { SearchCapabilities, SearchResponse } from '@/api/search'

const mockPush = vi.fn()
let currentRouteQuery: Record<string, any> = {}

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: currentRouteQuery,
  }),
  useRouter: () => ({
    push: mockPush,
  }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
}))

describe('SearchResultsView.vue', () => {
  const sampleCapabilities: SearchCapabilities = {
    scope: 'public',
    modules: [
      {
        module: 'books',
        label: '图书',
        allow_empty_query: true,
        default_sort: 'rating_desc',
        sorts: [{ key: 'rating_desc', label: '评分最高' }],
        filters: [
          {
            key: 'language',
            label: '作品语言',
            kind: 'text',
            multiple: true,
          },
        ],
        types: [
          {
            key: 'work',
            label: '作品',
            allow_empty_query: true,
            default_sort: 'rating_desc',
            sorts: [{ key: 'rating_desc', label: '评分最高' }],
            filters: [
              {
                key: 'language',
                label: '作品语言',
                kind: 'text',
                multiple: true,
              },
            ],
          },
        ],
      },
      {
        module: 'music',
        label: '音乐',
        allow_empty_query: false,
        default_sort: 'created_at_desc',
        sorts: [],
        filters: [],
        types: [],
      },
    ],
  }

  const sampleListResponse: SearchResponse = {
    view: 'list',
    scope: 'public',
    query: '三体',
    partial: false,
    items: [
      {
        key: 'books-work-1',
        module: 'books',
        type: 'work',
        id: '1',
        title: '三体',
        subtitle: '刘慈欣',
        snippet: '经典科幻小说',
        href: '/books/work/1',
      },
    ],
    groups: [],
    pagination: {
      page: 1,
      page_size: 20,
      total: 1,
      has_more: false,
    },
  }

  const sampleGroupedResponse: SearchResponse = {
    view: 'grouped',
    scope: 'public',
    query: '三体',
    partial: false,
    items: [],
    groups: [
      {
        module: 'books',
        type: 'work',
        label: '作品',
        total: 10,
        has_more: true,
        error: null,
        items: [
          {
            key: 'books-work-1',
            module: 'books',
            type: 'work',
            id: '1',
            title: '三体',
            subtitle: '刘慈欣',
            snippet: '经典科幻小说',
            href: '/books/work/1',
          },
        ],
      },
    ],
  }

  let mockCapabilities = ref<SearchCapabilities | null>(null)
  let mockResult = ref<SearchResponse | null>(null)
  let mockLoading = ref(false)
  let mockError = ref('')
  let mockSelectedModule = ref<any>(null)
  let mockSelectedType = ref<any>(null)
  let mockCapability = ref<any>(null)
  let mockReload = vi.fn()

  let pinia: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    currentRouteQuery = { q: '三体' }
    mockCapabilities.value = sampleCapabilities
    mockResult.value = sampleGroupedResponse
    mockLoading.value = false
    mockError.value = ''
    mockSelectedModule.value = sampleCapabilities.modules[0]
    mockSelectedType.value = sampleCapabilities.modules[0].types[0]
    mockCapability.value = sampleCapabilities.modules[0].types[0]
    mockReload = vi.fn()

    vi.spyOn(unifiedSearchModule, 'useUnifiedSearch').mockReturnValue({
      capabilities: mockCapabilities,
      result: mockResult,
      loading: mockLoading,
      error: mockError,
      selectedModule: mockSelectedModule,
      selectedType: mockSelectedType,
      capability: mockCapability,
      reload: mockReload,
      reset: vi.fn(),
    })
  })

  function createWrapper() {
    return mount(SearchResultsView, {
      global: {
        plugins: [pinia],
      },
    })
  }

  it('renders search input, scope tabs, and module tabs', () => {
    const wrapper = createWrapper()

    expect(wrapper.find('#search-title').text()).toBe('全站搜索')
    expect(wrapper.find('input[type="search"]').exists()).toBe(true)
    expect(wrapper.find('nav[aria-label="搜索范围"]').exists()).toBe(true)
    expect(wrapper.find('nav[aria-label="搜索模块"]').exists()).toBe(true)

    const moduleBtns = wrapper.findAll('.search-tab-pill')
    expect(moduleBtns).toHaveLength(3) // 全部, 图书, 音乐
    expect(moduleBtns[1].text()).toBe('图书')
  })

  it('renders grouped results with module title and view all link', () => {
    mockResult.value = sampleGroupedResponse
    const wrapper = createWrapper()

    expect(wrapper.find('.search-module-card').exists()).toBe(true)
    expect(wrapper.find('.search-module-card__title').text()).toBe('图书')
    expect(wrapper.find('.search-group__title').text()).toBe('作品')
    expect(wrapper.find('.search-group__more-link').text()).toContain('查看全部（10）')
    expect(wrapper.text()).toContain('三体')
    expect(wrapper.text()).toContain('刘慈欣')
  })

  it('renders list results and pagination when view is list', () => {
    mockResult.value = sampleListResponse
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('共 1 条结果')
    expect(wrapper.find('.search-pagination').exists()).toBe(true)
    expect(wrapper.text()).toContain('第 1 页')
  })

  it('displays loading state indicator', () => {
    mockLoading.value = true
    const wrapper = createWrapper()

    expect(wrapper.find('.search-state-message.is-loading').exists()).toBe(true)
    expect(wrapper.text()).toContain('正在搜索…')
  })

  it('displays error message and supports retry', async () => {
    mockError.value = '搜索服务异常'
    const wrapper = createWrapper()

    expect(wrapper.find('.search-state-message.is-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('搜索服务异常')

    const retryBtn = wrapper.find('.search-state-message.is-error .retry-btn')
    await retryBtn.trigger('click')
    expect(mockReload).toHaveBeenCalled()
  })

  it('submits search and updates router query on enter or button click', async () => {
    const wrapper = createWrapper()
    const input = wrapper.find('input[type="search"]')

    await input.setValue('三体2')
    await input.trigger('keydown.enter')

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/search',
        query: expect.objectContaining({
          q: '三体2',
        }),
      })
    )
  })
})