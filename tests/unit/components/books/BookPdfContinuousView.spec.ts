import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BookPdfContinuousView from '@/components/books/BookPdfContinuousView.vue'

const viewerMock = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: any[]) => void>,
  active: null as any,
}))

vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  EventBus: class { on(event: string, callback: (...args: any[]) => void) { viewerMock.handlers[event] = callback } },
  PDFLinkService: class { setViewer() {}; setDocument() {} },
  ScrollMode: { VERTICAL: 1 },
  PDFViewer: class {
    scrollMode = 0
    currentScale = 1
    private page = 1
    private root: HTMLElement
    constructor(options: { container: HTMLElement }) { this.root = options.container; viewerMock.active = this }
    get currentPageNumber() { return this.page }
    set currentPageNumber(value: number) {
      this.page = value
      this.root.scrollTop = (value - 1) * 1000
      viewerMock.handlers.pagechanging?.({ pageNumber: value })
    }
    getPageView(index: number) {
      const root = this.root
      return { div: {
        getBoundingClientRect() {
          const top = index * 1000 - root.scrollTop
          return { top, bottom: top + 1000, height: 1000 }
        },
      } }
    }
    setDocument(value: unknown) { if (value) viewerMock.handlers.pagesinit?.() }
    getCachedPageViews() { return [] }
  },
}))

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    queueMicrotask(() => callback(0))
    return 1
  })
})
afterEach(() => { viewerMock.handlers = {}; viewerMock.active = null; vi.restoreAllMocks() })

it('PDF 恢复精确页内 35%，自然滚动与同页位移上报真实位置，缩放不会冒充阅读', async () => {
  const wrapper = mount(BookPdfContinuousView, {
    props: { document: { numPages: 10 } as never, initialPage: 3, initialOffset: .35, zoom: 100, annotations: [] },
  })
  try {
    await flushPromises()
    expect(viewerMock.active.scrollMode).toBe(1)
    expect(viewerMock.active.currentPageNumber).toBe(3)
    const root = wrapper.get('.book-pdf-continuous__scroll')
    expect((root.element as HTMLElement).scrollTop).toBeCloseTo(2350, 0)
    expect((wrapper.emitted('position-change') || []).every((value) => value[2] === false)).toBe(true)

    wrapper.vm.goToPage(8)
    expect(viewerMock.active.currentPageNumber).toBe(8)
    expect(wrapper.emitted('position-change')?.at(-1)).toEqual([8, 0, false])

    await root.trigger('wheel')
    ;(root.element as HTMLElement).scrollTop = 7480
    await root.trigger('scroll')
    await flushPromises()
    expect(wrapper.emitted('position-change')?.at(-1)).toEqual([8, .488, true])
    await wrapper.setProps({ zoom: 120 })
    await flushPromises()
    await root.trigger('scroll')
    await flushPromises()
    expect(wrapper.emitted('position-change')?.at(-1)?.[2]).toBe(false)

    await root.trigger('wheel')
    ;(root.element as HTMLElement).scrollTop = 7520
    await root.trigger('scroll')
    await flushPromises()
    expect(wrapper.emitted('position-change')?.at(-1)).toEqual([8, .528, true])
  } finally { wrapper.unmount() }
})

it('mobile default PDF page uses PDF.js page-width fit instead of horizontal clipping', async () => {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
  const wrapper = mount(BookPdfContinuousView, {
    props: { document: { numPages: 2 } as never, initialPage: 1, zoom: 100, annotations: [] },
  })
  try {
    await flushPromises()
    expect(viewerMock.active.currentScaleValue).toBe('page-width')
  } finally { wrapper.unmount() }
})
