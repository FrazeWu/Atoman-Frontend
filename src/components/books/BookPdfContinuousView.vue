<template>
  <div class="book-pdf-continuous" aria-label="PDF 连续滚动阅读区">
    <div ref="container" class="book-pdf-continuous__scroll" tabindex="0" @scroll.passive="onScroll" @wheel.passive="markScrollInteraction" @touchmove.passive="markScrollInteraction" @keydown="markScrollInteraction" @pointerdown="markScrollInteraction">
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
  initialOffset?: number
  zoom: number
  annotations: ReadingMark[]
}>()
const emit = defineEmits<{ 'position-change': [page: number, offset: number, advanceFurthest: boolean] }>()
const container = ref<HTMLDivElement>()
const viewerRoot = ref<HTMLDivElement>()
let pdfViewer: any = null
let disposed = false
let initialized = false
let deliberateJump = false
// Until actual reader interaction, restoration and reflow cannot advance furthest.
let suppressNaturalProgress = true
let restoration: { page: number; offset: number } | null = null
let lastEmitted = { page: 0, offset: -1, advanced: false }
let pendingFrame = 0
const abort = new AbortController()
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
function markScrollInteraction() { suppressNaturalProgress = false }

// At default zoom every viewport receives a fully visible page, including
// desktops with sidebars; PDF.js scales its canvas and text layer together.
// CSS-only transforms would break page geometry and annotation anchors.
function applyReaderScale(percent: number) {
  if (!pdfViewer) return
  const zoom = Math.max(.5, Math.min(2, percent / 100))
  pdfViewer.currentScaleValue = 'page-width'
  if (zoom !== 1) pdfViewer.currentScale *= zoom
}

function handleViewportResize() {
  if (!initialized || disposed || !pdfViewer) return
  restoration = visiblePosition()
  suppressNaturalProgress = true
  applyReaderScale(props.zoom)
  requestAnimationFrame(restoreAnchor)
}

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
  for (const mark of props.annotations.filter(item => item.anchor.pdf_page === pageNumber)) {
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

function pageRect(page: number): DOMRect | null {
  const element = pdfViewer?.getPageView?.(page - 1)?.div as HTMLElement | undefined
  return element?.getBoundingClientRect() || null
}

// A fraction of a PDF page (not pixels) remains valid after changing zoom or window size.
function visiblePosition(): { page: number; offset: number } {
  const root = container.value
  const current = Math.max(1, pdfViewer?.currentPageNumber || props.initialPage)
  if (!root) return { page: current, offset: 0 }
  const target = root.getBoundingClientRect().top + 8
  for (const page of [current - 1, current, current + 1]) {
    if (page < 1 || page > props.document.numPages) continue
    const rect = pageRect(page)
    if (rect && rect.height > 0 && rect.top <= target && rect.bottom > target) {
      return { page, offset: clamp((target - rect.top) / rect.height) }
    }
  }
  const rect = pageRect(current)
  return { page: current, offset: rect && rect.height > 0 ? clamp((target - rect.top) / rect.height) : 0 }
}

function sendPosition(page: number, offset: number, advance: boolean) {
  if (!initialized || disposed) return
  const normalized = clamp(offset)
  if (lastEmitted.page === page && Math.abs(lastEmitted.offset - normalized) < .002 && lastEmitted.advanced === advance) return
  lastEmitted = { page, offset: normalized, advanced: advance }
  emit('position-change', page, normalized, advance)
}

// This runs even while staying within the same page: 'pagechanging' alone is insufficient.
function onScroll() {
  if (!initialized || restoration) return
  if (pendingFrame) return
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0
    if (!initialized || disposed || restoration) return
    const position = visiblePosition()
    sendPosition(position.page, position.offset, !suppressNaturalProgress && !deliberateJump)
    deliberateJump = false
  })
}

function restoreAnchor() {
  if (!initialized || !restoration || !container.value || !pdfViewer) return
  const { page, offset } = restoration
  const rect = pageRect(page)
  if (!rect || rect.height < 1) return
  const root = container.value
  suppressNaturalProgress = true
  root.scrollTop += rect.top - root.getBoundingClientRect().top + offset * rect.height
  restoration = null
  // PDF.js can dispatch a page-changing event during the programmatic restore.
  requestAnimationFrame(() => {
    if (!disposed) sendPosition(page, offset, false)
  })
}

function goToPage(page: number) {
  if (!pdfViewer || !initialized) return
  const next = Math.min(props.document.numPages, Math.max(1, Math.floor(page)))
  suppressNaturalProgress = true
  deliberateJump = true
  if (pdfViewer.currentPageNumber !== next) pdfViewer.currentPageNumber = next
  const rect = pageRect(next)
  if (rect && container.value) container.value.scrollTop += rect.top - container.value.getBoundingClientRect().top
  sendPosition(next, 0, false)
  deliberateJump = false
}

watch(() => props.zoom, value => {
  if (!pdfViewer || !initialized) return
  const anchor = visiblePosition()
  restoration = anchor
  suppressNaturalProgress = true
  applyReaderScale(value)
  requestAnimationFrame(restoreAnchor)
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
    window.addEventListener('resize', handleViewportResize)
    linkService.setViewer(viewer)
    eventBus.on('pagesinit', () => {
      if (disposed) return
      viewer.scrollMode = ScrollMode.VERTICAL
      applyReaderScale(props.zoom)
      const page = Math.min(props.document.numPages, Math.max(1, props.initialPage))
      restoration = { page, offset: clamp(props.initialOffset || 0) }
      viewer.currentPageNumber = page
      initialized = true
      requestAnimationFrame(restoreAnchor)
    })
    eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
      if (disposed || !initialized || restoration) return
      const position = visiblePosition()
      sendPosition(pageNumber, position.page === pageNumber ? position.offset : 0, !deliberateJump && !suppressNaturalProgress)
      deliberateJump = false
    })
    eventBus.on('pagerendered', ({ pageNumber }: { pageNumber: number }) => {
      if (disposed) return
      paintPageMarks(pageNumber)
      if (restoration?.page === pageNumber) requestAnimationFrame(restoreAnchor)
    })
    linkService.setDocument(props.document)
    viewer.setDocument(props.document)
  } catch (error) {
    if (!disposed) console.warn('PDF 连续阅读器初始化失败', error)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportResize)
  disposed = true
  if (pendingFrame) cancelAnimationFrame(pendingFrame)
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
