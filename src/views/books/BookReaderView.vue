<template>
  <main class="a-page-md books-reader">
    <PSectionHeader title="阅读" kicker="READER" rule />

    <header class="books-reader__header">
      <RouterLink class="books-back-link" to="/books/library" aria-label="返回我的书库" title="返回我的书库">
        <ArrowLeft :size="18" aria-hidden="true" />
      </RouterLink>
      <div class="books-reader__heading">
        <h1>{{ asset?.title || '私有电子书' }}</h1>
        <p v-if="asset">{{ asset.file_name }} · {{ statusLabel }}</p>
      </div>
      <div class="books-reader__actions">
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
      </div>
    </header>

    <p v-if="errorMessage" class="books-reader__feedback books-reader__feedback--error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="books-reader__feedback" aria-live="polite">正在打开电子书...</p>
    <p v-else-if="asset && !canRead" class="books-reader__feedback" aria-live="polite">{{ unavailableMessage }}</p>

    <section v-if="canRead" class="books-reader__surface" aria-label="电子书阅读器">
      <div class="books-reader__toolbar">
        <div class="books-reader__progress" aria-live="polite">
          <span>阅读进度</span>
          <strong>{{ Math.round(readingPercent * 100) }}%</strong>
        </div>
        <div v-if="asset?.format === 'pdf'" class="books-reader__pagination">
          <button type="button" aria-label="上一页" title="上一页" :disabled="pdfPage <= 1" @click="changePdfPage(-1)">
            <ChevronLeft :size="17" aria-hidden="true" />
          </button>
          <span>第 {{ pdfPage }} / {{ pdfPageCount }} 页</span>
          <button type="button" aria-label="下一页" title="下一页" :disabled="pdfPage >= pdfPageCount" @click="changePdfPage(1)">
            <ChevronRight :size="17" aria-hidden="true" />
          </button>
        </div>
        <div v-else-if="asset?.format === 'epub'" class="books-reader__pagination">
          <button type="button" aria-label="上一页" title="上一页" @click="moveEpubPage('prev')">
            <ChevronLeft :size="17" aria-hidden="true" />
          </button>
          <span>EPUB</span>
          <button type="button" aria-label="下一页" title="下一页" @click="moveEpubPage('next')">
            <ChevronRight :size="17" aria-hidden="true" />
          </button>
        </div>
        <div v-else-if="asset?.format === 'txt' && textPages.length" class="books-reader__pagination">
          <span>第 {{ textPage }} / {{ textPages.length }} 页</span>
        </div>
      </div>

      <details v-if="epubTOC.length > 0" class="books-reader__toc" open>
        <summary>目录</summary>
        <ol>
          <li v-for="item in epubTOC" :key="item.id || item.href">
            <button type="button" :class="{ 'is-nested': item.depth > 0 }" @click="jumpToEpubTOC(item.href)">{{ item.label }}</button>
          </li>
        </ol>
      </details>

      <div v-if="asset?.format === 'txt'" ref="textViewport" class="books-reader__text" @scroll="handleTextScroll">
        <div class="books-reader__text-pages">
          <article
            v-for="(page, index) in textPages"
            :key="page.start"
            :ref="element => setTextPageRef(index, element)"
            class="books-reader__text-page"
          >
            <div class="books-reader__text-page-content">{{ page.content }}</div>
            <span class="books-reader__text-page-number">{{ index + 1 }}</span>
          </article>
        </div>
        <div ref="textPageFrame" class="books-reader__text-page books-reader__text-page--measure" aria-hidden="true">
          <div ref="textMeasure" class="books-reader__text-page-content" />
        </div>
      </div>
      <div v-else-if="asset?.format === 'epub'" ref="epubViewport" class="books-reader__epub" />
      <div v-else class="books-reader__pdf">
        <canvas ref="pdfCanvas" aria-label="PDF 页面" />
      </div>

      <label class="books-reader__notes">
        <span>私有笔记</span>
        <textarea v-model="privateNotes" maxlength="50000" rows="3" placeholder="记录只对你可见的想法" />
      </label>

      <details class="books-reader__publication">
        <summary>申请发布为公共正文</summary>
        <form @submit.prevent="submitPublication">
          <label for="publication-work-id">公共作品 UUID</label>
          <input id="publication-work-id" v-model="publicationWorkID" required placeholder="粘贴作品 UUID" />
          <label for="publication-license">授权类型</label>
          <select id="publication-license" v-model="publicationLicense">
            <option value="public_domain">公版</option>
            <option value="open_license">开放许可</option>
            <option value="creator_owned">本人创作</option>
            <option value="authorized_distribution">已获授权</option>
          </select>
          <label for="publication-holder">权利人</label>
          <input id="publication-holder" v-model="publicationRightsHolder" required maxlength="500" />
          <label for="publication-source">授权来源 URL</label>
          <input id="publication-source" v-model="publicationSourceURL" type="url" required maxlength="4096" placeholder="https://" />
          <label for="publication-declaration">授权声明</label>
          <textarea id="publication-declaration" v-model="publicationDeclaration" required maxlength="20000" rows="4" />
          <label for="publication-evidence">授权证据文件（可选）</label>
          <input id="publication-evidence" type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" @change="selectPublicationEvidence" />
          <p v-if="publicationEvidence" class="books-reader__publication-file">已选择：{{ publicationEvidence.name }}</p>
          <PButton type="submit" variant="secondary" :loading="publicationSaving">
            <Send :size="16" aria-hidden="true" />
            <span>提交申请</span>
          </PButton>
        </form>
        <p v-if="publicationMessage" class="books-reader__publication-message" aria-live="polite">{{ publicationMessage }}</p>
      </details>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { IconArrowLeft as ArrowLeft, IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconDownload as Download, IconDeviceFloppy as Save, IconSend as Send } from '@tabler/icons-vue'
import ePub from 'epubjs'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import { paginateText, type TextPage } from '@/utils/textPagination'
import {
  fetchBookAssetContent,
  getBookAsset,
  getBookReadingState,
  saveBookReadingState,
  submitPublicationRequest,
  uploadPublicationEvidence,
  type BookPrivateAsset,
  type BookReadingState,
  type SubmitPublicationInput,
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
const publicationWorkID = ref('')
const publicationLicense = ref<SubmitPublicationInput['license_type']>('public_domain')
const publicationRightsHolder = ref('')
const publicationSourceURL = ref('')
const publicationDeclaration = ref('')
const publicationEvidence = ref<File | null>(null)
const publicationSaving = ref(false)
const publicationMessage = ref('')
const readingPercent = ref(0)
const epubTOC = ref<EpubTOCItem[]>([])
const pdfPage = ref(1)
const pdfPageCount = ref(0)
const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const textViewport = ref<HTMLElement | null>(null)
const textPageFrame = ref<HTMLElement | null>(null)
const textMeasure = ref<HTMLElement | null>(null)
const epubViewport = ref<HTMLElement | null>(null)
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
const textPageElements: Array<HTMLElement | undefined> = []
let pdfDocument: PDFDocumentProxy | null = null
let pdfLoadingTask: ReturnType<typeof getDocument> | null = null
let epubBook: EpubBook | null = null
let epubRendition: EpubRendition | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let textResizeObserver: ResizeObserver | null = null
let textPaginationFrame: number | null = null

const canRead = computed(() => ['private_available', 'publication_requested', 'pending_review', 'rejected'].includes(asset.value?.processing_status || ''))
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
    else await loadEPUB()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '电子书打开失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

function selectPublicationEvidence(event: Event) {
  const input = event.target as HTMLInputElement
  publicationEvidence.value = input.files?.[0] || null
}

async function submitPublication() {
  if (!asset.value) return
  publicationSaving.value = true
  publicationMessage.value = ''
  let requestSubmitted = false
  try {
    const request = await submitPublicationRequest(asset.value.id, {
      work_id: publicationWorkID.value.trim(),
      license_type: publicationLicense.value,
      rights_holder: publicationRightsHolder.value.trim(),
      source_url: publicationSourceURL.value.trim(),
      declaration: publicationDeclaration.value.trim(),
    })
    requestSubmitted = true
    if (publicationEvidence.value) {
      await uploadPublicationEvidence(request.id, publicationEvidence.value)
    }
    publicationMessage.value = publicationEvidence.value ? '申请和授权证据已提交，等待审核' : '申请已提交，审核期间仍可继续私有阅读'
    publicationWorkID.value = ''
    publicationRightsHolder.value = ''
    publicationSourceURL.value = ''
    publicationDeclaration.value = ''
    publicationEvidence.value = null
  } catch (error) {
    publicationMessage.value = requestSubmitted ? '申请已提交，但授权证据上传失败，请稍后重试' : (error instanceof Error ? error.message : '公共发布申请失败，请稍后重试')
  } finally {
    publicationSaving.value = false
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
      preferences: readingState.value?.preferences || {},
    })
    applyReadingState(saved)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '阅读位置保存失败'
  } finally {
    isSaving.value = false
  }
}

function changePdfPage(delta: number) {
  pdfPage.value = Math.min(Math.max(1, pdfPage.value + delta), pdfPageCount.value)
  void renderPDFPage()
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
})
</script>

<style scoped>
.books-reader {
  display: grid;
  gap: 1.25rem;
  padding-top: var(--a-page-start-space);
}

.books-reader__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
}

.books-back-link,
.books-reader__pagination button {
  display: inline-grid;
  place-items: center;
  color: var(--a-color-muted);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
  min-width: 2.25rem;
  height: 2.25rem;
}

.books-back-link:hover,
.books-reader__pagination button:hover:not(:disabled) {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
}

.books-reader__heading {
  min-width: 0;
}

.books-reader__heading h1 {
  margin: 0;
  font-size: 1.35rem;
  overflow-wrap: anywhere;
}

.books-reader__heading p,
.books-reader__feedback {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.books-reader__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.books-reader__feedback--error {
  color: var(--a-color-danger);
}

.books-reader__surface {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
}

.books-reader__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  min-height: 2.5rem;
  border-block: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.books-reader__progress,
.books-reader__pagination {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.books-reader__progress strong {
  color: var(--a-color-fg);
}

.books-reader__pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.books-reader__toc {
  border-block: 1px solid var(--a-color-border-soft);
}

.books-reader__toc summary {
  padding: 0.65rem 0;
  color: var(--a-color-muted);
  cursor: pointer;
}

.books-reader__toc ol {
  display: grid;
  gap: 0.15rem;
  max-height: 16rem;
  margin: 0;
  padding: 0 0 0.75rem 1.2rem;
  overflow: auto;
}

.books-reader__toc button {
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.books-reader__toc button:hover,
.books-reader__toc button:focus-visible {
  text-decoration: underline;
}

.books-reader__toc button.is-nested {
  padding-left: 1rem;
  color: var(--a-color-muted);
}

.books-reader__text,
.books-reader__epub,
.books-reader__pdf {
  min-height: min(68vh, 720px);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
  overflow: hidden;
}

.books-reader__text {
  position: relative;
  overflow: auto;
  max-height: min(78vh, 60rem);
  padding: clamp(0.75rem, 2vw, 1.5rem);
  background: var(--a-color-surface-muted);
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
  box-shadow: 0 1px 3px rgb(0 0 0 / 22%);
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
  column-rule: 1px solid var(--a-color-border-soft);
  overflow: hidden;
}

.books-reader__text-page-number {
  position: absolute;
  inset: auto 0 1.1rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  text-align: center;
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
}

.books-reader__pdf {
  display: grid;
  place-items: start center;
  overflow: auto;
  padding: 1rem;
}

.books-reader__pdf canvas {
  display: block;
  max-width: 100%;
  height: auto;
  background: white;
  box-shadow: 0 2px 12px rgb(0 0 0 / 12%);
}

.books-reader__publication {
  display: grid;
  gap: 0.75rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.books-reader__publication summary {
  color: var(--a-color-muted);
  cursor: pointer;
}

.books-reader__publication form {
  display: grid;
  gap: 0.5rem;
  max-width: 42rem;
}

.books-reader__publication input,
.books-reader__publication select,
.books-reader__publication textarea {
  width: 100%;
  border: 1px solid var(--a-color-border);
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  padding: 0.6rem;
  font: inherit;
}

.books-reader__publication-file {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}
.books-reader__publication-message {
  margin: 0;
  color: var(--a-color-muted);
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

.books-reader__notes textarea {
  width: 100%;
  resize: vertical;
  min-height: 5rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  padding: 0.7rem;
  font: inherit;
}

@media (max-width: 640px) {
  .books-reader__header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .books-reader__actions {
    grid-column: 2;
  }

  .books-reader__toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding-block: 0.6rem;
  }
}
</style>
