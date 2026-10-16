import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import BookWorkDrawer from '@/components/books/BookWorkDrawer.vue'
import { getPublicBookWork, setBookRating, deleteBookRating } from '@/api/books'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { id: 'u1', username: 'testuser' },
  }),
}))

const { mockSampleWork } = vi.hoisted(() => ({
  mockSampleWork: {
    id: 'work-1',
    title: '百年孤独',
    description: '魔幻现实主义的巅峰之作',
    authors: [{ id: 'a1', name: '加西亚·马尔克斯', role: 'author' }],
    editions: [{ id: 'ed-1', title: '南海出版公司版', isbn13: '9787544253994' }],
    rating_score: 9.3,
    rating_count: 1200,
  },
}))

vi.mock('@/api/books', () => ({
  getPublicBookWork: vi.fn(() => Promise.resolve(mockSampleWork)),
  listPublishedBookAssets: vi.fn(() => Promise.resolve({
    items: [{ id: 'asset-1', file_name: 'one_hundred_years.epub', format: 'epub', size: 1048576 }],
    total: 1,
  })),
  getPublicBookReviews: vi.fn(() => Promise.resolve({
    items: [{ id: 'rev-1', content: '震撼人心的家族史诗', spoiler: false, created_at: '2026-01-01T00:00:00Z' }],
    total: 1,
  })),
  saveBookShelf: vi.fn(() => Promise.resolve({})),
  getBookRating: vi.fn(() => Promise.resolve({ rating_score: 9.3, rating_count: 1200, viewer_rating: null })),
  setBookRating: vi.fn(() => Promise.resolve({ rating_score: 9, rating_count: 1201, viewer_rating: 9 })),
  deleteBookRating: vi.fn(() => Promise.resolve({ rating_score: 9.3, rating_count: 1200, viewer_rating: null })),
}))

describe('BookWorkDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  it('renders correctly and loads book details', async () => {
    const wrapper = mount(BookWorkDrawer, {
      props: {
        workId: 'work-1',
        show: true,
      },
      global: {
        stubs: {
          PSheet: {
            props: ['title'],
            template: '<div class="p-sheet"><h2>{{ title }}</h2><slot /></div>',
          },
          PButton: {
            template: '<button :disabled="disabled"><slot /></button>',
            props: ['disabled', 'loading', 'variant'],
          },
          PSelect: true,
          BookCover: true,
          RatingControl: true,
        },
      },
    })

    // 等待异步数据加载
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('百年孤独')
    })
    expect(wrapper.text()).toContain('加西亚·马尔克斯')
    expect(wrapper.text()).toContain('开始阅读')
  })

  it('emits close event', async () => {
    const wrapper = mount(BookWorkDrawer, {
      props: {
        workId: 'work-1',
        show: true,
      },
      global: {
        stubs: {
          PSheet: {
            template: '<div class="p-sheet"><button class="close-btn" @click="$emit(\'close\')">close</button><slot /></div>',
          },
          PButton: true,
          PSelect: true,
          BookCover: true,
          RatingControl: true,
        },
      },
    })

    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('enables rating, updates the summary, and clears the personal score', async () => {
    const wrapper = mount(BookWorkDrawer, {
      props: { workId: 'work-1', show: true },
      global: { stubs: {
        PSheet: { template: '<div><slot /></div>' },
        PButton: true, PSelect: true, BookCover: true, RatingControl: true,
      } },
    })
    await flushPromises()
    const rating = wrapper.findComponent({ name: 'RatingControl' })
    expect(rating.props('disabled')).toBe(false)
    rating.vm.$emit('rate', 9)
    await flushPromises()
    expect(setBookRating).toHaveBeenCalledWith('work-1', 9)
    expect(rating.props('viewerRating')).toBe(9)
    expect(rating.props('ratingCount')).toBe(1201)
    rating.vm.$emit('clear')
    await flushPromises()
    expect(deleteBookRating).toHaveBeenCalledWith('work-1')
    expect(rating.props('viewerRating')).toBeNull()
    wrapper.unmount()
  })

  it('ignores an older work response after the drawer switches books', async () => {
    let resolve!: (value: typeof mockSampleWork) => void
    vi.mocked(getPublicBookWork).mockReturnValueOnce(new Promise(done => { resolve = done as typeof resolve }))
    const wrapper = mount(BookWorkDrawer, {
      props: { workId: 'work-1', show: true },
      global: { stubs: {
        PSheet: { template: '<div><slot /></div>' },
        PButton: true, PSelect: true, BookCover: true, RatingControl: true,
      } },
    })
    vi.mocked(getPublicBookWork).mockResolvedValueOnce({ ...mockSampleWork, id: 'work-2', title: '第二本书' } as never)
    await wrapper.setProps({ workId: 'work-2' })
    await flushPromises()
    resolve(mockSampleWork)
    await flushPromises()
    expect(wrapper.text()).toContain('第二本书')
    expect(wrapper.text()).not.toContain('百年孤独')
    wrapper.unmount()
  })
})
