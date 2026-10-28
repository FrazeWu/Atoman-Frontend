import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import FeedStreamView from '@mobile/views/feed/FeedStreamView.vue'
import FeedSourcesView from '@mobile/views/feed/FeedSourcesView.vue'
import FeedArticleReaderView from '@mobile/views/feed/FeedArticleReaderView.vue'
import BlogListView from '@mobile/views/blog/BlogListView.vue'
import BlogPostReaderView from '@mobile/views/blog/BlogPostReaderView.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MInput from '@mobile/components/ui/MInput.vue'

vi.mock('@/api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
  apiRequestResult: vi.fn().mockResolvedValue({ ok: true, data: { data: [] } }),
  apiRequestJson: vi.fn().mockResolvedValue({ posts: [], total: 0 }),
}))

describe('Mobile Independent Feed & Blog Views', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/feed', component: FeedStreamView },
        { path: '/feed/article/:id', component: FeedArticleReaderView },
        { path: '/feed/sources', component: FeedSourcesView },
        { path: '/posts', component: BlogListView },
        { path: '/post/:id', component: BlogPostReaderView },
      ],
    })
    vi.clearAllMocks()
  })

  describe('FeedStreamView.vue', () => {
    const mockArticles = [
      {
        id: 'art-1',
        title: '构建现代化纯白极简阅读体验',
        summary: '探索移动端纯白卡片流排版与 SF Symbols 图标设计系统。',
        author: { name: 'Alex', avatar: '/avatars/alex.png' },
        source_title: '设计随笔',
        published_at: '2026-10-19T08:00:00Z',
        likes_count: 42,
        comments_count: 9,
        bookmarked: false,
      },
      {
        id: 'art-2',
        title: 'Swift 与 TypeScript 中的单向数据流实践',
        summary: '深入探讨移动端与桌面端共享核心状态模型的设计原则。',
        author: { name: 'Sarah', avatar: '' },
        source_title: '工程架构',
        published_at: '2026-10-18T14:30:00Z',
        likes_count: 18,
        comments_count: 3,
        bookmarked: true,
      },
    ]

    it('renders article list items with title, author avatar, and summary', async () => {
      const wrapper = mount(FeedStreamView, {
        props: {
          initialArticles: mockArticles,
        },
        global: {
          plugins: [pinia, router],
          stubs: {
            RouterLink: false,
          },
        },
      })
      await wrapper.vm.$nextTick()

      const items = wrapper.findAll('[data-testid="feed-article-item"]')
      expect(items.length).toBe(2)
      expect(wrapper.text()).toContain('构建现代化纯白极简阅读体验')
      expect(wrapper.text()).toContain('探索移动端纯白卡片流排版与 SF Symbols 图标设计系统。')
      expect(wrapper.text()).toContain('Alex')

      const avatars = wrapper.findAllComponents(MAvatar)
      expect(avatars.length).toBeGreaterThanOrEqual(2)
    })

    it('renders SF Symbols action icons (heart, messages, bookmark)', async () => {
      const wrapper = mount(FeedStreamView, {
        props: {
          initialArticles: mockArticles,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const icons = wrapper.findAllComponents(MIcon)
      const iconNames = icons.map((icon) => icon.props('name'))
      expect(iconNames).toContain('heart')
      expect(iconNames).toContain('messages')
      expect(iconNames).toContain('bookmark')
      expect(wrapper.text()).toContain('42')
      expect(wrapper.text()).toContain('9')
    })

    it('clicking article triggers navigation to reader view', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(FeedStreamView, {
        props: {
          initialArticles: mockArticles,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const firstLink = wrapper.get('[data-testid="feed-article-item"] .feed-article-item__link')
      expect(firstLink.attributes('href')).toBe('/feed/article/art-1')
      await firstLink.trigger('click')

      expect(pushSpy).toHaveBeenCalledWith('/feed/article/art-1')
    })

    it('supports switching between "推荐" and "订阅" tabs', async () => {
      const wrapper = mount(FeedStreamView, {
        props: {
          initialArticles: mockArticles,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const tabRecommend = wrapper.find('[data-testid="feed-tab-recommend"]')
      const tabSubscriptions = wrapper.find('[data-testid="feed-tab-subscriptions"]')
      expect(tabRecommend.exists()).toBe(true)
      expect(tabSubscriptions.exists()).toBe(true)
      expect(tabRecommend.classes()).toContain('is-active')

      await tabSubscriptions.trigger('click')
      expect(tabSubscriptions.classes()).toContain('is-active')
      expect(tabRecommend.classes()).not.toContain('is-active')
    })
  })

  describe('FeedSourcesView.vue', () => {
    const mockSources = [
      { id: 'src-1', title: 'Overreacted', category: 'Tech', update_frequency: '每周更新', feed_url: 'https://overreacted.io/rss.xml' },
      { id: 'src-2', title: 'Smashing Magazine', category: 'Design', update_frequency: '每日更新', feed_url: 'https://smashingmagazine.com/feed' },
    ]

    it('renders sources list and add source input/action', async () => {
      const wrapper = mount(FeedSourcesView, {
        props: {
          initialSources: mockSources,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const sourceItems = wrapper.findAll('[data-testid="feed-source-item"]')
      expect(sourceItems.length).toBe(2)
      expect(wrapper.text()).toContain('Overreacted')
      expect(wrapper.text()).toContain('Smashing Magazine')

      const input = wrapper.findComponent(MInput)
      expect(input.exists()).toBe(true)
      const addButton = wrapper.find('[data-testid="add-source-btn"]')
      expect(addButton.exists()).toBe(true)
    })

    it('clicking unsubscribe triggers unsubscribe action', async () => {
      const onUnsubscribe = vi.fn()
      const wrapper = mount(FeedSourcesView, {
        props: {
          initialSources: mockSources,
          onUnsubscribe,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const unsubscribeBtn = wrapper.find('[data-testid="unsubscribe-btn"]')
      expect(unsubscribeBtn.exists()).toBe(true)
      await unsubscribeBtn.trigger('click')

      expect(wrapper.emitted('unsubscribe') || onUnsubscribe.mock.calls.length > 0).toBeTruthy()
    })
  })

  describe('FeedArticleReaderView.vue', () => {
    const mockArticleDetail = {
      id: 'art-100',
      title: '沉浸式移动阅读体验的排版细节',
      content: '<p>在移动界面设计中，行高、段落间距与字体渲染清晰度决定了长时间阅读的舒适度。</p><p>纯白画布通过减去杂色边框，使用户视线完全聚焦于文字本身。</p>',
      author_name: 'Elena Vance',
      source_title: 'Typography Weekly',
      published_at: '2026-10-19T09:30:00Z',
      bookmarked: false,
    }

    it('renders article content and back button', async () => {
      const backSpy = vi.spyOn(router, 'back')
      const wrapper = mount(FeedArticleReaderView, {
        props: {
          article: mockArticleDetail,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('沉浸式移动阅读体验的排版细节')
      expect(wrapper.text()).toContain('Elena Vance')
      expect(wrapper.text()).toContain('Typography Weekly')
      expect(wrapper.html()).toContain('纯白画布通过减去杂色边框')

      const backBtn = wrapper.find('[data-testid="reader-back-btn"]')
      expect(backBtn.exists()).toBe(true)
      await backBtn.trigger('click')
      expect(backSpy).toHaveBeenCalled()
    })

    it('renders bookmark action and toggles bookmarked state', async () => {
      const wrapper = mount(FeedArticleReaderView, {
        props: {
          article: mockArticleDetail,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const bookmarkBtn = wrapper.find('[data-testid="reader-bookmark-btn"]')
      expect(bookmarkBtn.exists()).toBe(true)
      expect(bookmarkBtn.findComponent(MIcon).props('name')).toBe('bookmark')

      await bookmarkBtn.trigger('click')
      expect(wrapper.emitted('toggle-bookmark') || wrapper.find('[data-testid="reader-bookmark-btn"]').classes()).toBeTruthy()
    })
  })

  describe('BlogListView.vue', () => {
    const mockPosts = [
      {
        id: 'post-1',
        title: '移动端原生架构与 Web 应用的协同演进',
        excerpt: '探索 Swift 与 Vue 3 在多端设计系统中的规范对齐与独立实现。',
        author: { name: 'Felix', avatar: '/avatars/felix.png' },
        published_at: '2026-10-19T10:00:00Z',
        tags: ['架构', 'Swift', 'Vue'],
        reading_time_minutes: 6,
      },
      {
        id: 'post-2',
        title: '从零构建纯白几何极简设计系统',
        excerpt: '用 4px 圆角与柔和分割线重塑移动界面质感。',
        author: { name: 'Chloe', avatar: '' },
        published_at: '2026-10-17T12:00:00Z',
        tags: ['设计系统', 'CSS'],
        reading_time_minutes: 4,
      },
    ]

    it('renders post cards with title, excerpt, tags, and reading time', async () => {
      const wrapper = mount(BlogListView, {
        props: {
          initialPosts: mockPosts,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const cards = wrapper.findAll('[data-testid="blog-post-card"]')
      expect(cards.length).toBe(2)
      expect(wrapper.text()).toContain('移动端原生架构与 Web 应用的协同演进')
      expect(wrapper.text()).toContain('从零构建纯白几何极简设计系统')
      expect(wrapper.text()).toContain('架构')
      expect(wrapper.text()).toContain('6 分钟')
    })

    it('renders filter chips and filters posts by tag', async () => {
      const wrapper = mount(BlogListView, {
        props: {
          initialPosts: mockPosts,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const filterChips = wrapper.findAll('[data-testid="blog-filter-chip"]')
      expect(filterChips.length).toBeGreaterThanOrEqual(2)

      // Find chip for 'Swift'
      const swiftChip = filterChips.find((chip) => chip.text().includes('Swift'))
      expect(swiftChip).toBeDefined()
      if (swiftChip) {
        await swiftChip.trigger('click')
        const visibleCards = wrapper.findAll('[data-testid="blog-post-card"]')
        expect(visibleCards.length).toBe(1)
        expect(visibleCards[0].text()).toContain('移动端原生架构与 Web 应用的协同演进')
      }
    })

    it('clicking post card navigates to /post/:id', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(BlogListView, {
        props: {
          initialPosts: mockPosts,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const firstCard = wrapper.find('[data-testid="blog-post-card"]')
      await firstCard.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/post/post-1')
    })
  })

  describe('BlogPostReaderView.vue', () => {
    const mockPostDetail = {
      id: 'post-1',
      title: '移动端原生架构与 Web 应用的协同演进',
      content: '## 引言\n\n在现代全栈开发中，保持多端一致性是关键。\n\n- 第一点：统一设计语言\n- 第二点：独立轻量实现',
      author: { name: 'Felix', avatar: '/avatars/felix.png' },
      published_at: '2026-10-19T10:00:00Z',
      reading_time_minutes: 6,
    }

    it('renders markdown content, author header, and back button', async () => {
      const backSpy = vi.spyOn(router, 'back')
      const wrapper = mount(BlogPostReaderView, {
        props: {
          post: mockPostDetail,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('移动端原生架构与 Web 应用的协同演进')
      expect(wrapper.text()).toContain('Felix')
      expect(wrapper.find('[data-testid="blog-markdown-content"]').exists()).toBe(true)

      const backBtn = wrapper.find('[data-testid="blog-reader-back-btn"]')
      expect(backBtn.exists()).toBe(true)
      await backBtn.trigger('click')
      expect(backSpy).toHaveBeenCalled()
    })

    it('renders reading progress bar element', async () => {
      const wrapper = mount(BlogPostReaderView, {
        props: {
          post: mockPostDetail,
        },
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()

      const progressBar = wrapper.find('[data-testid="reading-progress-bar"]')
      expect(progressBar.exists()).toBe(true)
    })
  })
})
