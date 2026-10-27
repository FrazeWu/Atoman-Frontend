import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import BookPublicReaderView from '@/components/books/BookPublicReaderView.vue'

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }))
afterEach(() => vi.restoreAllMocks())

it('云端 PDF 精确页码优先于百分比，翻页提交对应页码', async () => {
  setActivePinia(createPinia())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never)
  const getPage = vi.fn().mockResolvedValue({ getViewport: () => ({ width: 405, height: 540 }), render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }) })
  vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve({ numPages: 10, getPage }), destroy: vi.fn().mockResolvedValue(undefined) } as never)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: BookPublicReaderView }] })
  await router.push('/')
  const observe = vi.fn()
  const ready = vi.fn()
  const wrapper = mount(BookPublicReaderView, { props: { source: {
    title: 'PDF', backTo: '/books', progressKey: 'revision:pdf-cloud', loadContent: async () => new Blob(['PDF']),
    asset: { id: 'a', format: 'pdf', file_name: 'test.pdf', content_type: 'application/pdf', size: 3, status: 'published', created_at: '' },
    initialPosition: { pdf_page: 3, current_percent: .9, epub_cfi: '', txt_offset: 0 }, bookmarks: [], onPosition: observe, onReady: ready,
  } }, global: { plugins: [router] } })
  try {
    await flushPromises()
    expect(getPage).toHaveBeenLastCalledWith(3)
    expect(observe).not.toHaveBeenCalled()
    expect(ready).toHaveBeenCalledOnce()
    await wrapper.get('button[aria-label="下一页"]').trigger('click')
    await flushPromises()
    expect(observe).toHaveBeenLastCalledWith({ pdf_page: 4, current_percent: .4, txt_offset: 0, epub_cfi: '' })
  } finally { wrapper.unmount() }
})

it('快速缩放取消旧 PDF 绘制，只有最新请求继续使用画布', async () => {
  setActivePinia(createPinia())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never)
  const tasks: { promise: Promise<void>; cancel: ReturnType<typeof vi.fn>; finish: () => void }[] = []
  const render = vi.fn(() => {
    let finish!: () => void
    let reject!: (error: Error) => void
    const promise = new Promise<void>((resolve, fail) => { finish = resolve; reject = fail })
    const task = { promise, cancel: vi.fn(() => reject(new Error('Rendering cancelled'))), finish }
    tasks.push(task)
    return task
  })
  vi.mocked(getDocument).mockReturnValue({
    promise: Promise.resolve({ numPages: 1, getPage: vi.fn().mockResolvedValue({ getViewport: () => ({ width: 405, height: 540 }), render }) }),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as never)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/books/read/w/a/r', component: BookPublicReaderView }] })
  await router.push('/books/read/w/a/r')
  await router.isReady()
  const wrapper = mount(BookPublicReaderView, { props: { source: {
    title: 'PDF', backTo: '/books', progressKey: 'revision:pdf-test', loadContent: async () => new Blob(['PDF']),
    asset: { id: 'a', format: 'pdf', file_name: 'test.pdf', content_type: 'application/pdf', size: 3, status: 'published', created_at: '' },
  } }, global: { plugins: [router] } })
  try {
    await flushPromises()
    expect(tasks).toHaveLength(1)
    await wrapper.get('button[aria-label="放大"]').trigger('click')
    await wrapper.get('button[aria-label="放大"]').trigger('click')
    await flushPromises()
    expect(tasks[0]!.cancel).toHaveBeenCalled()
    tasks.at(-1)!.finish()
    await flushPromises()
    expect(wrapper.text()).toContain('120%')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  } finally { wrapper.unmount() }
})
