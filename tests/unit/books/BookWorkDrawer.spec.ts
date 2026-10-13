import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import BookWorkDrawer from '@/components/books/BookWorkDrawer.vue'

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
})
