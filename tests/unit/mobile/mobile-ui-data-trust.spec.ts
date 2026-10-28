import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { searchCatalogWorks } from '@/api/bookCatalog'
import { apiRequestEnvelope, apiRequestResult } from '@/api/client'
import { listMusicSongs } from '@/api/musicV1'
import BooksDiscoverView from '@mobile/views/books/BooksDiscoverView.vue'
import FeedStreamView from '@mobile/views/feed/FeedStreamView.vue'
import FeedArticleReaderView from '@mobile/views/feed/FeedArticleReaderView.vue'
import BlogNotesTimelineView from '@mobile/views/blog/BlogNotesTimelineView.vue'
import MusicLibraryView from '@mobile/views/music/MusicLibraryView.vue'

vi.mock('@/api/bookCatalog', async (original) => ({
  ...await original<typeof import('@/api/bookCatalog')>(),
  searchCatalogWorks: vi.fn(),
}))
vi.mock('@/api/client', async (original) => ({
  ...await original<typeof import('@/api/client')>(),
  apiRequestResult: vi.fn(),
  apiRequestEnvelope: vi.fn(),
}))
vi.mock('@/api/musicV1', async (original) => ({
  ...await original<typeof import('@/api/musicV1')>(),
  listMusicSongs: vi.fn(),
}))

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/books', component: BooksDiscoverView },
      { path: '/posts/notes', component: BlogNotesTimelineView },
      { path: '/feed', component: FeedStreamView },
      { path: '/feed/article/:id', component: FeedArticleReaderView },
      { path: '/music/bookmarks', component: MusicLibraryView },
    ],
  })
}

describe('Mobile production content trust', () => {
  let pinia: ReturnType<typeof createPinia>
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.mocked(searchCatalogWorks).mockReset()
    vi.mocked(apiRequestResult).mockReset()
    vi.mocked(apiRequestEnvelope).mockReset()
    vi.mocked(listMusicSongs).mockReset()
  })

  it('shows a retry error instead of invented books on catalog failure', async () => {
    vi.mocked(searchCatalogWorks).mockRejectedValue(new Error('offline'))
    const wrapper = mount(BooksDiscoverView, { global: { plugins: [pinia, router()] } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('图书目录加载失败')
    expect(wrapper.find('[data-testid="books-hero-card"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('沉思录')
    expect(wrapper.get('[role="alert"] button').text()).toContain('重新加载')
    wrapper.unmount()
  })

  it('renders a real empty catalog without inventing a recommendation', async () => {
    vi.mocked(searchCatalogWorks).mockResolvedValue({ items: [], total: 0 } as never)
    const wrapper = mount(BooksDiscoverView, { global: { plugins: [pinia, router()] } })
    await flushPromises()
    expect(wrapper.get('[data-testid="books-discover-empty"]').text()).toContain('暂无收录图书')
    expect(wrapper.find('[data-testid="books-hero-card"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows an error without fake authors or articles when Feed requests fail', async () => {
    vi.mocked(apiRequestResult).mockRejectedValue(new Error('offline'))
    const wrapper = mount(FeedStreamView, { global: { plugins: [pinia, router()] } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('内容加载失败')
    expect(wrapper.findAll('[data-testid="feed-article-item"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('构建现代化纯白极简阅读体验')
    wrapper.unmount()
  })

  it('does not render invented reader content for an invalid article ID', async () => {
    vi.mocked(apiRequestResult).mockResolvedValue({ ok: false, status: 404, data: {} } as never)
    const appRouter = router()
    await appRouter.push('/feed/article/does-not-exist')
    await appRouter.isReady()
    const wrapper = mount(FeedArticleReaderView, { global: { plugins: [pinia, appRouter] } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('文章不存在')
    expect(wrapper.find('[data-testid="reader-content"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('构建现代化纯白极简阅读体验')
    wrapper.unmount()
  })

  it('does not invent three notes when the timeline is unavailable', async () => {
    vi.mocked(apiRequestEnvelope).mockRejectedValue(new Error('offline'))
    const wrapper = mount(BlogNotesTimelineView, { global: { plugins: [pinia, router()] } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('短笺加载失败')
    expect(wrapper.findAll('[data-testid="short-note-card"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('思绪记录者')
    wrapper.unmount()
  })

  it('does not generate audio sample URLs on a failed music list', async () => {
    vi.mocked(listMusicSongs).mockRejectedValue(new Error('offline'))
    const wrapper = mount(MusicLibraryView, { global: { plugins: [pinia, router()] } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('歌曲加载失败')
    expect(wrapper.findAll('[data-testid="library-track-item"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Echoes of Silence')
    wrapper.unmount()
  })
})
