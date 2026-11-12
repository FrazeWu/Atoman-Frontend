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
    <p v-if="chapterError && !chapterDraft" role="alert">{{ chapterError }}</p>
    <div v-if="markError" role="alert">
      <p>{{ markError }}</p>
      <PButton v-if="pendingMark && !markConflict" variant="secondary" :disabled="markBusy" @click="retryMark">重试标记操作</PButton>
      <PButton variant="ghost" :disabled="markBusy" @click="reloadMarks">重新载入书签与批注</PButton>
    </div>
    <BookPublicReaderView
      v-if="opened"
      :key="readerKey"
      :source="cloudSource"
      @annotate="openHighlight"
      @annotate-direct="directSaveHighlight"
      @annotation-edit="editHighlight"
      @annotation-update="directUpdateHighlight"
      @annotation-delete="deleteHighlight"
      @chapter-note="openChapterNote"
    />
    <div v-if="opened" class="cloud-reader__note-actions">
      <PButton size="sm" variant="ghost" @click="toggleChapterNotes">{{ chapterListOpen ? '收起本书笔记' : '查看本书章节笔记' }}</PButton>
      <RouterLink :to="`/books/work/${source.asset.work_id}/notes?revision_id=${revisionId}`">本作品全部笔记</RouterLink>
    </div>
    <section v-if="opened && chapterListOpen" class="cloud-reader__chapter-list" aria-label="本电子书章节笔记">
      <h3>本文件的章节笔记</h3>
      <p v-if="chapterListLoading">正在加载…</p>
      <p v-else-if="chapterListError" role="alert">{{ chapterListError }} <PButton variant="ghost" size="sm" @click="reloadChapterNotes">重试</PButton></p>
      <p v-else-if="!chapterNotes.length">暂无章节笔记。阅读时点击“章节笔记”即可创建。</p>
      <ul v-else><li v-for="item in chapterNotes" :key="item.id"><strong>{{ item.title || item.chapter_anchor?.chapter_title || '阅读笔记' }}</strong><PButton variant="ghost" size="sm" :disabled="chapterBusy" @click="editChapterNote(item.id)">编辑</PButton></li></ul>
      <p v-if="chapterNotes.length < chapterTotal" class="cloud-reader__chapter-more">还有其他笔记，请通过作品笔记页面查看。</p>
    </section>
    <BookPublicReaderView v-else-if="localOnly" :source="localSource" />
    <BookChapterNoteEditor v-if="chapterDraft" :key="`${chapterDraft.id}:${chapterDraft.version}`" ref="chapterEditor" :draft="chapterDraft" :busy="chapterBusy" :frozen="Boolean(chapterPending)" :conflict="chapterConflict" :error="chapterError" @save="saveChapterNote" @close="closeChapterNote" />
    <PButton v-if="chapterPending && !chapterConflict" variant="secondary" :disabled="chapterBusy" @click="performChapterNote">重试保存章节笔记</PButton>
    <BookHighlightEditor v-if="draft" :key="`${draft.id}:${draft.version}`" ref="editor" :draft="draft" :busy="markBusy" :frozen="Boolean(pendingMark)" :conflict="markConflict" :error="markError" allow-discussion @discuss="passages?.discuss(draft.anchor)" @save="saveHighlight" @delete="deleteHighlight(draft)" @close="draft = undefined" />
    <PSheet :show="!!deletingHighlight" title="删除划线与公开分享" mode="partial" @close="deletingHighlight = undefined">
      <div v-if="deletingHighlight" class="cloud-reader__share-warning">
        <p>删除此私人划线后，默认撤销所有包含它的有效分享链接。已发布快照不会被自动修改。</p>
        <template v-if="highlightShareImpact?.total">
          <p role="status">有 {{ highlightShareImpact.total }} 个已发布合集受影响：</p>
          <ul><li v-for="item in highlightShareImpact.items" :key="item.collection_id">{{ item.title }} · {{ item.visibility==='public'?'完全公开':'通过链接访问' }}</li></ul>
          <label><input v-model="keepHighlightShared" type="checkbox" aria-label="明确保留已发布划线分享" /> 我明确同意保留公开快照，删除私人划线后仍允许他人访问。</label>
        </template>
        <div class="cloud-reader__share-actions">
          <PButton variant="secondary" @click="deletingHighlight = undefined">取消</PButton>
          <PButton variant="danger" :disabled="markBusy" @click="confirmDeleteHighlight">{{ keepHighlightShared?'删除并保留分享':'删除并撤销相关分享' }}</PButton>
        </div>
      </div>
    </PSheet>
    <BookPassageDiscussions ref="passages" :revision-id="revisionId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { deleteReadingMark, listReadingMarks, listWorkNotes, saveReadingMark, type ReadingMark, type ReadingMarkInput, type WorkNoteItem, type ReadingPosition } from '@/api/bookReading'
import { getPrivateNote, savePrivateNote, type BookChapterAnchor, type PrivateNote, type NoteInput } from '@/api/bookPrivate'
import { getNoteShareImpact, type NoteShareImpact } from '@/api/bookNoteCollections'
import { useRevisionReading } from '@/composables/useRevisionReading'
import type { BookReaderSource } from '@/types/bookReaderSource'
import type { BookReaderBookmark } from '@/utils/bookReaderPreferences'
import BookPublicReaderView from '@/components/books/BookPublicReaderView.vue'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import BookHighlightEditor, { type HighlightDraft } from '@/components/books/BookHighlightEditor.vue'
import BookChapterNoteEditor from '@/components/books/BookChapterNoteEditor.vue'
import type { HighlightSelection } from '@/utils/bookMarkAnchors'
import BookPassageDiscussions from './BookPassageDiscussions.vue'

const props = defineProps<{ source: BookReaderSource; owner: string; revisionId: string }>()
const reading = useRevisionReading(props.owner, props.revisionId)
const route = useRoute()
const passages = ref<InstanceType<typeof BookPassageDiscussions>>()
const opened = ref(false)
const localOnly = ref(false)
const readerKey = ref(0)
const marks = shallowRef<ReadingMark[]>([])
const marksLoaded = ref(false)
const markError = ref('')
const markConflict = ref(false)
const markBusy = ref(false)
type MarkOperation = { id: string; input: ReadingMarkInput } | { id: string; version: number; keepShared?: boolean }
const pendingMark = shallowRef<MarkOperation>()
const draft = shallowRef<HighlightDraft>()
const deletingHighlight = shallowRef<{ id: string; version: number }>()
const highlightShareImpact = shallowRef<NoteShareImpact>()
const keepHighlightShared = ref(false)
const editor = ref<InstanceType<typeof BookHighlightEditor>>()
const chapterEditor = ref<InstanceType<typeof BookChapterNoteEditor>>()
const chapterDraft = shallowRef<PrivateNote>()
const chapterPending = shallowRef<{ id: string; input: NoteInput }>()
const chapterBusy = ref(false)
const chapterError = ref('')
const chapterConflict = ref(false)
const chapterListOpen = ref(false)
const chapterListLoading = ref(false)
const chapterListError = ref('')
const chapterNotes = shallowRef<WorkNoteItem[]>([])
const chapterTotal = ref(0)
const chapterTarget = shallowRef<ReadingPosition>()
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
const linkedPosition = computed(() => {
  const mark = marks.value.find(item => item.id === route.query.mark)
  if (mark) return { current_percent: 0, epub_cfi: mark.anchor.epub_start_cfi || '', pdf_page: mark.anchor.pdf_page || 0, pdf_offset: 0, txt_offset: mark.anchor.txt_offset_start || 0 }
  return chapterTarget.value || reading.initialPosition.value
})
const cloudSource = computed<BookReaderSource>(() => ({
  ...props.source, initialPosition: linkedPosition.value, bookmarks: bookmarks.value,
  annotations: marksLoaded.value ? marks.value.filter(mark => mark.kind === 'highlight') : undefined,
  supportsChapterNotes: true,
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
function closeChapterNote() {
  chapterDraft.value = undefined
  if (chapterConflict.value) {
    // A rejected conflicting edit must not leave the reader locked forever.
    chapterPending.value = undefined
    chapterConflict.value = false
    chapterError.value = ''
  }
}
function openChapterNote(anchor: BookChapterAnchor) {
  const workID = props.source.asset.work_id
  if (!workID || chapterDraft.value || chapterPending.value) return
  chapterError.value = ''
  chapterConflict.value = false
  chapterDraft.value = { id: crypto.randomUUID(), version: 0, work_id: workID, source_revision_id: props.revisionId, chapter_anchor: anchor, title: '', body: '', tags: [] }
}
async function reloadChapterNotes() {
  const workID = props.source.asset.work_id
  if (!workID) { chapterListError.value = '当前文件未关联作品，无法加载章节笔记'; return }
  chapterListLoading.value = true
  chapterListError.value = ''
  try {
    const result = await listWorkNotes(workID, { kind: 'chapter_note', revisionId: props.revisionId, limit: 50 }, reading.signal)
    if (stopped) return
    chapterNotes.value = result.items
    chapterTotal.value = result.total
  } catch {
    if (!stopped) chapterListError.value = '章节笔记读取失败，请重试。'
  } finally { chapterListLoading.value = false }
}
function toggleChapterNotes() {
  chapterListOpen.value = !chapterListOpen.value
  if (chapterListOpen.value) void reloadChapterNotes()
}
async function editChapterNote(id: string) {
  if (chapterDraft.value || chapterBusy.value || chapterPending.value) return
  chapterBusy.value = true
  chapterError.value = ''
  try {
    const note = await getPrivateNote(id)
    if (note.source_revision_id !== props.revisionId) throw new Error('这条笔记不属于当前文件')
    if (!stopped) { chapterConflict.value = false; chapterDraft.value = note }
  } catch (err) {
    if (!stopped) { chapterListError.value = err instanceof Error ? err.message : '无法加载笔记' }
  } finally { chapterBusy.value = false }
}
async function saveChapterNote(value: { title: string; body: string }) {
  const current = chapterDraft.value
  if (!current || chapterConflict.value || chapterBusy.value) return
  chapterPending.value ||= { id: current.id, input: { base_version: current.version, work_id: current.work_id, source_revision_id: current.source_revision_id, chapter_anchor: current.chapter_anchor, title: value.title, body: value.body, tags: current.tags } }
  await performChapterNote()
}
async function performChapterNote() {
  const operation = chapterPending.value
  if (!operation || chapterBusy.value) return
  chapterBusy.value = true
  chapterError.value = ''
  try {
    await savePrivateNote(operation.id, operation.input)
    if (!stopped) {
      chapterPending.value = undefined
      chapterConflict.value = false
      chapterDraft.value = undefined
      if (chapterListOpen.value) await reloadChapterNotes()
    }
  } catch (err) {
    if (!stopped) {
      chapterConflict.value = err instanceof ApiErrorResponseError && err.status === 409
      chapterError.value = chapterConflict.value ? '这条笔记已在其他设备更改。请复制当前内容后重新打开，避免覆盖。' : '保存未确认成功，已保留笔记与原请求，可重试。'
    }
  } finally { chapterBusy.value = false }
}
async function loadChapterDeepLink() {
  const id = typeof route.query.chapter_note === 'string' ? route.query.chapter_note : ''
  if (!id) return
  try {
    const note = await getPrivateNote(id)
    const anchor = note.chapter_anchor
    if (note.source_revision_id !== props.revisionId || !anchor || anchor.format !== props.source.asset.format) return
    chapterTarget.value = { current_percent: 0, advance_furthest: false, epub_cfi: anchor.epub_cfi || '', pdf_page: anchor.pdf_page || 0, pdf_offset: anchor.pdf_offset || 0, txt_offset: anchor.txt_offset || 0 }
  } catch { if (!stopped) chapterError.value = '无法读取该章节笔记的定位，将继续从最近阅读位置打开。' }
}

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
  } catch { if (!stopped) markError.value = '云端书签与批注载入失败，请重新载入；不会用本机旧数据覆盖。' }
}
function openHighlight(selection: HighlightSelection) {
  if (pendingMark.value || draft.value) return
  draft.value = { ...selection, id: crypto.randomUUID(), version: 0, note: '', color: 'yellow', style: 'highlight' }
}
async function directSaveHighlight(payload: { selection: HighlightSelection; color: string; style: string; note?: string; isQuote?: boolean }) {
  const id = crypto.randomUUID()
  const input: ReadingMarkInput = {
    base_version: 0,
    kind: 'highlight',
    anchor: payload.selection.anchor,
    quote: payload.selection.quote,
    label: payload.isQuote ? '精选书摘' : '',
    note: payload.note || '',
    color: payload.color,
    style: payload.style,
  }
  pendingMark.value = { id, input }
  try {
    await performMark()
  } catch {
    // Retain in pendingMark
  }
}
async function directUpdateHighlight(payload: ReadingMark) {
  const input: ReadingMarkInput = {
    base_version: payload.version,
    kind: 'highlight',
    anchor: payload.anchor,
    quote: payload.quote,
    label: payload.label || '',
    note: payload.note || '',
    color: payload.color,
    style: payload.style,
  }
  pendingMark.value = { id: payload.id, input }
  try {
    await performMark()
  } catch {
    // Retain in pendingMark
  }
}
function editHighlight(mark: ReadingMark) {
  if (pendingMark.value || draft.value) return
  draft.value = { id: mark.id, version: mark.version, anchor: { ...mark.anchor, pdf_rects: mark.anchor.pdf_rects?.map(rect => ({ ...rect })) }, quote: mark.quote, note: mark.note, color: mark.color, style: mark.style }
}
async function saveHighlight(value: { color: string; style: string; note: string }) {
  const selected = draft.value
  if (!selected || markConflict.value || (pendingMark.value && pendingMark.value.id !== selected.id)) return
  pendingMark.value ||= { id: selected.id, input: { base_version: selected.version, kind: 'highlight', anchor: selected.anchor, quote: selected.quote, label: '', ...value } }
  try { await performMark() } catch { /* 原选区和输入保留，原请求可幂等重试。 */ }
}
async function deleteHighlight(mark: { id: string; version: number }) {
  if (pendingMark.value || markBusy.value || deletingHighlight.value) return
  markBusy.value = true
  markError.value = ''
  keepHighlightShared.value = false
  highlightShareImpact.value = undefined
  try {
    const impact = await getNoteShareImpact('highlight', mark.id)
    if (!stopped) { highlightShareImpact.value = impact; deletingHighlight.value = { id: mark.id, version: mark.version } }
  } catch {
    if (!stopped) markError.value = '无法确认此划线关联的公开快照，暂不删除。请重试。'
  } finally { markBusy.value = false }
}
async function confirmDeleteHighlight() {
  const value = deletingHighlight.value
  if (!value || markBusy.value || pendingMark.value) return
  const keepShared = keepHighlightShared.value && !!highlightShareImpact.value?.total
  deletingHighlight.value = undefined
  highlightShareImpact.value = undefined
  keepHighlightShared.value = false
  pendingMark.value = { ...value, keepShared }
  try { await performMark() } catch { /* 保留版本化删除请求与原始标记供重试。 */ }
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
      if ('keepShared' in operation) await deleteReadingMark(props.revisionId, operation.id, operation.version, reading.signal, operation.keepShared)
      else await deleteReadingMark(props.revisionId, operation.id, operation.version, reading.signal)
      if (!stopped) marks.value = marks.value.filter(item => item.id !== operation.id)
    }
    if (!stopped) { pendingMark.value = undefined; if (draft.value?.id === operation.id) draft.value = undefined }
  } catch (err) {
    if (!stopped) {
      markConflict.value = err instanceof ApiErrorResponseError && err.status === 409
      markError.value = markConflict.value ? '这条阅读标记已在其他设备修改或删除，请重新载入，不会覆盖。' : '阅读标记操作未确认成功，请重试原操作；输入内容仍保留。'
    }
    throw err
  } finally { markBusy.value = false }
}
async function retryMark() { try { await performMark() } catch { /* 保留原 UUID 和内容供重试。 */ } }
async function retry() {
  if (opened.value) { await reading.flush(); return }
  if (await reading.start()) {
    await reloadMarks()
    await loadChapterDeepLink()
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
onBeforeRouteLeave(async () => {
  if (editor.value && !await editor.value.requestClose()) return false
  if (chapterEditor.value && !await chapterEditor.value.requestClose()) return false
  await reading.flush()
})
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
 .cloud-reader__note-actions { display:flex; gap:.8rem; align-items:center; flex-wrap:wrap; margin:.5rem 0; font-size:.85rem; }
 .cloud-reader__note-actions a { color:var(--a-color-primary,#3764a6); }
 .cloud-reader__chapter-list { border:1px solid var(--a-color-border-soft); padding:.85rem; border-radius:.6rem; margin:1rem 0; }
 .cloud-reader__chapter-list ul { list-style:none; padding:0; display:grid; gap:.6rem; }
 .cloud-reader__chapter-list li { display:flex; justify-content:space-between; align-items:center; gap:.6rem; }
 .cloud-reader__chapter-more { font-size:.83rem; color:var(--a-color-text-secondary); }
 .cloud-reader__share-warning { display:grid; gap:1rem; padding:1rem; }
 .cloud-reader__share-warning p { line-height:1.6; }
 .cloud-reader__share-warning label { display:flex; align-items:flex-start; gap:.6rem; }
 .cloud-reader__share-actions { display:flex; gap:.8rem; flex-wrap:wrap; }
</style>
