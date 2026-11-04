<template>
  <section class="work-notes a-content-frame" aria-label="作品笔记时间线">
    <PPageHeader title="我的笔记" :sub="workTitle ? `${workTitle} · 跨电子书文件汇总` : '按作品汇总不同电子书上的划线与笔记'" />
    <nav class="work-notes__navigation">
      <RouterLink :to="`/books/work/${workId}`">返回作品详情</RouterLink>
      <RouterLink to="/books/notes">管理独立笔记</RouterLink>
      <RouterLink :to="`/books/work/${workId}/collections`">我的笔记合集</RouterLink>
    </nav>
    <div class="work-notes__toolbar">
      <label for="work-notes-filter">记录类型</label>
      <select id="work-notes-filter" v-model="kind" aria-label="筛选笔记类型">
        <option value="all">全部</option>
        <option value="highlight">划线与批注</option>
        <option value="chapter_note">独立章节笔记</option>
      </select>
      <button v-if="selectedRevision" type="button" class="work-notes__clear" @click="selectedRevision = ''">清除文件筛选</button>
      <span class="work-notes__total">{{ total }} 条记录</span>
    </div>
    <p v-if="selectedRevision" class="work-notes__hint">当前仅显示所选具体电子书的记录；清除筛选后可查看本作品全部版本。</p>
    <p v-if="loading && !items.length" role="status">正在加载笔记…</p>
    <div v-if="error" class="work-notes__error" role="alert">{{ error }} <button type="button" @click="reload">重试</button></div>
    <p v-if="!loading && !error && !items.length" class="work-notes__empty">暂无笔记。阅读时划线、添加批注或创建章节笔记后，会汇总在这里。</p>
    <ol class="work-notes__timeline" aria-label="按最近更新排序的笔记">
      <li v-for="item in items" :key="`${item.type}:${item.id}`" class="work-notes__entry" :data-note-id="item.id">
        <article class="work-notes__card">
          <div class="work-notes__meta">
            <span class="work-notes__kind">{{ item.type === 'highlight' ? '划线与批注' : '独立章节笔记' }}</span>
            <time :datetime="item.updated_at">{{ formatTime(item.updated_at) }}</time>
          </div>
          <h3 v-if="item.title" class="work-notes__title">{{ item.title }}</h3>
          <blockquote v-if="item.quote" class="work-notes__quote" :data-color="item.color || 'yellow'">{{ item.quote }}</blockquote>
          <p v-if="item.note" class="work-notes__body">{{ item.note }}</p>
          <div class="work-notes__origin">
            <span v-if="item.source" class="work-notes__file">{{ item.source.file_name }}<span v-if="item.source.format"> · {{ item.source.format.toUpperCase() }}</span><span v-if="item.source.edition_label"> · {{ item.source.edition_label }}</span></span>
            <span v-else>作品级独立笔记 · 未关联电子书文件</span>
            <span v-if="item.anchor?.pdf_page">第 {{ item.anchor.pdf_page }} 页</span>
            <span v-if="item.chapter_anchor">{{ item.chapter_anchor.chapter_title || (item.chapter_anchor.pdf_page ? `第 ${item.chapter_anchor.pdf_page} 页` : '已保存阅读位置') }}</span>
          </div>
          <div class="work-notes__actions">
            <RouterLink v-if="item.source?.can_open && ((item.type === 'highlight' && item.anchor) || (item.type === 'chapter_note' && item.chapter_anchor))" :to="sourceLink(item)" class="work-notes__link">{{ item.type === 'highlight' ? '跳转原文' : '跳转笔记位置' }}</RouterLink>
            <span v-else-if="item.source && !item.source.can_open" class="work-notes__unavailable">原文件不可访问，笔记仍然保留</span>
            <span v-else-if="item.type === 'chapter_note' && !item.chapter_anchor" class="work-notes__muted">此旧笔记未保存精确位置</span>
            <button v-if="item.source && !selectedRevision" type="button" class="work-notes__link" @click="selectedRevision = item.source.revision_id">仅看此文件</button>
            <RouterLink :to="{ path: `/books/work/${workId}/collections/new`, query: { kind: item.type, note_id: item.id } }" class="work-notes__link">单条分享 / 加入合集</RouterLink>
          </div>
        </article>
      </li>
    </ol>
    <button v-if="items.length < total" type="button" class="work-notes__more" :disabled="loading" @click="loadMore">{{ loading ? '加载中…' : '加载更多' }}</button>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { listWorkNotes, type WorkNoteItem } from '@/api/bookReading'
import { getCatalogWork } from '@/api/bookCatalog'

const route = useRoute()
const workId = computed(() => String(route.params.workId || ''))
const workTitle = ref('')
const kind = ref<'all' | 'highlight' | 'chapter_note'>('all')
const selectedRevision = ref(String(route.query.revision_id || ''))
const items = ref<WorkNoteItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
let controller: AbortController | undefined
let generation = 0
function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}
function sourceLink(item: WorkNoteItem) {
  const source = item.source!
  return { path: `/books/read/${source.work_id}/${source.asset_id}/${source.revision_id}`, query: item.type === 'chapter_note' ? { chapter_note: item.id } : { mark: item.id } }
}
async function load(reset: boolean) {
  const current = ++generation
  controller?.abort()
  controller = new AbortController()
  if (reset) { items.value = []; total.value = 0 }
  const offset = reset ? 0 : items.value.length
  loading.value = true
  error.value = ''
  try {
    const result = await listWorkNotes(workId.value, { kind: kind.value, revisionId: selectedRevision.value || undefined, limit: 30, offset }, controller.signal)
    if (current !== generation) return
    items.value = reset ? result.items : [...items.value, ...result.items]
    total.value = result.total
  } catch (cause) {
    if (current !== generation || controller.signal.aborted) return
    error.value = cause instanceof Error ? cause.message : '笔记加载失败'
  } finally { if (current === generation) loading.value = false }
}
function reload() { void load(true) }
function loadMore() { if (!loading.value && items.value.length < total.value) void load(false) }
watch([workId, kind, selectedRevision], () => void load(true), { immediate: true })
watch(workId, async id => {
  workTitle.value = ''
  try { const work = await getCatalogWork(id); if (id === workId.value) workTitle.value = work.title } catch { /* Timeline still works without public work metadata. */ }
}, { immediate: true })
onBeforeUnmount(() => { generation++; controller?.abort() })
</script>

<style scoped>
.work-notes { display:flex; flex-direction:column; gap:1rem; max-width:1050px; padding:1rem 1.25rem 3rem; margin:0 auto; }
.work-notes__navigation { display:flex; gap:1.25rem; font-size:.9rem; }
.work-notes__navigation a,.work-notes__link { color:var(--a-color-primary, #3764a6); text-decoration:none; }
.work-notes__toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:.8rem; font-size:.9rem; }
.work-notes__toolbar select { border:1px solid var(--a-color-border-soft); border-radius:.45rem; padding:.45rem .7rem; background:var(--a-color-surface, white); }
.work-notes__total { margin-left:auto; color:var(--a-color-text-secondary); }
.work-notes__hint,.work-notes__muted,.work-notes__unavailable { color:var(--a-color-text-secondary); font-size:.8rem; }
.work-notes__clear,.work-notes__link { background:transparent; padding:0; border:0; font:inherit; cursor:pointer; }
.work-notes__timeline { display:flex; flex-direction:column; list-style:none; padding:0; margin:0; gap:.9rem; }
.work-notes__card { border:1px solid var(--a-color-border-soft); border-radius:.8rem; padding:1.1rem 1.2rem; background:var(--a-color-surface,transparent); }
.work-notes__meta,.work-notes__origin,.work-notes__actions { display:flex; justify-content:space-between; gap:.7rem; flex-wrap:wrap; }
.work-notes__meta { font-size:.79rem; color:var(--a-color-text-secondary); }
.work-notes__kind { font-weight:600; }
.work-notes__title { font-size:1rem; margin:.6rem 0; }
.work-notes__quote { border-left:3px solid #d4ac37; margin:.85rem 0; padding:.4rem .7rem; line-height:1.7; }
.work-notes__quote[data-color='green'] { border-color:#64a979; }
.work-notes__quote[data-color='blue'] { border-color:#6097d9; }
.work-notes__quote[data-color='pink'] { border-color:#da79ae; }
.work-notes__body { white-space:pre-wrap; line-height:1.7; }
.work-notes__origin { font-size:.8rem; color:var(--a-color-text-secondary); padding-top:.65rem; }
.work-notes__actions { justify-content:flex-start; margin-top:.8rem; font-size:.85rem; }
.work-notes__error { color:var(--a-color-danger, #b42318); }
.work-notes__more { align-self:center; border:1px solid var(--a-color-border-soft); border-radius:.5rem; padding:.55rem 1.8rem; background:transparent; }
</style>
