import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookReaderStore, type ActiveReadingBook } from '@/stores/bookReader'
import { clearSessionStores } from '@/stores/sessionReset'

describe('useBookReaderStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('initializes with default state', () => {
    const store = useBookReaderStore()
    expect(store.activeBook).toBeNull()
    expect(store.isOverlayOpen).toBe(false)
    expect(store.sidebarMode).toBe('none')
    expect(store.zoomLevel).toBe(100)
    expect(store.searchQuery).toBe('')
    expect(store.isSearchOpen).toBe(false)
  })

  it('opens a book and saves active book state', () => {
    const store = useBookReaderStore()
    const book: ActiveReadingBook = {
      assetId: 'asset-123',
      workId: 'work-456',
      title: '三体',
      author: '刘慈欣',
      format: 'epub',
      currentPage: 1,
      totalPages: 100,
      percent: 0.01,
      chapterTitle: '第一章 科学边界',
    }

    store.openBook(book)
    expect(store.activeBook).toEqual(book)
    expect(store.isOverlayOpen).toBe(true)
  })

  it('clears the active reading session when the store resets', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useBookReaderStore()
    store.openBook({
      assetId: 'private-asset',
      title: '私人书籍',
      format: 'epub',
      currentPage: 3,
      totalPages: 20,
      percent: 0.15,
    })

    clearSessionStores(pinia)

    expect(store.activeBook).toBeNull()
    expect(store.isOverlayOpen).toBe(false)
    expect(localStorage.getItem('atoman_book_reader_active')).toBeNull()
  })

  it('updates progress accurately and clamps percent', () => {
    const store = useBookReaderStore()
    store.openBook({
      assetId: 'asset-1',
      title: '测试书籍',
      format: 'pdf',
      currentPage: 1,
      totalPages: 50,
      percent: 0.02,
    })

    store.updateProgress(25, 50, '第 25 页')
    expect(store.activeBook?.currentPage).toBe(25)
    expect(store.activeBook?.percent).toBe(0.5)
    expect(store.activeBook?.chapterTitle).toBe('第 25 页')
  })

  it('toggles overlay and controls zoom', () => {
    const store = useBookReaderStore()
    expect(store.isOverlayOpen).toBe(false)

    store.toggleOverlay(true)
    expect(store.isOverlayOpen).toBe(true)

    store.toggleOverlay(false)
    expect(store.isOverlayOpen).toBe(false)

    store.setZoom(125)
    expect(store.zoomLevel).toBe(125)
  })

  it('toggles sidebar and search panel', () => {
    const store = useBookReaderStore()
    store.setSidebarMode('thumbnails')
    expect(store.sidebarMode).toBe('thumbnails')

    store.setSidebarMode('none')
    expect(store.sidebarMode).toBe('none')

    store.setSearchOpen(true)
    store.setSearchQuery('量子力学')
    expect(store.isSearchOpen).toBe(true)
    expect(store.searchQuery).toBe('量子力学')
  })
})
