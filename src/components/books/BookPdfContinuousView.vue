<template>
  <div class="book-pdf-continuous" aria-label="PDF 连续滚动阅读区">
    <div ref="container" class="book-pdf-continuous__scroll" tabindex="0" @wheel.passive="markScrollInteraction" @touchmove.passive="markScrollInteraction" @keydown="markScrollInteraction" @pointerdown="markScrollInteraction">
      <div ref="viewerRoot" class="pdfViewer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { ReadingMark } from '@/api/bookReading'
import { highlightColors } from '@/utils/bookMarkAnchors'

const props = defineProps<{
  document: PDFDocumentProxy
  initialPage: number
  zoom: number
  annotations: ReadingMark[]
}>()
const emit = defineEmits<{ 'page-change': [page: number, advanceFurthest: boolean] }>()
const container = ref<HTMLDivElement>()
const viewerRoot = ref<HTMLDivElement>()
let pdfViewer: any = null
let disposed = false
let initialized = false
let deliberateJump = false
// Programmatic loading/zoom changes must not be treated as reading until a genuine gesture.
let suppressScaleChange = true
function markScrollInteraction() { suppressScaleChange = false }
const abort = new AbortController()

function paintPageMarks(pageNumber: number) {
  const pageView = pdfViewer?.getPageView?.(pageNumber - 1)
  const page = pageView?.div as HTMLElement | undefined
  if (!page) return
  let layer = page.querySelector<HTMLElement>('.atoman-pdf-marks')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'atoman-pdf-marks'
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1'
    page.appendChild(layer)
  }
  layer.replaceChildren()
  for (const mark of props.annotations.filter(mark => mark.anchor.pdf_page === pageNumber)) {
    const color = highlightColors[mark.color] || highlightColors.yellow || '#eab308'
    for (const rect of mark.anchor.pdf_rects || []) {
      const piece = document.createElement('span')
      piece.style.cssText = `position:absolute;left:${rect.x * 100}%;top:${rect.y * 100}%;width:${rect.width * 100}%;height:${rect.height * 100}%;box-sizing:border-box;`
      if (mark.style === 'underline') piece.style.borderBottom = `2px solid ${color}`
      else piece.style.backgroundColor = `${color}66`
      layer.appendChild(piece)
    }
  }
}

function goToPage(page: number) {
  if (!pdfViewer || !initialized) return
  const nextPage = Math.min(props.document.numPages, Math.max(1, Math.floor(page)))
  if (pdfViewer.currentPageNumber === nextPage) return
  deliberateJump = true
  pdfViewer.currentPageNumber = nextPage
}

watch(() => props.zoom, value => {
  if (!pdfViewer || !initialized) return
  suppressScaleChange = true
  pdfViewer.currentScale = Math.max(.5, Math.min(2, value / 100)) * 1.35
})
watch(() => props.annotations, () => {
  if (!pdfViewer) return
  for (const page of pdfViewer.getCachedPageViews?.() || []) {
    if (page?.id) paintPageMarks(page.id)
  }
})

onMounted(async () => {
  const root = container.value
  const pages = viewerRoot.value
  if (!root || !pages) return
  try {
    const { PDFViewer, EventBus, PDFLinkService, ScrollMode } = await import('pdfjs-dist/web/pdf_viewer.mjs')
    if (disposed) return
    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    const options = { container: root, viewer: pages, eventBus, linkService,
      annotationMode: 0, textLayerMode: 1, abortSignal: abort.signal }
    const viewer = new PDFViewer(options)
    pdfViewer = viewer
    linkService.setViewer(viewer)
    eventBus.on('pagesinit', () => {
      if (disposed) return
      viewer.scrollMode = ScrollMode.VERTICAL
      viewer.currentScale = Math.max(.5, Math.min(2, props.zoom / 100)) * 1.35
      viewer.currentPageNumber = Math.min(props.document.numPages, Math.max(1, props.initialPage))
      initialized = true
    })
    eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
      if (disposed || !initialized) return
      const isReading = !deliberateJump && !suppressScaleChange
      deliberateJump = false
      emit('page-change', pageNumber, isReading)
    })
    eventBus.on('pagerendered', ({ pageNumber }: { pageNumber: number }) => {
      if (!disposed) paintPageMarks(pageNumber)
    })
    linkService.setDocument(props.document)
    viewer.setDocument(props.document)
  } catch (error) {
    if (!disposed) console.warn('PDF 连续阅读器初始化失败', error)
  }
})
onBeforeUnmount(() => {
  disposed = true
  abort.abort()
  pdfViewer?.setDocument?.(null)
  pdfViewer = null
})
defineExpose({ goToPage })
</script>

<style scoped>
.book-pdf-continuous { position:relative; width:100%; min-width:0; height:min(68vh,720px); }
.book-pdf-continuous__scroll { position:absolute; inset:0; overflow:auto; background:var(--book-reader-surface); }
.book-pdf-continuous__scroll :deep(.pdfViewer .page) { margin:0 auto 1rem; box-shadow:none; border:1px solid var(--a-color-border-soft); }
</style>
