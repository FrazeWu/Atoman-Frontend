<!-- 固定修订阅读器与云同步容器共用的正文渲染组件。 -->
<template>
  <main
    class="public-reader"
    :class="[
      `public-reader--theme-${displayPreferences.theme}`,
      `public-reader--font-${displayPreferences.font_family || 'serif'}`,
      { 'a-page-xl': !source }
    ]"
    :style="{ '--book-reader-font-scale': displayPreferences.font_scale }"
  >
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
      :initial-scroll-mode="displayPreferences.scroll_mode || 'continuous'"
      :initial-panel="source ? '' : undefined"
      @previous="movePrevious"
      @next="moveNext"
      @toc-select="jumpToEpubTOC"
      @zoom-change="handleZoomChange"
      @scroll-mode-change="handleScrollModeChange"
    >
      <template #actions>
        <PButton v-if="source?.annotations !== undefined && ['txt', 'epub', 'pdf'].includes(asset?.format || '')" type="button" variant="ghost" :disabled="!selectionCandidate || isLoading" @pointerdown.prevent @click="annotateCandidate">标注选中文字</PButton>
        <PButton v-if="source?.supportsChapterNotes" type="button" variant="ghost" :disabled="isLoading" aria-label="记录当前位置笔记" @click="createChapterNote">章节笔记</PButton>
        <PButton type="button" variant="ghost" :disabled="!asset || isLoading || bookmarkBusy" aria-label="添加书签" title="添加书签" @click="addBookmark">
          <Bookmark :size="16" aria-hidden="true" />
          <span>书签</span>
        </PButton>
      </template>
      <template #status>
        <p v-if="annotationMessage" class="public-reader__feedback" role="status">{{ annotationMessage }}</p>
        <p v-if="errorMessage" class="public-reader__feedback public-reader__feedback--error" role="alert">{{ errorMessage }}</p>
        <p v-else-if="isLoading" class="public-reader__feedback" aria-live="polite">正在打开公共正文...</p>
      </template>
      <template #sidebar>
        <BookReaderSidebar
          :total-pages="asset?.format === 'pdf' ? pdfPageCount : ((asset?.format === 'cbz' || asset?.format === 'cbr') ? comicPages.length : 0)"
          :current-page="asset?.format === 'pdf' ? pdfPage : ((asset?.format === 'cbz' || asset?.format === 'cbr') ? comicPage : 1)"
          :toc="epubTOC"
          :bookmarks="bookmarks"
          :annotations="sidebarAnnotations"
          :annotation-editable="source?.annotations !== undefined"
          @select-page="(page: number) => handleSelectPage(page)"
          @toc-select="jumpToEpubTOC"
          @bookmark-jump="jumpToBookmark"
          @bookmark-remove="removeBookmark"
          @annotation-jump="jumpToAnnotation"
          @annotation-edit="editAnnotation"
          @annotation-delete="deleteAnnotation"
          @annotation-export="exportAnnotations"
        />
      </template>
      <div v-if="asset?.format === 'txt'" ref="textViewport" class="public-reader__text" :class="{ 'public-reader__text--paginated': displayPreferences.scroll_mode === 'paginated' }" tabindex="0" @wheel="handleTextWheel" @keydown="handleTextKeydown" @scroll="handleTextScroll" @mouseup="captureSelection(true)" @keyup="captureSelection(true)"><pre ref="textRoot"><template v-for="part in textParts" :key="part.start"><mark v-if="part.mark" :data-mark-id="part.mark.id" :style="highlightStyle(part.mark)" style="cursor: pointer;" @click="clickTextMark(part.mark, $event)">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></pre></div>
      <div v-else-if="asset?.format === 'epub'" ref="epubViewport" class="public-reader__epub" @wheel.passive="markEpubActivity" @touchstart.passive="markEpubActivity" @keydown="markEpubActivity">
        <BookReaderSkeleton v-if="isEngineLoading" format="epub" />
        <div ref="epubHost" class="public-reader__epub-renderer" />
      </div>
      <div v-else-if="asset?.format === 'cbz' || asset?.format === 'cbr'" ref="comicViewport" class="public-reader__comic" aria-label="漫画页面">
        <figure v-for="(page, index) in comicPages" :key="page.name" :ref="element => setComicPageRef(index, element)" class="public-reader__comic-page">
          <img :src="page.url" :alt="`${asset?.file_name || '漫画'} 第 ${index + 1} 页`" loading="lazy" />
          <figcaption class="tabular-nums">{{ index + 1 }}</figcaption>
        </figure>
      </div>
      <div v-else ref="pdfViewport" class="public-reader__pdf" :class="{ 'public-reader__pdf--continuous': displayPreferences.scroll_mode === 'continuous' }" @mouseup="captureSelection(true)" @keyup="captureSelection(true)">
        <BookReaderSkeleton v-if="isEngineLoading" format="pdf" />
        <BookPdfContinuousView v-if="displayPreferences.scroll_mode === 'continuous' && pdfDocumentRef" ref="pdfContinuousReader" :document="pdfDocumentRef" :initial-page="pdfPage" :initial-offset="pdfOffset" :zoom="displayPreferences.zoom_level || 100" :annotations="annotations" @position-change="onContinuousPdfPositionChange" />
        <div v-else v-show="!isEngineLoading" class="public-reader__pdf-page" :class="{ 'is-selectable': source?.annotations !== undefined }" :style="pdfWidth ? { width: `${pdfWidth}px` } : {}">
          <canvas ref="pdfCanvas" aria-label="PDF 页面" />
          <div v-if="source?.annotations !== undefined" ref="pdfTextRoot" class="textLayer" aria-label="PDF 可选文字" />
          <div class="public-reader__pdf-marks"><template v-for="mark in annotations.filter(item => item.anchor.pdf_page === pdfPage)" :key="mark.id"><span v-for="(rect, index) in mark.anchor.pdf_rects" :key="index" :style="pdfMarkStyle(mark, rect)" style="pointer-events: auto; cursor: pointer;" @click.stop="clickTextMark(mark, $event)" /></template></div>
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

    <BookSelectionToolbar
      v-if="selectionToolbar"
      :position="{ x: selectionToolbar.x, y: selectionToolbar.y }"
      :selected-text="selectionToolbar.text"
      :existing-annotation="selectionToolbar.existing ? {
        id: selectionToolbar.existing.id,
        asset_id: asset?.id || '',
        format: asset?.format || '',
        text: selectionToolbar.existing.quote,
        color: (selectionToolbar.existing.color as any) || 'yellow',
        style: (selectionToolbar.existing.style as any) || 'highlight',
        note: selectionToolbar.existing.note || '',
        created_at: selectionToolbar.existing.created_at || '',
        updated_at: (selectionToolbar.existing as any).updated_at || selectionToolbar.existing.created_at || '',
      } : null"
      :book-title="source?.title || asset?.file_name || ''"
      @highlight="onToolbarHighlight"
      @save-note="onToolbarSaveNote"
      @quote="onToolbarQuote"
      @delete="onToolbarDelete"
      @close="closeSelectionToolbar"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Bookmark, Flag, Search } from 'lucide-vue-next'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { loadPdfEngine, loadEpubEngine } from '@/utils/bookReaderEngines'
import BookReaderSkeleton from '@/components/books/BookReaderSkeleton.vue'
import BookPdfContinuousView from '@/components/books/BookPdfContinuousView.vue'
import PButton from '@/components/ui/PButton.vue'
import BookSelectionToolbar from '@/components/books/BookSelectionToolbar.vue'
import BookReaderDisplayControls from '@/components/books/BookReaderDisplayControls.vue'
import BookReaderShell from '@/components/books/BookReaderShell.vue'
import BookReaderSidebar from '@/components/books/BookReaderSidebar.vue'
import BookReaderThumbnailStrip from '@/components/books/BookReaderThumbnailStrip.vue'
import { useBookReaderStore } from '@/stores/bookReader'
import { extractComicPages, type ComicPage } from '@/utils/bookComicArchive'
import { findBookTextMatches, type BookTextSearchMatch } from '@/utils/bookTextSearch'
import { getLocalBookReadingProgress, saveLocalBookReadingProgress, type LocalBookReadingProgress } from '@/utils/bookReadingProgress'
import { bookReaderPreferencesForFormat, parseBookReaderDisplayPreferences, type BookReaderBookmark, type BookReaderDisplayPreferences, type BookReaderScrollMode } from '@/utils/bookReaderPreferences'
import { fetchPublishedBookAssetContent, getPublishedBookAsset, type BookPublishedAsset } from '@/api/books'
import type { BookReaderSource } from '@/types/bookReaderSource'
import type { BookChapterAnchor } from '@/api/bookPrivate'
import type { ReadingMark, ReadingAnchor } from '@/api/bookReading'
import type { BookAnnotation, BookHighlightColor, BookHighlightStyle } from '@/api/books'
import { textSelection, pdfSelection, epubSelection, epubMarkRange, textRange, highlightedText, highlightColors, type HighlightSelection } from '@/utils/bookMarkAnchors'

type EpubBook = any
type EpubRendition = any
type Contents = any
type EpubTOCSource = { id?: string; href: string; label: string; subitems?: EpubTOCSource[] }
type EpubTOCItem = EpubTOCSource & { depth: number }

interface SelectionToolbarState {
  x: number
  y: number
  text: string
  candidate?: HighlightSelection | null
  existing?: ReadingMark | null
}

const selectionToolbar = ref<SelectionToolbarState | null>(null)

const route = useRoute()
const props = defineProps<{ source?: BookReaderSource }>()
const emit = defineEmits<{
  annotate: [selection: HighlightSelection]
  'annotate-direct': [payload: { selection: HighlightSelection; color: string; style: string; note?: string; isQuote?: boolean }]
  'annotation-edit': [mark: ReadingMark]
  'annotation-update': [payload: ReadingMark]
  'annotation-delete': [mark: ReadingMark]
  'chapter-note': [anchor: BookChapterAnchor]
}>()
const readerStore = useBookReaderStore()
const asset = ref<BookPublishedAsset | null>(null)
const textContent = ref('')
const readingPercent = ref(0)
const textPage = ref(1)
const textPageCount = ref(1)
const pdfPage = ref(1)
const pdfOffset = ref(0)
const pdfPageCount = ref(0)
const comicPage = ref(1)
const comicPages = ref<Array<ComicPage & { url: string }>>([])
const epubTOC = ref<EpubTOCItem[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
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
const epubHost = ref<HTMLElement | null>(null)
const comicViewport = ref<HTMLElement | null>(null)
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const pdfContinuousReader = ref<InstanceType<typeof BookPdfContinuousView> | null>(null)
const pdfDocumentRef = shallowRef<PDFDocumentProxy | null>(null)
const comicPageElements: Array<HTMLElement | undefined> = []
const isEngineLoading = ref(false)
let contentBlob: Blob | null = null
let pdfDocument: PDFDocumentProxy | null = null
let pdfLoadingTask: ReturnType<typeof import('pdfjs-dist/legacy/build/pdf.mjs').getDocument> | null = null
let pdfTextLayerClass: any = null
let activeEpubCfi: any = null
let epubBook: EpubBook | null = null
let epubRendition: EpubRendition | null = null
let epubJumpPending = false
let epubHasUserInteraction = false
let epubRenderedMode: BookReaderScrollMode | null = null
let epubBuildGeneration = 0
let textJumpPending = false
let lastTextWheelPageAt = 0
let localProgress: LocalBookReadingProgress | null = null
let disposed = false
let pdfRenderTask: RenderTask | undefined
let pdfTextTask: any = undefined
const epubPainted: { cfi: string; type: string }[] = []
let pdfRenderGeneration = 0
let lastTextScrollTop = 0
let epubPaintGeneration = 0
function progressKey() { return props.source?.progressKey || asset.value?.id || '' }
watch(() => props.source?.bookmarks, value => { if (value) bookmarks.value = value })
watch(() => props.source?.annotations, (value, previous) => {
  void paintEpubAnnotations()
  if (value !== undefined && previous === undefined && asset.value?.format === 'pdf' && !isLoading.value) void renderPDFPage(false)
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
  if (disposed || isLoading.value) return
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    if (selectionToolbar.value && !selectionToolbar.value.existing) {
      selectionToolbar.value = null
    }
    return
  }
  const anchorNode = selection?.anchorNode
  const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement
  const selectedPage = asset.value?.format === 'pdf' && displayPreferences.value.scroll_mode === 'continuous'
    ? anchorElement?.closest<HTMLElement>('.pdfViewer .page') : null
  const selectedTextRoot = selectedPage?.querySelector<HTMLElement>('.textLayer') || pdfTextRoot.value
  const selectedPageNumber = selectedPage ? Number(selectedPage.dataset.pageNumber || 0) || pdfPage.value : pdfPage.value
  const candidate = asset.value?.format === 'txt' && textRoot.value ? textSelection(textRoot.value, selection)
    : asset.value?.format === 'pdf' && selectedTextRoot ? pdfSelection(selectedTextRoot, selectedPageNumber, selection) : null
  selectionCandidate.value = candidate || undefined
  if (open && candidate) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect && rect.width > 0) {
      selectionToolbar.value = {
        x: Math.max(140, Math.min(window.innerWidth - 140, rect.left + rect.width / 2)),
        y: Math.max(60, rect.top),
        text: candidate.quote,
        candidate,
        existing: null,
      }
    } else {
      annotateCandidate()
    }
  }
}
function annotateCandidate() {
  if (!selectionCandidate.value) return
  if (new TextEncoder().encode(selectionCandidate.value.quote).length > 50000) { annotationMessage.value = '选中文字过长，请选择较短的段落。'; return }
  emit('annotate', selectionCandidate.value)
  selectionCandidate.value = undefined
}
function selectionChanged() { if (asset.value?.format !== 'epub') captureSelection() }
function clickTextMark(mark: ReadingMark, event?: MouseEvent) {
  if (window.getSelection()?.isCollapsed === false) return
  if (event) {
    const target = event.currentTarget as HTMLElement | null
    const rect = target?.getBoundingClientRect() || { left: event.clientX, top: event.clientY, width: 0 }
    selectionToolbar.value = {
      x: Math.max(140, Math.min(window.innerWidth - 140, rect.left + (rect.width || 0) / 2)),
      y: Math.max(60, rect.top),
      text: mark.quote,
      candidate: null,
      existing: mark,
    }
  } else {
    emit('annotation-edit', mark)
  }
}
function onToolbarHighlight(color: BookHighlightColor, style: BookHighlightStyle) {
  if (!selectionToolbar.value) return
  if (props.source?.annotations === undefined) {
    annotationMessage.value = '登录后可保存划线高亮'
    closeSelectionToolbar()
    return
  }
  if (selectionToolbar.value.existing) {
    emit('annotation-update', { ...selectionToolbar.value.existing, color, style })
  } else if (selectionToolbar.value.candidate) {
    emit('annotate-direct', { selection: selectionToolbar.value.candidate, color, style })
    emit('annotate', selectionToolbar.value.candidate)
  }
  closeSelectionToolbar()
}
function onToolbarSaveNote(note: string, color: BookHighlightColor, style: BookHighlightStyle) {
  if (!selectionToolbar.value) return
  if (props.source?.annotations === undefined) {
    annotationMessage.value = '登录后可保存读书想法'
    closeSelectionToolbar()
    return
  }
  if (selectionToolbar.value.existing) {
    emit('annotation-update', { ...selectionToolbar.value.existing, note, color, style })
  } else if (selectionToolbar.value.candidate) {
    emit('annotate-direct', { selection: selectionToolbar.value.candidate, color, style, note })
  }
  closeSelectionToolbar()
}
function onToolbarQuote(color: BookHighlightColor, style: BookHighlightStyle) {
  if (!selectionToolbar.value) return
  if (props.source?.annotations === undefined) {
    annotationMessage.value = '登录后可同步公开书摘'
    closeSelectionToolbar()
    return
  }
  if (selectionToolbar.value.existing) {
    emit('annotation-update', { ...selectionToolbar.value.existing, label: '精选书摘', color, style })
  } else if (selectionToolbar.value.candidate) {
    emit('annotate-direct', { selection: selectionToolbar.value.candidate, color, style, isQuote: true })
  }
  annotationMessage.value = '已设为公开书摘，已同步至图书详情'
  closeSelectionToolbar()
}
function onToolbarDelete(id: string) {
  if (selectionToolbar.value?.existing) {
    emit('annotation-delete', selectionToolbar.value.existing)
  }
  closeSelectionToolbar()
}
function closeSelectionToolbar() {
  selectionToolbar.value = null
  window.getSelection()?.removeAllRanges()
}
function editAnnotation(item: BookAnnotation) { const mark = annotations.value.find(mark => mark.id === item.id); if (mark) emit('annotation-edit', mark) }
function deleteAnnotation(id: string) { const mark = annotations.value.find(mark => mark.id === id); if (mark) emit('annotation-delete', mark) }
function jumpToAnnotation(item: BookAnnotation) {
  const mark = annotations.value.find(mark => mark.id === item.id)
  if (!mark) return
  if (asset.value?.format === 'txt') { textJumpPending = true; scrollToTextOffset(mark.anchor.txt_offset_start || 0); handleTextScroll() }
  else if (asset.value?.format === 'pdf' && mark.anchor.pdf_page) jumpToPdfPage(mark.anchor.pdf_page)
  else if (asset.value?.format === 'epub' && mark.anchor.epub_start_cfi && epubRendition) { epubHasUserInteraction = true; epubJumpPending = true; void epubRendition.display(mark.anchor.epub_start_cfi) }
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
function clickEpubMark(mark: ReadingMark, event?: MouseEvent) {
  const iframe = epubHost.value?.querySelector('iframe')
  const iframeRect = iframe?.getBoundingClientRect() || { left: 0, top: 0 }
  const x = event ? iframeRect.left + (event.clientX || 0) : window.innerWidth / 2
  const y = event ? iframeRect.top + (event.clientY || 0) : 120
  selectionToolbar.value = {
    x: Math.max(140, Math.min(window.innerWidth - 140, x)),
    y: Math.max(60, y),
    text: mark.quote,
    candidate: null,
    existing: mark,
  }
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
      const range = epubMarkRange(mark.anchor, start.startContainer.ownerDocument!, activeEpubCfi)
      const cfi = activeEpubCfi ? new activeEpubCfi(range, new activeEpubCfi(mark.anchor.epub_start_cfi).base).toString() : mark.anchor.epub_start_cfi
      const type = mark.style === 'underline' ? 'underline' : 'highlight'
      if (keys.has(type + cfi)) continue
      keys.add(type + cfi)
      const color = highlightColors[mark.color] || highlightColors.yellow!
      epubRendition.annotations.add(
        type,
        cfi,
        { id: mark.id },
        (e: MouseEvent) => {
          clickEpubMark(mark, e)
          emit('annotation-edit', mark)
        },
        'revision-highlight',
        { fill: color, 'fill-opacity': '0.3', stroke: color, 'stroke-opacity': '1', 'stroke-width': '2' }
      )
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
// Snapshot of the currently displayed content, never a guessed chapter boundary.
function createChapterNote() {
  if (!props.source?.supportsChapterNotes || isLoading.value || !asset.value) return
  const format = asset.value.format
  let anchor: BookChapterAnchor
  if (format === 'epub') {
    const current = epubRendition?.currentLocation?.()?.start
    const cfi = current?.cfi || localProgress?.epub_cfi || ''
    if (!cfi) { annotationMessage.value = 'EPUB 当前阅读位置尚未就绪，请打开正文后重试。'; return }
    const href = String(current?.href || '')
    const found = epubTOC.value.find(item => href && item.href.split('#')[0] === href.split('#')[0])
    anchor = { format: 'epub', epub_cfi: cfi, epub_href: href, chapter_title: found?.label || 'EPUB 阅读位置' }
  } else if (format === 'pdf') {
    anchor = { format: 'pdf', pdf_page: Math.max(1, pdfPage.value), pdf_offset: pdfOffset.value, chapter_title: `第 ${pdfPage.value} 页` }
  } else if (format === 'txt') {
    anchor = { format: 'txt', txt_offset: textOffset(), chapter_title: '文本阅读位置' }
  } else if (format === 'cbz' || format === 'cbr') {
    anchor = { format, pdf_page: Math.max(1, comicPage.value), chapter_title: `第 ${comicPage.value} 页` }
  } else return
  emit('chapter-note', anchor)
}

function notifyPosition(advanceFurthest = true) {
  if (disposed || isLoading.value) return
  const format = asset.value?.format
  props.source?.onPosition?.({ current_percent: readingPercent.value, advance_furthest: advanceFurthest, epub_cfi: format === 'epub' ? localProgress?.epub_cfi || '' : '', pdf_page: format === 'pdf' ? pdfPage.value : format === 'cbz' || format === 'cbr' ? comicPage.value : 0, pdf_offset: format === 'pdf' ? pdfOffset.value : 0, txt_offset: format === 'txt' ? textOffset() : 0 })
}

const formatLabel = computed(() => asset.value?.format.toUpperCase() || '')
const pageLabel = computed(() => {
  if (asset.value?.format === 'txt') return `第 ${textPage.value} / ${textPageCount.value} 页`
  if (asset.value?.format === 'pdf') return `第 ${pdfPage.value} / ${pdfPageCount.value} 页`
  if (asset.value?.format === 'epub') return 'EPUB'
  if ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPages.value.length) return `第 ${comicPage.value} / ${comicPages.value.length} 页`
  return ''
})
const showPagination = computed(() => ['cbz', 'cbr'].includes(asset.value?.format || '') || (['txt', 'pdf', 'epub'].includes(asset.value?.format || '') && displayPreferences.value.scroll_mode === 'paginated'))
const canPrev = computed(() => asset.value?.format === 'epub' || (asset.value?.format === 'txt' && textPage.value > 1) || (asset.value?.format === 'pdf' && pdfPage.value > 1) || ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPage.value > 1))
const canNext = computed(() => asset.value?.format === 'epub' || (asset.value?.format === 'txt' && textPage.value < textPageCount.value) || (asset.value?.format === 'pdf' && pdfPageCount.value > 0 && pdfPage.value < pdfPageCount.value) || ((asset.value?.format === 'cbz' || asset.value?.format === 'cbr') && comicPages.value.length > 0 && comicPage.value < comicPages.value.length))

function flattenEpubTOC(items: EpubTOCSource[], depth = 0): EpubTOCItem[] {
  return items.flatMap((item) => [{ ...item, depth }, ...flattenEpubTOC(item.subitems || [], depth + 1)])
}

function extractTxtTOC(text: string) {
  const headingRegex = /(?:^|\n)\s*(第[0-9一二三四五六七八九十百千万]+[章节回集卷篇][^\n]{0,35}|(?:Chapter|Section)\s+[0-9]+[^\n]{0,35}|[引楔]子[^\n]{0,20}|尾声[^\n]{0,20}|后记[^\n]{0,20})/g
  const matches: EpubTOCItem[] = []
  let match: RegExpExecArray | null
  while ((match = headingRegex.exec(text)) !== null) {
    const label = match[1].trim()
    const offset = match.index + (match[0].startsWith('\n') ? 1 : 0)
    matches.push({
      id: `txt-heading-${matches.length}`,
      href: `txt:${offset}`,
      label,
      depth: 0,
    })
  }
  if (matches.length >= 2) {
    epubTOC.value = matches
  }
}

function handleSelectPage(page: number) {
  if (asset.value?.format === 'pdf') {
    jumpToPdfPage(page)
  } else if (asset.value?.format === 'cbz' || asset.value?.format === 'cbr') {
    comicPage.value = Math.max(1, Math.min(page, comicPages.value.length))
    scrollToComicPage()
  }
}

async function loadText() {
  const text = await contentBlob!.text()
  textContent.value = text
  extractTxtTOC(text)
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
  isEngineLoading.value = true
  try {
    const { getDocument, TextLayer } = await loadPdfEngine()
    pdfTextLayerClass = TextLayer
    pdfLoadingTask = getDocument({ data: await contentBlob!.arrayBuffer() })
    pdfDocument = await pdfLoadingTask.promise
    if (disposed) return
    pdfDocumentRef.value = pdfDocument
    pdfPageCount.value = pdfDocument.numPages
    if (localProgress) {
      pdfPage.value = Math.min(pdfPageCount.value, Math.max(1, localProgress.pdf_page || Math.round(localProgress.reading_percent * pdfPageCount.value)))
      pdfOffset.value = localProgress.pdf_offset || 0
    }
    if (props.source?.initialPosition?.pdf_page) {
      pdfPage.value = Math.min(pdfPageCount.value, props.source.initialPosition.pdf_page)
      pdfOffset.value = props.source.initialPosition.pdf_offset || 0
    }
    await nextTick()
    if (displayPreferences.value.scroll_mode === 'paginated') await renderPDFPage(false)
  } finally {
    isEngineLoading.value = false
  }
}

async function renderPDFPage(advanceFurthest = true) {
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
        pdfTextTask = pdfTextLayerClass ? new pdfTextLayerClass({ textContentSource: content, container: pdfTextRoot.value, viewport }) : null
        if (pdfTextTask) await pdfTextTask.render()
      } catch { if (!disposed && current === pdfRenderGeneration) annotationMessage.value = '文字层暂不可用，仍可阅读；请重新载入后再尝试选字划线。' }
    }
    if (disposed || current !== pdfRenderGeneration) return
    readingPercent.value = pdfPageCount.value > 0 ? pdfPage.value / pdfPageCount.value : 0
    if (!props.source) readerStore.updateProgress(pdfPage.value, pdfPageCount.value, `第 ${pdfPage.value} 页`)
    saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, pdf_page: pdfPage.value, pdf_offset: pdfOffset.value, bookmarks: bookmarks.value, display: displayPreferences.value })
    notifyPosition(advanceFurthest)
  } catch { if (!disposed && current === pdfRenderGeneration) errorMessage.value = 'PDF 页面显示失败，请重新载入文件。' }
}

function handleZoomChange(newZoom: number) {
  displayPreferences.value = { ...displayPreferences.value, zoom_level: newZoom }
  if (asset.value?.format === 'pdf' && displayPreferences.value.scroll_mode === 'paginated') {
    void renderPDFPage(false)
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
  rebuildEpubAfterModeChange()
  if (asset.value?.format === 'pdf' && newMode === 'paginated') void nextTick().then(() => renderPDFPage(false))
}

function applyEpubThemesAndStyles() {
  if (!epubRendition) return
  const theme = displayPreferences.value.theme || 'paper'
  const fontScale = displayPreferences.value.font_scale || 1
  const fontFamily = displayPreferences.value.font_family || 'serif'

  const fontFamilies: Record<string, string> = {
    serif: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", Georgia, serif',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif',
    kaiti: '"Kaiti SC", "STKaiti", "KaiTi", "楷体", serif',
  }

  const themeColors: Record<string, { bg: string; fg: string; link: string }> = {
    paper: { bg: '#ffffff', fg: '#0f172a', link: '#0066cc' },
    sepia: { bg: '#fbf0d9', fg: '#2d2013', link: '#8c531b' },
    dim: { bg: '#fbf0d9', fg: '#2d2013', link: '#8c531b' },
    slate: { bg: '#f1f5f9', fg: '#1e293b', link: '#0284c7' },
    night: { bg: '#18181b', fg: '#e4e4e7', link: '#60a5fa' },
  }

  const colors = themeColors[theme] || themeColors.paper
  const font = fontFamilies[fontFamily] || fontFamilies.serif
  const fontSize = `${Math.round(100 * fontScale)}%`

  try {
    epubRendition.themes?.default?.({
      body: {
        'background-color': `${colors.bg} !important`,
        color: `${colors.fg} !important`,
        'font-family': `${font} !important`,
        'font-size': `${fontSize} !important`,
        'line-height': '1.85 !important',
        padding: '1.5rem 1.25rem !important',
      },
      'p, div, span, li, blockquote, dd, dt, h1, h2, h3, h4, h5, h6': {
        color: `${colors.fg} !important`,
        'font-family': `${font} !important`,
      },
      a: {
        color: `${colors.link} !important`,
      },
      img: {
        'max-width': '100% !important',
        height: 'auto !important',
      },
      '.revision-highlight': {
        cursor: 'pointer',
      }
    })
    epubRendition.themes?.fontSize?.(fontSize)
    epubRendition.themes?.font?.(font)
  } catch {}
}

async function buildEpubRendition(target?: string) {
  if (!epubBook || !epubHost.value || disposed) return
  const generation = ++epubBuildGeneration
  const previous = epubRendition
  epubRendition = null
  // Invalidate async annotation paints from the old rendition.
  epubPaintGeneration++
  if (previous) { epubPainted.length = 0; previous.destroy() }
  epubHost.value.replaceChildren()
  const mode = displayPreferences.value.scroll_mode || 'continuous'
  epubRenderedMode = mode
  const rendition = epubBook.renderTo(epubHost.value, {
    width: '100%', height: '100%',
    flow: mode === 'continuous' ? 'scrolled-continuous' : 'paginated',
    manager: mode === 'continuous' ? 'continuous' : 'default',
    allowScriptedContent: false,
  })
  epubRendition = rendition
  rendition.on('selected', (cfi: string, contents: any) => {
    if (disposed || rendition !== epubRendition) return
    try {
      const range = contents?.range ? contents.range(cfi) : null
      const candidate = range ? (epubSelection(cfi, range, activeEpubCfi) || undefined) : undefined
      selectionCandidate.value = candidate

      if (candidate && range) {
        const rangeRect = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null
        const iframe = epubHost.value?.querySelector('iframe')
        const iframeRect = iframe?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 }
        if (rangeRect && rangeRect.width > 0) {
          selectionToolbar.value = {
            x: Math.max(140, Math.min(window.innerWidth - 140, iframeRect.left + rangeRect.left + rangeRect.width / 2)),
            y: Math.max(60, iframeRect.top + rangeRect.top),
            text: candidate.quote,
            candidate,
            existing: null,
          }
        }
      }
    } catch { annotationMessage.value = '选区无法定位，请重新选择同一章节内的文字。' }
  })
  rendition.hooks?.content?.register?.((contents: any) => {
    contents.document?.addEventListener?.('mousedown', () => {
      if (selectionToolbar.value && !selectionToolbar.value.existing) {
        selectionToolbar.value = null
      }
    })
    contents.document?.addEventListener?.('selectionchange', () => {
      const sel = contents.window?.getSelection()
      if (!sel || sel.isCollapsed) {
        if (selectionToolbar.value && !selectionToolbar.value.existing) {
          selectionToolbar.value = null
        }
      }
    })
  })
  for (const event of ['keydown', 'touchstart', 'touchmove', 'mousedown']) {
    rendition.on(event, () => { if (!disposed) epubHasUserInteraction = true })
  }
  rendition.on('relocated', (location: { start?: { cfi?: string; percentage?: number } }) => {
    if (disposed || rendition !== epubRendition || !location.start) return
    const cfi = location.start.cfi || ''
    const moved = !!cfi && localProgress?.epub_cfi !== cfi
    let percent = location.start.percentage
    if (cfi && epubBook?.locations?.length?.()) {
      const indexed = epubBook.locations.percentageFromCfi(cfi)
      if (Number.isFinite(indexed)) percent = indexed
    }
    if (typeof percent === 'number' && Number.isFinite(percent)) readingPercent.value = Math.max(0, Math.min(1, percent))
    saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, epub_cfi: cfi, bookmarks: bookmarks.value, display: displayPreferences.value })
    localProgress = getLocalBookReadingProgress(progressKey())
    if (moved && epubHasUserInteraction) notifyPosition(!epubJumpPending)
    epubJumpPending = false
  })
  await rendition.display(target || undefined)
  if (disposed || generation !== epubBuildGeneration || rendition !== epubRendition) return
  applyEpubThemesAndStyles()
  // EPUB iframe wheel input does not bubble to the outer Vue component.
  // epub.js reports actual continuous viewport movement through the manager.
  if (mode === 'continuous') rendition.manager?.on?.('scrolled', () => {
    if (!disposed && !epubJumpPending) epubHasUserInteraction = true
  })
  void paintEpubAnnotations()
}

async function loadEPUB() {
  isEngineLoading.value = true
  try {
    const [{ ePub, EpubCFI }, data] = await Promise.all([loadEpubEngine(), contentBlob!.arrayBuffer()])
    activeEpubCfi = EpubCFI
    if (disposed || !ePub || !data || !epubHost.value) return
    epubBook = ePub(data)
    await epubBook.ready
    if (disposed) return
    epubTOC.value = flattenEpubTOC(epubBook.navigation.toc as EpubTOCSource[])
    if (props.source?.onPosition) void epubBook.locations.generate(1600).then(() => {
      if (!disposed && localProgress?.epub_cfi && epubBook?.locations?.length?.()) {
        const indexed = epubBook.locations.percentageFromCfi(localProgress.epub_cfi)
        if (Number.isFinite(indexed)) readingPercent.value = Math.max(0, Math.min(1, indexed))
      }
    }).catch(() => { /* Exact CFI remains available if the index fails. */ })
    epubJumpPending = true // initial position recovery must not advance the furthest read
    await buildEpubRendition(localProgress?.epub_cfi)
  } finally { isEngineLoading.value = false }
}

function markEpubActivity() { if (!isLoading.value) epubHasUserInteraction = true }

function rebuildEpubAfterModeChange() {
  if (asset.value?.format !== 'epub' || !epubRendition || epubRenderedMode === displayPreferences.value.scroll_mode) return
  const location = localProgress?.epub_cfi || epubRendition.currentLocation?.()?.start?.cfi || ''
  epubHasUserInteraction = false
  epubJumpPending = true // reflow is not reading
  void buildEpubRendition(location).catch(() => {
    if (!disposed) annotationMessage.value = '切换 EPUB 阅读模式失败，请尝试重新打开文件。'
  })
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


function handleTextScroll() {
  const viewport = textViewport.value
  if (!viewport) return
  const moved = Math.abs(viewport.scrollTop - lastTextScrollTop) > .5
  lastTextScrollTop = viewport.scrollTop
  const pageHeight = Math.max(1, viewport.clientHeight)
  textPageCount.value = Math.max(1, Math.ceil(viewport.scrollHeight / pageHeight))
  textPage.value = Math.min(textPageCount.value, Math.floor(viewport.scrollTop / pageHeight) + 1)
  readingPercent.value = Math.max(0, Math.min(1, viewport.scrollTop / Math.max(1, viewport.scrollHeight - viewport.clientHeight)))
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value, display: displayPreferences.value })
  if (moved) notifyPosition(!textJumpPending)
  textJumpPending = false
}

function handleTextWheel(event: WheelEvent) {
  if (displayPreferences.value.scroll_mode !== 'paginated' || !event.deltaY) return
  event.preventDefault()
  if (Date.now() - lastTextWheelPageAt < 280) return
  lastTextWheelPageAt = Date.now()
  changeTextPage(event.deltaY > 0 ? 1 : -1)
}

function handleTextKeydown(event: KeyboardEvent) {
  if (displayPreferences.value.scroll_mode !== 'paginated') return
  if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); changeTextPage(1) }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); changeTextPage(-1) }
}

function updateTextPageCount() {
  const viewport = textViewport.value
  if (!viewport) return
  textPageCount.value = Math.max(1, Math.ceil(viewport.scrollHeight / Math.max(1, viewport.clientHeight)))
}

function onContinuousPdfPositionChange(page: number, offset: number, advance: boolean) {
  if (!pdfPageCount.value || disposed) return
  pdfPage.value = Math.min(Math.max(1, page), pdfPageCount.value)
  pdfOffset.value = Math.max(0, Math.min(1, offset))
  readingPercent.value = (pdfPage.value - 1 + pdfOffset.value) / pdfPageCount.value
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, pdf_page: pdfPage.value, pdf_offset: pdfOffset.value, bookmarks: bookmarks.value, display: displayPreferences.value })
  notifyPosition(advance)
}

function changePdfPage(delta: number) {
  pdfPage.value = Math.min(Math.max(1, pdfPage.value + delta), pdfPageCount.value)
  pdfOffset.value = 0
  void renderPDFPage()
}

function jumpToPdfPage(page: number) {
  pdfPage.value = Math.min(Math.max(1, page), pdfPageCount.value)
  pdfOffset.value = 0
  if (displayPreferences.value.scroll_mode === 'continuous') pdfContinuousReader.value?.goToPage(pdfPage.value)
  else void renderPDFPage(false)
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
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value, display: displayPreferences.value })
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
  textViewport.value?.scrollTo?.({ top: (nextPage - 1) * Math.max(1, textViewport.value?.clientHeight || 0), behavior: 'auto' })
  handleTextScroll()
  readingPercent.value = textPageCount.value > 1 ? (nextPage - 1) / (textPageCount.value - 1) : 1
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value, display: displayPreferences.value })
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
    try { const result = await props.source.addBookmark(bookmark); if (!disposed) { bookmarks.value = result; errorMessage.value = '' } }
    catch { errorMessage.value = '书签未保存到云端，请重试。' }
    finally { bookmarkBusy.value = false }
    return
  }
  bookmarks.value = [bookmark, ...bookmarks.value]
  saveLocalBookReadingProgress(progressKey(), {
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    bookmarks: bookmarks.value,
    display: displayPreferences.value,
  })
}

async function removeBookmark(id: string) {
  if (!asset.value) return
  if (props.source?.removeBookmark) {
    if (bookmarkBusy.value) return
    bookmarkBusy.value = true
    try { const result = await props.source.removeBookmark(id); if (!disposed) { bookmarks.value = result; errorMessage.value = '' } }
    catch { errorMessage.value = '书签未从云端删除，请重试。' }
    finally { bookmarkBusy.value = false }
    return
  }
  bookmarks.value = bookmarks.value.filter((bookmark) => bookmark.id !== id)
  saveLocalBookReadingProgress(progressKey(), {
    reading_percent: readingPercent.value,
    epub_cfi: localProgress?.epub_cfi || '',
    bookmarks: bookmarks.value,
    display: displayPreferences.value,
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
  rebuildEpubAfterModeChange()
  applyEpubThemesAndStyles()
}

function jumpToTextMatch(match: BookTextSearchMatch) {
  if (asset.value?.format !== 'txt') return
  textJumpPending = true
  readingPercent.value = textContent.value.length ? match.index / textContent.value.length : 0
  scrollToTextOffset(match.index)
  saveLocalBookReadingProgress(progressKey(), { reading_percent: readingPercent.value, bookmarks: bookmarks.value, display: displayPreferences.value })
  handleTextScroll()
}

function jumpToBookmark(bookmark: BookReaderBookmark) {
  if (!asset.value) return
  readingPercent.value = bookmark.reading_percent
  if (asset.value.format === 'epub' && bookmark.epub_cfi && epubRendition) { epubHasUserInteraction = true; epubJumpPending = true; void epubRendition.display(bookmark.epub_cfi) }
  else if (asset.value.format === 'pdf' && bookmark.pdf_page) {
    jumpToPdfPage(bookmark.pdf_page)
  } else if (asset.value.format === 'txt') {
    textJumpPending = true
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
  epubHasUserInteraction = true
  epubJumpPending = false
  void (direction === 'prev' ? epubRendition.prev() : epubRendition.next())
}

function jumpToEpubTOC(href: string) {
  if (href.startsWith('txt:')) {
    const offset = Number(href.slice(4))
    if (!isNaN(offset)) {
      scrollToTextOffset(offset)
      handleTextScroll()
    }
  } else if (epubRendition) {
    epubHasUserInteraction = true
    epubJumpPending = true
    void epubRendition.display(href)
  }
}

watch(
  [() => displayPreferences.value.theme, () => displayPreferences.value.font_scale, () => displayPreferences.value.font_family],
  () => {
    if (asset.value?.format === 'epub') {
      applyEpubThemesAndStyles()
    }
  }
)

onMounted(async () => {
  document.addEventListener('selectionchange', selectionChanged)
  try {
    const assetID = String(route.params.assetId || '')
    asset.value = props.source?.asset || await getPublishedBookAsset(assetID)
    if (disposed) return
    localProgress = getLocalBookReadingProgress(progressKey())
    if (props.source?.initialPosition) {
      const position = props.source.initialPosition
      localProgress = { reading_percent: position.current_percent, epub_cfi: position.epub_cfi, pdf_page: position.pdf_page, pdf_offset: position.pdf_offset || 0, bookmarks: [], display: bookReaderPreferencesForFormat(asset.value.format, localProgress?.display), updated_at: new Date().toISOString() }
    }
    readingPercent.value = localProgress?.reading_percent || 0
    bookmarks.value = props.source?.bookmarks ?? localProgress?.bookmarks ?? []
    displayPreferences.value = bookReaderPreferencesForFormat(asset.value.format, localProgress?.display)
    contentBlob = props.source ? await props.source.loadContent() : await fetchPublishedBookAssetContent(assetID)
    if (disposed) return
    await nextTick()
    if (!asset.value) throw new Error('未找到图书文件')
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
@import "./bookPublicReaderView.css";
</style>
