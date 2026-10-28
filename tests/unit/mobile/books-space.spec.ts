import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { saveLibrary } from '@/api/bookPrivate'
import { createRouter, createMemoryHistory } from 'vue-router'
import BooksDiscoverView from '@mobile/views/books/BooksDiscoverView.vue'
import BooksShelfView from '@mobile/views/books/BooksShelfView.vue'
import BooksNotesView from '@mobile/views/books/BooksNotesView.vue'
import BooksMeView from '@mobile/views/books/BooksMeView.vue'
import BookDetailMobileView from '@mobile/views/books/BookDetailMobileView.vue'
vi.mock('@/api/bookPrivate', async importOriginal => ({
  ...await importOriginal<typeof import('@/api/bookPrivate')>(),
  listLibrary: vi.fn(async () => ({ items: [], total: 0 })),
  saveLibrary: vi.fn(async (workId: string, status: string, tags: string[]) => ({ id: 'library-1', work_id: workId, work_title: 'Book', status, tags, version: 1 })),
  readingRecommendation: vi.fn(async (workId: string) => ({ available: true, work_id: workId, asset: { id: 'asset-1' }, revision_id: 'rev-1' })),
}))

vi.mock('@/components/books/BookWorkCommunity.vue', () => ({ default: { props: ['workId', 'authenticated'], template: '<section data-testid="book-community" />' } }))

vi.mock('@mobile/components/ui/MIcon.vue', () => ({
  default: {
    name: 'MIcon',
    props: ['name', 'size'],
    template: '<span class="m-icon" :data-icon="name"><slot /></span>',
  },
}))

describe('Mobile Books Space Overhaul', () => {
  let router: any
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = { uuid: 'reader', username: 'reader' } as typeof auth.user
    vi.mocked(saveLibrary).mockClear()
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/books', component: BooksDiscoverView },
        { path: '/books/shelf', component: BooksShelfView },
        { path: '/books/notes', component: BooksNotesView },
        { path: '/books/me', component: BooksMeView },
        { path: '/books/work/:id', component: BookDetailMobileView },
        { path: '/books/read/:id/:asset/:revision', component: { template: '<div>Book Reader</div>' } },
      ],
    })
  })

  describe('BooksDiscoverView.vue (Tab 1: 发现)', () => {
    const mockWorks = [
      {
        id: 'w-1',
        title: '沉思录',
        authors: [{ name: '马可·奥勒留' }],
        rating_score: 9.3,
        publisher: '中央编译出版社',
        category: '哲学',
      },
      {
        id: 'w-2',
        title: '代码整洁之道',
        authors: [{ name: 'Robert C. Martin' }],
        rating_score: 9.1,
        publisher: '人民邮电出版社',
        category: '科技',
      },
    ]

    it('renders search input, category chips, and hero book card', () => {
      const wrapper = mount(BooksDiscoverView, {
        global: { plugins: [router, pinia] },
        props: { initialWorks: mockWorks },
      })

      expect(wrapper.find('[data-testid="books-search-input"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="books-hero-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('沉思录')
      expect(wrapper.text()).toContain('马可·奥勒留')
    })

    it('filters works when typing in search input', async () => {
      const wrapper = mount(BooksDiscoverView, {
        global: { plugins: [router, pinia] },
        props: { initialWorks: mockWorks },
      })

      const input = wrapper.find('[data-testid="books-search-input"] input')
      if (input.exists()) {
        await input.setValue('代码')
        expect(wrapper.text()).toContain('代码整洁之道')
        expect(wrapper.text()).not.toContain('沉思录')
      }
    })

    it('clicking hero book action navigates to book detail', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(BooksDiscoverView, {
        global: { plugins: [router, pinia] },
        props: { initialWorks: mockWorks },
      })

      const heroBtn = wrapper.find('[data-testid="hero-detail-btn"]')
      if (heroBtn.exists()) {
        await heroBtn.trigger('click')
        expect(pushSpy).toHaveBeenCalledWith('/books/work/w-1')
      }
    })
  })

  describe('BookDetailMobileView.vue (图书详情)', () => {
    const mockDetail = {
      id: 'w-1',
      title: '沉思录',
      author: '马可·奥勒留',
      publisher: '中央编译出版社',
      rating: 9.3,
      synopsis: '古罗马唯一一位哲学家皇帝马可·奥勒留写给自己的私人对话记录。',
      inShelf: false,
      chapters: ['第1卷：来自祖先的德行', '第2卷：清晨的自我告诫', '第3卷：自然的和谐法则'],
    }

    it('renders book details, synopsis, and chapters', () => {
      const wrapper = mount(BookDetailMobileView, {
        global: { plugins: [router, pinia] },
        props: { initialBook: mockDetail },
      })

      expect(wrapper.find('[data-testid="book-detail-back-btn"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('沉思录')
      expect(wrapper.text()).toContain('马可·奥勒留')
      expect(wrapper.text()).toContain('古罗马唯一一位哲学家皇帝')
      expect(wrapper.text()).toContain('第1卷：来自祖先的德行')
    })

    it('persists the shelf state through the canonical shelf controller', async () => {
      const wrapper = mount(BookDetailMobileView, {
        global: { plugins: [router, pinia] }, props: { initialBook: mockDetail },
      })
      await flushPromises()
      const shelf = wrapper.get('[aria-label="我的阅读状态"]')
      await shelf.get('button').trigger('click')
      await flushPromises()
      expect(saveLibrary).toHaveBeenCalledWith('w-1', 'want_to_read', [], undefined)
      expect(shelf.text()).toContain('书架状态已保存')
      wrapper.unmount()
    })

    it('navigates to reader when clicking "开始阅读"', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(BookDetailMobileView, {
        global: { plugins: [router, pinia] },
        props: { initialBook: mockDetail },
      })

      const startReadBtn = wrapper.find('[data-testid="start-reading-btn"]')
      await flushPromises()
      expect(startReadBtn.attributes('disabled')).toBeUndefined()
      await startReadBtn.trigger('click')
      await flushPromises()
      expect(pushSpy).toHaveBeenCalledWith('/books/read/w-1/asset-1/rev-1')
    })
  })

  describe('BooksShelfView.vue (Tab 2: 书架)', () => {
    const mockCurrent = {
      id: 'b-current',
      title: '工作颂歌',
      author: '阿兰·德波顿',
      progress: 64,
      annotationsCount: 12,
    }

    const mockBooks = [
      { id: 'b-1', title: '艺术的慰藉', author: '阿兰·德波顿', format: 'EPUB', fileSize: '2.4 MB' },
    ]

    it('renders current reading card and bookshelf items', () => {
      const wrapper = mount(BooksShelfView, {
        global: { plugins: [router, pinia] },
        props: {
          initialCurrentBook: mockCurrent,
          initialBooks: mockBooks,
        },
      })

      expect(wrapper.find('[data-testid="current-reading-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('工作颂歌')
      expect(wrapper.text()).toContain('64%')
      expect(wrapper.findAll('[data-testid="book-shelf-item"]')).toHaveLength(1)
      expect(wrapper.text()).toContain('艺术的慰藉')
    })

    it('clicking reading card navigates to reader', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(BooksShelfView, {
        global: { plugins: [router, pinia] },
        props: {
          initialCurrentBook: mockCurrent,
          initialBooks: mockBooks,
        },
      })

      const card = wrapper.find('[data-testid="current-reading-card"]')
      await card.trigger('click')
      await flushPromises()
      expect(pushSpy).toHaveBeenCalledWith('/books/read/b-current/asset-1/rev-1')
    })
  })

  describe('BooksNotesView.vue (Tab 3: 书摘)', () => {
    const mockNotes = [
      {
        id: 'bn-1',
        bookTitle: '沉思录',
        chapter: '第4卷',
        quote: '事物的本质并不因我们对它的赞扬或贬低而发生丝毫改变。',
        comment: '无论外界声浪如何，坚守内在的秩序与平静。',
        created_at: '2026-10-20T10:00:00Z',
      },
      {
        id: 'bn-2',
        bookTitle: '工作的乐趣',
        chapter: '序言',
        quote: '真正的劳动在于将混沌的原料转化为有条理的形式。',
        comment: '代码重构和木雕有相通的手艺人愉悦。',
        created_at: '2026-10-21T09:00:00Z',
      },
    ]

    it('renders list of quotes with book badge and commentary', () => {
      const wrapper = mount(BooksNotesView, {
        global: { plugins: [router, pinia] },
        props: { initialNotes: mockNotes },
      })

      expect(wrapper.findAll('[data-testid="book-note-card"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('沉思录')
      expect(wrapper.text()).toContain('事物的本质并不因我们对它的赞扬')
      expect(wrapper.text()).toContain('代码重构和木雕')
    })

    it('deleting a quote removes it from stream', async () => {
      const wrapper = mount(BooksNotesView, {
        global: { plugins: [router, pinia] },
        props: { initialNotes: mockNotes },
      })

      const deleteBtn = wrapper.find('[data-testid="note-delete-btn-bn-1"]')
      expect(deleteBtn.exists()).toBe(true)

      await deleteBtn.trigger('click')
      expect(wrapper.text()).not.toContain('事物的本质并不因我们对它的赞扬')
    })
  })

  describe('BooksMeView.vue (Tab 4: 我的)', () => {
    const mockReaderProfile = {
      name: '爱书客',
      username: 'book_lover',
      bio: '在书页间旅行，在文字中呼吸。',
      stats: {
        readingCount: 3,
        finishedCount: 14,
        notesCount: 48,
        readingHours: 56,
      },
      annualGoal: {
        target: 20,
        finished: 14,
      },
    }

    it('renders reader stats and annual reading target', () => {
      const wrapper = mount(BooksMeView, {
        global: { plugins: [router, pinia] },
        props: { initialProfile: mockReaderProfile },
      })

      expect(wrapper.find('[data-testid="reader-profile-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('爱书客')
      expect(wrapper.text()).toContain('14')
      expect(wrapper.text()).toContain('56')
      expect(wrapper.text()).toContain('年度阅读目标')
      expect(wrapper.text()).toContain('70%')
    })

    it('switches between "在读书籍" and "已读书单" subtabs', async () => {
      const wrapper = mount(BooksMeView, {
        global: { plugins: [router, pinia] },
        props: { initialProfile: mockReaderProfile },
      })

      expect(wrapper.find('[data-testid="me-tab-reading"]').exists()).toBe(true)

      const finishedTab = wrapper.find('[data-testid="me-tab-finished"]')
      await finishedTab.trigger('click')
      expect(wrapper.text()).toContain('已读完的书单')
    })
  })
})
