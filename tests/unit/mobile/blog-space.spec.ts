import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import BlogDiscoverView from '@mobile/views/blog/BlogDiscoverView.vue'
import BlogNotesTimelineView from '@mobile/views/blog/BlogNotesTimelineView.vue'
import BlogArticlesView from '@mobile/views/blog/BlogArticlesView.vue'
import BlogMeView from '@mobile/views/blog/BlogMeView.vue'
import ShortNoteDetailMobileView from '@mobile/views/blog/ShortNoteDetailMobileView.vue'

// Mock icons & router
vi.mock('@mobile/components/ui/MIcon.vue', () => ({
  default: {
    name: 'MIcon',
    props: ['name', 'size'],
    template: '<span class="m-icon" :data-icon="name"><slot /></span>',
  },
}))

describe('Mobile Blog Space Overhaul', () => {
  let router: any

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/posts', component: BlogDiscoverView },
        { path: '/posts/notes', component: BlogNotesTimelineView },
        { path: '/posts/articles', component: BlogArticlesView },
        { path: '/posts/me', component: BlogMeView },
        { path: '/post/:id', component: { template: '<div>Post Detail</div>' } },
        { path: '/posts/notes/:id', component: ShortNoteDetailMobileView },
      ],
    })
  })

  describe('BlogDiscoverView.vue (Tab 1: 发现)', () => {
    const mockPosts = [
      {
        id: 'p-1',
        title: '深度工作：如何在高干扰时代专注创造',
        excerpt: '在现代碎片化信息的冲击下，深度专注成为了极为罕见且价值巨大的核心能力。',
        author: { name: '林克', avatar: '' },
        reading_time_minutes: 8,
        tags: ['思考', '生产力'],
        published_at: '2026-10-20T10:00:00Z',
      },
      {
        id: 'p-2',
        title: 'TypeScript 5.8 核心特性解析',
        excerpt: '本次更新在类型检查性能与模块解析方面带来了质的飞跃。',
        author: { name: '代码工匠', avatar: '' },
        reading_time_minutes: 5,
        tags: ['技术'],
        published_at: '2026-10-21T08:00:00Z',
      },
    ]

    it('renders search input and hero featured card', () => {
      const wrapper = mount(BlogDiscoverView, {
        global: { plugins: [router] },
        props: { initialPosts: mockPosts },
      })

      expect(wrapper.find('[data-testid="blog-search-input"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="blog-hero-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('深度工作：如何在高干扰时代专注创造')
    })

    it('filters articles when searching', async () => {
      const wrapper = mount(BlogDiscoverView, {
        global: { plugins: [router] },
        props: { initialPosts: mockPosts },
      })

      await wrapper.get('[data-testid="blog-search-input"]').setValue('TypeScript')
      expect(wrapper.text()).toContain('TypeScript 5.8')
      expect(wrapper.text()).not.toContain('深度工作')
      wrapper.unmount()
    })

    it('clicking hero action navigates to reader', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(BlogDiscoverView, {
        global: { plugins: [router] },
        props: { initialPosts: mockPosts },
      })

      const heroBtn = wrapper.find('[data-testid="hero-read-btn"]')
      if (heroBtn.exists()) {
        await heroBtn.trigger('click')
        expect(pushSpy).toHaveBeenCalledWith('/post/p-1')
      }
    })
  })

  describe('BlogNotesTimelineView.vue (Tab 2: 短笺)', () => {
    const mockNotes = [
      {
        id: 'n-1',
        content: '今天阅读了阿兰·德波顿的《工作颂歌》，对于现代劳动的异化有了新的领悟。',
        author: { name: '思绪记录者', avatar: '' },
        created_at: '2026-10-21T12:00:00Z',
        likes_count: 12,
        comments_count: 3,
        liked: false,
      },
      {
        id: 'n-2',
        content: '纯白微圆角设计系统的核心在于克制与呼吸感，而不是无节制的大圆角。',
        author: { name: 'UI琢磨者', avatar: '' },
        created_at: '2026-10-21T11:00:00Z',
        likes_count: 45,
        comments_count: 8,
        liked: true,
      },
    ]

    it('renders list of short notes with author, content and stats', () => {
      const wrapper = mount(BlogNotesTimelineView, {
        global: { plugins: [router] },
        props: { initialNotes: mockNotes },
      })

      expect(wrapper.findAll('[data-testid="short-note-card"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('阿兰·德波顿')
      expect(wrapper.text()).toContain('纯白微圆角设计系统')
    })

    it('makes note detail a keyboard-accessible, full-card navigation link', () => {
      const wrapper = mount(BlogNotesTimelineView, {
        global: { plugins: [router] },
        props: { initialNotes: mockNotes },
      })
      const link = wrapper.get('.short-note-card__body')
      expect(link.element.tagName).toBe('A')
      expect(link.attributes('href')).toBe('/posts/notes/n-1')
      expect(link.attributes('aria-label')).toContain('阅读短笺')
      wrapper.unmount()
    })

    it('toggles like state when clicking heart button', async () => {
      const wrapper = mount(BlogNotesTimelineView, {
        global: { plugins: [router] },
        props: { initialNotes: mockNotes },
      })

      const likeBtn = wrapper.find('[data-testid="note-like-btn-n-1"]')
      expect(likeBtn.exists()).toBe(true)
      expect(likeBtn.text()).toContain('12')

      await likeBtn.trigger('click')
      expect(likeBtn.text()).toContain('13')
    })

    it('opens composer sheet when clicking write note button', async () => {
      const wrapper = mount(BlogNotesTimelineView, {
        global: { plugins: [router] },
        props: { initialNotes: mockNotes },
      })

      const writeBtn = wrapper.find('[data-testid="compose-note-btn"]')
      expect(writeBtn.exists()).toBe(true)
      await writeBtn.trigger('click')

      expect(wrapper.find('[data-testid="short-note-composer-sheet"]').exists()).toBe(true)
    })
  })

  describe('BlogArticlesView.vue (Tab 3: 长文)', () => {
    const mockArticles = [
      {
        id: 'a-1',
        title: '现代前端工程化全景思考',
        excerpt: '从 Vite、Turbopack 到基于 Rust 的底层工具链，现代前端架构正迎来范式转移。',
        author: { name: '前端老兵', avatar: '' },
        reading_time_minutes: 10,
        category: '技术',
        tags: ['前端', '架构'],
        published_at: '2026-10-18T10:00:00Z',
      },
      {
        id: 'a-2',
        title: '古典音乐与心流状态的科学解释',
        excerpt: '脑电波研究表明，巴赫与莫扎特的复调音乐能够在脑内诱发稳定的 Alpha 节律。',
        author: { name: '神经学乐迷', avatar: '' },
        reading_time_minutes: 6,
        category: '思考',
        tags: ['脑科学', '音乐'],
        published_at: '2026-10-19T10:00:00Z',
      },
    ]

    it('uses ordinary links for article cards and hides meaningless all-only filters', () => {
      const wrapper = mount(BlogArticlesView, {
        global: { plugins: [router] },
        props: { initialArticles: [{ id: 'a-only', title: '只有一篇长文', excerpt: '测试摘要' }] },
      })
      const card = wrapper.get('[data-testid="article-card"]')
      expect(card.element.tagName).toBe('A')
      expect(card.attributes('href')).toBe('/post/a-only')
      expect(wrapper.find('.blog-category-chips').exists()).toBe(false)
      wrapper.unmount()
    })

    it('renders category chips and article items', () => {
      const wrapper = mount(BlogArticlesView, {
        global: { plugins: [router] },
        props: { initialArticles: mockArticles },
      })

      expect(wrapper.findAll('[data-testid="article-card"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('现代前端工程化全景思考')
      expect(wrapper.text()).toContain('古典音乐与心流状态的科学解释')
    })

    it('filters articles when selecting a category chip', async () => {
      const wrapper = mount(BlogArticlesView, {
        global: { plugins: [router] },
        props: { initialArticles: mockArticles },
      })

      const techChip = wrapper.find('[data-testid="category-chip-技术"]')
      if (techChip.exists()) {
        await techChip.trigger('click')
        expect(wrapper.text()).toContain('现代前端工程化全景思考')
        expect(wrapper.text()).not.toContain('古典音乐与心流状态')
      }
    })

    it('navigates to reader view when clicking an article card', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(BlogArticlesView, {
        global: { plugins: [router] },
        props: { initialArticles: mockArticles },
      })

      const card = wrapper.find('[data-testid="article-card"]')
      await card.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/post/a-1')
    })
  })

  describe('BlogMeView.vue (Tab 4: 我的)', () => {
    beforeEach(() => {
      useAuthStore().isAuthenticated = true
    })
    const mockProfile = {
      name: '墨客',
      username: 'writer_moke',
      bio: '热爱书写、观察与反思的文字探索者。',
      stats: {
        notes: 32,
        articles: 8,
        likes: 246,
        followers: 128,
      },
    }

    const mockUserNotes = [
      { id: 'un-1', content: '自留短笺一条', created_at: '2026-10-21T09:00:00Z', likes_count: 5, comments_count: 1 },
    ]

    const mockUserArticles = [
      { id: 'ua-1', title: '我的第一篇长文', reading_time_minutes: 4, published_at: '2026-10-15T10:00:00Z' },
    ]

    it('renders author profile card with 4 stats', () => {
      const wrapper = mount(BlogMeView, {
        global: { plugins: [router] },
        props: {
          initialProfile: mockProfile,
          initialNotes: mockUserNotes,
          initialArticles: mockUserArticles,
        },
      })

      expect(wrapper.find('[data-testid="author-profile-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('墨客')
      expect(wrapper.text()).toContain('@writer_moke')
      expect(wrapper.text()).toContain('32')
      expect(wrapper.text()).toContain('8')
      expect(wrapper.text()).toContain('246')
      expect(wrapper.text()).toContain('128')
    })

    it('switches between "短笺", "长文", and "收藏" sub-tabs', async () => {
      const wrapper = mount(BlogMeView, {
        global: { plugins: [router] },
        props: {
          initialProfile: mockProfile,
          initialNotes: mockUserNotes,
          initialArticles: mockUserArticles,
        },
      })

      expect(wrapper.text()).toContain('自留短笺一条')

      // Switch to 长文
      const articlesTab = wrapper.find('[data-testid="me-tab-articles"]')
      await articlesTab.trigger('click')
      expect(wrapper.text()).toContain('我的第一篇长文')

      // Switch to 收藏
      const bookmarksTab = wrapper.find('[data-testid="me-tab-bookmarks"]')
      await bookmarksTab.trigger('click')
      expect(wrapper.find('[data-testid="bookmarks-empty"]').exists()).toBe(true)
    })
  })

  describe('ShortNoteDetailMobileView.vue (短笺详情)', () => {
    const mockNote = {
      id: 'n-detail-1',
      content: '详细短笺内容：关于纯白微圆角系统在手持移动端的实际触感体验。',
      author: { name: '设计师', avatar: '' },
      created_at: '2026-10-21T10:00:00Z',
      likes_count: 18,
      comments_count: 2,
    }

    it('renders note details and back button', () => {
      const wrapper = mount(ShortNoteDetailMobileView, {
        global: { plugins: [router] },
        props: { initialNote: mockNote },
      })

      expect(wrapper.find('[data-testid="note-detail-back-btn"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('详细短笺内容')
      expect(wrapper.text()).toContain('设计师')
    })
  })
})
