import { describe, expect, it, vi, beforeEach } from 'vitest'
import { loadPdfEngine, loadEpubEngine, resetReaderEnginesForTest } from '@/utils/bookReaderEngines'
import { mount } from '@vue/test-utils'
import BookReaderSkeleton from '@/components/books/BookReaderSkeleton.vue'

vi.mock('epubjs', () => ({ default: vi.fn(), EpubCFI: vi.fn() }))
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
  TextLayer: vi.fn(),
}))

describe('bookReaderEngines dynamic loader', () => {
  beforeEach(() => {
    resetReaderEnginesForTest()
    vi.clearAllMocks()
  })

  it('loads pdf engine dynamically and caches the singleton promise', async () => {
    const firstCall = loadPdfEngine()
    const secondCall = loadPdfEngine()
    expect(firstCall).toBe(secondCall)

    const engine = await firstCall
    expect(engine).toHaveProperty('getDocument')
    expect(engine).toHaveProperty('GlobalWorkerOptions')
  })

  it('loads epub engine dynamically and caches the singleton promise', async () => {
    const firstCall = loadEpubEngine()
    const secondCall = loadEpubEngine()
    expect(firstCall).toBe(secondCall)

    const engine = await firstCall
    expect(engine).toHaveProperty('ePub')
  })

  it('renders reader skeleton with accessible role and labels', () => {
    const wrapper = mount(BookReaderSkeleton, {
      props: { format: 'pdf' },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('aria-label')).toContain('PDF')
    expect(wrapper.find('.book-reader-skeleton__card.is-pdf').exists()).toBe(true)
  })
})
