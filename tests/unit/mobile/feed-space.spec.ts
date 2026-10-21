import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import FeedStreamView from '@mobile/views/feed/FeedStreamView.vue'
import FeedFollowingView from '@mobile/views/feed/FeedFollowingView.vue'
import FeedStarredView from '@mobile/views/feed/FeedStarredView.vue'
import FeedMeView from '@mobile/views/feed/FeedMeView.vue'
import FeedArticleReaderView from '@mobile/views/feed/FeedArticleReaderView.vue'

vi.mock('@mobile/components/ui/MIcon.vue', () => ({
  default: {
    name: 'MIcon',
    props: ['name', 'size'],
    template: '<span class="m-icon" :data-icon="name"><slot /></span>',
  },
}))

vi.mock('@/api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
  apiRequestResult: vi.fn().mockResolvedValue({ ok: true, data: { data: [] } }),
  apiRequestJson: vi.fn().mockResolvedValue({ articles: [], total: 0 }),
}))

describe('Mobile Feed Space Overhaul (Option B)', () => {
  let pinia: any
  let router: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/feed', component: FeedStreamView },
        { path: '/feed/following', component: FeedFollowingView },
        { path: '/feed/starred', component: FeedStarredView },
        { path: '/feed/me', component: FeedMeView },
        { path: '/feed/article/:id', component: FeedArticleReaderView },
        { path: '/feed/sources', component: { template: '<div>Sources</div>' } },
      ],
    })
    vi.clearAllMocks()
  })

  describe('FeedStreamView.vue (Tab 1: 精选)', () => {
    const mockArticles = [
      {
        id: 'art-1',
        title: '纯白极简系统设计探索',
        summary: '从设计令牌到触控体验，构筑优雅的阅读工具。',
        author: { name: 'Alex' },
        source_title: '设计随笔',
        published_at: '2026-10-21T08:00:00Z',
        likes_count: 32,
        comments_count: 5,
        bookmarked: false,
      },
    ]

    it('renders article item and navigates to article reader on tap', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(FeedStreamView, {
        global: { plugins: [pinia, router] },
        props: { initialArticles: mockArticles },
      })

      expect(wrapper.find('[data-testid="feed-article-item"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('纯白极简系统设计探索')

      await wrapper.find('[data-testid="feed-article-item"]').trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/feed/article/art-1')
    })
  })

  describe('FeedFollowingView.vue (Tab 2: 关注)', () => {
    const mockFollowingArticles = [
      {
        id: 'f-1',
        title: 'Vue 3.5 响应式系统深度解析',
        summary: '内存占用减少 56%，SSR 性能大幅飞跃。',
        sourceName: 'Evan You Blog',
        sourceAvatar: '/avatars/evan.png',
        published_at: '2026-10-21T09:00:00Z',
        unread: true,
      },
      {
        id: 'f-2',
        title: 'TypeScript 5.8 发布速览',
        summary: '更精确的类型推导与更低的编译内存开销。',
        sourceName: 'TypeScript Official',
        sourceAvatar: '',
        published_at: '2026-10-20T14:00:00Z',
        unread: false,
      },
    ]

    it('renders timeline articles and mark-all-read action', async () => {
      const wrapper = mount(FeedFollowingView, {
        global: { plugins: [pinia, router] },
        props: { initialArticles: mockFollowingArticles },
      })

      expect(wrapper.findAll('[data-testid="following-article-item"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('Vue 3.5 响应式系统深度解析')
      expect(wrapper.text()).toContain('Evan You Blog')
      expect(wrapper.find('[data-testid="mark-all-read-btn"]').exists()).toBe(true)
    })

    it('clicking article navigates to reader', async () => {
      const pushSpy = vi.spyOn(router, 'push')
      const wrapper = mount(FeedFollowingView, {
        global: { plugins: [pinia, router] },
        props: { initialArticles: mockFollowingArticles },
      })

      const first = wrapper.find('[data-testid="following-article-item"]')
      await first.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/feed/article/f-1')
    })
  })

  describe('FeedStarredView.vue (Tab 3: 收藏)', () => {
    const mockStarred = [
      {
        id: 's-1',
        title: '从零构建响应式设计系统',
        sourceName: 'Design Systems',
        category: '设计',
        savedAt: '2026-10-20T10:00:00Z',
      },
      {
        id: 's-2',
        title: 'Rust 高并发内存安全实战',
        sourceName: 'Rust Magazine',
        category: '技术',
        savedAt: '2026-10-19T11:00:00Z',
      },
    ]

    it('renders starred articles with category badge', () => {
      const wrapper = mount(FeedStarredView, {
        global: { plugins: [pinia, router] },
        props: { initialArticles: mockStarred },
      })

      expect(wrapper.findAll('[data-testid="starred-article-item"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('从零构建响应式设计系统')
      expect(wrapper.text()).toContain('设计')
    })

    it('unstarring an article removes it from the list', async () => {
      const wrapper = mount(FeedStarredView, {
        global: { plugins: [pinia, router] },
        props: { initialArticles: mockStarred },
      })

      const unstarBtn = wrapper.find('[data-testid="unstar-btn-s-1"]')
      expect(unstarBtn.exists()).toBe(true)
      await unstarBtn.trigger('click')
      expect(wrapper.text()).not.toContain('从零构建响应式设计系统')
    })
  })

  describe('FeedMeView.vue (Tab 4: 我的)', () => {
    const mockProfile = {
      name: '探索客',
      username: 'explorer_feed',
      bio: '用 RSS 捕获世界的细微震颤。',
      stats: {
        sourcesCount: 24,
        starredCount: 68,
        readCount: 312,
        readingHours: 42,
      },
    }

    it('renders user stats and subscription manager shortcut', () => {
      const wrapper = mount(FeedMeView, {
        global: { plugins: [pinia, router] },
        props: { initialProfile: mockProfile },
      })

      expect(wrapper.find('[data-testid="feed-profile-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('探索客')
      expect(wrapper.text()).toContain('24')
      expect(wrapper.text()).toContain('68')
      expect(wrapper.text()).toContain('312')
      expect(wrapper.text()).toContain('42')
      expect(wrapper.find('[data-testid="feed-sources-manager-link"]').exists()).toBe(true)
    })
  })
})
