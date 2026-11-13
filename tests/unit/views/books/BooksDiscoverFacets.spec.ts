import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import BooksDiscoverView from '@/views/books/BooksDiscoverView.vue'
import * as catalogApi from '@/api/bookCatalog'

const mockCatalogPage = {
  items: [
    {
      id: 'work-1',
      title: '红楼梦',
      language: 'zh',
      rating_score: 9.6,
      rating_count: 120,
      authors: [{ id: 'person-1', name: '曹雪芹', role: 'author' }],
      editions: [],
      sources: [],
      related_posts: [],
      lifecycle_status: 'active',
    },
  ],
  total: 1,
  limit: 24,
  offset: 0,
}

const mockFacets = {
  languages: [
    { key: 'zh', label: '中文', count: 42 },
    { key: 'en', label: '英语', count: 18 },
  ],
  decades: [
    { key: '2020s', label: '2020年代', count: 12 },
    { key: 'classic', label: '2000年以前', count: 25 },
  ],
  ratings: [
    { key: '9+', label: '9.0分以上', count: 5 },
    { key: '8+', label: '8.0分以上', count: 16 },
  ],
}

describe('BooksDiscoverView Cupertino Facets Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function setup(initialUrl = '/books') {
    const pinia = createPinia()
    setActivePinia(pinia)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/books', component: BooksDiscoverView },
        { path: '/books/work/:id', component: { template: '<div>Work</div>' } },
        { path: '/books/new', component: { template: '<div>New</div>' } },
        { path: '/login', component: { template: '<div>Login</div>' } },
      ],
    })

    vi.spyOn(catalogApi, 'searchCatalogWorks').mockResolvedValue(mockCatalogPage as any)
    vi.spyOn(catalogApi, 'getCatalogWorkFacets').mockResolvedValue(mockFacets as any)

    await router.push(initialUrl)
    await router.isReady()

    const wrapper = mount(BooksDiscoverView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          PUnifiedSearchBar: { template: '<div class="stub-search"></div>' },
          BookCard: { props: ['work'], template: '<div class="book-card">{{ work.title }}</div>' },
          PaginationBar: true,
          PPageHeader: true,
          BookWikiPanel: true,
        },
      },
    })
    await flushPromises()
    return { wrapper, router }
  }

  it('renders filter toggle button and toggles the Cupertino facets panel', async () => {
    const { wrapper } = await setup('/books')
    const toggle = wrapper.find('.book-discover__filter-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toContain('筛选')
    expect(wrapper.find('.book-discover__facets-panel').exists()).toBe(false)

    // Click to expand
    await toggle.trigger('click')
    await flushPromises()
    expect(wrapper.find('.book-discover__facets-panel').exists()).toBe(true)

    // Verify facet groups
    const panel = wrapper.find('.book-discover__facets-panel')
    expect(panel.text()).toContain('语言')
    expect(panel.text()).toContain('年代')
    expect(panel.text()).toContain('评分')

    // Verify language badges
    expect(panel.text()).toContain('中文')
    expect(panel.text()).toContain('42')
    expect(panel.text()).toContain('英语')
    expect(panel.text()).toContain('18')
  })

  it('selects a facet and updates URL query parameters', async () => {
    const { wrapper, router } = await setup('/books?lang=zh')
    // Should be auto-expanded because a filter query is active
    expect(wrapper.find('.book-discover__facets-panel').exists()).toBe(true)
    const toggle = wrapper.find('.book-discover__filter-toggle')
    expect(toggle.classes()).toContain('is-active')
    expect(wrapper.find('.book-discover__filter-badge').text()).toBe('1')

    // Find the English capsule and click it
    const capsules = wrapper.findAll('.book-discover__capsule')
    const enCapsule = capsules.find((c) => c.text().includes('英语'))
    expect(enCapsule).toBeDefined()
    await enCapsule!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.lang).toBe('en')
  })

  it('resets filters when clicking reset button', async () => {
    const { wrapper, router } = await setup('/books?lang=zh&era=2020s')
    expect(wrapper.find('.book-discover__reset-btn').exists()).toBe(true)
    expect(wrapper.find('.book-discover__filter-badge').text()).toBe('2')

    await wrapper.find('.book-discover__reset-btn').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.lang).toBeUndefined()
    expect(router.currentRoute.value.query.era).toBeUndefined()
  })
})
