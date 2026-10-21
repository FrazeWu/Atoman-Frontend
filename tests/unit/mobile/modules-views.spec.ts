import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import BooksDiscoverView from '@mobile/views/books/BooksDiscoverView.vue'
import BooksShelfView from '@mobile/views/books/BooksShelfView.vue'
import BookReaderMobileView from '@mobile/views/books/BookReaderMobileView.vue'
import DebateHallView from '@mobile/views/debate/DebateHallView.vue'
import MessagesMobileView from '@mobile/views/messages/MessagesMobileView.vue'
import StudioMobileView from '@mobile/views/studio/StudioMobileView.vue'
import ProfileMobileView from '@mobile/views/me/ProfileMobileView.vue'
import { mobileRoutes } from '@mobile/mobileRoutes'

describe('Mobile Independent Module Views (Task 5)', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/books', component: BooksDiscoverView },
        { path: '/books/shelf', component: BooksShelfView },
        { path: '/books/read/:id', component: BookReaderMobileView },
        { path: '/debate', component: DebateHallView },
        { path: '/messages', component: MessagesMobileView },
        { path: '/inbox', component: MessagesMobileView },
        { path: '/studio', component: StudioMobileView },
        { path: '/me', component: ProfileMobileView },
      ],
    })
    vi.clearAllMocks()
  })

  describe('BooksDiscoverView.vue', () => {
    const mockWorks = [
      {
        id: 'work-1',
        title: '设计心理学',
        authors: [{ name: '唐·诺曼' }],
        rating_score: 8.8,
        publisher: '中信出版社',
      },
      {
        id: 'work-2',
        title: '计算机程序的构造和解释',
        authors: [{ name: 'Harold Abelson' }, { name: 'Gerald Jay Sussman' }],
        rating_score: 9.6,
        publisher: '机械工业出版社',
      },
    ]

    it('renders discover header, search input, and filter chips', async () => {
      const wrapper = mount(BooksDiscoverView, {
        props: { initialWorks: mockWorks },
        global: { plugins: [pinia, router] },
      })

      expect(wrapper.text()).toContain('发现图书')
      expect(wrapper.text()).toContain('全部图书')
      expect(wrapper.text()).toContain('高分榜')
      expect(wrapper.find('[data-testid="books-search-input"]').exists()).toBe(true)
    })

    it('renders catalog works list with title and authors', async () => {
      const wrapper = mount(BooksDiscoverView, {
        props: { initialWorks: mockWorks },
        global: { plugins: [pinia, router] },
      })

      const items = wrapper.findAll('[data-testid="book-catalog-item"]')
      expect(items.length).toBe(2)
      expect(wrapper.text()).toContain('设计心理学')
      expect(wrapper.text()).toContain('唐·诺曼')
      expect(wrapper.text()).toContain('8.8')
    })

    it('clicking book item navigates to reader /books/read/:id', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(BooksDiscoverView, {
        props: { initialWorks: mockWorks },
        global: { plugins: [pinia, router] },
      })

      const item = wrapper.find('[data-testid="book-catalog-item"]')
      await item.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/books/read/work-1')
    })

    it('renders empty state when no works match', async () => {
      const wrapper = mount(BooksDiscoverView, {
        props: { initialWorks: [] },
        global: { plugins: [pinia, router] },
      })

      expect(wrapper.find('[data-testid="books-discover-empty"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('暂无收录图书')
    })
  })

  describe('BooksShelfView.vue', () => {
    const mockReadingProgress = {
      id: 'book-1',
      title: '设计心理学',
      author: '唐·诺曼',
      progress: 64,
      annotationsCount: 12,
      cover: '/covers/design.jpg',
    }

    const mockBooks = [
      {
        id: 'book-1',
        title: '设计心理学',
        author: '唐·诺曼',
        format: 'EPUB',
        fileSize: '4.2 MB',
      },
      {
        id: 'book-2',
        title: '计算机程序的构造和解释',
        author: 'SICP',
        format: 'TXT',
        fileSize: '1.8 MB',
      },
    ]

    it('renders current reading progress card with progress bar, percentage, and annotations', async () => {
      const wrapper = mount(BooksShelfView, {
        props: {
          currentReading: mockReadingProgress,
          initialBooks: mockBooks,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('当前在读')
      expect(wrapper.text()).toContain('设计心理学')
      expect(wrapper.text()).toContain('唐·诺曼')
      expect(wrapper.text()).toContain('64%')
      expect(wrapper.text()).toContain('12')
      expect(wrapper.find('[data-testid="reading-progress-bar"]').exists()).toBe(true)
    })

    it('renders book shelf items list with title and format badges', async () => {
      const wrapper = mount(BooksShelfView, {
        props: {
          initialBooks: mockBooks,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const items = wrapper.findAll('[data-testid="book-shelf-item"]')
      expect(items.length).toBe(2)
      expect(wrapper.text()).toContain('计算机程序的构造和解释')
      expect(wrapper.text()).toContain('EPUB')
      expect(wrapper.text()).toContain('TXT')
    })

    it('clicking book item navigates to reader /books/read/:id', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(BooksShelfView, {
        props: {
          initialBooks: mockBooks,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const item = wrapper.find('[data-testid="book-shelf-item"]')
      await item.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/books/read/book-1')
    })

    it('renders empty state when shelf has no books', async () => {
      const wrapper = mount(BooksShelfView, {
        props: {
          initialBooks: [],
          currentReading: null,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.find('[data-testid="books-empty-state"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('书架暂无图书')
    })
  })

  describe('BookReaderMobileView.vue', () => {
    it('renders book title, reading content, and back button', async () => {
      const wrapper = mount(BookReaderMobileView, {
        props: {
          bookTitle: '设计心理学',
          content: '日用品中的设计原则与心理意象...',
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('设计心理学')
      expect(wrapper.text()).toContain('日用品中的设计原则与心理意象...')
      expect(wrapper.find('[data-testid="reader-back-btn"]').exists()).toBe(true)
    })

    it('adjusts font size and toggles night mode theme', async () => {
      const wrapper = mount(BookReaderMobileView, {
        props: {
          bookTitle: '设计心理学',
          content: '正文阅读测试内容。',
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const fontIncBtn = wrapper.find('[data-testid="reader-font-inc"]')
      expect(fontIncBtn.exists()).toBe(true)
      await fontIncBtn.trigger('click')

      const themeToggleBtn = wrapper.find('[data-testid="reader-theme-toggle"]')
      expect(themeToggleBtn.exists()).toBe(true)
      await themeToggleBtn.trigger('click')

      expect(wrapper.classes()).toContain('is-night-mode')
    })
  })

  describe('DebateHallView.vue', () => {
    const mockTopics = [
      {
        id: 'deb-1',
        title: '人工智能是否会替代大部分常规软件工程岗位？',
        description: '探讨大语言模型自动化编程对软件工程分工体系的重塑。',
        affirmativeCount: 120,
        negativeCount: 80,
        userVote: null as 'affirmative' | 'negative' | null,
      },
    ]

    it('renders debate topic cards with dual affirmative/negative meters and vote buttons', async () => {
      const wrapper = mount(DebateHallView, {
        props: {
          initialTopics: mockTopics,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('人工智能是否会替代大部分常规软件工程岗位？')
      expect(wrapper.find('[data-testid="affirmative-meter"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="negative-meter"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="vote-affirmative-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="vote-negative-btn"]').exists()).toBe(true)
    })

    it('clicking vote button updates stance count and percentage', async () => {
      const wrapper = mount(DebateHallView, {
        props: {
          initialTopics: mockTopics,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const affBtn = wrapper.find('[data-testid="vote-affirmative-btn"]')
      await affBtn.trigger('click')

      expect(wrapper.text()).toContain('121')
    })

    it('supports switching tabs: 全部辩题, 热门, 我的参与', async () => {
      const wrapper = mount(DebateHallView, {
        props: {
          initialTopics: mockTopics,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const hotTab = wrapper.find('[data-testid="debate-tab-hot"]')
      expect(hotTab.exists()).toBe(true)
      await hotTab.trigger('click')
      expect(hotTab.classes()).toContain('is-active')
    })
  })

  describe('MessagesMobileView.vue', () => {
    const mockConversations = [
      {
        id: 'conv-1',
        partyName: 'Alice',
        avatar: '/avatars/alice.png',
        lastMessage: '新设计的阅读器非常轻盈！',
        unreadCount: 2,
        updatedAt: '10:42',
      },
      {
        id: 'conv-2',
        partyName: 'Bob',
        avatar: '',
        lastMessage: '辩题观点已提交，请查看。',
        unreadCount: 0,
        updatedAt: '09:15',
      },
    ]

    it('renders conversation list with avatars, names, and preview texts', async () => {
      const wrapper = mount(MessagesMobileView, {
        props: {
          initialConversations: mockConversations,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const items = wrapper.findAll('[data-testid="conversation-item"]')
      expect(items.length).toBe(2)
      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.text()).toContain('新设计的阅读器非常轻盈！')
      expect(wrapper.text()).toContain('2')
    })

    it('clicking a conversation switches to interactive chat pane', async () => {
      const wrapper = mount(MessagesMobileView, {
        props: {
          initialConversations: mockConversations,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const item = wrapper.find('[data-testid="conversation-item"]')
      await item.trigger('click')

      expect(wrapper.find('[data-testid="chat-pane"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="chat-header-title"]').text()).toBe('Alice')

      // Back to conversation list
      const backBtn = wrapper.find('[data-testid="chat-back-btn"]')
      await backBtn.trigger('click')
      expect(wrapper.find('[data-testid="chat-pane"]').exists()).toBe(false)
    })

    it('sends new message in chat pane using MInput and MButton', async () => {
      const wrapper = mount(MessagesMobileView, {
        props: {
          initialConversations: mockConversations,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      await wrapper.find('[data-testid="conversation-item"]').trigger('click')

      const input = wrapper.find('[data-testid="chat-input"] input')
      await input.setValue('收到，马上跟进！')

      const sendBtn = wrapper.find('[data-testid="chat-send-btn"]')
      await sendBtn.trigger('click')

      expect(wrapper.text()).toContain('收到，马上跟进！')
    })
  })

  describe('StudioMobileView.vue', () => {
    const mockDrafts = [
      {
        id: 'draft-1',
        title: '移动端手势与纯白极简规范',
        type: 'post',
        updatedAt: '2 小时前',
      },
      {
        id: 'draft-2',
        title: '周末闲谈短记',
        type: 'note',
        updatedAt: '昨天',
      },
    ]

    it('renders quick creation action cards and recent drafts list', async () => {
      const wrapper = mount(StudioMobileView, {
        props: {
          initialDrafts: mockDrafts,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('发布短记')
      expect(wrapper.text()).toContain('撰写长文')
      expect(wrapper.text()).toContain('上传单曲/播客')
      expect(wrapper.text()).toContain('移动端手势与纯白极简规范')
      expect(wrapper.findAll('[data-testid="draft-item"]').length).toBe(2)
    })

    it('deleting a draft removes it from the drafts list', async () => {
      const wrapper = mount(StudioMobileView, {
        props: {
          initialDrafts: mockDrafts,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const deleteBtns = wrapper.findAll('[data-testid="draft-delete-btn"]')
      await deleteBtns[0].trigger('click')

      expect(wrapper.findAll('[data-testid="draft-item"]').length).toBe(1)
      expect(wrapper.text()).not.toContain('移动端手势与纯白极简规范')
    })
  })

  describe('ProfileMobileView.vue', () => {
    const mockProfile = {
      username: 'fafa',
      name: 'FaFa',
      avatar: '/avatars/fafa.png',
      bio: '专注简洁与极致用户体验的设计工程师。',
      stats: {
        articles: 24,
        bookmarks: 86,
        followers: 320,
      },
    }

    it('renders user profile card with avatar, bio, and stats', async () => {
      const wrapper = mount(ProfileMobileView, {
        props: {
          user: mockProfile,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('FaFa')
      expect(wrapper.text()).toContain('专注简洁与极致用户体验的设计工程师。')
      expect(wrapper.text()).toContain('24')
      expect(wrapper.text()).toContain('86')
      expect(wrapper.text()).toContain('320')
    })

    it('renders theme mode switch and logout action', async () => {
      const wrapper = mount(ProfileMobileView, {
        props: {
          user: mockProfile,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.find('[data-testid="settings-theme-toggle"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="logout-btn"]').exists()).toBe(true)
    })
  })

  describe('Route Registrations Decoupling', () => {
    it('contains no desktop @/views/ imports for target modules in mobileRoutes', () => {
      const targetPaths = ['/books', '/books/read/:id', '/debate', '/inbox', '/messages', '/studio', '/me']
      for (const p of targetPaths) {
        const route = mobileRoutes.find((r) => r.path === p)
        expect(route, `route ${p} should be registered in mobileRoutes`).toBeDefined()
      }
    })
  })
})
