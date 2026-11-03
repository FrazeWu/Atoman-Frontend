import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import BookPdfContinuousView from '@/components/books/BookPdfContinuousView.vue'

const mockPdfViewer = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  active: null as any,
}))

vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  EventBus: class {
    on(event: string, callback: (...args: any[]) => void) { mockPdfViewer.handlers[event] = callback }
  },
  PDFLinkService: class { setViewer() {}; setDocument() {} },
  ScrollMode: { VERTICAL: 1 },
  PDFViewer: class {
    scrollMode = 0
    currentScale = 1
    private page = 1
    constructor() { mockPdfViewer.active = this }
    get currentPageNumber() { return this.page }
    set currentPageNumber(value: number) {
      if (this.page === value) return
      this.page = value
      mockPdfViewer.handlers.pagechanging?.({ pageNumber: value })
    }
    setDocument(value: unknown) { if (value) mockPdfViewer.handlers.pagesinit?.() }
    getCachedPageViews() { return [] }
  },
}))

afterEach(() => { mockPdfViewer.handlers = {}; mockPdfViewer.active = null })

it('PDF 连续模式真正使用多页 viewer，并区分跳页与自然滚动', async () => {
  const wrapper = mount(BookPdfContinuousView, {
    props: { document: { numPages: 10 } as never, initialPage: 3, zoom: 100, annotations: [] },
  })
  try {
    await flushPromises()
    expect(mockPdfViewer.active).not.toBeNull()
    expect(mockPdfViewer.active.scrollMode).toBe(1)
    expect(mockPdfViewer.active.currentPageNumber).toBe(3)
    expect(wrapper.emitted('page-change')).toBeUndefined() // opening at the last position is not reading

    wrapper.vm.goToPage(8)
    expect(mockPdfViewer.active.currentPageNumber).toBe(8)
    expect(wrapper.emitted('page-change')).toEqual([[8, false]])

    await wrapper.get('.book-pdf-continuous__scroll').trigger('wheel')
    mockPdfViewer.active.currentPageNumber = 9
    expect(wrapper.emitted('page-change')).toEqual([[8, false], [9, true]])
    await wrapper.setProps({ zoom: 120 })
    mockPdfViewer.active.currentPageNumber = 10
    expect(wrapper.emitted('page-change')).toEqual([[8, false], [9, true], [10, false]])
    await wrapper.get('.book-pdf-continuous__scroll').trigger('wheel')
    mockPdfViewer.active.currentPageNumber = 9
    expect(wrapper.emitted('page-change')).toEqual([[8, false], [9, true], [10, false], [9, true]])
  } finally { wrapper.unmount() }
})
