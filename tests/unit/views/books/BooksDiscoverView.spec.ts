import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import * as catalogApi from '@/api/bookCatalog'
import * as communityApi from '@/api/bookCommunity'
import * as wikiApi from '@/api/bookWiki'
import BooksDiscoverView from '@/views/books/BooksDiscoverView.vue'
import PSkeletonCard from '@/components/ui/PSkeletonCard.vue'
import PEmpty from '@/components/ui/PEmpty.vue'

let wrapper: VueWrapper | null = null

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

async function setupView(routePath = '/books') {
  useAuthStore().isAuthenticated = false
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/books', component: BooksDiscoverView },
      { path: '/books/work/:workId', component: { template: '<div>Work Detail</div>' } },
      { path: '/login', component: { template: '<div>Login</div>' } },
    ],
  })

  await router.push(routePath)
  await router.isReady()

  wrapper = mount(BooksDiscoverView, {
    global: {
      plugins: [router],
      stubs: {
        BookWikiPanel: true,
        BookCard: true,
      },
    },
  })
  return { router, wrapper }
}

describe('BooksDiscoverView Skeletons and Empty States', () => {
  it('renders a grid of PSkeletonCard while loading', async () => {
    let resolveWorks!: (val: { items: []; total: 0 }) => void
    vi.spyOn(catalogApi, 'searchCatalogWorks').mockReturnValue(
      new Promise((resolve) => {
        resolveWorks = resolve
      })
    )

    const { wrapper } = await setupView('/books')

    // While loading, PSkeletonCard components should be rendered in the grid
    const skeletons = wrapper.findAllComponents(PSkeletonCard)
    expect(skeletons.length).toBe(12)
    expect(skeletons[0].props('aspect')).toBe('3/4')

    // Complete loading
    resolveWorks({ items: [], total: 0 })
    await flushPromises()

    expect(wrapper.findAllComponents(PSkeletonCard).length).toBe(0)
  })

  it('renders PEmpty when high-rated rankings are empty', async () => {
    vi.spyOn(communityApi, 'highRatedWorks').mockResolvedValue({
      items: [],
      total: 0,
    })

    const { wrapper } = await setupView('/books?sort=high-rated')
    await flushPromises()

    const empty = wrapper.findComponent(PEmpty)
    expect(empty.exists()).toBe(true)
    expect(empty.props('title')).toBe('未找到相关书籍')
    expect(empty.props('description')).toBe('尝试更换分类或调整筛选条件')
  })

  it('renders PEmpty when author search returns no people', async () => {
    vi.spyOn(wikiApi, 'searchWikiPeople').mockResolvedValue({
      items: [],
      total: 0,
    })

    const { wrapper } = await setupView('/books?type=people&q=unknown')
    await flushPromises()

    const empty = wrapper.findComponent(PEmpty)
    expect(empty.exists()).toBe(true)
    expect(empty.props('title')).toBe('未找到作者')
    expect(empty.props('description')).toBe('试试输入其他姓名或关键词')
  })

  it('renders PEmpty when catalog works are empty', async () => {
    vi.spyOn(catalogApi, 'searchCatalogWorks').mockResolvedValue({
      items: [],
      total: 0,
    })

    const { wrapper } = await setupView('/books')
    await flushPromises()

    const empty = wrapper.findComponent(PEmpty)
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toContain('还没有图书，添加第一本书即可公开展示。')
  })
})
