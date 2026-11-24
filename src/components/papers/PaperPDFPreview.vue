<template>
  <section class="paper-pdf" aria-label="已验证 PDF 预览">
    <div class="paper-pdf__toolbar">
      <span>源码版本 {{ revision }}</span>
      <PButton size="sm" variant="secondary" :disabled="!pageCount || page <= 1" @click="changePage(-1)">上一页</PButton>
      <span v-if="pageCount">{{ page }} / {{ pageCount }}</span>
      <PButton size="sm" variant="secondary" :disabled="!pageCount || page >= pageCount" @click="changePage(1)">下一页</PButton>
      <PButton size="sm" variant="secondary" :disabled="!documentBlob" @click="download">下载 PDF</PButton>
    </div>
    <p v-if="loading" role="status">正在读取编译产物...</p>
    <p v-if="rendering" role="status">正在渲染页面...</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <PButton v-if="error && !documentBlob" size="sm" variant="secondary" @click="load">重试</PButton>
    <div class="paper-pdf__page"><canvas ref="canvas" aria-label="论文 PDF 页面" /></div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { getPaperCompilePDF } from '@/api/papers'
import { loadPdfEngine } from '@/utils/bookReaderEngines'
import PButton from '@/components/ui/PButton.vue'

const props = defineProps<{ projectId: string; jobId: string; revision: number }>()
const canvas = ref<HTMLCanvasElement>()
const documentBlob = shallowRef<Blob>()
const page = ref(1)
const pageCount = ref(0)
const loading = ref(false)
const rendering = ref(false)
const error = ref('')
const abort = new AbortController()
let disposed = false
let renderGeneration = 0
let task: PDFDocumentLoadingTask | undefined
let doc: PDFDocumentProxy | undefined
let renderTask: RenderTask | undefined

async function load() {
  if (loading.value || disposed) return
  loading.value = true
  error.value = ''
  try {
    const blob = await getPaperCompilePDF(props.projectId, props.jobId, abort.signal)
    if (disposed) return
    documentBlob.value = blob
    const { getDocument } = await loadPdfEngine()
    if (disposed) return
    const data = await blob.arrayBuffer()
    if (disposed) return
    // Canvas pixels only: no PDF scripting manager, annotation links or XFA.
    task = getDocument({ data, enableXfa: false, disableAutoFetch: true, stopAtErrors: true })
    doc = await task.promise
    if (disposed) return
    pageCount.value = doc.numPages
    if (pageCount.value < 1) throw new Error('empty PDF')
    await renderPage()
  } catch {
    if (!disposed) error.value = '无法预览 PDF，请重试或下载查看。'
  } finally {
    if (!disposed) loading.value = false
  }
}

async function renderPage() {
  if (!doc || !canvas.value || disposed) return
  const serial = ++renderGeneration
  rendering.value = true
  error.value = ''
  try {
    renderTask?.cancel()
    await renderTask?.promise.catch(() => undefined)
    if (disposed || serial !== renderGeneration) return
    const target = await doc.getPage(page.value)
    if (disposed || serial !== renderGeneration || !canvas.value) return
    const natural = target.getViewport({ scale: 1 })
    if (!(natural.width > 0 && natural.height > 0)) throw new Error('invalid page')
    const width = Math.max(1, (canvas.value.parentElement?.clientWidth || 480) - 16)
    const scale = Math.min(2, width / natural.width, 4096 / natural.width, 4096 / natural.height,
      Math.sqrt(8_000_000 / (natural.width * natural.height)))
    const viewport = target.getViewport({ scale })
    if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) throw new Error('invalid viewport')
    const context = canvas.value.getContext('2d')
    if (!context) throw new Error('canvas unavailable')
    canvas.value.width = Math.max(1, Math.floor(viewport.width))
    canvas.value.height = Math.max(1, Math.floor(viewport.height))
    renderTask = target.render({ canvas: canvas.value, canvasContext: context, viewport, annotationMode: 0 })
    await renderTask.promise
  } catch {
    if (!disposed && serial === renderGeneration) error.value = '页面渲染失败，可下载 PDF 查看。'
  } finally {
    if (!disposed && serial === renderGeneration) rendering.value = false
  }
}

function changePage(delta: number) {
  page.value = Math.min(pageCount.value, Math.max(1, page.value + delta))
  void renderPage()
}

function download() {
  if (!documentBlob.value) return
  const url = URL.createObjectURL(documentBlob.value)
  const link = document.createElement('a')
  link.href = url
  link.download = 'paper.pdf'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
onMounted(() => void load())
onBeforeUnmount(() => {
  disposed = true
  renderGeneration++
  abort.abort()
  renderTask?.cancel()
  void task?.destroy().catch(() => undefined)
  documentBlob.value = undefined
})
</script>

<style scoped>
.paper-pdf { margin-top: 12px; display: grid; gap: 10px; min-width: 0; }
.paper-pdf__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; font-size: .82rem; }
.paper-pdf__page { min-width: 0; overflow: auto; padding: 8px; background: var(--surface-secondary, #edf1f6); text-align: center; }
.paper-pdf__page canvas { max-width: 100%; height: auto; background: #fff; }
</style>
