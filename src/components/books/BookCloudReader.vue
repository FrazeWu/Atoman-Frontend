<template>
  <div @pointerdown.capture="reading.activity" @keydown.capture="reading.activity" @wheel.capture.passive="reading.activity" @touchstart.capture.passive="reading.activity">
    <div class="cloud-reader__status">
      <span role="status" aria-live="polite">{{ message }}</span>
      <PButton v-if="reading.status.value === 'offline'" variant="secondary" @click="retry">重试同步</PButton>
      <PButton v-if="!opened && reading.status.value === 'offline'" variant="ghost" @click="localOnly = true">仅本机阅读</PButton>
    </div>
    <div v-if="reading.status.value === 'conflict'" class="cloud-reader__conflict" role="alert">
      <p>其他设备已更新进度（云端 {{ Math.round((reading.conflict.value?.current_percent || 0) * 100) }}%）。请选择继续位置，不会自动覆盖。</p>
      <PButton variant="secondary" @click="chooseCloud">采用云端位置</PButton>
      <PButton variant="ghost" @click="reading.chooseLocal">保留当前位置并同步</PButton>
    </div>
    <div v-if="markError" role="alert">
      <p>{{ markError }}</p>
      <PButton v-if="pendingMark && !markConflict" variant="secondary" :disabled="markBusy" @click="retryMark">重试书签操作</PButton>
      <PButton variant="ghost" :disabled="markBusy" @click="reloadMarks">重新载入书签</PButton>
    </div>
    <BookPublicReaderView v-if="opened" :key="readerKey" :source="cloudSource" />
    <BookPublicReaderView v-else-if="localOnly" :source="localSource" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { deleteReadingMark, listReadingMarks, saveReadingMark, type ReadingMark, type ReadingMarkInput } from '@/api/bookReading'
import { useRevisionReading } from '@/composables/useRevisionReading'
import type { BookReaderSource } from '@/types/bookReaderSource'
import type { BookReaderBookmark } from '@/utils/bookReaderPreferences'
import BookPublicReaderView from '@/views/books/BookPublicReaderView.vue'
import PButton from '@/components/ui/PButton.vue'

const props = defineProps<{ source: BookReaderSource; owner: string; revisionId: string }>()
const reading = useRevisionReading(props.owner, props.revisionId)
const opened = ref(false)
const localOnly = ref(false)
const readerKey = ref(0)
const marks = shallowRef<ReadingMark[]>([])
const marksLoaded = ref(false)
const markError = ref('')
const markConflict = ref(false)
const markBusy = ref(false)
type MarkOperation = { id: string; input: ReadingMarkInput } | { id: string; version: number }
const pendingMark = shallowRef<MarkOperation>()
let heartbeatTimer: ReturnType<typeof setInterval> | undefined
let stopped = false
const message = computed(() => {
  if (localOnly.value && !opened.value) return '进度暂存本机，重新连接后确认同步；本机模式的书签不会自动上传。'
  return ({ loading: '正在读取云端进度…', saved: '进度已同步到云端 · 书签仅本人可见', pending: '进度已暂存本机，等待同步…', saving: '正在同步进度…', offline: '云端同步失败。未同步进度暂存本机，可重试。', conflict: '跨设备进度冲突，已暂停同步。' })[reading.status.value]
})
const bookmarks = computed<BookReaderBookmark[]>(() => marks.value.filter(mark => mark.kind === 'bookmark').map(mark => ({
  id: mark.id, label: mark.label, created_at: mark.created_at, reading_percent: 0,
  epub_cfi: mark.anchor.epub_start_cfi, pdf_page: mark.anchor.pdf_page, comic_page: mark.anchor.pdf_page, txt_offset: mark.anchor.txt_offset_start,
})))
const localSource = computed<BookReaderSource>(() => ({ ...props.source, onPosition: reading.observe }))
const cloudSource = computed<BookReaderSource>(() => ({
  ...props.source, initialPosition: reading.initialPosition.value, bookmarks: bookmarks.value,
  onPosition: reading.observe, onReady: reading.ready,
  addBookmark: async bookmark => {
    if (!marksLoaded.value) throw new Error('书签尚未载入')
    if (pendingMark.value) throw new Error('请先重试或重新载入尚未确认的书签操作')
    if (!pendingMark.value) {
      const format = props.source.asset.format
      pendingMark.value = { id: bookmark.id, input: { base_version: 0, kind: 'bookmark', label: bookmark.label, quote: '', note: '', color: '', style: '', anchor: format === 'epub' ? { epub_start_cfi: bookmark.epub_cfi } : format === 'txt' ? { txt_offset_start: bookmark.txt_offset || 0 } : { pdf_page: bookmark.pdf_page || bookmark.comic_page || 1 } } }
    }
    await performMark()
    return bookmarks.value
  },
  removeBookmark: async id => {
    const mark = marks.value.find(item => item.id === id)
    if (!mark) return bookmarks.value
    if (pendingMark.value && pendingMark.value.id !== id) throw new Error('请先处理尚未保存的书签')
    pendingMark.value ||= { id, version: mark.version }
    await performMark()
    return bookmarks.value
  },
}))
async function reloadMarks() {
  try {
    const result = await listReadingMarks(props.revisionId, reading.signal)
    if (stopped) return
    // 完整云端快照替换本机列表；删除记录不会被本机旧书签复活。
    marks.value = result.items
    marksLoaded.value = true
    pendingMark.value = undefined
    markError.value = ''
    markConflict.value = false
  } catch { if (!stopped) markError.value = '云端书签载入失败，请重新载入；不会用本机旧数据覆盖。' }
}
async function performMark() {
  const operation = pendingMark.value
  if (!operation || markBusy.value) return
  markBusy.value = true
  markError.value = ''
  try {
    if ('input' in operation) {
      const mark = await saveReadingMark(props.revisionId, operation.id, operation.input, reading.signal)
      if (!stopped) marks.value = [mark, ...marks.value.filter(item => item.id !== mark.id)]
    } else {
      await deleteReadingMark(props.revisionId, operation.id, operation.version, reading.signal)
      if (!stopped) marks.value = marks.value.filter(item => item.id !== operation.id)
    }
    if (!stopped) pendingMark.value = undefined
  } catch (err) {
    if (!stopped) {
      markConflict.value = err instanceof ApiErrorResponseError && err.status === 409
      markError.value = markConflict.value ? '这条书签已在其他设备修改或删除，请重新载入书签，不会覆盖。' : '书签操作未确认成功，请重试原操作。'
    }
    throw err
  } finally { markBusy.value = false }
}
async function retryMark() { try { await performMark() } catch { /* 保留原 UUID 和内容供重试。 */ } }
async function retry() {
  if (opened.value) { await reading.flush(); return }
  if (await reading.start()) {
    await reloadMarks()
    if (!stopped) { localOnly.value = false; opened.value = true }
  }
}
function chooseCloud() { reading.chooseCloud(); readerKey.value++ }
function visibility() { void reading.heartbeat(); if (document.visibilityState === 'hidden') void reading.flush() }
function pagehide() { void reading.heartbeat(true) }
onMounted(() => {
  void retry()
  heartbeatTimer = setInterval(() => { void reading.heartbeat() }, 15_000)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', pagehide)
})
onBeforeRouteLeave(async () => { await reading.flush() })
onBeforeUnmount(() => {
  stopped = true
  clearInterval(heartbeatTimer)
  document.removeEventListener('visibilitychange', visibility)
  window.removeEventListener('pagehide', pagehide)
  reading.dispose()
})
</script>

<style scoped>
.cloud-reader__status { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; color: var(--a-color-muted-soft); }
.cloud-reader__conflict { padding: 1rem; border: 1px solid var(--a-color-border-soft); }
</style>
