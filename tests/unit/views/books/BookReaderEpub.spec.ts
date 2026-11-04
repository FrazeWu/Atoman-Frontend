import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import ePub from 'epubjs'
import BookPublicReaderView from '@/components/books/BookPublicReaderView.vue'
import { bookReaderPreferencesForFormat } from '@/utils/bookReaderPreferences'

vi.mock('epubjs', () => ({ default: vi.fn() }))
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

it('EPUB 恢复与排版产生的 relocated 不回写云端，主动翻页才提交 CFI', async () => {
  setActivePinia(createPinia())
  const events = new Map<string, (location: unknown) => void>()
  const display = vi.fn().mockResolvedValue(undefined)
  vi.mocked(ePub).mockReturnValue({
    ready: Promise.resolve(), navigation: { toc: [] }, destroy: vi.fn(),
    locations: { generate: vi.fn().mockResolvedValue([]), percentageFromCfi: (cfi: string) => cfi.includes('/30/') ? .7 : cfi.includes('/18/') ? .55 : .6, length: () => 10 },
    renderTo: () => ({ on: (name: string, callback: (location: unknown) => void) => events.set(name, callback), display, next: vi.fn().mockResolvedValue(undefined), prev: vi.fn(), destroy: vi.fn() }),
  } as never)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: BookPublicReaderView }] })
  await router.push('/')
  const observe = vi.fn()
  const wrapper = mount(BookPublicReaderView, { props: { source: {
    title: 'EPUB', backTo: '/books', progressKey: 'revision:epub-cloud', loadContent: async () => new Blob(['epub']),
    asset: { id: 'a', format: 'epub', file_name: 'test.epub', content_type: 'application/epub+zip', size: 4, status: 'published', created_at: '' },
    initialPosition: { pdf_page: 0, current_percent: .6, epub_cfi: 'epubcfi(/6/2!/4/20/1:5)', txt_offset: 0 }, bookmarks: [], onPosition: observe,
  } }, global: { plugins: [router] } })
  try {
    await flushPromises()
    expect(display).toHaveBeenCalledWith('epubcfi(/6/2!/4/20/1:5)')
    events.get('relocated')!({ start: { cfi: 'epubcfi(/6/2!/4/18/1:0)', percentage: .55 } })
    expect(observe).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('atoman:book-reading-progress:revision:epub-cloud') || '{}').display.scroll_mode).toBe('continuous')
    // EPUB defaults to continuous scroll; switching to paging preserves the CFI.
    await wrapper.get('button[aria-label="切换为单页翻页"]').trigger('click')
    await flushPromises()
    expect(display).toHaveBeenLastCalledWith('epubcfi(/6/2!/4/18/1:0)')
    await wrapper.get('button[aria-label="下一页"]').trigger('click')
    events.get('relocated')!({ start: { cfi: 'epubcfi(/6/2!/4/30/1:0)', percentage: .7 } })
    expect(observe).toHaveBeenCalledWith({ advance_furthest: true, epub_cfi: 'epubcfi(/6/2!/4/30/1:0)', current_percent: .7, pdf_page: 0, pdf_offset: 0, txt_offset: 0 })
  } finally { wrapper.unmount() }
})


it('按格式默认纵向阅读，按具体文件保存的左右翻页偏好优先', () => {
  expect(bookReaderPreferencesForFormat('epub', null).scroll_mode).toBe('continuous')
  expect(bookReaderPreferencesForFormat('pdf', null).scroll_mode).toBe('continuous')
  expect(bookReaderPreferencesForFormat('txt', null).scroll_mode).toBe('continuous')
  expect(bookReaderPreferencesForFormat('cbz', null).scroll_mode).toBe('paginated')
  expect(bookReaderPreferencesForFormat('cbr', null).scroll_mode).toBe('paginated')
  expect(bookReaderPreferencesForFormat('epub', { scroll_mode: 'paginated' }).scroll_mode).toBe('paginated')
})
