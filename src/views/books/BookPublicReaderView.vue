<template>
  <main class="a-page-md public-reader">
    <PPageHeader title="公共阅读" mb="0" />
    <BookReaderShell
      :title="asset?.file_name || '公共电子书'"
      :format="formatLabel"
      :progress="readingPercent"
      :page-label="pageLabel"
      toolbar-label="公共正文"
      back-to="/books"
      back-label="返回书籍"
      :can-prev="canPrev"
      :can-next="canNext"
      :show-pagination="showPagination"
      :show-surface="!errorMessage"
      :toc="epubTOC"
      @previous="movePrevious"
      @next="moveNext"
      @toc-select="jumpToEpubTOC"
    >
      <template #actions>
        <PButton type="button" variant="ghost" :disabled="!asset" @click="reportAsset">
          <Flag :size="16" aria-hidden="true" />
          <span>举报正文</span>
        </PButton>
        <PButton type="button" variant="ghost" :disabled="!asset" aria-label="添加书签" title="添加书签" @click="addBookmark">
          <Bookmark :size="16" aria-hidden="true" />
          <span>书签</span>
        </PButton>
      </template>
      <template #status>
        <p v-if="reportMessage" class="public-reader__feedback" aria-live="polite">{{ reportMessage }}</p>
        <p v-if="errorMessage" class="public-reader__feedback public-reader__feedback--error" role="alert">{{ errorMessage }}</p>
        <p v-else-if="isLoading" class="public-reader__feedback" aria-live="polite">正在打开公共正文...</p>
      </template>
      <div v-if="asset?.format === 'txt'" ref="textViewport" class="public-reader__text" @scroll="handleTextScroll"><pre>{{ textContent }}</pre></div>
      <div v-else-if="asset?.format === 'epub'" ref="epubViewport" class="public-reader__epub" />
      <div v-else-if="asset?.format === 'cbz' || asset?.format === 'cbr'" ref="comicViewport" class="public-reader__comic" aria-label="漫画页面">
        <figure v-for="(page, index) in comicPages" :key="page.name" :ref="element => setComicPageRef(index, element)" class="public-reader__comic-page">
          <img :src="page.url" :alt="`${asset?.file_name || '漫画'} 第 ${index + 1} 页`" loading="lazy" />
          <figcaption class="tabular-nums">{{ index + 1 }}</figcaption>
        </figure>
      </div>
      <div v-else class="public-reader__pdf"><canvas ref="pdfCanvas" aria-label="PDF 页面" /></div>
      <template #footer>
        <form v-if="asset?.format === 'txt'" class="public-reader__search" @submit.prevent="searchText">
          <label for="public-book-search">搜索正文</label>
          <div class="public-reader__search-row">
            <input id="public-book-search" v-model="textSearchQuery" type="search" placeholder="输入关键词" autocomplete="off" />
            <PButton type="submit" variant="ghost" aria-label="搜索正文">
              <Search :size="16" aria-hidden="true" />
              <span>搜索</span>
            </PButton>
          </div>
          <p v-if="textSearchQuery" class="public-reader__search-status" aria-live="polite">
            {{ textSearchMatches.length ? `找到 ${textSearchMatches.length} 处匹配` : '没有找到匹配内容' }}
          </p>
          <ol v-if="textSearchMatches.length" class="public-reader__search-results">
            <li v-for="match in textSearchMatches" :key="match.index">
              <button type="button" @click="jumpToTextMatch(match)">{{ match.preview }}</button>
            </li>
          </ol>
        </form>
        <details v-if="bookmarks.length" class="public-reader__bookmarks">
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
import { IconBookmark as Bookmark, IconFlag as Flag, IconSearch as Search } from '@tabler/icons-vue'
import ePub from 'epubjs'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import BookReaderShell from '@/components/books/BookReaderShell.vue'
import { extractComicPages, type ComicPage } from '@/utils/bookComicArchive'
import { findBookTextMatches, type BookTextSearchMatch } from '@/utils/bookTextSearch'
import { getLocalBookReadingProgress, saveLocalBookReadingProgress, type LocalBookReadingProgress } from '@/utils/bookReadingProgress'
import type { BookReaderBookmark } from '@/utils/bookReaderPreferences'
import { fetchPublishedBookAssetContent, getPublishedBookAsset, reportPublishedBookAsset, type BookPublishedAsset } from '@/api/books'

GlobalWorkerOptions.workerSrc = pdfWorker

type EpubBook = ReturnType<typeof ePub>
type EpubRendition = ReturnType<EpubBook['renderTo']>
type EpubTOCSource = { id?: string; href: string; label: string; subitems?: EpubTOCSource[] }
type EpubTOCItem = EpubTOCSource & { depth: number }

const route = useRoute()
const asset = ref<BookPublishedAsset | null>(null)
const textContent = ref('')
const readingPercent = ref(0)
const textPage = ref(1)
const textPageCount = ref(1)
const pdfPage = ref(1)
const pdfPageCount = ref(0)
const comicPage = ref(1)
const comicPages = ref<Array<ComicPage & { url: string }>>([])
const epubTOC = ref<EpubTOCItem[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const reportMessage = ref('')
const bookmarks = ref<BookReaderBookmark[]>([])
const textSearchQuery = ref('')
const textSearchMatches = ref<BookTextSearchMatch[]>([])
const textViewport = ref<HTMLElement | null>(null)
const epubViewport = ref<HTMLElement | null>(null)
const comicViewport = ref<HTMLElement | null>(null)
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const comicPageElements: Array<HTMLElement | undefined> = []
let contentBlob: Blob | null = null
let pdfDocument: PDFDocumentProxy | null = null
let pdfLoadingTask: ReturnType<typeof getDocument> | null = null
let epubBook: EpubBook | null = null
let epubRendition: EpubRendition | null = null
let localProgress: LocalBookReadingProgress | null = null

const formatLabel = computed(() => asset.value?.format.toUpperCase() || '')
const pageLabel = computed(() => {
  if (asset.value?.format === 'txt') return `第 ${textPage.value} / ${textPageCount.value} 页`
  if (asset.value?.format === 'pdf') return `第 ${pdfPage.value} / ${pdfPageCount.value} 页`
  if (asset.value?.format === 'epub') return 'EPUB'
  if ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPages.value.length) return `第 ${comicPage.value} / ${comicPages.value.length} 页`
  return ''
})
const showPagination = computed(() => ['txt', 'pdf', 'epub', 'cbz', 'cbr'].includes(asset.value?.format || ''))
const canPrev = computed(() => asset.value?.format === 'epub' || (asset.value?.format === 'txt' && textPage.value > 1) || (asset.value?.format === 'pdf' && pdfPage.value > 1) || ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPage.value > 1))
const canNext = computed(() => asset.value?.format === 'epub' || (asset.value?.format === 'txt' && textPage.value < textPageCount.value) || (asset.value?.format === 'pdf' && pdfPageCount.value > 0 && pdfPage.value < pdfPageCount.value) || ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPages.value.length > 0 && comicPage.value < comicPages.value.length))

function flattenEpubTOC(items: EpubTOCSource[], depth = 0): EpubTOCItem[] {
  return items.flatMap((item) => [{ ...item, depth }, ...flattenEpubTOC(item.subitems || [], depth + 1)])
}

async function loadText() {
  textContent.value = await contentBlob!.text()
  await nextTick()
  updateTextPageCount()
  if (localProgress) {
    const viewport = textViewport.value
    if (viewport) viewport.scrollTop = localProgress.reading_percent * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    handleTextScroll()
  }
}

async function loadPDF() {
  pdfLoadingTask = getDocument({ data: await contentBlob!.arrayBuffer() })
  pdfDocument = await pdfLoadingTask.promise
  pdfPageCount.value = pdfDocument.numPages
  if (localProgress) pdfPage.value = Math.min(pdfPageCount.value, Math.max(1, Math.round(localProgress.reading_percent * pdfPageCount.value)))
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
  saveLocalBookReadingProgress(asset.value?.id || '', { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
}

async function loadEPUB() {
  epubBook = ePub(await contentBlob!.arrayBuffer())
  await epubBook.ready
  epubTOC.value = flattenEpubTOC(epubBook.navigation.toc as EpubTOCSource[])
  epubRendition = epubBook.renderTo(epubViewport.value!, { width: '100%', height: '100%', flow: 'paginated', manager: 'default', allowScriptedContent: false })
  epubRendition.on('relocated', (location: { start?: { cfi?: string; percentage?: number } }) => {
    readingPercent.value = Math.max(0, Math.min(1, location.start?.percentage || 0))
    saveLocalBookReadingProgress(asset.value?.id || '', {
      reading_percent: readingPercent.value,
      epub_cfi: location.start?.cfi || '',
      bookmarks: bookmarks.value,
    })
  })
  await epubRendition.display(localProgress?.epub_cfi || undefined)
}

async function loadComic() {
  const format = asset.value?.format
  if (format !== 'cbz' && format !== 'cbr') return
  const pages = await extractComicPages(contentBlob!, format)
  comicPages.value = pages.map((page) => ({ ...page, url: URL.createObjectURL(page.blob) }))
  comicPage.value = localProgress ? Math.min(comicPages.value.length, Math.max(1, Math.round(localProgress.reading_percent * Math.max(1, comicPages.value.length - 1)) + 1)) : 1
  await nextTick()
  scrollToComicPage()
}

function reportAsset() {
  if (!asset.value) return
  const reason = window.prompt('请输入举报原因')?.trim()
  if (!reason) return
  void reportPublishedBookAsset(asset.value.id, reason)
    .then(() => { reportMessage.value = '举报已提交，感谢你的反馈' })
    .catch(() => { reportMessage.value = '举报提交失败，请登录后重试' })
}

function handleTextScroll() {
  const viewport = textViewport.value
  if (!viewport) return
  const pageHeight = Math.max(1, viewport.clientHeight)
  textPageCount.value = Math.max(1, Math.ceil(viewport.scrollHeight / pageHeight))
  textPage.value = Math.min(textPageCount.value, Math.floor(viewport.scrollTop / pageHeight) + 1)
  readingPercent.value = Math.max(0, Math.min(1, viewport.scrollTop / Math.max(1, viewport.scrollHeight - viewport.clientHeight)))
  saveLocalBookReadingProgress(asset.value?.id || '', { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
}

function updateTextPageCount() {
  const viewport = textViewport.value
  if (!viewport) return
  textPageCount.value = Math.max(1, Math.ceil(viewport.scrollHeight / Math.max(1, viewport.clientHeight)))
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
  saveLocalBookReadingProgress(asset.value?.id || '', { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
}

function changeComicPage(delta: number) {
  comicPage.value = Math.min(Math.max(1, comicPage.value + delta), comicPages.value.length)
  scrollToComicPage()
}

function changeTextPage(delta: number) {
  const nextPage = Math.min(Math.max(1, textPage.value + delta), textPageCount.value)
  if (nextPage === textPage.value) return
  textPage.value = nextPage
  textViewport.value?.scrollTo?.({ top: (nextPage - 1) * Math.max(1, textViewport.value?.clientHeight || 0), behavior: 'smooth' })
  readingPercent.value = textPageCount.value > 1 ? (nextPage - 1) / (textPageCount.value - 1) : 1
  saveLocalBookReadingProgress(asset.value?.id || '', { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
}

function createBookmarkID() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `bookmark-${Date.now()}`
}

function addBookmark() {
  if (!asset.value) return
  bookmarks.value = [{
    id: createBookmarkID(),
    label: pageLabel.value || `${Math.round(readingPercent.value * 100)}%`,
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    pdf_page: asset.value.format === 'pdf' ? pdfPage.value : undefined,
    comic_page: asset.value.format === 'cbz' || asset.value.format === 'cbr' ? comicPage.value : undefined,
    created_at: new Date().toISOString(),
  }, ...bookmarks.value]
  saveLocalBookReadingProgress(asset.value.id, {
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    bookmarks: bookmarks.value,
  })
}

function removeBookmark(id: string) {
  if (!asset.value) return
  bookmarks.value = bookmarks.value.filter((bookmark) => bookmark.id !== id)
  saveLocalBookReadingProgress(asset.value.id, {
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    bookmarks: bookmarks.value,
  })
}

function searchText() {
  if (asset.value?.format !== 'txt') return
  textSearchMatches.value = findBookTextMatches(textContent.value, textSearchQuery.value)
}

function jumpToTextMatch(match: BookTextSearchMatch) {
  if (asset.value?.format !== 'txt') return
  readingPercent.value = textContent.value.length ? match.index / textContent.value.length : 0
  const viewport = textViewport.value
  if (viewport) viewport.scrollTop = readingPercent.value * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  saveLocalBookReadingProgress(asset.value.id, { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
}

function jumpToBookmark(bookmark: BookReaderBookmark) {
  if (!asset.value) return
  readingPercent.value = bookmark.reading_percent
  if (asset.value.format === 'epub' && bookmark.epub_cfi && epubRendition) void epubRendition.display(bookmark.epub_cfi)
  else if (asset.value.format === 'pdf' && bookmark.pdf_page) {
    pdfPage.value = Math.min(Math.max(1, bookmark.pdf_page), pdfPageCount.value)
    void renderPDFPage()
  } else if (asset.value.format === 'txt') {
    const viewport = textViewport.value
    if (viewport) viewport.scrollTop = bookmark.reading_percent * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  } else if ((asset.value.format === 'cbz' || asset.value.format === 'cbr') && bookmark.comic_page) {
    comicPage.value = Math.min(Math.max(1, bookmark.comic_page), comicPages.value.length)
    scrollToComicPage()
  }
}

function moveEpubPage(direction: 'prev' | 'next') {
  if (!epubRendition) return
  void (direction === 'prev' ? epubRendition.prev() : epubRendition.next())
}

function jumpToEpubTOC(href: string) {
  if (epubRendition) void epubRendition.display(href)
}

onMounted(async () => {
  try {
    const assetID = String(route.params.assetId || '')
    asset.value = await getPublishedBookAsset(assetID)
    localProgress = getLocalBookReadingProgress(assetID)
    readingPercent.value = localProgress?.reading_percent || 0
    bookmarks.value = localProgress?.bookmarks || []
    contentBlob = await fetchPublishedBookAssetContent(assetID)
    await nextTick()
    if (asset.value.format === 'txt') await loadText()
    else if (asset.value.format === 'pdf') await loadPDF()
    else if (asset.value.format === 'cbz' || asset.value.format === 'cbr') await loadComic()
    else await loadEPUB()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '公共正文打开失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (epubRendition) epubRendition.destroy()
  if (epubBook) epubBook.destroy()
  if (pdfLoadingTask) void pdfLoadingTask.destroy()
  for (const page of comicPages.value) URL.revokeObjectURL(page.url)
})
</script>

<style scoped>
.public-reader {
  display: grid;
  gap: 1.25rem;
  padding-top: var(--a-page-start-space);
}

.public-reader__feedback {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.public-reader__feedback--error {
  color: var(--a-color-danger);
}

.public-reader__surface {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
}

.public-reader__text,
.public-reader__epub,
.public-reader__pdf {
  min-height: min(68vh, 720px);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: #ffffff;
}

.public-reader__text {
  overflow: auto;
  padding: clamp(1.25rem, 4vw, 3rem);
  background: #ffffff;
}

.public-reader__text pre {
  max-width: 72ch;
  margin: 0 auto;
  color: var(--a-color-fg);
  font: inherit;
  line-height: 1.85;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.public-reader__epub {
  padding: 1rem;
  background: #ffffff;
}

.public-reader__comic {
  display: grid;
  gap: 1rem;
  max-height: min(78vh, 60rem);
  overflow: auto;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: #ffffff;
  scroll-behavior: smooth;
}

.public-reader__comic-page {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  margin: 0;
}

.public-reader__comic-page img {
  display: block;
  max-width: min(100%, 64rem);
  height: auto;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.public-reader__comic-page figcaption {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.public-reader__pdf {
  display: grid;
  place-items: start center;
  overflow: auto;
  padding: 1rem;
  background: #ffffff;
}

.public-reader__pdf canvas {
  display: block;
  max-width: 100%;
  height: auto;
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-shadow: none;
}

.public-reader__bookmarks {
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  padding-top: 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.public-reader__search {
  display: grid;
  gap: 0.45rem;
  max-width: 42rem;
}

.public-reader__search > label {
  color: var(--a-color-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.public-reader__search-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.public-reader__search-row input {
  min-width: 0;
  flex: 1;
  min-height: 2.25rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control);
  background: #ffffff;
  color: var(--a-color-fg);
}

.public-reader__search-row input:focus-visible,
.public-reader__search-results button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.public-reader__search-status {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.public-reader__search-results {
  display: grid;
  gap: 0.35rem;
  max-height: 12rem;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.public-reader__search-results button {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted, #f8fafc);
  color: var(--a-color-fg);
  text-align: left;
  cursor: pointer;
}

.public-reader__bookmarks ol {
  display: grid;
  gap: 0.4rem;
  margin: 0.75rem 0 0;
  padding-left: 1.25rem;
}

.public-reader__bookmarks li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.public-reader__bookmarks button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.public-reader__bookmarks li button:first-child {
  color: var(--a-color-link, #2563eb);
  text-align: left;
}

@media (prefers-reduced-motion: reduce) {
  .public-reader__comic {
    scroll-behavior: auto;
  }
}

</style>
