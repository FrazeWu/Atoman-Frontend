<template>
  <main class="a-page-md books-reader">
    <PPageHeader title="阅读" mb="0" />
    <BookReaderShell
      :title="asset?.title || '私有电子书'"
      :subtitle="asset ? `${asset.file_name} · ${statusLabel}` : ''"
      :format="formatLabel"
      :progress="readingPercent"
      :page-label="pageLabel"
      :back-to="'/books/library'"
      back-label="返回我的书库"
      :can-prev="canPrev"
      :can-next="canNext"
      :show-pagination="showPagination"
      :show-surface="canRead"
      :toc="epubTOC"
      @previous="movePrevious"
      @next="moveNext"
      @toc-select="jumpToEpubTOC"
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
      <div v-if="asset?.format === 'txt'" ref="textViewport" class="books-reader__text" @scroll="handleTextScroll">
        <div class="books-reader__text-pages">
          <article
            v-for="(page, index) in textPages"
            :key="page.start"
            :ref="element => setTextPageRef(index, element)"
            class="books-reader__text-page"
          >
            <div class="books-reader__text-page-content">{{ page.content }}</div>
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
      <template #footer>
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
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { IconBookmark as Bookmark, IconDownload as Download, IconDeviceFloppy as Save } from '@tabler/icons-vue'
import ePub from 'epubjs'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import BookReaderShell from '@/components/books/BookReaderShell.vue'
import { extractComicPages, type ComicPage } from '@/utils/bookComicArchive'
import { parseBookReaderBookmarks, type BookReaderBookmark } from '@/utils/bookReaderPreferences'
import { paginateText, type TextPage } from '@/utils/textPagination'
import {
  fetchBookAssetContent,
  getBookAsset,
  getBookReadingState,
  saveBookReadingState,
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
const asset = ref<BookPrivateAsset | null>(null)
const readingState = ref<BookReadingState | null>(null)
const contentBlob = ref<Blob | null>(null)
const textContent = ref('')
const textPages = ref<TextPage[]>([])
const textPage = ref(1)
const privateNotes = ref('')
const bookmarks = ref<BookReaderBookmark[]>([])
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
  const viewport = page.getViewport({ scale: 1.35 })
  const canvas = pdfCanvas.value
  const context = canvas.getContext('2d')
  if (!context) return
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
  await page.render({ canvas, canvasContext: context, viewport }).promise
  readingPercent.value = pdfPageCount.value > 0 ? pdfPage.value / pdfPageCount.value : 0
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
  epubRendition.on('relocated', (location: EpubLocation) => {
    const start = location.start
    if (!start) return
    readingPercent.value = clampPercent(start.percentage || 0)
    if (readingState.value) readingState.value.epub_cfi = start.cfi || ''
    scheduleSaveState()
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
  const assetID = String(route.params.assetId || '')
  if (!assetID) {
    errorMessage.value = '私有资源标识无效'
    isLoading.value = false
    return
  }
  try {
    asset.value = await getBookAsset(assetID)
    if (!canRead.value) return
    applyReadingState(await getBookReadingState(assetID))
    contentBlob.value = await fetchBookAssetContent(assetID)
    await nextTick()
    if (asset.value.format === 'txt') await loadText()
    else if (asset.value.format === 'pdf') await loadPDF()
    else if (asset.value.format === 'cbz' || asset.value.format === 'cbr') await loadComic()
    else await loadEPUB()
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
    const saved = await saveBookReadingState(asset.value.id, {
      epub_cfi: readingState.value?.epub_cfi || '',
      pdf_page: pdfPage.value,
      txt_offset: readingState.value?.txt_offset || 0,
      reading_percent: readingPercent.value,
      private_notes: privateNotes.value,
      preferences: { ...(readingState.value?.preferences || {}), bookmarks: bookmarks.value },
    })
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: #ffffff;
  overflow: hidden;
}

.books-reader__text {
  position: relative;
  overflow: auto;
  max-height: min(78vh, 60rem);
  padding: clamp(0.75rem, 2vw, 1.5rem);
  background: #ffffff;
}

.books-reader__text-pages {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
}

.books-reader__text-page {
  position: relative;
  box-sizing: border-box;
  width: min(100%, 56rem);
  aspect-ratio: 1 / 1.414;
  padding: clamp(2rem, 5vw, 4.75rem) clamp(1.75rem, 7vw, 6.5rem) 3.25rem;
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-shadow: none;
}

.books-reader__text-page-content {
  height: 100%;
  color: var(--a-color-fg);
  font: inherit;
  font-family: Georgia, "Songti SC", "SimSun", serif;
  font-size: clamp(0.9rem, 1vw, 1.05rem);
  line-height: 1.78;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  column-count: 2;
  column-fill: auto;
  column-gap: clamp(1.5rem, 4vw, 3.5rem);
  column-rule: 1px solid var(--a-color-border-soft, #e2e8f0);
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
  background: #ffffff;
}

.books-reader__comic {
  display: grid;
  gap: 1rem;
  max-height: min(78vh, 60rem);
  overflow: auto;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: #ffffff;
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
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
  background: #ffffff;
}

.books-reader__pdf canvas {
  display: block;
  max-width: 100%;
  height: auto;
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-shadow: none;
}

.books-reader__public-status {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
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
  font-weight: 600;
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control);
  background: #ffffff;
  color: var(--a-color-fg);
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

</style>
