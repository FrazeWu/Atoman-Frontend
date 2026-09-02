<template>
  <main class="a-page-md public-reader">
    <PSectionHeader title="公共阅读" kicker="READER" rule />
    <header class="public-reader__header">
      <RouterLink class="public-reader__back" to="/books" aria-label="返回读书" title="返回读书">
        <ArrowLeft :size="18" aria-hidden="true" />
      </RouterLink>
      <div>
        <h1>{{ asset?.file_name || '公共电子书' }}</h1>
        <p v-if="asset">{{ formatLabel }} · {{ Math.round(readingPercent * 100) }}%</p>
      </div>
      <div class="public-reader__actions">
        <PButton type="button" variant="ghost" :disabled="!asset" @click="reportAsset">
          <Flag :size="16" aria-hidden="true" />
          <span>举报正文</span>
        </PButton>
      </div>
    </header>

    <p v-if="reportMessage" class="public-reader__feedback" aria-live="polite">{{ reportMessage }}</p>
    <p v-if="errorMessage" class="public-reader__feedback public-reader__feedback--error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="public-reader__feedback" aria-live="polite">正在打开公共正文...</p>
    <section v-else class="public-reader__surface" aria-label="公共电子书阅读器">
      <div class="public-reader__toolbar">
        <span>公共正文</span>
        <div v-if="asset?.format === 'pdf'" class="public-reader__pagination">
          <button type="button" aria-label="上一页" title="上一页" :disabled="pdfPage <= 1" @click="changePdfPage(-1)"><ChevronLeft :size="17" aria-hidden="true" /></button>
          <span>第 {{ pdfPage }} / {{ pdfPageCount }} 页</span>
          <button type="button" aria-label="下一页" title="下一页" :disabled="pdfPage >= pdfPageCount" @click="changePdfPage(1)"><ChevronRight :size="17" aria-hidden="true" /></button>
        </div>
        <div v-else-if="asset?.format === 'epub'" class="public-reader__pagination">
          <button type="button" aria-label="上一页" title="上一页" @click="moveEpubPage('prev')"><ChevronLeft :size="17" aria-hidden="true" /></button>
          <span>EPUB</span>
          <button type="button" aria-label="下一页" title="下一页" @click="moveEpubPage('next')"><ChevronRight :size="17" aria-hidden="true" /></button>
        </div>
      </div>

      <details v-if="epubTOC.length > 0" class="public-reader__toc" open>
        <summary>目录</summary>
        <ol>
          <li v-for="item in epubTOC" :key="item.id || item.href">
            <button type="button" :class="{ 'is-nested': item.depth > 0 }" @click="jumpToEpubTOC(item.href)">{{ item.label }}</button>
          </li>
        </ol>
      </details>

      <div v-if="asset?.format === 'txt'" ref="textViewport" class="public-reader__text" @scroll="handleTextScroll"><pre>{{ textContent }}</pre></div>
      <div v-else-if="asset?.format === 'epub'" ref="epubViewport" class="public-reader__epub" />
      <div v-else class="public-reader__pdf"><canvas ref="pdfCanvas" aria-label="PDF 页面" /></div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { IconArrowLeft as ArrowLeft, IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconFlag as Flag } from '@tabler/icons-vue'
import ePub from 'epubjs'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
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
const pdfPage = ref(1)
const pdfPageCount = ref(0)
const epubTOC = ref<EpubTOCItem[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const reportMessage = ref('')
const textViewport = ref<HTMLElement | null>(null)
const epubViewport = ref<HTMLElement | null>(null)
const pdfCanvas = ref<HTMLCanvasElement | null>(null)
let contentBlob: Blob | null = null
let pdfDocument: PDFDocumentProxy | null = null
let pdfLoadingTask: ReturnType<typeof getDocument> | null = null
let epubBook: EpubBook | null = null
let epubRendition: EpubRendition | null = null

const formatLabel = computed(() => asset.value?.format.toUpperCase() || '')

function flattenEpubTOC(items: EpubTOCSource[], depth = 0): EpubTOCItem[] {
  return items.flatMap((item) => [{ ...item, depth }, ...flattenEpubTOC(item.subitems || [], depth + 1)])
}

async function loadText() {
  textContent.value = await contentBlob!.text()
}

async function loadPDF() {
  pdfLoadingTask = getDocument({ data: await contentBlob!.arrayBuffer() })
  pdfDocument = await pdfLoadingTask.promise
  pdfPageCount.value = pdfDocument.numPages
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
}

async function loadEPUB() {
  epubBook = ePub(await contentBlob!.arrayBuffer())
  await epubBook.ready
  epubTOC.value = flattenEpubTOC(epubBook.navigation.toc as EpubTOCSource[])
  epubRendition = epubBook.renderTo(epubViewport.value!, { width: '100%', height: '100%', flow: 'paginated', manager: 'default', allowScriptedContent: false })
  epubRendition.on('relocated', (location: { start?: { percentage?: number } }) => {
    readingPercent.value = Math.max(0, Math.min(1, location.start?.percentage || 0))
  })
  await epubRendition.display()
}

function reportAsset() {
  if (!asset.value) return
  const reason = window.prompt('请输入举报理由')?.trim()
  if (!reason) return
  void reportPublishedBookAsset(asset.value.id, reason)
    .then(() => { reportMessage.value = '举报已提交，感谢你的反馈' })
    .catch(() => { reportMessage.value = '举报提交失败，请登录后重试' })
}

function handleTextScroll() {
  const viewport = textViewport.value
  if (!viewport) return
  readingPercent.value = Math.max(0, Math.min(1, viewport.scrollTop / Math.max(1, viewport.scrollHeight - viewport.clientHeight)))
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
  if (epubRendition) void epubRendition.display(href)
}

onMounted(async () => {
  try {
    const assetID = String(route.params.assetId || '')
    asset.value = await getPublishedBookAsset(assetID)
    contentBlob = await fetchPublishedBookAssetContent(assetID)
    await nextTick()
    if (asset.value.format === 'txt') await loadText()
    else if (asset.value.format === 'pdf') await loadPDF()
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
})
</script>

<style scoped>
.public-reader { display: grid; gap: 1.25rem; padding-top: var(--a-page-start-space); }
.public-reader__header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.85rem; }
.public-reader__back, .public-reader__pagination button { display: inline-grid; place-items: center; min-width: 2.25rem; height: 2.25rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-surface); color: var(--a-color-muted); }
.public-reader__actions { display: flex; justify-content: end; }

.public-reader__header h1 { margin: 0; font-size: 1.35rem; overflow-wrap: anywhere; }
.public-reader__header p, .public-reader__feedback { margin: 0.25rem 0 0; color: var(--a-color-muted); font-size: 0.88rem; }
.public-reader__feedback--error { color: var(--a-color-danger); }
.public-reader__surface { display: grid; gap: 0.9rem; min-width: 0; }
.public-reader__toolbar { display: flex; justify-content: space-between; align-items: center; min-height: 2.5rem; color: var(--a-color-muted); border-block: 1px solid var(--a-color-border-soft); }
.public-reader__pagination { display: flex; align-items: center; gap: 0.65rem; }
.public-reader__pagination button { cursor: pointer; }
.public-reader__pagination button:disabled { cursor: not-allowed; opacity: 0.4; }
.public-reader__toc { border-block: 1px solid var(--a-color-border-soft); }
.public-reader__toc summary { padding: 0.65rem 0; color: var(--a-color-muted); cursor: pointer; }
.public-reader__toc ol { display: grid; gap: 0.15rem; max-height: 16rem; margin: 0; padding: 0 0 0.75rem 1.2rem; overflow: auto; }
.public-reader__toc button { border: 0; background: transparent; color: var(--a-color-fg); cursor: pointer; font: inherit; text-align: left; }
.public-reader__toc button:hover, .public-reader__toc button:focus-visible { text-decoration: underline; }
.public-reader__toc button.is-nested { padding-left: 1rem; color: var(--a-color-muted); }
.public-reader__text, .public-reader__epub, .public-reader__pdf { min-height: min(68vh, 720px); overflow: hidden; border: 1px solid var(--a-color-border-soft); background: var(--a-color-surface); }
.public-reader__text { overflow: auto; padding: clamp(1.25rem, 4vw, 3rem); }
.public-reader__text pre { max-width: 72ch; margin: 0 auto; color: var(--a-color-fg); font: inherit; line-height: 1.85; white-space: pre-wrap; overflow-wrap: anywhere; }
.public-reader__epub { padding: 1rem; }
.public-reader__pdf { display: grid; place-items: start center; overflow: auto; padding: 1rem; }
.public-reader__pdf canvas { display: block; max-width: 100%; height: auto; }
</style>
