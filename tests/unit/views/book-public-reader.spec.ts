import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import * as booksApi from '@/api/books'
import BookPublicReaderView from '@/views/books/BookPublicReaderView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('BookPublicReaderView', () => {
  it('uses a revision source without legacy APIs and isolates local bookmarks by account and revision', async () => {
    const legacy = vi.spyOn(booksApi, 'getPublishedBookAsset')
    const legacyContent = vi.spyOn(booksApi, 'fetchPublishedBookAssetContent')
    const loadContent = vi.fn().mockResolvedValue(new Blob(['固定版本的正文']))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/books/read/:workId/:assetId/:revisionId', component: BookPublicReaderView }] })
    await router.push('/books/read/work-1/asset-1/revision-old')
    await router.isReady()
    const wrapper = mount(BookPublicReaderView, { props: { source: {
      title: '历史', backTo: '/books/work/work-1', progressKey: 'revision:user-1:revision-old', loadContent,
      asset: { id: 'asset-1', work_id: 'work-1', format: 'txt', file_name: 'old.txt', content_type: 'text/plain', size: 9, status: 'published', created_at: '' },
    } }, global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('固定版本的正文')
    expect(wrapper.classes()).not.toContain('a-page-md')
    expect(wrapper.find('.book-reader-shell__panel').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('举报正文')
    expect(legacy).not.toHaveBeenCalled()
    expect(legacyContent).not.toHaveBeenCalled()
    await wrapper.get('button[aria-label="添加书签"]').trigger('click')
    const cached = JSON.parse(localStorage.getItem('atoman:book-reading-progress:revision:user-1:revision-old') || '{}')
    expect(cached.bookmarks).toHaveLength(1)
    expect(localStorage.getItem('atoman:book-reading-progress:asset-1')).toBeNull()
    wrapper.unmount()
  })

  it('opens a published TXT asset without requesting private reading state', async () => {
    vi.spyOn(booksApi, 'getPublishedBookAsset').mockResolvedValue({
      id: 'public-asset-1',
      work_id: 'work-1',
      format: 'txt',
      file_name: 'public.txt',
      content_type: 'text/plain',
      size: 12,
      status: 'published',
      created_at: '2026-08-27T00:00:00Z',
    })
    vi.spyOn(booksApi, 'fetchPublishedBookAssetContent').mockResolvedValue(new Blob(['Public text']))
    const privateStateSpy = vi.spyOn(booksApi, 'getBookReadingState')

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/public-read/:assetId', component: BookPublicReaderView }],
    })
    await router.push('/books/public-read/public-asset-1')
    await router.isReady()
    const wrapper = mount(BookPublicReaderView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Public text')
    expect(wrapper.text()).toContain('公共正文')
    expect(privateStateSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('保留公共正文举报动作', async () => {
    vi.spyOn(booksApi, 'getPublishedBookAsset').mockResolvedValue({
      id: 'public-asset-2',
      work_id: 'work-2',
      format: 'txt',
      file_name: 'reported.txt',
      content_type: 'text/plain',
      size: 12,
      status: 'published',
      created_at: '2026-08-27T00:00:00Z',
    })
    vi.spyOn(booksApi, 'fetchPublishedBookAssetContent').mockResolvedValue(new Blob(['Public text']))
    const reportSpy = vi.spyOn(booksApi, 'reportPublishedBookAsset').mockResolvedValue(undefined)
    Object.defineProperty(window, 'prompt', { configurable: true, value: vi.fn(() => '内容不实') })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/public-read/:assetId', component: BookPublicReaderView }],
    })
    await router.push('/books/public-read/public-asset-2')
    await router.isReady()
    const wrapper = mount(BookPublicReaderView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(reportSpy).toHaveBeenCalledWith('public-asset-2', '内容不实')
    expect(wrapper.text()).toContain('举报已提交')
    wrapper.unmount()
  })

  it('在匿名公共阅读中添加并删除本地书签', async () => {
    vi.spyOn(booksApi, 'getPublishedBookAsset').mockResolvedValue({
      id: 'public-asset-3',
      work_id: 'work-3',
      format: 'txt',
      file_name: 'bookmarked.txt',
      content_type: 'text/plain',
      size: 12,
      status: 'published',
      created_at: '2026-08-27T00:00:00Z',
    })
    vi.spyOn(booksApi, 'fetchPublishedBookAssetContent').mockResolvedValue(new Blob(['Public text']))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/public-read/:assetId', component: BookPublicReaderView }],
    })
    await router.push('/books/public-read/public-asset-3')
    await router.isReady()
    const wrapper = mount(BookPublicReaderView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[aria-label="添加书签"]').trigger('click')
    expect(wrapper.find('.public-reader__bookmarks').exists()).toBe(true)
    expect(localStorage.getItem('atoman:book-reading-progress:public-asset-3')).toContain('bookmarks')

    await wrapper.find('.public-reader__bookmarks li button:nth-child(2)').trigger('click')
    expect(wrapper.find('.public-reader__bookmarks').exists()).toBe(false)
    wrapper.unmount()
  })

  it('搜索公共 TXT 正文并显示匹配片段', async () => {
    vi.spyOn(booksApi, 'getPublishedBookAsset').mockResolvedValue({
      id: 'public-asset-4',
      work_id: 'work-4',
      format: 'txt',
      file_name: 'searchable.txt',
      content_type: 'text/plain',
      size: 20,
      status: 'published',
      created_at: '2026-08-27T00:00:00Z',
    })
    vi.spyOn(booksApi, 'fetchPublishedBookAssetContent').mockResolvedValue(new Blob(['公共正文中的关键词']))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/public-read/:assetId', component: BookPublicReaderView }],
    })
    await router.push('/books/public-read/public-asset-4')
    await router.isReady()
    const wrapper = mount(BookPublicReaderView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.get('#public-book-search').setValue('关键词')
    await wrapper.find('.public-reader__search').trigger('submit')

    expect(wrapper.text()).toContain('找到 1 处匹配')
    expect(wrapper.find('.public-reader__search-results button').text()).toContain('关键词')
    wrapper.unmount()
  })

  it('保存匿名阅读器的显示偏好', async () => {
    vi.spyOn(booksApi, 'getPublishedBookAsset').mockResolvedValue({
      id: 'public-asset-5',
      work_id: 'work-5',
      format: 'txt',
      file_name: 'preferences.txt',
      content_type: 'text/plain',
      size: 12,
      status: 'published',
      created_at: '2026-08-27T00:00:00Z',
    })
    vi.spyOn(booksApi, 'fetchPublishedBookAssetContent').mockResolvedValue(new Blob(['Public text']))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/public-read/:assetId', component: BookPublicReaderView }],
    })
    await router.push('/books/public-read/public-asset-5')
    await router.isReady()
    const wrapper = mount(BookPublicReaderView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('.book-reader-display-controls select').setValue('0.85')
    await wrapper.find('[aria-label="夜间主题"]').trigger('click')

    expect(localStorage.getItem('atoman:book-reading-progress:public-asset-5')).toContain('"theme":"night"')
    expect(localStorage.getItem('atoman:book-reading-progress:public-asset-5')).toContain('"font_scale":0.85')
    wrapper.unmount()
  })
})
