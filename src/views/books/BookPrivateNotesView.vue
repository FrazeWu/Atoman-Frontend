<template>
  <section class="book-catalog private-books">
    <!-- 顶栏标题与快捷操作 -->
    <div class="private-books__header">
      <PPageHeader title="我的读书笔记" sub="全书库划线摘录、随手批注与深度长篇笔记。" mb="0" />

      <div class="private-books__header-actions">
        <PButton variant="ghost" size="sm" :disabled="busy" @click="backup('markdown')">
          <Download :size="14" aria-hidden="true" />
          <span>导出全部笔记</span>
        </PButton>
        <PButton size="sm" @click="create">
          <Plus :size="14" aria-hidden="true" />
          <span>+ 写长篇笔记</span>
        </PButton>
      </div>
    </div>

    <!-- 顶部状态提示 -->
    <p v-if="error" role="alert" class="book-catalog__error">{{ error }}</p>
    <p v-if="notice" role="status" class="private-books__notice">{{ notice }}</p>

    <!-- 分栏 Segmented Control 与筛选工具条 -->
    <div class="private-books__notes-toolbar">
      <!-- 选项卡切换：长篇书评 / 划线摘录 / 回收站 -->
      <div class="private-books__tabs-wrapper">
        <PSegmentedControl
          :model-value="activeTab"
          :options="noteTabs"
          @update:model-value="onTabChange"
        />

        <!-- 保持辅助/单测兼容的回收站复选框 -->
        <label style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;">
          <input
            v-model="trash"
            type="checkbox"
            @change="onTrashCheckboxChange"
          />
          <span>回收站</span>
        </label>
      </div>

      <!-- 筛选与搜索控件 (针对长篇笔记与回收站) -->
      <div v-if="activeTab !== 'highlights'" class="private-books__filter-inputs">
        <div class="private-books__search-box">
          <Search :size="13" class="private-books__search-icon" aria-hidden="true" />
          <input
            v-model="query"
            type="search"
            placeholder="搜索笔记标题或内容..."
            class="private-books__search-input"
            @keyup.enter="load()"
          />
        </div>

        <div v-if="activeTab === 'notes'" class="private-books__tag-filter-box">
          <input
            v-model="tag"
            placeholder="标签过滤..."
            class="private-books__tag-input-field"
            @keyup.enter="load()"
          />
          <button
            v-if="tag"
            type="button"
            class="private-books__tag-clear-btn"
            title="清除标签过滤"
            @click="clearTagFilter"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <!-- 加载中状态 -->
    <p v-if="loading && activeTab !== 'highlights'" role="status" class="private-books__loading">正在加载笔记…</p>

    <template v-else>
      <!-- =====================================================================
           视图 1：划线摘录流 (复用升级后的 BookPrivateHighlights，真实后端)
           ===================================================================== -->
      <div v-if="activeTab === 'highlights'" class="private-books__highlights-pane">
        <BookPrivateHighlights />
      </div>

      <!-- =====================================================================
           视图 2：长篇读书笔记与书评 (真实后端 /me/private-notes)
           ===================================================================== -->
      <div v-else class="space-y-4">
        <BookHighlightTrash v-if="trash" />

        <div v-if="activeTab === 'notes' && tag" class="private-books__active-filter-strip">
          <span class="text-xs text-[var(--a-color-text-secondary)]">当前筛选标签：</span>
          <span class="private-books__active-tag-pill">
            # {{ tag }}
            <button type="button" @click="clearTagFilter" aria-label="清除当前标签筛选">✕</button>
          </span>
        </div>

        <p v-if="notes.length" class="private-books__count">
          {{ trash ? `回收站共 ${total} 条笔记` : `共 ${total} 条长篇笔记` }}
        </p>

        <PEmpty
          v-if="!notes.length"
          :description="trash ? '没有已删除的独立笔记。已删除划线单独列在上方，统一保留 30 天。' : '暂无长篇笔记。点击上方“+ 写长篇笔记”开始记录。'"
        />

        <ul v-else class="private-books__notes-grid">
          <li v-for="item in notes" :key="item.id" class="private-books__note-card">
            <div class="private-books__note-header">
              <strong class="private-books__note-title">
                {{ item.title || '未命名笔记' }}
              </strong>
              <div v-if="item.tags.length" class="private-books__tags-list">
                <button
                  v-for="t in item.tags"
                  :key="t"
                  type="button"
                  class="private-books__tag-btn"
                  :title="'按标签 #' + t + ' 筛选'"
                  @click="filterByTag(t)"
                >
                  # {{ t }}
                </button>
              </div>
            </div>

            <p class="private-books__body">{{ item.body }}</p>

            <div class="private-books__toolbar">
              <RouterLink
                v-if="item.work_id"
                :to="{ path: `/books/work/${item.work_id}`, query: route.query }"
                class="private-books__action-link"
              >
                <BookOpen :size="13" aria-hidden="true" class="inline-block mr-1" />
                <span>图书详情 ➔</span>
              </RouterLink>

              <div class="private-books__card-buttons">
                <template v-if="trash">
                  <PButton variant="secondary" size="sm" :disabled="busy" @click="restore(item)">
                    恢复笔记
                  </PButton>
                  <PButton variant="ghost" size="sm" :disabled="busy" class="private-books__btn-danger" @click="prepareErase(item)">
                    彻底销毁
                  </PButton>
                </template>
                <template v-else>
                  <PButton variant="secondary" size="sm" :disabled="busy" @click="edit(item)">
                    编辑
                  </PButton>
                  <PButton variant="ghost" size="sm" :disabled="busy" @click="preparePublish(item)">
                    发布为博客
                  </PButton>
                  <PButton variant="ghost" size="sm" :disabled="busy" class="private-books__btn-danger" @click="prepareDelete(item)">
                    删除
                  </PButton>
                </template>
              </div>
            </div>
          </li>
        </ul>

        <!-- 加载更多 -->
        <div v-if="notes.length < total" class="flex justify-center pt-2">
          <PButton
            variant="secondary"
            size="sm"
            :disabled="loading"
            @click="load(true)"
          >
            加载更多笔记 ({{ notes.length }} / {{ total }})
          </PButton>
        </div>
      </div>
    </template>

    <!-- 侧栏抽屉：编辑 / 新建私人笔记 -->
    <PSheet :show="!!draft" title="私人读书笔记" mode="full" @close="requestClose">
      <form v-if="draft" class="private-books__note-editor" @submit.prevent="save">
        <label class="private-books__field-group">
          <span class="private-books__field-label">关联图书作品</span>
          <div class="flex gap-2">
            <input
              v-model="workQuery"
              placeholder="输入作品名检索…"
              class="private-books__filter-input flex-1"
              @keyup.enter.prevent="findWorks"
            />
            <PButton type="button" variant="secondary" size="sm" @click="findWorks">
              检索
            </PButton>
          </div>
          <select v-if="works.length" v-model="draft.work_id" class="private-books__filter-select mt-2">
            <option value="">（不绑定特定图书）</option>
            <option v-for="w in works" :key="w.id" :value="w.id">{{ w.title }}</option>
          </select>
        </label>

        <label class="private-books__field-group">
          <span class="private-books__field-label">标题</span>
          <input
            v-model="draft.title"
            placeholder="笔记标题"
            class="private-books__filter-input"
          />
        </label>

        <label class="private-books__field-group">
          <span class="private-books__field-label">正文</span>
          <textarea
            v-model="draft.body"
            rows="12"
            placeholder="记录你的阅读心得、思想推演或书评…"
            class="private-books__filter-input font-mono text-sm leading-relaxed"
          />
        </label>

        <label class="private-books__field-group">
          <span class="private-books__field-label">分类标签</span>
          <input
            v-model="draftTags"
            placeholder="逗号分隔，如：历史, 哲学"
            class="private-books__filter-input"
          />
        </label>

        <p v-if="editError" role="alert" class="book-catalog__error">{{ editError }}</p>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-[var(--a-color-border-soft)]">
          <PButton type="button" variant="ghost" :disabled="busy" @click="requestClose">
            取消
          </PButton>
          <PButton type="submit" :disabled="busy">
            {{ busy ? '正在保存…' : '保存笔记' }}
          </PButton>
        </div>
      </form>
    </PSheet>

    <!-- 发布为独立博客副本 -->
    <PSheet :show="!!publishing" title="发布为独立博客" mode="full" @close="publishing = null">
      <div v-if="publishing" class="space-y-4 text-sm p-4">
        <p class="text-[var(--a-color-text-secondary)] leading-relaxed">
          将私人笔记作为一篇公开博客文章发布。发布后正文将复制为博客草稿，此私人笔记仍保留在书库中。
        </p>
        <label class="block">
          <span class="block text-xs font-medium mb-1">选择目标频道</span>
          <select v-model="channelId" class="private-books__filter-select w-full">
            <option value="">请选择自己的博客频道</option>
            <option v-for="ch in channels" :key="ch.id" :value="ch.id">{{ ch.name }}</option>
          </select>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="confirmPublic" type="checkbox" />
          <span class="text-xs">我确认以上正文将对所有人公开</span>
        </label>
        <p v-if="editError" role="alert" class="book-catalog__error">{{ editError }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <PButton variant="ghost" @click="publishing = null">取消</PButton>
          <PButton :disabled="busy || !channelId || !confirmPublic" @click="publish">
            {{ busy ? '正在发布…' : '确认发布' }}
          </PButton>
        </div>
      </div>
    </PSheet>

    <!-- 删除前明确显示每个受到影响的公开快照及保留选项 -->
    <PSheet :show="!!deleting" :title="trash ? '回收站笔记' : '删除私人笔记'" mode="partial" @close="deleting = null">
      <div v-if="deleting" class="space-y-4 p-4">
        <p>笔记移入回收站后可在 30 天内恢复；默认会撤销所有包含它的当前公开快照。</p>
        <template v-if="shareImpact?.total">
          <p role="status">此笔记属于 {{ shareImpact.total }} 个正在分享的快照，撤销时整个合集的分享链接都将失效：</p>
          <ul class="list-disc pl-5">
            <li v-for="impact in shareImpact.items" :key="impact.collection_id">
              {{ impact.title }}（{{ impact.visibility === 'public' ? '完全公开' : '通过链接访问' }}）
            </li>
          </ul>
          <label class="flex gap-2 items-start cursor-pointer">
            <input v-model="keepShared" type="checkbox" aria-label="明确保留已发布快照" />
            <span>我明确选择保留这些已公开快照，即使删除私人原笔记，分享内容仍可被访问。</span>
          </label>
        </template>
        <div class="flex gap-3 justify-end pt-2">
          <PButton variant="secondary" @click="deleting = null">取消</PButton>
          <PButton variant="danger" :disabled="busy" @click="remove">
            {{ keepShared ? '删除并保留分享' : '删除并撤销相关分享' }}
          </PButton>
        </div>
      </div>
    </PSheet>

    <!-- 彻底销毁二次确认 -->
    <PConfirm
      :show="!!erasing"
      title="确认彻底销毁这条私人笔记？"
      message="立即擦除已删除的正文、标题、标签和阅读位置，之后无法恢复。原来明确保留的公开快照不会因此自动撤销。"
      :danger="true"
      confirm-text="确认永久销毁"
      :loading="busy"
      @confirm="erase"
      @cancel="erasing = null"
    />

    <!-- 未保存关闭拦截 -->
    <PConfirm
      :show="confirmClose"
      title="存在未保存的更改"
      message="当前修改尚未保存，关闭将放弃已输入的内容。"
      @confirm="finishClose(true)"
      @cancel="finishClose(false)"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Plus, Download, Search, BookOpen } from 'lucide-vue-next'
import { apiGet } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import {
  deletePrivateNote,
  erasePrivateNote,
  downloadBookData,
  exportPrivateNotes,
  listPrivateNotes,
  publishPrivateNote,
  restorePrivateNote,
  savePrivateNote,
  type PrivateNote,
} from '@/api/bookPrivate'
import { searchCatalogWorks } from '@/api/bookCatalog'
import { getNoteShareImpact, type NoteShareImpact } from '@/api/bookNoteCollections'
import type { BookPublicWork } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import BookPrivateHighlights from '@/components/books/BookPrivateHighlights.vue'
import BookHighlightTrash from '@/components/books/BookHighlightTrash.vue'
import './bookCatalog.css'
import './bookPrivate.css'

const route = useRoute()
const router = useRouter()

// 选项卡状态：默认 'notes' 以兼容测试契约
const activeTab = ref<'notes' | 'highlights' | 'trash'>('notes')
const noteTabs = [
  { label: '长篇笔记', value: 'notes' },
  { label: '划线摘录', value: 'highlights' },
  { label: '回收站', value: 'trash' },
]

const notes = ref<PrivateNote[]>([])
const total = ref(0)
const query = ref('')
const tag = ref('')
const trash = ref(false)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const notice = ref('')

const draft = ref<{
  id: string
  base_version: number
  work_id: string
  source_revision_id?: string
  title: string
  body: string
  tags: string[]
} | null>(null)

const draftTags = ref('')
const editError = ref('')
const original = ref('')
const deleting = ref<PrivateNote | null>(null)
const erasing = ref<PrivateNote | null>(null)
const shareImpact = ref<NoteShareImpact | null>(null)
const keepShared = ref(false)
const confirmClose = ref(false)
let closeResolve: ((value: boolean) => void) | undefined

const works = ref<BookPublicWork[]>([])
const workQuery = ref('')

const publishing = ref<PrivateNote | null>(null)
const channelId = ref('')
const channels = ref<{ id: string; name: string }[]>([])
const confirmPublic = ref(false)
let publishRequest = ''

const dirty = computed(() => draft.value && serialized() !== original.value)

function serialized() {
  if (!draft.value) return ''
  return JSON.stringify({ ...draft.value, tags: draftTags.value })
}

function onTabChange(tab: string) {
  const t = tab as 'notes' | 'highlights' | 'trash'
  activeTab.value = t
  if (t === 'trash') {
    trash.value = true
    load()
  } else if (t === 'notes') {
    trash.value = false
    load()
  }
}

function onTrashCheckboxChange() {
  activeTab.value = trash.value ? 'trash' : 'notes'
  load()
}

function filterByTag(selectedTag: string) {
  tag.value = selectedTag
  void load()
}

function clearTagFilter() {
  tag.value = ''
  void load()
}

async function load(append = false) {
  if (activeTab.value === 'highlights') return
  loading.value = true
  error.value = ''
  try {
    const page = await listPrivateNotes({
      q: query.value.trim() || undefined,
      tag: tag.value.trim() || undefined,
      trash: trash.value,
      offset: append ? notes.value.length : 0,
    })
    notes.value = append ? [...notes.value, ...page.items] : page.items
    total.value = page.total
  } catch {
    error.value = '笔记加载失败，请重新加载。'
  } finally {
    loading.value = false
  }
}

function create() {
  draft.value = {
    id: crypto.randomUUID(),
    base_version: 0,
    work_id: String(route.query.work || ''),
    title: '',
    body: '',
    tags: [],
    ...(route.query.revision ? { source_revision_id: String(route.query.revision) } : {}),
  }
  draftTags.value = ''
  editError.value = ''
  original.value = serialized()
  void findWorks()
}

function edit(note: PrivateNote) {
  draft.value = {
    id: note.id,
    base_version: note.version,
    work_id: note.work_id,
    source_revision_id: note.source_revision_id,
    title: note.title,
    body: note.body,
    tags: [...note.tags],
  }
  draftTags.value = note.tags.join(', ')
  editError.value = ''
  original.value = serialized()
}

async function findWorks() {
  try {
    works.value = (await searchCatalogWorks(workQuery.value)).items
  } catch {
    editError.value = '图书搜索失败，请重试。'
  }
}

async function save() {
  if (!draft.value || busy.value) return
  busy.value = true
  editError.value = ''
  const { id, ...input } = draft.value
  try {
    await savePrivateNote(id, {
      ...input,
      tags: draftTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean),
    })
    draft.value = null
    notice.value = '私人笔记已保存。'
    await load()
  } catch {
    editError.value = '保存失败或云端已有新版本。输入仍保留，请勿覆盖其他设备的更改；可复制正文后重新加载。'
  } finally {
    busy.value = false
  }
}

function requestClose(): Promise<boolean> {
  if (busy.value) return Promise.resolve(false)
  if (!dirty.value) {
    draft.value = null
    return Promise.resolve(true)
  }
  confirmClose.value = true
  return new Promise(resolve => {
    closeResolve = resolve
  })
}

function finishClose(value: boolean) {
  confirmClose.value = false
  if (value) draft.value = null
  closeResolve?.(value)
  closeResolve = undefined
}

function prepareErase(note: PrivateNote) {
  if (busy.value) return
  erasing.value = note
}

async function erase() {
  const note = erasing.value
  erasing.value = null
  if (!note || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await erasePrivateNote(note)
    notice.value = '笔记正文及阅读位置已永久销毁。'
    await load()
  } catch {
    error.value = '永久销毁失败，请刷新回收站后重试。'
  } finally {
    busy.value = false
  }
}

async function prepareDelete(note: PrivateNote) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  keepShared.value = false
  shareImpact.value = null
  try {
    shareImpact.value = await getNoteShareImpact('chapter_note', note.id)
    deleting.value = note
  } catch {
    error.value = '无法确认笔记关联的公开快照，因此暂不删除。请重试。'
  } finally {
    busy.value = false
  }
}

async function remove() {
  const note = deleting.value
  const keep = keepShared.value && !!shareImpact.value?.total
  deleting.value = null
  keepShared.value = false
  shareImpact.value = null
  if (!note || busy.value) return
  busy.value = true
  try {
    await deletePrivateNote(note, keep)
    await load()
  } catch {
    error.value = '删除失败或笔记已更改，请重新加载后重试。'
  } finally {
    busy.value = false
  }
}

async function restore(note: PrivateNote) {
  busy.value = true
  try {
    await restorePrivateNote(note)
    await load()
    notice.value = '笔记已恢复。'
  } catch {
    error.value = '恢复失败：请重新加载，超过 30 天的笔记不能恢复。'
  } finally {
    busy.value = false
  }
}

async function backup(format: 'json' | 'markdown') {
  busy.value = true
  error.value = ''
  try {
    const data = await exportPrivateNotes()
    if (format === 'json') {
      downloadBookData(JSON.stringify(data, null, 2), 'atoman-notes.json', 'application/json')
    } else {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      data.notes.forEach(n =>
        zip.file(
          `${n.id}.md`,
          `# ${n.title}\n\n${n.body}\n\n标签：${n.tags.join(', ')}\n作品：${n.work_id}\n`
        )
      )
      downloadBookData(await zip.generateAsync({ type: 'blob' }), 'atoman-notes.zip')
    }
  } catch {
    error.value = '导出失败，请重试。'
  } finally {
    busy.value = false
  }
}

async function preparePublish(note: PrivateNote) {
  publishing.value = note
  channelId.value = ''
  confirmPublic.value = false
  publishRequest = crypto.randomUUID()
  editError.value = ''
  try {
    channels.value = await apiGet<{ id: string; name: string }[]>(`${useApiUrl()}/studio/channels`)
  } catch {
    editError.value = '无法加载自己的博客频道，请先在创作中心建立博客频道。'
  }
}

async function publish() {
  if (!publishing.value || !confirmPublic.value || !channelId.value || busy.value) return
  busy.value = true
  try {
    const result = await publishPrivateNote(publishing.value, channelId.value, publishRequest)
    publishing.value = null
    await router.push(result.target_path)
  } catch {
    editError.value = '发布未确认，请重试。私人笔记不会被改成公开。'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  void load()
})

onBeforeRouteLeave(() => (draft.value ? requestClose() : !busy.value))
</script>

<style scoped>
.private-books {
  display: grid;
  gap: 1.25rem;
}

.private-books__header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .private-books__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.private-books__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.private-books__notice {
  font-size: 0.75rem;
  color: var(--a-color-success, #10b981);
  margin: 0;
}

.private-books__loading {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
}

.private-books__notes-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(0, 0, 0, 0.025);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.private-books__tabs-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.private-books__filter-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.private-books__search-box {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 160px;
  max-width: 240px;
}

.private-books__search-icon {
  position: absolute;
  left: 0.5rem;
  color: var(--a-color-text-secondary, #94a3b8);
  pointer-events: none;
}

.private-books__search-input {
  width: 100%;
  height: 28px;
  padding: 0 0.5rem 0 1.65rem;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--a-color-text, #0f172a);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.private-books__search-input:focus-visible {
  outline: 2px solid var(--a-color-primary, #007aff);
  outline-offset: -1px;
}

.private-books__tag-filter-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 110px;
}

.private-books__tag-input-field {
  width: 100%;
  height: 28px;
  padding: 0 1.35rem 0 0.5rem;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--a-color-text, #0f172a);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.private-books__tag-input-field:focus-visible {
  outline: 2px solid var(--a-color-primary, #007aff);
  outline-offset: -1px;
}

.private-books__tag-clear-btn {
  position: absolute;
  right: 0.35rem;
  background: transparent;
  border: none;
  font-size: 0.7rem;
  color: var(--a-color-text-secondary, #94a3b8);
  cursor: pointer;
  padding: 0 0.2rem;
}

.private-books__tag-clear-btn:hover {
  color: var(--a-color-text, #0f172a);
}

.private-books__active-filter-strip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.private-books__active-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--a-color-primary, #007aff);
  background: rgba(0, 122, 255, 0.08);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.private-books__active-tag-pill button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 0.7rem;
  color: var(--a-color-primary, #007aff);
  opacity: 0.8;
}

.private-books__active-tag-pill button:hover {
  opacity: 1;
}

.private-books__count {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  font-weight: 500;
  margin: 0;
}

.private-books__notes-grid {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.private-books__note-card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  padding: 1.15rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.private-books__note-card:hover {
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.private-books__note-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.private-books__note-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  line-height: 1.35;
}

.private-books__tags-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.private-books__tag-btn {
  background: rgba(0, 0, 0, 0.035);
  border: 1px solid rgba(0, 0, 0, 0.03);
  border-radius: 4px;
  padding: 0.15rem 0.45rem;
  font-size: 0.6875rem;
  color: var(--a-color-text-secondary, #64748b);
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
}

.private-books__tag-btn:hover {
  background: rgba(0, 122, 255, 0.08);
  color: var(--a-color-primary, #007aff);
}

.private-books__body {
  font-size: 0.84rem;
  line-height: 1.6;
  color: var(--a-color-text, #1e293b);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.private-books__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.private-books__action-link {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-primary, #007aff);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: opacity 0.15s ease;
}

.private-books__action-link:hover {
  opacity: 0.85;
}

.private-books__card-buttons {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.private-books__btn-danger {
  color: var(--a-color-danger, #e11d48) !important;
}

.private-books__btn-danger:hover {
  background: rgba(225, 29, 72, 0.08) !important;
}

.private-books__field-group {
  display: grid;
  gap: 0.35rem;
  font-size: 0.75rem;
}

.private-books__field-label {
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
}

.private-books__note-editor {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

@media (max-width: 640px) {
  .private-books__header-actions {
    width: 100%;
  }
  .private-books__header-actions :deep(.p-button) {
    flex: 1;
    justify-content: center;
  }
  .private-books__search-box {
    max-width: 100%;
    flex: 1;
  }
  .private-books__card-buttons {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
