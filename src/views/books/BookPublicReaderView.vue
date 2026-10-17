<template>
  <main class="public-reader" :class="[`public-reader--theme-${displayPreferences.theme}`, { 'a-page-md': !source }]" :style="{ '--book-reader-font-scale': displayPreferences.font_scale }">
    <BookReaderShell
      :title="source?.title || asset?.file_name || '公共电子书'"
      :format="formatLabel"
      :progress="readingPercent"
      :page-label="pageLabel"
      :toolbar-label="source ? '固定文件版本' : '公共正文'"
      :back-to="source?.backTo || '/books'"
      back-label="返回书籍"
      :can-prev="canPrev"
      :can-next="canNext"
      :show-pagination="showPagination"
      :show-surface="!errorMessage"
      :toc="epubTOC"
      :show-zoom="asset?.format === 'pdf'"
      :initial-zoom="displayPreferences.zoom_level || 100"
      :show-scroll-mode-toggle="['pdf', 'txt', 'epub'].includes(asset?.format || '')"
      :initial-scroll-mode="displayPreferences.scroll_mode || 'paginated'"
      :initial-panel="source ? '' : undefined"
      @previous="movePrevious"
      @next="moveNext"
      @toc-select="jumpToEpubTOC"
      @zoom-change="handleZoomChange"
      @scroll-mode-change="handleScrollModeChange"
    >
      <template #actions>
        <PButton v-if="source?.annotations !== undefined && ['txt', 'epub', 'pdf'].includes(asset?.format || '')" type="button" variant="ghost" :disabled="!selectionCandidate || isLoading" @pointerdown.prevent @click="annotateCandidate">标注选中文字</PButton>
        <PButton v-if="!source" type="button" variant="ghost" :disabled="!asset" @click="reportAsset">
          <Flag :size="16" aria-hidden="true" />
          <span>举报正文</span>
        </PButton>
        <PButton type="button" variant="ghost" :disabled="!asset || isLoading || bookmarkBusy" aria-label="添加书签" title="添加书签" @click="addBookmark">
          <Bookmark :size="16" aria-hidden="true" />
          <span>书签</span>
        </PButton>
      </template>
      <template #status>
        <p v-if="reportMessage" class="public-reader__feedback" aria-live="polite">{{ reportMessage }}</p>
        <p v-if="annotationMessage" class="public-reader__feedback" role="status">{{ annotationMessage }}</p>
        <p v-if="errorMessage" class="public-reader__feedback public-reader__feedback--error" role="alert">{{ errorMessage }}</p>
        <p v-else-if="isLoading" class="public-reader__feedback" aria-live="polite">正在打开公共正文...</p>
      </template>
      <template #sidebar>
        <BookReaderSidebar
          :total-pages="asset?.format === 'pdf' ? pdfPageCount : 0"
          :current-page="asset?.format === 'pdf' ? pdfPage : 1"
          :toc="epubTOC"
          :bookmarks="bookmarks"
          :annotations="sidebarAnnotations"
          :annotation-editable="source?.annotations !== undefined"
          @select-page="jumpToPdfPage"
          @toc-select="jumpToEpubTOC"
          @bookmark-jump="jumpToBookmark"
          @bookmark-remove="removeBookmark"
          @annotation-jump="jumpToAnnotation"
          @annotation-edit="editAnnotation"
          @annotation-delete="deleteAnnotation"
          @annotation-export="exportAnnotations"
        />
      </template>
      <div v-if="asset?.format === 'txt'" ref="textViewport" class="public-reader__text" @scroll="handleTextScroll" @mouseup="captureSelection(true)" @keyup="captureSelection(true)"><pre ref="textRoot"><template v-for="part in textParts" :key="part.start"><mark v-if="part.mark" :data-mark-id="part.mark.id" :style="highlightStyle(part.mark)" @click="clickTextMark(part.mark)">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></pre></div>
      <div v-else-if="asset?.format === 'epub'" ref="epubViewport" class="public-reader__epub" />
      <div v-else-if="asset?.format === 'cbz' || asset?.format === 'cbr'" ref="comicViewport" class="public-reader__comic" aria-label="漫画页面">
        <figure v-for="(page, index) in comicPages" :key="page.name" :ref="element => setComicPageRef(index, element)" class="public-reader__comic-page">
          <img :src="page.url" :alt="`${asset?.file_name || '漫画'} 第 ${index + 1} 页`" loading="lazy" />
          <figcaption class="tabular-nums">{{ index + 1 }}</figcaption>
        </figure>
      </div>
      <div v-else ref="pdfViewport" class="public-reader__pdf" @mouseup="captureSelection(true)" @keyup="captureSelection(true)">
        <div class="public-reader__pdf-page" :class="{ 'is-selectable': source?.annotations !== undefined }" :style="pdfWidth ? { width: `${pdfWidth}px` } : {}">
          <canvas ref="pdfCanvas" aria-label="PDF 页面" />
          <div v-if="source?.annotations !== undefined" ref="pdfTextRoot" class="textLayer" aria-label="PDF 可选文字" />
          <div class="public-reader__pdf-marks" aria-hidden="true"><template v-for="mark in annotations.filter(item => item.anchor.pdf_page === pdfPage)" :key="mark.id"><span v-for="(rect, index) in mark.anchor.pdf_rects" :key="index" :style="pdfMarkStyle(mark, rect)" /></template></div>
        </div>
      </div>
      <template #settings>
        <BookReaderDisplayControls v-model="displayPreferences" @update:model-value="updateDisplayPreferences" />
      </template>
      <template #tools>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Bookmark, Flag, Search } from 'lucide-vue-next'
import ePub, { EpubCFI, type Contents } from 'epubjs'
import { GlobalWorkerOptions, getDocument, TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import PButton from '@/components/ui/PButton.vue'
import BookReaderDisplayControls from '@/components/books/BookReaderDisplayControls.vue'
import BookReaderShell from '@/components/books/BookReaderShell.vue'
import BookReaderSidebar from '@/components/books/BookReaderSidebar.vue'
import BookReaderThumbnailStrip from '@/components/books/BookReaderThumbnailStrip.vue'
import { useBookReaderStore } from '@/stores/bookReader'
import { extractComicPages, type ComicPage } from '@/utils/bookComicArchive'
import { findBookTextMatches, type BookTextSearchMatch } from '@/utils/bookTextSearch'
import { getLocalBookReadingProgress, saveLocalBookReadingProgress, type LocalBookReadingProgress } from '@/utils/bookReadingProgress'
import { parseBookReaderDisplayPreferences, type BookReaderBookmark, type BookReaderDisplayPreferences, type BookReaderScrollMode } from '@/utils/bookReaderPreferences'
import { fetchPublishedBookAssetContent, getPublishedBookAsset, reportPublishedBookAsset, type BookPublishedAsset } from '@/api/books'
import type { BookReaderSource } from '@/types/bookReaderSource'
import type { ReadingMark, ReadingAnchor } from '@/api/bookReading'
import type { BookAnnotation } from '@/api/books'
import { textSelection, pdfSelection, epubSelection, epubMarkRange, textRange, highlightedText, highlightColors, type HighlightSelection } from '@/utils/bookMarkAnchors'

GlobalWorkerOptions.workerSrc = pdfWorker

type EpubBook = ReturnType<typeof ePub>
type EpubRendition = ReturnType<EpubBook['renderTo']>
type EpubTOCSource = { id?: string; href: string; label: string; subitems?: EpubTOCSource[] }
type EpubTOCItem = EpubTOCSource & { depth: number }

const route = useRoute()
const props = defineProps<{ source?: BookReaderSource }>()
const emit = defineEmits<{ annotate: [selection: HighlightSelection]; 'annotation-edit': [mark: ReadingMark]; 'annotation-delete': [mark: ReadingMark] }>()
const readerStore = useBookReaderStore()
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
const bookmarkBusy = ref(false)
const displayPreferences = ref<BookReaderDisplayPreferences>(parseBookReaderDisplayPreferences(null))
const textSearchQuery = ref('')
const textSearchMatches = ref<BookTextSearchMatch[]>([])
const textViewport = ref<HTMLElement | null>(null)
const textRoot = ref<HTMLElement | null>(null)
const pdfViewport = ref<HTMLElement | null>(null)
const pdfTextRoot = ref<HTMLElement | null>(null)
const pdfWidth = ref(0)
const annotationMessage = ref('')
const selectionCandidate = shallowRef<HighlightSelection>()
const annotations = computed(() => props.source?.annotations || [])
const textParts = computed(() => highlightedText(textContent.value, annotations.value))
const sidebarAnnotations = computed<BookAnnotation[]>(() => annotations.value.map(mark => ({ id: mark.id, asset_id: asset.value?.id || '', format: asset.value?.format || '', text: mark.quote, note: mark.note, color: mark.color as BookAnnotation['color'], style: mark.style as BookAnnotation['style'], created_at: mark.created_at, updated_at: mark.created_at, pdf_page: mark.anchor.pdf_page, epub_cfi: mark.anchor.epub_start_cfi, txt_offset_start: mark.anchor.txt_offset_start, txt_offset_end: mark.anchor.txt_offset_end })))
const epubViewport = ref<HTMLElement | null>(null)
const comicViewport = ref<HTMLElement | null>(null)
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const comicPageElements: Array<HTMLElement | undefined> = []
let contentBlob: Blob | null = null
let pdfDocument: PDFDocumentProxy | null = null
let pdfLoadingTask: ReturnType<typeof getDocument> | null = null
let epubBook: EpubBook | null = null
let epubRendition: EpubRendition | null = null
let epubNavigating = false
let localProgress: LocalBookReadingProgress | null = null
let disposed = false
let pdfRenderTask: RenderTask | undefined
let pdfTextTask: TextLayer | undefined
const epubPainted: { cfi: string; type: string }[] = []
let pdfRenderGeneration = 0
let lastTextScrollTop = 0
let epubPaintGeneration = 0
function progressKey() { return props.source?.progressKey || asset.value?.id || '' }
watch(() => props.source?.bookmarks, value => { if (value) bookmarks.value = value })
watch(() => props.source?.annotations, (value, previous) => {
  void paintEpubAnnotations()
  if (value !== undefined && previous === undefined && asset.value?.format === 'pdf' && !isLoading.value) void renderPDFPage()
}, { flush: 'post' })

function highlightStyle(mark: ReadingMark) {
  const color = highlightColors[mark.color] || highlightColors.yellow!
  return { color: 'inherit', backgroundColor: mark.style === 'underline' ? 'transparent' : `${color}66`, textDecoration: mark.style === 'underline' ? `underline ${color} 2px` : 'none' }
}
function pdfMarkStyle(mark: ReadingMark, rect: NonNullable<ReadingAnchor['pdf_rects']>[number]) {
  const color = highlightColors[mark.color] || highlightColors.yellow!
  return { left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, backgroundColor: mark.style === 'underline' ? 'transparent' : `${color}66`, borderBottom: mark.style === 'underline' ? `2px solid ${color}` : 'none' }
}
function captureSelection(open = false) {
  if (disposed || props.source?.annotations === undefined || isLoading.value) return
  const selection = window.getSelection()
  const candidate = asset.value?.format === 'txt' && textRoot.value ? textSelection(textRoot.value, selection) : asset.value?.format === 'pdf' && pdfTextRoot.value ? pdfSelection(pdfTextRoot.value, pdfPage.value, selection) : null
  selectionCandidate.value = candidate || undefined
  if (open && candidate) annotateCandidate()
}
function annotateCandidate() {
  if (!selectionCandidate.value) return
  if (new TextEncoder().encode(selectionCandidate.value.quote).length > 50000) { annotationMessage.value = '选中文字过长，请选择较短的段落。'; return }
  emit('annotate', selectionCandidate.value)
  selectionCandidate.value = undefined
}
function selectionChanged() { if (asset.value?.format !== 'epub') captureSelection() }
function clickTextMark(mark: ReadingMark) { if (window.getSelection()?.isCollapsed !== false) emit('annotation-edit', mark) }
function editAnnotation(item: BookAnnotation) { const mark = annotations.value.find(mark => mark.id === item.id); if (mark) emit('annotation-edit', mark) }
function deleteAnnotation(id: string) { const mark = annotations.value.find(mark => mark.id === id); if (mark) emit('annotation-delete', mark) }
function jumpToAnnotation(item: BookAnnotation) {
  const mark = annotations.value.find(mark => mark.id === item.id)
  if (!mark) return
  if (asset.value?.format === 'txt') { scrollToTextOffset(mark.anchor.txt_offset_start || 0); handleTextScroll() }
  else if (asset.value?.format === 'pdf' && mark.anchor.pdf_page) jumpToPdfPage(mark.anchor.pdf_page)
  else if (asset.value?.format === 'epub' && mark.anchor.epub_start_cfi && epubRendition) { epubNavigating = true; void epubRendition.display(mark.anchor.epub_start_cfi) }
}
function exportAnnotations() {
  const text = annotations.value.map(mark => `> ${mark.quote.replaceAll('\n', '\n> ')}\n\n${mark.note}\n`).join('\n---\n\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${props.source?.title || '图书'}-划线与批注.md`
  link.click()
  URL.revokeObjectURL(url)
}
async function paintEpubAnnotations() {
  if (!epubRendition || !epubBook || !epubRendition.annotations) return
  const current = ++epubPaintGeneration
  for (const painted of epubPainted.splice(0)) epubRendition.annotations.remove(painted.cfi, painted.type)
  const keys = new Set<string>()
  for (const mark of annotations.value) {
    if (!mark.anchor.epub_start_cfi || !mark.anchor.epub_end_cfi) continue
    try {
      const start = await epubBook.getRange(mark.anchor.epub_start_cfi)
      if (disposed || current !== epubPaintGeneration) return
      const range = epubMarkRange(mark.anchor, start.startContainer.ownerDocument!)
      const cfi = new EpubCFI(range, new EpubCFI(mark.anchor.epub_start_cfi).base).toString()
      const type = mark.style === 'underline' ? 'underline' : 'highlight'
      if (keys.has(type + cfi)) continue
      keys.add(type + cfi)
      const color = highlightColors[mark.color] || highlightColors.yellow!
      epubRendition.annotations.add(type, cfi, { id: mark.id }, () => emit('annotation-edit', mark), 'revision-highlight', { fill: color, 'fill-opacity': '0.3', stroke: color, 'stroke-opacity': '1', 'stroke-width': '2' })
      epubPainted.push({ cfi, type })
    } catch { if (!disposed) annotationMessage.value = '部分划线无法定位，请从批注列表查看原文与笔记。' }
  }
}

function textOffset() {
  const viewport = textViewport.value
  const root = textRoot.value
  if (!viewport || !root || !textContent.value.length) return 0
  const range = document.createRange()
  if (typeof range.getBoundingClientRect !== 'function') return Math.round(readingPercent.value * textContent.value.length)
  const top = viewport.getBoundingClientRect().top + parseFloat(getComputedStyle(viewport).paddingTop)
  let low = 0
  let high = textContent.value.length
  // TXT 偏移按 UTF-16 文本位置记录，不用随窗口宽度变化的页码定位。
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const point = textRange(root, mid, Math.min(mid + 1, textContent.value.length))
    if (!point) return low
    if (point.getBoundingClientRect().bottom < top) low = mid + 1
    else high = mid
  }
  return low
}
function scrollToTextOffset(offset: number) {
  const viewport = textViewport.value
  const root = textRoot.value
  if (!viewport || !root) return
  const range = textRange(root, Math.min(offset, textContent.value.length), Math.min(offset + 1, textContent.value.length))
  if (!range) return
  if (typeof range.getBoundingClientRect !== 'function') {
    viewport.scrollTop = offset / Math.max(1, textContent.value.length) * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    return
  }
  viewport.scrollTop += range.getBoundingClientRect().top - viewport.getBoundingClientRect().top - parseFloat(getComputedStyle(viewport).paddingTop)
}
function notifyPosition() {
  if (disposed || isLoading.value) return
  const format = asset.value?.format
  props.source?.onPosition?.({ current_percent: readingPercent.value, epub_cfi: format === 'epub' ? localProgress?.epub_cfi || '' : '', pdf_page: format === 'pdf' ? pdfPage.value : format === 'cbz' || format === 'cbr' ? comicPage.value : 0, txt_offset: format === 'txt' ? textOffset() : 0 })
}

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
    if (props.source?.initialPosition) scrollToTextOffset(props.source.initialPosition.txt_offset)
    else if (viewport) viewport.scrollTop = localProgress.reading_percent * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    lastTextScrollTop = viewport?.scrollTop || 0
    handleTextScroll()
  }
}

async function loadPDF() {
  pdfLoadingTask = getDocument({ data: await contentBlob!.arrayBuffer() })
  pdfDocument = await pdfLoadingTask.promise
  if (disposed) return
  pdfPageCount.value = pdfDocument.numPages
  if (localProgress) pdfPage.value = Math.min(pdfPageCount.value, Math.max(1, Math.round(localProgress.reading_percent * pdfPageCount.value)))
  if (props.source?.initialPosition?.pdf_page) pdfPage.value = Math.min(pdfPageCount.value, props.source.initialPosition.pdf_page)
  await renderPDFPage()
}

async function renderPDFPage() {
  if (!pdfDocument || !pdfCanvas.value) return
  const current = ++pdfRenderGeneration
  const previous = pdfRenderTask
  previous?.cancel()
  pdfTextTask?.cancel()
  pdfTextRoot.value?.replaceChildren()
  selectionCandidate.value = undefined
  try {
    await previous?.promise.catch(() => undefined)
    if (disposed || current !== pdfRenderGeneration) return
    const page = await pdfDocument.getPage(pdfPage.value)
    if (disposed || current !== pdfRenderGeneration) return
    const zoomFactor = (displayPreferences.value.zoom_level || 100) / 100
    let baseScale = 1.35
    if (props.source?.annotations !== undefined && pdfViewport.value?.clientWidth) baseScale = Math.min(baseScale, Math.max(1, pdfViewport.value.clientWidth - 32) / page.getViewport({ scale: 1 }).width)
    const viewport = page.getViewport({ scale: baseScale * zoomFactor })
    pdfWidth.value = viewport.width
    const canvas = pdfCanvas.value
    const context = canvas.getContext('2d')
    if (!context) return
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
    pdfRenderTask = page.render({ canvas, canvasContext: context, viewport })
    await pdfRenderTask.promise
    if (disposed || current !== pdfRenderGeneration) return
    if (pdfTextRoot.value) {
      annotationMessage.value = ''
      try {
        const content = await page.getTextContent()
        if (disposed || current !== pdfRenderGeneration) return
        if (!content.items.some(item => 'str' in item && item.str.trim())) annotationMessage.value = '当前页没有可选文字，扫描版 PDF 暂不支持选字划线。'
        pdfTextRoot.value.style.setProperty('--total-scale-factor', String(viewport.scale * (viewport.userUnit || 1)))
        pdfTextTask = new TextLayer({ textContentSource: content, container: pdfTextRoot.value, viewport })
        await pdfTextTask.render()
      } catch { if (!disposed && current === pdfRenderGeneration) annotationMessage.value = '文字层暂不可用，仍可阅读；请重新载入后再尝试选字划线。' }
    }
    if (disposed || current !== pdfRenderGeneration) return
    readingPercent.value = pdfPageCount.value > 0 ? pdfPage.value / pdfPageCount.value : 0
    if (!props.source) readerStore.updateProgress(pdfPage.value, pdfPageCount.value, `第 ${pdfPage.value} 页`)
    saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
    notifyPosition()
  } catch { if (!disposed && current === pdfRenderGeneration) errorMessage.value = 'PDF 页面显示失败，请重新载入文件。' }
}

function handleZoomChange(newZoom: number) {
  displayPreferences.value = { ...displayPreferences.value, zoom_level: newZoom }
  if (asset.value?.format === 'pdf') {
    void renderPDFPage()
  }
  if (asset.value) {
    saveLocalBookReadingProgress(progressKey(), {
      reading_percent: readingPercent.value,
      epub_cfi: localProgress?.epub_cfi || '',
      bookmarks: bookmarks.value,
      display: displayPreferences.value,
    })
  }
}

function handleScrollModeChange(newMode: BookReaderScrollMode) {
  displayPreferences.value = { ...displayPreferences.value, scroll_mode: newMode }
  if (asset.value) {
    saveLocalBookReadingProgress(progressKey(), {
      reading_percent: readingPercent.value,
      epub_cfi: localProgress?.epub_cfi || '',
      bookmarks: bookmarks.value,
      display: displayPreferences.value,
    })
  }
}

async function loadEPUB() {
  epubBook = ePub(await contentBlob!.arrayBuffer())
  await epubBook.ready
  if (disposed) return
  epubTOC.value = flattenEpubTOC(epubBook.navigation.toc as EpubTOCSource[])
  epubRendition = epubBook.renderTo(epubViewport.value!, { width: '100%', height: '100%', flow: 'paginated', manager: 'default', allowScriptedContent: false })
  epubRendition.on('selected', (cfi: string, contents: Contents) => {
    if (disposed || props.source?.annotations === undefined) return
    try {
      selectionCandidate.value = epubSelection(cfi, contents.range(cfi)) || undefined
      annotateCandidate()
    } catch { annotationMessage.value = '选区无法定位，请重新选择同一章节内的文字。' }
  })
  void paintEpubAnnotations()
  for (const event of ['click', 'keydown', 'touchstart']) epubRendition.on(event, () => { epubNavigating = true })
  // 百分比依赖位置索引；在后台生成，避免阻塞正文首次显示。
  if (props.source?.onPosition) void epubBook.locations.generate(1600).then(() => {
    if (!disposed && localProgress?.epub_cfi && epubBook) readingPercent.value = epubBook.locations.percentageFromCfi(localProgress.epub_cfi)
  }).catch(() => { /* 即使索引生成失败，仍用精确 CFI 恢复位置。 */ })
  epubRendition.on('relocated', (location: { start?: { cfi?: string; percentage?: number } }) => {
    const moved = localProgress?.epub_cfi !== location.start?.cfi
    if (!props.source?.onPosition || epubBook?.locations.length()) readingPercent.value = Math.max(0, Math.min(1, location.start?.percentage || 0))
    saveLocalBookReadingProgress(progressKey(), {
      reading_percent: readingPercent.value,
      epub_cfi: location.start?.cfi || '',
      bookmarks: bookmarks.value,
    })
    localProgress = getLocalBookReadingProgress(progressKey())
    if (epubNavigating && moved && localProgress?.epub_cfi) notifyPosition()
    epubNavigating = false
  })
  await epubRendition.display(localProgress?.epub_cfi || undefined)
}

async function loadComic() {
  const format = asset.value?.format
  if (format !== 'cbz' && format !== 'cbr') return
  const pages = await extractComicPages(contentBlob!, format)
  if (disposed) return
  comicPages.value = pages.map((page) => ({ ...page, url: URL.createObjectURL(page.blob) }))
  comicPage.value = localProgress ? Math.min(comicPages.value.length, Math.max(1, Math.round(localProgress.reading_percent * Math.max(1, comicPages.value.length - 1)) + 1)) : 1
  if (props.source?.initialPosition?.pdf_page) comicPage.value = Math.min(comicPages.value.length, props.source.initialPosition.pdf_page)
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
  const moved = Math.abs(viewport.scrollTop - lastTextScrollTop) > .5
  lastTextScrollTop = viewport.scrollTop
  const pageHeight = Math.max(1, viewport.clientHeight)
  textPageCount.value = Math.max(1, Math.ceil(viewport.scrollHeight / pageHeight))
  textPage.value = Math.min(textPageCount.value, Math.floor(viewport.scrollTop / pageHeight) + 1)
  readingPercent.value = Math.max(0, Math.min(1, viewport.scrollTop / Math.max(1, viewport.scrollHeight - viewport.clientHeight)))
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
  if (moved) notifyPosition()
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
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
  notifyPosition()
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
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
}

function createBookmarkID() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `bookmark-${Date.now()}`
}

async function addBookmark() {
  if (!asset.value) return
  const bookmark: BookReaderBookmark = {
    id: createBookmarkID(),
    label: pageLabel.value || `${Math.round(readingPercent.value * 100)}%`,
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    pdf_page: asset.value.format === 'pdf' ? pdfPage.value : undefined,
    comic_page: asset.value.format === 'cbz' || asset.value.format === 'cbr' ? comicPage.value : undefined,
    txt_offset: asset.value.format === 'txt' ? textOffset() : undefined,
    created_at: new Date().toISOString(),
  }
  if (props.source?.addBookmark) {
    bookmarkBusy.value = true
    try { const result = await props.source.addBookmark(bookmark); if (!disposed) { bookmarks.value = result; reportMessage.value = '' } }
    catch { reportMessage.value = '书签未保存到云端，请重试。' }
    finally { bookmarkBusy.value = false }
    return
  }
  bookmarks.value = [bookmark, ...bookmarks.value]
  saveLocalBookReadingProgress(progressKey(), {
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    bookmarks: bookmarks.value,
  })
}

async function removeBookmark(id: string) {
  if (!asset.value) return
  if (props.source?.removeBookmark) {
    if (bookmarkBusy.value) return
    bookmarkBusy.value = true
    try { const result = await props.source.removeBookmark(id); if (!disposed) { bookmarks.value = result; reportMessage.value = '' } }
    catch { reportMessage.value = '书签未从云端删除，请重试。' }
    finally { bookmarkBusy.value = false }
    return
  }
  bookmarks.value = bookmarks.value.filter((bookmark) => bookmark.id !== id)
  saveLocalBookReadingProgress(progressKey(), {
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    bookmarks: bookmarks.value,
  })
}

function searchText() {
  if (asset.value?.format !== 'txt') return
  textSearchMatches.value = findBookTextMatches(textContent.value, textSearchQuery.value)
}

function updateDisplayPreferences(value: BookReaderDisplayPreferences) {
  displayPreferences.value = parseBookReaderDisplayPreferences(value)
  if (!asset.value) return
  saveLocalBookReadingProgress(progressKey(), {
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    bookmarks: bookmarks.value,
    display: displayPreferences.value,
  })
}

function jumpToTextMatch(match: BookTextSearchMatch) {
  if (asset.value?.format !== 'txt') return
  readingPercent.value = textContent.value.length ? match.index / textContent.value.length : 0
  scrollToTextOffset(match.index)
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value })
  handleTextScroll()
}

function jumpToBookmark(bookmark: BookReaderBookmark) {
  if (!asset.value) return
  readingPercent.value = bookmark.reading_percent
  if (asset.value.format === 'epub' && bookmark.epub_cfi && epubRendition) { epubNavigating = true; void epubRendition.display(bookmark.epub_cfi) }
  else if (asset.value.format === 'pdf' && bookmark.pdf_page) {
    pdfPage.value = Math.min(Math.max(1, bookmark.pdf_page), pdfPageCount.value)
    void renderPDFPage()
  } else if (asset.value.format === 'txt') {
    const viewport = textViewport.value
    if (bookmark.txt_offset !== undefined) scrollToTextOffset(bookmark.txt_offset)
    else if (viewport) viewport.scrollTop = bookmark.reading_percent * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    handleTextScroll()
  } else if ((asset.value.format === 'cbz' || asset.value.format === 'cbr') && bookmark.comic_page) {
    comicPage.value = Math.min(Math.max(1, bookmark.comic_page), comicPages.value.length)
    scrollToComicPage()
  }
}

function moveEpubPage(direction: 'prev' | 'next') {
  if (!epubRendition) return
  epubNavigating = true
  void (direction === 'prev' ? epubRendition.prev() : epubRendition.next())
}

function jumpToEpubTOC(href: string) {
  if (epubRendition) { epubNavigating = true; void epubRendition.display(href) }
}

onMounted(async () => {
  document.addEventListener('selectionchange', selectionChanged)
  try {
    const assetID = String(route.params.assetId || '')
    asset.value = props.source?.asset || await getPublishedBookAsset(assetID)
    if (disposed) return
    localProgress = getLocalBookReadingProgress(progressKey())
    if (props.source?.initialPosition) {
      const position = props.source.initialPosition
      localProgress = { reading_percent: position.current_percent, epub_cfi: position.epub_cfi, bookmarks: [], display: localProgress?.display || parseBookReaderDisplayPreferences(null), updated_at: new Date().toISOString() }
    }
    readingPercent.value = localProgress?.reading_percent || 0
    bookmarks.value = props.source?.bookmarks ?? localProgress?.bookmarks ?? []
    displayPreferences.value = localProgress?.display || parseBookReaderDisplayPreferences(null)
    contentBlob = props.source ? await props.source.loadContent() : await fetchPublishedBookAssetContent(assetID)
    if (disposed) return
    await nextTick()
    if (asset.value.format === 'txt') await loadText()
    else if (asset.value.format === 'pdf') await loadPDF()
    else if (asset.value.format === 'cbz' || asset.value.format === 'cbr') await loadComic()
    else await loadEPUB()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '公共正文打开失败，请稍后重试'
  } finally {
    isLoading.value = false
    if (!disposed && !errorMessage.value) props.source?.onReady?.()
  }
})

onBeforeUnmount(() => {
  disposed = true
  document.removeEventListener('selectionchange', selectionChanged)
  epubPaintGeneration++
  pdfRenderGeneration++
  pdfRenderTask?.cancel()
  pdfTextTask?.cancel()
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
  --book-reader-surface: var(--a-color-bg);
  --book-reader-text: var(--a-color-fg);
  --book-reader-muted: var(--a-color-muted);
}

.public-reader--theme-dim {
  --book-reader-surface: #f3eee4;
  --book-reader-text: #423a2f;
  --book-reader-muted: #756b5d;
}

.public-reader--theme-night {
  --book-reader-surface: #1f2430;
  --book-reader-text: #e7e9ee;
  --book-reader-muted: #aab2c0;
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
  border: 1px solid var(--a-color-border-soft);
  background: var(--book-reader-surface);
}

.public-reader__text {
  height: min(68vh, 720px);
  overflow: auto;
  padding: clamp(1.25rem, 4vw, 3rem);
  background: var(--book-reader-surface);
}

.public-reader__text pre {
  max-width: 72ch;
  margin: 0 auto;
  color: var(--book-reader-text);
  font: inherit;
  font-size: calc(1rem * var(--book-reader-font-scale, 1));
  line-height: 1.85;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.public-reader__epub {
  height: min(68vh, 720px);
  padding: 1rem;
  background: var(--book-reader-surface);
}

.public-reader__comic {
  display: grid;
  gap: 1rem;
  max-height: min(78vh, 60rem);
  overflow: auto;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--book-reader-surface);
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
  border: 1px solid var(--a-color-border-soft);
}

.public-reader__comic-page figcaption {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.public-reader__pdf {
  display: block;
  min-width: 0;
  overflow: auto;
  padding: 1rem;
  background: var(--book-reader-surface);
}
.public-reader__pdf-page { position: relative; max-width: 100%; margin-inline: auto; }
.public-reader__pdf-page.is-selectable { max-width: none; }
.public-reader__pdf-page.is-selectable canvas { max-width: none; border: 0; }
.public-reader__pdf-marks { position: absolute; inset: 0; pointer-events: none; }
.public-reader__pdf-marks span { position: absolute; box-sizing: border-box; }
.public-reader__text mark { font: inherit; cursor: pointer; }

.public-reader__pdf canvas {
  display: block;
  max-width: 100%;
  height: auto;
  background: var(--book-reader-surface);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}

.public-reader__bookmarks {
  border-top: 1px solid var(--a-color-border-soft);
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
  font-weight: 500;
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
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--book-reader-surface);
  color: var(--book-reader-text);
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
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--book-reader-surface) 92%, var(--book-reader-text));
  color: var(--book-reader-text);
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
  color: var(--a-color-primary);
  text-align: left;
}

@media (prefers-reduced-motion: reduce) {
  .public-reader__comic {
    scroll-behavior: auto;
  }
}

</style>
