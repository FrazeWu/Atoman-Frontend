import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ActiveReadingBook {
  assetId: string
  workId?: string
  title: string
  author?: string
  coverUrl?: string
  format: string
  currentPage: number
  totalPages: number
  percent: number
  chapterTitle?: string
}

export type BookSidebarMode = 'thumbnails' | 'outline' | 'bookmarks' | 'none'

const STORAGE_KEY = 'atoman_book_reader_active'

export const useBookReaderStore = defineStore('bookReader', () => {
  const activeBook = ref<ActiveReadingBook | null>(loadPersistedBook())
  const isOverlayOpen = ref(false)
  const zoomLevel = ref(100)
  const sidebarMode = ref<BookSidebarMode>('none')
  const searchQuery = ref('')
  const isSearchOpen = ref(false)

  function loadPersistedBook(): ActiveReadingBook | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  }

  function persistBook() {
    try {
      if (activeBook.value) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activeBook.value))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Storage errors handled gracefully
    }
  }

  function openBook(book: ActiveReadingBook) {
    activeBook.value = { ...book }
    isOverlayOpen.value = true
    persistBook()
  }

  function closeBook() {
    activeBook.value = null
    isOverlayOpen.value = false
    persistBook()
  }

  function updateProgress(page: number, total: number, chapter?: string) {
    if (!activeBook.value) return
    const validTotal = Math.max(1, total)
    const validPage = Math.max(1, Math.min(page, validTotal))
    const percent = Math.min(1, Math.max(0, validPage / validTotal))

    activeBook.value.currentPage = validPage
    activeBook.value.totalPages = validTotal
    activeBook.value.percent = percent
    if (chapter !== undefined) {
      activeBook.value.chapterTitle = chapter
    }
    persistBook()
  }

  function toggleOverlay(open?: boolean) {
    isOverlayOpen.value = open !== undefined ? open : !isOverlayOpen.value
  }

  function setZoom(zoom: number) {
    zoomLevel.value = Math.max(25, Math.min(400, zoom))
  }

  function setSidebarMode(mode: BookSidebarMode) {
    sidebarMode.value = mode
  }

  function setSearchOpen(open: boolean) {
    isSearchOpen.value = open
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  return {
    activeBook,
    isOverlayOpen,
    zoomLevel,
    sidebarMode,
    searchQuery,
    isSearchOpen,
    openBook,
    closeBook,
    updateProgress,
    toggleOverlay,
    setZoom,
    setSidebarMode,
    setSearchOpen,
    setSearchQuery,
  }
})
