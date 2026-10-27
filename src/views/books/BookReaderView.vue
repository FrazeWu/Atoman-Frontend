<template>
  <main class="a-page-md books-reader" :class="`books-reader--theme-${displayPreferences.theme}`" :style="{ '--book-reader-font-scale': displayPreferences.font_scale }">
    <BookReaderShell
      :title="asset?.title || '私有电子书'"
      :subtitle="asset ? `${asset.file_name} · ${statusLabel}` : ''"
      :format="formatLabel"
      :progress="readingPercent"
      :page-label="pageLabel"
      :back-to="'/books/library'"
      back-label="返回书架"
      :can-prev="canPrev"
      :can-next="canNext"
      :show-pagination="showPagination"
      :show-surface="canRead"
      :toc="epubTOC"
      :show-zoom="asset?.format === 'pdf'"
      :initial-zoom="displayPreferences.zoom_level || 100"
      :show-scroll-mode-toggle="['pdf', 'txt', 'epub'].includes(asset?.format || '')"
      :initial-scroll-mode="displayPreferences.scroll_mode || 'paginated'"
      @previous="movePrevious"
      @next="moveNext"
      @toc-select="jumpToEpubTOC"
      @zoom-change="handleZoomChange"
      @scroll-mode-change="handleScrollModeChange"
    >
      <template #actions>
        <PButton type="button" variant="ghost" :disabled="!canRead" aria-label="添加书签" title="添加书签" @click="addBookmark">
          <Bookmark :size="16" aria-hidden="true" />
          <span>书签</span>
        </PButton>
        <PButton
          type="button"
          variant="ghost"
          :disabled="!contentBlob"
          aria-label="下载原文件"
          title="下载原文件"
          @click="downloadBook"
        >
          <Download :size="16" aria-hidden="true" />
        </PButton>
        <PButton
          type="button"
          variant="secondary"
          :loading="isSaving"
          loading-text="保存中..."
          :disabled="!canRead"
          @click="saveState"
        >
          <Save :size="16" aria-hidden="true" />
          <span>保存位置</span>
        </PButton>
      </template>
      <template #status>
        <p v-if="errorMessage" class="books-reader__feedback books-reader__feedback--error" role="alert">{{ errorMessage }}</p>
        <p v-else-if="isLoading" class="books-reader__feedback" aria-live="polite">正在打开电子书...</p>
        <p v-else-if="asset && !canRead" class="books-reader__feedback" aria-live="polite">{{ unavailableMessage }}</p>
      </template>
      <template #sidebar>
        <BookReaderSidebar
          :total-pages="asset?.format === 'pdf' ? pdfPageCount : 0"
          :current-page="asset?.format === 'pdf' ? pdfPage : 1"
          :toc="epubTOC"
          :bookmarks="bookmarks"
          :annotations="annotations"
          @select-page="jumpToPdfPage"
          @toc-select="jumpToEpubTOC"
          @bookmark-jump="jumpToBookmark"
          @bookmark-remove="removeBookmark"
          @annotation-jump="jumpToAnnotation"
          @annotation-delete="handleDeleteAnnotation"
          @annotation-export="exportAnnotationsToMarkdown"
          @annotation-quote="handleQuoteAnnotation"
        />
      </template>
      <div
        v-if="asset?.format === 'txt'"
        ref="textViewport"
        class="books-reader__text"
        @scroll="handleTextScroll"
        @mouseup="handleTextMouseUp"
        @click="handleTextClick"
      >
        <div class="books-reader__text-pages" :class="{ 'books-reader__text-pages--double': displayPreferences.page_layout === 'double' }">
          <article
            v-for="(page, index) in textPages"
            :key="page.start"
            :ref="element => setTextPageRef(index, element)"
            class="books-reader__text-page"
          >
            <div class="books-reader__text-page-content" v-html="renderTextPageHtml(page)" />
            <span class="books-reader__text-page-number tabular-nums">{{ index + 1 }}</span>
          </article>
        </div>
        <div ref="textPageFrame" class="books-reader__text-page books-reader__text-page--measure" aria-hidden="true">
          <div ref="textMeasure" class="books-reader__text-page-content" />
        </div>
      </div>
      <div v-else-if="asset?.format === 'epub'" ref="epubViewport" class="books-reader__epub" />
      <div v-else-if="asset?.format === 'cbz' || asset?.format === 'cbr'" ref="comicViewport" class="books-reader__comic" aria-label="漫画页面">
        <figure v-for="(page, index) in comicPages" :key="page.name" :ref="element => setComicPageRef(index, element)" class="books-reader__comic-page">
          <img :src="page.url" :alt="`${asset?.title || '漫画'} 第 ${index + 1} 页`" loading="lazy" />
          <figcaption class="tabular-nums">{{ index + 1 }}</figcaption>
        </figure>
      </div>
      <div v-else class="books-reader__pdf">
        <canvas ref="pdfCanvas" aria-label="PDF 页面" />
      </div>
      <template #settings>
        <BookReaderDisplayControls v-model="displayPreferences" @update:model-value="updateDisplayPreferences" />
      </template>
      <template #tools>
        <form v-if="asset?.format === 'txt'" class="books-reader__search" @submit.prevent="searchText">
          <label for="private-book-search">搜索正文</label>
          <div class="books-reader__search-row">
            <input id="private-book-search" v-model="textSearchQuery" type="search" placeholder="输入关键词" autocomplete="off" />
            <PButton type="submit" variant="ghost" aria-label="搜索正文">
              <Search :size="16" aria-hidden="true" />
              <span>搜索</span>
            </PButton>
          </div>
          <p v-if="textSearchQuery" class="books-reader__search-status" aria-live="polite">
            {{ textSearchMatches.length ? `找到 ${textSearchMatches.length} 处匹配` : '没有找到匹配内容' }}
          </p>
          <ol v-if="textSearchMatches.length" class="books-reader__search-results">
            <li v-for="match in textSearchMatches" :key="match.index">
              <button type="button" @click="jumpToTextMatch(match)">{{ match.preview }}</button>
            </li>
          </ol>
        </form>
        <label class="books-reader__notes">
          <span>私有笔记</span>
          <textarea v-model="privateNotes" maxlength="50000" rows="3" placeholder="记录只对你可见的想法" />
        </label>
        <p class="books-reader__public-status">公共副本与此处的私有阅读进度相互独立。</p>
        <details v-if="bookmarks.length" class="books-reader__bookmarks">
          <summary>书签（{{ bookmarks.length }}）</summary>
          <ol>
            <li v-for="bookmark in bookmarks" :key="bookmark.id">
              <button type="button" @click="jumpToBookmark(bookmark)">{{ bookmark.label }}</button>
              <button type="button" :aria-label="`删除书签 ${bookmark.label}`" @click="removeBookmark(bookmark.id)">删除</button>
            </li>
          </ol>
        </details>
      </template>
    </BookReaderShell>

    <BookSelectionToolbar
      v-if="selectionToolbar"
      :position="{ x: selectionToolbar.x, y: selectionToolbar.y }"
      :selected-text="selectionToolbar.text"
      :existing-annotation="selectionToolbar.existing"
      :book-title="asset?.title || ''"
      @highlight="onToolbarHighlight"
      @save-note="onToolbarSaveNote"
      @delete="onToolbarDelete"
      @close="closeSelectionToolbar"
    />

    <BookQuoteActionModal
      :open="quoteModalOpen"
      :item="activeQuoteAnnotation"
      :book-title="asset?.title || ''"
      :book-author="asset?.author"
      @close="quoteModalOpen = false"
      @select="onQuoteModalSelect"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bookmark, Download, Save, Search } from 'lucide-vue-next'
import BookQuoteActionModal from '@/components/books/BookQuoteActionModal.vue'
import { useDraftStagingStore } from '@/stores/draftStaging'
import ePub from 'epubjs'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'
import PButton from '@/components/ui/PButton.vue'
import BookReaderDisplayControls from '@/components/books/BookReaderDisplayControls.vue'
import BookReaderShell from '@/components/books/BookReaderShell.vue'
import BookReaderSidebar from '@/components/books/BookReaderSidebar.vue'
import BookReaderThumbnailStrip from '@/components/books/BookReaderThumbnailStrip.vue'
import BookSelectionToolbar from '@/components/books/BookSelectionToolbar.vue'
import { useBookReaderStore } from '@/stores/bookReader'
import { extractComicPages, type ComicPage } from '@/utils/bookComicArchive'
import { findBookTextMatches, type BookTextSearchMatch } from '@/utils/bookTextSearch'
import { mergeBookReadingProgress } from '@/utils/mediaProgressConflict'
import { parseBookReaderBookmarks, parseBookReaderDisplayPreferences, type BookReaderBookmark, type BookReaderDisplayPreferences, type BookReaderScrollMode } from '@/utils/bookReaderPreferences'
import { paginateText, type TextPage } from '@/utils/textPagination'
import {
  createBookAnnotation,
  deleteBookAnnotation,
  fetchBookAssetContent,
  getBookAsset,
  getBookReadingState,
  listAssetAnnotations,
  saveBookReadingState,
  updateBookAnnotation,
  type BookAnnotation,
  type BookHighlightColor,
  type BookHighlightStyle,
  type BookPrivateAsset,
  type BookReadingState,
} from '@/api/books'

GlobalWorkerOptions.workerSrc = pdfWorker

type EpubBook = ReturnType<typeof ePub>
type EpubRendition = ReturnType<EpubBook['renderTo']>

type EpubLocation = {
  start?: { cfi?: string; percentage?: number }
}

type EpubTOCSource = {
  id?: string
  href: string
  label: string
  subitems?: EpubTOCSource[]
}

type EpubTOCItem = EpubTOCSource & { depth: number }

const route = useRoute()
const router = useRouter()
const draftStagingStore = useDraftStagingStore()
const readerStore = useBookReaderStore()
const asset = ref<BookPrivateAsset | null>(null)
const readingState = ref<BookReadingState | null>(null)
const contentBlob = ref<Blob | null>(null)
const textContent = ref('')
const textPages = ref<TextPage[]>([])
const textPage = ref(1)
const privateNotes = ref('')
const bookmarks = ref<BookReaderBookmark[]>([])
const deletedBookmarkIDs = ref<string[]>([])
const annotations = ref<BookAnnotation[]>([])
interface SelectionToolbarState {
  x: number
  y: number
  text: string
  cfi?: string
  txtStart?: number
  txtEnd?: number
  page?: number
  existing?: BookAnnotation | null
}
const selectionToolbar = ref<SelectionToolbarState | null>(null)
const displayPreferences = ref<BookReaderDisplayPreferences>(parseBookReaderDisplayPreferences(null))
const textSearchQuery = ref('')
const textSearchMatches = ref<BookTextSearchMatch[]>([])
const readingPercent = ref(0)
const epubTOC = ref<EpubTOCItem[]>([])
const pdfPage = ref(1)
const pdfPageCount = ref(0)
const comicPage = ref(1)
const comicPages = ref<Array<ComicPage & { url: string }>>([])
const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const textViewport = ref<HTMLElement | null>(null)
const textPageFrame = ref<HTMLElement | null>(null)
const textMeasure = ref<HTMLElement | null>(null)
const epubViewport = ref<HTMLElement | null>(null)
const comicViewport = ref<HTMLElement | null>(null)
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const textPageElements: Array<HTMLElement | undefined> = []
const comicPageElements: Array<HTMLElement | undefined> = []
let pdfDocument: PDFDocumentProxy | null = null
let pdfLoadingTask: ReturnType<typeof getDocument> | null = null
let epubBook: EpubBook | null = null
let epubRendition: EpubRendition | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let textResizeObserver: ResizeObserver | null = null
let textPaginationFrame: number | null = null

const canRead = computed(() => ['private_available', 'publication_requested', 'pending_review', 'rejected'].includes(asset.value?.processing_status || ''))
const formatLabel = computed(() => asset.value?.format.toUpperCase() || '')
const pageLabel = computed(() => {
  if (asset.value?.format === 'pdf') return `第 ${pdfPage.value} / ${pdfPageCount.value} 页`
  if (asset.value?.format === 'txt' && textPages.value.length) return `第 ${textPage.value} / ${textPages.value.length} 页`
  if (asset.value?.format === 'epub') return 'EPUB'
  if ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPages.value.length) return `第 ${comicPage.value} / ${comicPages.value.length} 页`
  return ''
})
const showPagination = computed(() => ['txt', 'pdf', 'epub', 'cbz', 'cbr'].includes(asset.value?.format || ''))
const canPrev = computed(() => asset.value?.format === 'epub' || (asset.value?.format === 'txt' && textPage.value > 1) || (asset.value?.format === 'pdf' && pdfPage.value > 1) || ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPage.value > 1))
const canNext = computed(() => asset.value?.format === 'epub' || (asset.value?.format === 'txt' && textPage.value < textPages.value.length) || (asset.value?.format === 'pdf' && pdfPageCount.value > 0 && pdfPage.value < pdfPageCount.value) || ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPages.value.length > 0 && comicPage.value < comicPages.value.length))
const statusLabel = computed(() => {
  if (!asset.value) return ''
  if (asset.value.processing_status === 'private_available' || asset.value.processing_status === 'publication_requested' || asset.value.processing_status === 'pending_review' || asset.value.processing_status === 'rejected') return '可以阅读'
  if (asset.value.processing_status === 'failed') return '处理失败'
  return '处理中'
})
const unavailableMessage = computed(() => {
  if (asset.value?.processing_status === 'failed') return asset.value.error_message || '文件处理失败，请删除后重新导入'
  return '文件尚未处理完成，请稍后刷新'
})

function clampPercent(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function flattenEpubTOC(items: EpubTOCSource[], depth = 0): EpubTOCItem[] {
  return items.flatMap((item) => [
    { ...item, depth },
    ...flattenEpubTOC(item.subitems || [], depth + 1),
  ])
}

function applyReadingState(state: BookReadingState) {
  readingState.value = state
  privateNotes.value = state.private_notes || ''
  readingPercent.value = clampPercent(state.reading_percent)
  pdfPage.value = Math.max(1, state.pdf_page || 1)
  bookmarks.value = parseBookReaderBookmarks(state.preferences?.bookmarks)
  const deletedIDs = state.preferences?.deleted_bookmark_ids
  deletedBookmarkIDs.value = Array.isArray(deletedIDs) ? deletedIDs.filter((id): id is string => typeof id === 'string') : []
  displayPreferences.value = parseBookReaderDisplayPreferences(state.preferences?.display)
}

async function loadText() {
  textContent.value = await contentBlob.value!.text()
  await nextTick()
  await paginateTextContent(readingState.value?.txt_offset || 0)
  observeTextPageSize()
}

async function loadPDF() {
  const data = await contentBlob.value!.arrayBuffer()
  pdfLoadingTask = getDocument({ data })
  pdfDocument = await pdfLoadingTask.promise
  pdfPageCount.value = pdfDocument.numPages
  pdfPage.value = Math.min(Math.max(1, pdfPage.value), pdfDocument.numPages)
  await renderPDFPage()
}

async function renderPDFPage() {
  if (!pdfDocument || !pdfCanvas.value) return
  const page = await pdfDocument.getPage(pdfPage.value)
  const zoomFactor = (displayPreferences.value.zoom_level || 100) / 100
  const viewport = page.getViewport({ scale: 1.35 * zoomFactor })
  const canvas = pdfCanvas.value
  const context = canvas.getContext('2d')
  if (!context) return
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
  await page.render({ canvas, canvasContext: context, viewport }).promise
  readingPercent.value = pdfPageCount.value > 0 ? pdfPage.value / pdfPageCount.value : 0
  readerStore.updateProgress(pdfPage.value, pdfPageCount.value, `第 ${pdfPage.value} 页`)
  scheduleSaveState()
}

function handleZoomChange(newZoom: number) {
  displayPreferences.value = { ...displayPreferences.value, zoom_level: newZoom }
  if (asset.value?.format === 'pdf') {
    void renderPDFPage()
  }
  scheduleSaveState()
}

function handleScrollModeChange(newMode: BookReaderScrollMode) {
  displayPreferences.value = { ...displayPreferences.value, scroll_mode: newMode }
  scheduleSaveState()
}

async function loadEPUB() {
  epubBook = ePub(await contentBlob.value!.arrayBuffer())
  await epubBook.ready
  epubTOC.value = flattenEpubTOC(epubBook.navigation.toc as EpubTOCSource[])
  epubRendition = epubBook.renderTo(epubViewport.value!, {
    width: '100%',
    height: '100%',
    flow: 'paginated',
    manager: 'default',
    allowScriptedContent: false,
  })

  epubRendition.themes.default({
    '.book-highlight': {
      'background-color': 'color-mix(in srgb, #f59e0b 35%, transparent)',
      'cursor': 'pointer',
      'border-radius': '2px',
    },
    '.book-highlight--yellow': {
      'background-color': 'color-mix(in srgb, #f59e0b 35%, transparent)',
    },
    '.book-highlight--green': {
      'background-color': 'color-mix(in srgb, #10b981 35%, transparent)',
    },
    '.book-highlight--blue': {
      'background-color': 'color-mix(in srgb, #3b82f6 35%, transparent)',
    },
    '.book-highlight--pink': {
      'background-color': 'color-mix(in srgb, #f87171 35%, transparent)',
    },
    '.book-highlight.is-underline': {
      'background-color': 'transparent !important',
      'text-decoration': 'underline wavy #3b82f6 !important',
      'text-underline-offset': '3px !important',
    },
  })

  epubRendition.on('relocated', (location: EpubLocation) => {
    const start = location.start
    if (!start) return
    readingPercent.value = clampPercent(start.percentage || 0)
    if (readingState.value) readingState.value.epub_cfi = start.cfi || ''
    scheduleSaveState()
  })

  epubRendition.on('selected', (cfiRange: string) => {
    if (!epubBook) return
    epubBook.getRange(cfiRange).then((range: Range) => {
      if (!range) return
      const text = range.toString().trim()
      if (!text) return
      const iframe = epubViewport.value?.querySelector('iframe')
      const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 }
      const rangeRect = range.getBoundingClientRect()
      const existing = annotations.value.find((a) => a.epub_cfi === cfiRange)
      selectionToolbar.value = {
        x: iframeRect.left + rangeRect.left + rangeRect.width / 2,
        y: iframeRect.top + rangeRect.top,
        text,
        cfi: cfiRange,
        existing: existing || null,
      }
    }).catch(() => {})
  })

  epubRendition.on('rendered', () => {
    registerEpubAnnotations()
  })

  await epubRendition.display(readingState.value?.epub_cfi || undefined)
}

async function loadComic() {
  const format = asset.value?.format
  if (format !== 'cbz' && format !== 'cbr') return
  const pages = await extractComicPages(contentBlob.value!, format)
  comicPages.value = pages.map((page) => ({ ...page, url: URL.createObjectURL(page.blob) }))
  comicPage.value = Math.min(Math.max(1, Number(readingState.value?.preferences?.comic_page || 1)), comicPages.value.length)
  await nextTick()
  scrollToComicPage()
}

async function loadReader() {
  const assetID = String(route.params.assetId || route.params.id || '')
  if (!assetID) {
    errorMessage.value = '私有资源标识无效'
    isLoading.value = false
    return
  }
  try {
    asset.value = await getBookAsset(assetID)
    if (!canRead.value) return
    applyReadingState(await getBookReadingState(assetID))
    try {
      annotations.value = await listAssetAnnotations(assetID)
    } catch {
      annotations.value = []
    }
    contentBlob.value = await fetchBookAssetContent(assetID)
    await nextTick()
    if (!asset.value) return
    if (asset.value.format === 'txt') await loadText()
    else if (asset.value.format === 'pdf') await loadPDF()
    else if (asset.value.format === 'cbz' || asset.value.format === 'cbr') await loadComic()
    else await loadEPUB()

    const targetAnnotationId = route.query.annotationId as string | undefined
    if (targetAnnotationId) {
      const target = annotations.value.find((a) => a.id === targetAnnotationId)
      if (target) {
        await nextTick()
        await jumpToAnnotation(target)
      }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '电子书打开失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

function handleTextScroll() {
  const viewport = textViewport.value
  if (!viewport || !textPages.value.length) return
  const focusLine = viewport.scrollTop + viewport.clientHeight * 0.3
  let pageIndex = 0
  for (let index = 0; index < textPageElements.length; index += 1) {
    if ((textPageElements[index]?.offsetTop || 0) <= focusLine) pageIndex = index
  }
  const page = textPages.value[pageIndex]
  const element = textPageElements[pageIndex]
  if (!page || !element) return
  textPage.value = pageIndex + 1
  const pageProgress = clampPercent((focusLine - element.offsetTop) / Math.max(1, element.clientHeight))
  const offset = Math.min(page.end, page.start + Math.round((page.end - page.start) * pageProgress))
  readingPercent.value = clampPercent(offset / Math.max(1, textContent.value.length))
  if (readingState.value) readingState.value.txt_offset = offset
  scheduleSaveState()
}

function setTextPageRef(index: number, element: unknown) {
  if (element instanceof HTMLElement) textPageElements[index] = element
  else textPageElements[index] = undefined
}

function textPageSize() {
  const frame = textPageFrame.value
  if (!frame) return null
  const styles = window.getComputedStyle(frame)
  const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
  const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
  const width = frame.clientWidth - horizontalPadding
  const height = frame.clientHeight - verticalPadding
  return width > 0 && height > 0 ? { width, height } : null
}

async function paginateTextContent(offset = 0) {
  if (!textContent.value) {
    textPages.value = []
    return
  }
  await nextTick()
  const measure = textMeasure.value
  const size = textPageSize()
  textPageElements.length = 0
  if (!measure || !size) {
    textPages.value = paginateText(textContent.value)
  } else {
    measure.style.width = `${size.width}px`
    measure.style.height = `${size.height}px`
    textPages.value = paginateText(textContent.value, (content) => {
      measure.textContent = content
      return measure.scrollWidth <= measure.clientWidth + 1
    })
  }
  await nextTick()
  restoreTextPosition(offset)
}

function restoreTextPosition(offset: number) {
  const viewport = textViewport.value
  if (!viewport || !textPages.value.length) return
  const pageIndex = textPages.value.findIndex((page) => offset >= page.start && offset < page.end)
  const index = pageIndex >= 0 ? pageIndex : textPages.value.length - 1
  textPage.value = index + 1
  viewport.scrollTop = textPageElements[index]?.offsetTop || 0
}

function scheduleTextPagination() {
  if (textPaginationFrame !== null) cancelAnimationFrame(textPaginationFrame)
  textPaginationFrame = requestAnimationFrame(() => {
    textPaginationFrame = null
    void paginateTextContent(readingState.value?.txt_offset || 0)
  })
}

function observeTextPageSize() {
  textResizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined' || !textPageFrame.value) return
  textResizeObserver = new ResizeObserver(scheduleTextPagination)
  textResizeObserver.observe(textPageFrame.value)
}

function scheduleSaveState() {
  if (!canRead.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void saveState() }, 800)
}

async function saveState() {
  if (!canRead.value || isSaving.value || !asset.value) return
  isSaving.value = true
  try {
    const localInput = {
      epub_cfi: readingState.value?.epub_cfi || '',
      pdf_page: pdfPage.value,
      txt_offset: readingState.value?.txt_offset || 0,
      reading_percent: readingPercent.value,
      private_notes: privateNotes.value,
      preferences: {
        ...(readingState.value?.preferences || {}),
        bookmarks: bookmarks.value,
        deleted_bookmark_ids: deletedBookmarkIDs.value,
        display: displayPreferences.value,
      },
    }
    const remote = await getBookReadingState(asset.value.id).catch(() => null)
    const saved = await saveBookReadingState(asset.value.id, mergeBookReadingProgress(localInput, remote))
    applyReadingState(saved)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '阅读位置保存失败'
  } finally {
    isSaving.value = false
  }
}

function createBookmarkID() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `bookmark-${Date.now()}`
}

function addBookmark() {
  if (!canRead.value) return
  bookmarks.value = [{
    id: createBookmarkID(),
    label: pageLabel.value || `${Math.round(readingPercent.value * 100)}%`,
    reading_percent: readingPercent.value,
    epub_cfi: readingState.value?.epub_cfi || '',
    pdf_page: asset.value?.format === 'pdf' ? pdfPage.value : undefined,
    txt_offset: asset.value?.format === 'txt' ? readingState.value?.txt_offset || 0 : undefined,
    comic_page: asset.value?.format === 'cbz' || asset.value?.format === 'cbr' ? comicPage.value : undefined,
    created_at: new Date().toISOString(),
  }, ...bookmarks.value]
  void saveState()
}

function removeBookmark(id: string) {
  bookmarks.value = bookmarks.value.filter((bookmark) => bookmark.id !== id)
  if (!deletedBookmarkIDs.value.includes(id)) deletedBookmarkIDs.value = [...deletedBookmarkIDs.value, id]
  void saveState()
}

function searchText() {
  if (asset.value?.format !== 'txt') return
  textSearchMatches.value = findBookTextMatches(textContent.value, textSearchQuery.value)
}

function updateDisplayPreferences(value: BookReaderDisplayPreferences) {
  displayPreferences.value = parseBookReaderDisplayPreferences(value)
  void saveState()
}

function jumpToTextMatch(match: BookTextSearchMatch) {
  if (asset.value?.format !== 'txt') return
  if (readingState.value) readingState.value.txt_offset = match.index
  restoreTextPosition(match.index)
  readingPercent.value = clampPercent(match.index / Math.max(1, textContent.value.length))
  void saveState()
}

function jumpToBookmark(bookmark: BookReaderBookmark) {
  readingPercent.value = bookmark.reading_percent
  if (asset.value?.format === 'epub' && bookmark.epub_cfi && epubRendition) void epubRendition.display(bookmark.epub_cfi)
  else if (asset.value?.format === 'pdf' && bookmark.pdf_page) {
    pdfPage.value = Math.min(Math.max(1, bookmark.pdf_page), pdfPageCount.value)
    void renderPDFPage()
  } else if (asset.value?.format === 'txt') {
    const offset = bookmark.txt_offset || 0
    if (readingState.value) readingState.value.txt_offset = offset
    restoreTextPosition(offset)
  } else if ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && bookmark.comic_page) {
    comicPage.value = Math.min(Math.max(1, bookmark.comic_page), comicPages.value.length)
    scrollToComicPage()
  }
}

function changePdfPage(delta: number) {
  pdfPage.value = Math.min(Math.max(1, pdfPage.value + delta), pdfPageCount.value)
  void renderPDFPage()
}

function jumpToPdfPage(page: number) {
  pdfPage.value = Math.min(Math.max(1, page), pdfPageCount.value)
  void renderPDFPage()
}

function movePrevious() {
  if (asset.value?.format === 'txt') changeTextPage(-1)
  else if (asset.value?.format === 'pdf') changePdfPage(-1)
  else if (asset.value?.format === 'cbz' || asset.value?.format === 'cbr') changeComicPage(-1)
  else moveEpubPage('prev')
}

function moveNext() {
  if (asset.value?.format === 'txt') changeTextPage(1)
  else if (asset.value?.format === 'pdf') changePdfPage(1)
  else if (asset.value?.format === 'cbz' || asset.value?.format === 'cbr') changeComicPage(1)
  else moveEpubPage('next')
}

function setComicPageRef(index: number, element: unknown) {
  comicPageElements[index] = element instanceof HTMLElement ? element : undefined
}

function scrollToComicPage() {
  comicPageElements[comicPage.value - 1]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  readingPercent.value = comicPages.value.length > 1 ? (comicPage.value - 1) / (comicPages.value.length - 1) : 1
  if (readingState.value) {
    readingState.value.preferences = { ...readingState.value.preferences, comic_page: comicPage.value }
  }
  scheduleSaveState()
}

function changeComicPage(delta: number) {
  comicPage.value = Math.min(Math.max(1, comicPage.value + delta), comicPages.value.length)
  scrollToComicPage()
}

function changeTextPage(delta: number) {
  const nextPage = Math.min(Math.max(1, textPage.value + delta), textPages.value.length)
  if (nextPage === textPage.value) return
  textPage.value = nextPage
  textViewport.value?.scrollTo?.({ top: textPageElements[nextPage - 1]?.offsetTop || 0, behavior: 'smooth' })
  readingPercent.value = textPages.value.length > 1 ? (nextPage - 1) / (textPages.value.length - 1) : 1
  if (readingState.value) {
    readingState.value.txt_offset = textPages.value[nextPage - 1]?.start || 0
  }
  scheduleSaveState()
}

function moveEpubPage(direction: 'prev' | 'next') {
  if (!epubRendition) return
  void (direction === 'prev' ? epubRendition.prev() : epubRendition.next())
}

function jumpToEpubTOC(href: string) {
  if (!epubRendition) return
  void epubRendition.display(href)
}

function downloadBook() {
  if (!contentBlob.value || !asset.value) return
  const url = URL.createObjectURL(contentBlob.value)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = asset.value.file_name
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderTextPageHtml(page: TextPage): string {
  const pageAnns = annotations.value
    .filter(
      (a) =>
        a.format === 'txt' &&
        a.txt_offset_start !== undefined &&
        a.txt_offset_end !== undefined &&
        a.txt_offset_start < page.end &&
        a.txt_offset_end > page.start,
    )
    .sort((a, b) => (a.txt_offset_start || 0) - (b.txt_offset_start || 0))

  if (!pageAnns.length) {
    return escapeHtml(page.content)
  }

  let html = ''
  let currentRelOffset = 0

  for (const ann of pageAnns) {
    const annStartRel = Math.max(0, (ann.txt_offset_start || 0) - page.start)
    const annEndRel = Math.min(page.content.length, (ann.txt_offset_end || 0) - page.start)

    if (annStartRel > currentRelOffset) {
      html += escapeHtml(page.content.slice(currentRelOffset, annStartRel))
    }

    if (annEndRel > annStartRel) {
      const highlightedText = page.content.slice(Math.max(currentRelOffset, annStartRel), annEndRel)
      const underlineCls = ann.style === 'underline' ? ' is-underline' : ''
      html += `<mark class="book-highlight book-highlight--${escapeHtml(ann.color)}${underlineCls}" data-annotation-id="${escapeHtml(ann.id)}">${escapeHtml(highlightedText)}</mark>`
      currentRelOffset = Math.max(currentRelOffset, annEndRel)
    }
  }

  if (currentRelOffset < page.content.length) {
    html += escapeHtml(page.content.slice(currentRelOffset))
  }

  return html
}

function getTextOffsetInContainer(container: HTMLElement, node: Node, offset: number): number {
  let charCount = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let current = walker.nextNode()
  while (current) {
    if (current === node) {
      return charCount + offset
    }
    charCount += current.textContent?.length || 0
    current = walker.nextNode()
  }
  return charCount
}

function handleTextClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.book-highlight') as HTMLElement | null
  if (!target) return
  const id = target.getAttribute('data-annotation-id')
  if (!id) return
  const ann = annotations.value.find((a) => a.id === id)
  if (!ann) return
  const rect = target.getBoundingClientRect()
  selectionToolbar.value = {
    x: rect.left + rect.width / 2,
    y: rect.top,
    text: ann.text,
    txtStart: ann.txt_offset_start,
    txtEnd: ann.txt_offset_end,
    existing: ann,
  }
}

function handleTextMouseUp() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return
  const text = sel.toString().trim()
  if (!text) return
  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return

  const startEl = range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement
  if (startEl?.closest('.book-highlight')) {
    return
  }

  let pageIndex = -1
  let pageElement: HTMLElement | null = null
  for (let i = 0; i < textPageElements.length; i++) {
    const el = textPageElements[i]
    if (el && el.contains(range.startContainer)) {
      pageIndex = i
      pageElement = el
      break
    }
  }

  let absStart = 0
  let absEnd = 0

  if (pageIndex >= 0 && pageElement) {
    const page = textPages.value[pageIndex]
    const contentDiv = (pageElement.querySelector('.books-reader__text-page-content') as HTMLElement) || pageElement
    const relOffset = getTextOffsetInContainer(contentDiv, range.startContainer, range.startOffset)
    absStart = page.start + relOffset
    absEnd = absStart + text.length
  } else {
    const idx = textContent.value.indexOf(text)
    absStart = idx >= 0 ? idx : 0
    absEnd = absStart + text.length
  }

  selectionToolbar.value = {
    x: rect.left + rect.width / 2,
    y: rect.top,
    text,
    txtStart: absStart,
    txtEnd: absEnd,
    page: pageIndex >= 0 ? pageIndex + 1 : undefined,
    existing: null,
  }
}

function registerSingleEpubAnnotation(ann: BookAnnotation) {
  if (!epubRendition || !ann.epub_cfi) return
  const renditionAnn = (epubRendition as any).annotations
  if (!renditionAnn) return
  try {
    renditionAnn.add(
      'highlight',
      ann.epub_cfi,
      {},
      () => void handleAnnotationClick(ann),
      `book-highlight book-highlight--${ann.color} ${ann.style === 'underline' ? 'is-underline' : ''}`,
    )
  } catch {}
}

function registerEpubAnnotations() {
  if (!epubRendition) return
  for (const ann of annotations.value) {
    if (ann.format === 'epub' && ann.epub_cfi) {
      registerSingleEpubAnnotation(ann)
    }
  }
}

async function handleAnnotationClick(item: BookAnnotation) {
  if (!item.epub_cfi || !epubBook) return
  try {
    const range = await epubBook.getRange(item.epub_cfi)
    const iframe = epubViewport.value?.querySelector('iframe')
    const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 }
    const rangeRect = range?.getBoundingClientRect()
    selectionToolbar.value = {
      x: rangeRect ? iframeRect.left + rangeRect.left + rangeRect.width / 2 : window.innerWidth / 2,
      y: rangeRect ? iframeRect.top + rangeRect.top : 120,
      text: item.text,
      cfi: item.epub_cfi,
      existing: item,
    }
  } catch {
    selectionToolbar.value = {
      x: window.innerWidth / 2,
      y: 120,
      text: item.text,
      cfi: item.epub_cfi,
      existing: item,
    }
  }
}

function clearSelection() {
  window.getSelection()?.removeAllRanges()
  try {
    epubViewport.value?.querySelector('iframe')?.contentWindow?.getSelection()?.removeAllRanges()
  } catch {}
}

function closeSelectionToolbar() {
  clearSelection()
  selectionToolbar.value = null
}

const currentChapterTitle = computed(() => {
  if (asset.value?.format === 'pdf') {
    return `第 ${pdfPage.value} 页`
  }
  if (asset.value?.format === 'txt') {
    return `第 ${textPage.value} 页`
  }
  return ''
})

async function onToolbarHighlight(color: BookHighlightColor, style: BookHighlightStyle) {
  if (!selectionToolbar.value || !asset.value) return
  const { existing, text, cfi, txtStart, txtEnd, page } = selectionToolbar.value

  try {
    if (existing) {
      const updated = await updateBookAnnotation(existing.id, { color, style })
      const idx = annotations.value.findIndex((a) => a.id === existing.id)
      if (idx >= 0) annotations.value[idx] = updated
      if (asset.value.format === 'epub' && epubRendition && existing.epub_cfi) {
        try {
          (epubRendition as any).annotations?.remove(existing.epub_cfi, 'highlight')
        } catch {}
        registerSingleEpubAnnotation(updated)
      }
    } else {
      const created = await createBookAnnotation(asset.value.id, {
        format: asset.value.format,
        text,
        color,
        style,
        epub_cfi: cfi,
        txt_offset_start: txtStart,
        txt_offset_end: txtEnd,
        pdf_page: page || (asset.value.format === 'pdf' ? pdfPage.value : undefined),
        chapter_title: currentChapterTitle.value || undefined,
      })
      annotations.value.push(created)
      if (asset.value.format === 'epub' && epubRendition && created.epub_cfi) {
        registerSingleEpubAnnotation(created)
      }
    }
  } catch (err) {
    console.error('保存划线高亮失败', err)
  } finally {
    closeSelectionToolbar()
  }
}

async function onToolbarSaveNote(note: string, color: BookHighlightColor, style: BookHighlightStyle) {
  if (!selectionToolbar.value || !asset.value) return
  const { existing, text, cfi, txtStart, txtEnd, page } = selectionToolbar.value

  try {
    if (existing) {
      const updated = await updateBookAnnotation(existing.id, { note, color, style })
      const idx = annotations.value.findIndex((a) => a.id === existing.id)
      if (idx >= 0) annotations.value[idx] = updated
      if (asset.value.format === 'epub' && epubRendition && existing.epub_cfi) {
        try {
          (epubRendition as any).annotations?.remove(existing.epub_cfi, 'highlight')
        } catch {}
        registerSingleEpubAnnotation(updated)
      }
    } else {
      const created = await createBookAnnotation(asset.value.id, {
        format: asset.value.format,
        text,
        note,
        color,
        style,
        epub_cfi: cfi,
        txt_offset_start: txtStart,
        txt_offset_end: txtEnd,
        pdf_page: page || (asset.value.format === 'pdf' ? pdfPage.value : undefined),
        chapter_title: currentChapterTitle.value || undefined,
      })
      annotations.value.push(created)
      if (asset.value.format === 'epub' && epubRendition && created.epub_cfi) {
        registerSingleEpubAnnotation(created)
      }
    }
  } catch (err) {
    console.error('保存批注想法失败', err)
  } finally {
    closeSelectionToolbar()
  }
}

async function onToolbarDelete(id: string) {
  try {
    await deleteBookAnnotation(id)
    const target = annotations.value.find((a) => a.id === id)
    annotations.value = annotations.value.filter((a) => a.id !== id)
    if (asset.value?.format === 'epub' && epubRendition && target?.epub_cfi) {
      try {
        (epubRendition as any).annotations?.remove(target.epub_cfi, 'highlight')
      } catch {}
    }
  } catch (err) {
    console.error('删除高亮划线失败', err)
  } finally {
    closeSelectionToolbar()
  }
}

watch(
  () => route.query.annotationId,
  async (targetAnnotationId) => {
    if (!targetAnnotationId || typeof targetAnnotationId !== 'string') return
    const target = annotations.value.find((a) => a.id === targetAnnotationId)
    if (target) {
      await nextTick()
      await jumpToAnnotation(target)
    }
  },
)

const quoteModalOpen = ref(false)
const activeQuoteAnnotation = ref<BookAnnotation | null>(null)

function handleQuoteAnnotation(annotation: BookAnnotation) {
  activeQuoteAnnotation.value = annotation
  quoteModalOpen.value = true
}

function onQuoteModalSelect(payload: { target: 'blog_post' | 'short_note'; mode: 'append' | 'replace' }) {
  if (!activeQuoteAnnotation.value) return
  draftStagingStore.setPendingQuote({
    sourceType: 'book_annotation',
    annotationId: activeQuoteAnnotation.value.id,
    assetId: activeQuoteAnnotation.value.asset_id,
    bookTitle: asset.value?.title || '书籍摘录',
    bookAuthor: asset.value?.author,
    quoteText: activeQuoteAnnotation.value.text,
    personalNote: activeQuoteAnnotation.value.note || undefined,
    target: payload.target,
    mode: payload.mode,
  })
  quoteModalOpen.value = false
  if (payload.target === 'blog_post') {
    void router.push('/studio/blog/new')
  } else {
    void router.push('/posts/notes/new')
  }
}

async function handleDeleteAnnotation(annotationId: string) {
  try {
    await deleteBookAnnotation(annotationId)
    const target = annotations.value.find((a) => a.id === annotationId)
    annotations.value = annotations.value.filter((a) => a.id !== annotationId)
    if (asset.value?.format === 'epub' && epubRendition && target?.epub_cfi) {
      try {
        (epubRendition as any).annotations?.remove(target.epub_cfi, 'highlight')
      } catch {}
    }
  } catch (err) {
    console.error('删除划线失败', err)
  }
}

async function jumpToAnnotation(annotation: BookAnnotation) {
  if (asset.value?.format === 'epub' && annotation.epub_cfi && epubRendition) {
    await epubRendition.display(annotation.epub_cfi)
  } else if (asset.value?.format === 'txt' && annotation.txt_offset_start !== undefined) {
    restoreTextPosition(annotation.txt_offset_start)
    await nextTick()
    const mark = textViewport.value?.querySelector(`[data-annotation-id="${annotation.id}"]`) as HTMLElement | null
    if (mark) {
      mark.classList.add('book-highlight--pulse')
      setTimeout(() => mark.classList.remove('book-highlight--pulse'), 2000)
    }
  } else if (asset.value?.format === 'pdf' && annotation.pdf_page) {
    pdfPage.value = annotation.pdf_page
    await renderPDFPage()
  }
}

function exportAnnotationsToMarkdown() {
  if (!annotations.value.length) return
  const title = asset.value?.title || '读书笔记'
  const dateStr = new Date().toLocaleDateString('zh-CN')

  let md = `# 《${title}》\n\n`
  md += `导出时间：${dateStr}\n\n`
  md += `共 ${annotations.value.length} 条划线与批注\n\n---\n\n`

  for (const ann of annotations.value) {
    const loc = ann.chapter_title || (ann.pdf_page ? `第 ${ann.pdf_page} 页` : (ann.format === 'txt' ? '正文' : ''))
    if (loc) {
      md += `### ${loc}\n\n`
    }
    md += `> ${ann.text}\n\n`
    if (ann.note) {
      md += `**想法**：${ann.note}\n\n`
    }
    md += `*标注于 ${new Date(ann.created_at).toLocaleString('zh-CN')}*\n\n---\n\n`
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}-划线与批注.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(loadReader)
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  if (textPaginationFrame !== null) cancelAnimationFrame(textPaginationFrame)
  textResizeObserver?.disconnect()
  if (epubRendition) epubRendition.destroy()
  if (epubBook) epubBook.destroy()
  if (pdfLoadingTask) void pdfLoadingTask.destroy()
  for (const page of comicPages.value) URL.revokeObjectURL(page.url)
})
</script>

<style scoped>
.books-reader {
  display: grid;
  gap: 1.25rem;
  padding-top: var(--a-page-start-space);
  --book-reader-surface: var(--a-color-bg);
  --book-reader-text: var(--a-color-fg);
  --book-reader-muted: var(--a-color-muted);
}

.books-reader--theme-dim {
  --book-reader-surface: #f3eee4;
  --book-reader-text: #423a2f;
  --book-reader-muted: #756b5d;
}

.books-reader--theme-night {
  --book-reader-surface: #1f2430;
  --book-reader-text: #e7e9ee;
  --book-reader-muted: #aab2c0;
}

.books-reader__feedback {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.books-reader__feedback--error {
  color: var(--a-color-danger);
}

.books-reader__surface {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
}

.books-reader__text,
.books-reader__epub,
.books-reader__pdf {
  min-height: min(68vh, 720px);
  border: 1px solid var(--a-color-border-soft);
  background: var(--book-reader-surface);
  overflow: hidden;
}

.books-reader__text {
  position: relative;
  overflow: auto;
  max-height: min(78vh, 60rem);
  padding: clamp(0.75rem, 2vw, 1.5rem);
  background: var(--book-reader-surface);
}

.books-reader__text-pages {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
}

.books-reader__text-pages--double {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  max-width: 96rem;
  margin: 0 auto;
}

.books-reader__text-page {
  position: relative;
  box-sizing: border-box;
  width: min(100%, 56rem);
  aspect-ratio: 1 / 1.414;
  padding: clamp(2rem, 5vw, 4.75rem) clamp(1.75rem, 7vw, 6.5rem) 3.25rem;
  background: var(--book-reader-surface);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}

.books-reader__text-page-content {
  height: 100%;
  color: var(--book-reader-text);
  font: inherit;
  font-family: Georgia, "Songti SC", "SimSun", serif;
  font-size: calc(clamp(0.9rem, 1vw, 1.05rem) * var(--book-reader-font-scale, 1));
  line-height: 1.78;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  column-count: 2;
  column-fill: auto;
  column-gap: clamp(1.5rem, 4vw, 3.5rem);
  column-rule: 1px solid var(--a-color-border-soft);
  overflow: hidden;
}

.books-reader__text-page-number {
  position: absolute;
  inset: auto 0 1.1rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.books-reader__text-page--measure {
  position: absolute;
  top: 0;
  left: -10000px;
  visibility: hidden;
  pointer-events: none;
}

.books-reader__epub {
  padding: 1rem;
  background: var(--book-reader-surface);
}

.books-reader__comic {
  display: grid;
  gap: 1rem;
  max-height: min(78vh, 60rem);
  overflow: auto;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--book-reader-surface);
  scroll-behavior: smooth;
}

.books-reader__comic-page {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  margin: 0;
}

.books-reader__comic-page img {
  display: block;
  max-width: min(100%, 64rem);
  height: auto;
  border: 1px solid var(--a-color-border-soft);
}

.books-reader__comic-page figcaption {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

@media (prefers-reduced-motion: reduce) {
  .books-reader__comic {
    scroll-behavior: auto;
  }
}

.books-reader__pdf {
  display: grid;
  place-items: start center;
  overflow: auto;
  padding: 1rem;
  background: var(--book-reader-surface);
}

.books-reader__pdf canvas {
  display: block;
  max-width: 100%;
  height: auto;
  background: var(--book-reader-surface);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}

.books-reader__public-status {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.books-reader__search {
  display: grid;
  gap: 0.45rem;
  max-width: 42rem;
}

.books-reader__search > label {
  color: var(--a-color-muted);
  font-size: 0.85rem;
  font-weight: 500;
}

.books-reader__search-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.books-reader__search-row input {
  min-width: 0;
  flex: 1;
  min-height: 2.25rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--book-reader-surface);
  color: var(--book-reader-text);
}

.books-reader__search-row input:focus-visible,
.books-reader__search-results button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.books-reader__search-status {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.books-reader__search-results {
  display: grid;
  gap: 0.35rem;
  max-height: 12rem;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.books-reader__search-results button {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--book-reader-surface) 92%, var(--book-reader-text));
  color: var(--book-reader-text);
  text-align: left;
  cursor: pointer;
}

.books-reader__bookmarks {
  display: grid;
  gap: 0.5rem;
  max-width: 42rem;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.books-reader__bookmarks summary {
  cursor: pointer;
  font-weight: 500;
}

.books-reader__bookmarks ol {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding-left: 1.25rem;
}

.books-reader__bookmarks li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.books-reader__bookmarks button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.books-reader__bookmarks button:last-child {
  color: var(--a-color-muted);
  font-size: 0.78rem;
}

.books-reader__notes {
  display: grid;
  gap: 0.45rem;
  max-width: 72ch;
}

.books-reader__notes span {
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.books-reader__notes textarea {
  width: 100%;
  resize: vertical;
  min-height: 5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--book-reader-surface);
  color: var(--book-reader-text);
  padding: 0.75rem;
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.6;
  outline: none;
  transition: border-color 0.15s ease;
}

.books-reader__notes textarea:focus {
  border-color: var(--a-color-primary);
}

@media (max-width: 720px) {
  .books-reader__text {
    max-height: none;
    overflow: visible;
    padding-inline: 0;
  }

  .books-reader__text-page {
    width: 100%;
    min-height: 141vw;
    aspect-ratio: auto;
    padding: 2.5rem 9vw 3.25rem;
  }

  .books-reader__text-page-content {
    column-count: 1;
    column-rule: 0;
    font-size: 1rem;
  }
}

/* 高亮划线样式 */
:deep(.book-highlight),
.book-highlight {
  cursor: pointer;
  border-radius: 2px;
  padding: 0 1px;
  transition: opacity 0.15s ease, filter 0.15s ease;
}

:deep(.book-highlight--yellow),
.book-highlight--yellow {
  background-color: color-mix(in srgb, var(--a-color-warning) 30%, transparent);
}

:deep(.book-highlight--green),
.book-highlight--green {
  background-color: color-mix(in srgb, var(--a-color-success) 30%, transparent);
}

:deep(.book-highlight--blue),
.book-highlight--blue {
  background-color: color-mix(in srgb, var(--a-color-primary) 30%, transparent);
}

:deep(.book-highlight--pink),
.book-highlight--pink {
  background-color: color-mix(in srgb, var(--a-color-danger) 30%, transparent);
}

:deep(.book-highlight.is-underline),
.book-highlight.is-underline {
  background-color: transparent !important;
  text-decoration: underline wavy var(--a-color-primary, #6366f1) !important;
  text-underline-offset: 3px !important;
}

:deep(.book-highlight:hover),
.book-highlight:hover {
  filter: brightness(0.92);
}

:deep(.book-highlight--pulse),
.book-highlight--pulse {
  animation: pulse-highlight 2s ease;
}

@keyframes pulse-highlight {
  0%, 100% {
    box-shadow: none;
  }
  30%, 70% {
    box-shadow: 0 0 0 4px var(--a-color-primary);
  }
}
</style>
