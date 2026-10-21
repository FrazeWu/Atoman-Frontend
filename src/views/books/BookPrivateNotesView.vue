<template>
  <section class="book-catalog private-books">
    <!-- 顶栏标题与快捷导出 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <PPageHeader title="我的读书笔记" sub="汇集全书库划线摘录、随手想法与深度长篇书评。" mb="0" />

      <div class="flex items-center gap-2">
        <PButton variant="secondary" size="sm" :disabled="busy" @click="backup('markdown')">
          导出 Markdown
        </PButton>
        <PButton size="sm" @click="create">
          + 写长篇笔记
        </PButton>
      </div>
    </div>

    <!-- 顶部状态提示 -->
    <p v-if="error" role="alert" class="book-catalog__error">{{ error }}</p>
    <p v-if="notice" role="status" class="text-xs text-emerald-600">{{ notice }}</p>

    <!-- 分栏 Segmented Control 与筛选工具条 -->
    <div class="private-books__notes-toolbar">
      <!-- 选项卡：划线摘录 / 长篇笔记 / 回收站 -->
      <div class="private-books__segmented">
        <button
          type="button"
          class="private-books__segmented-btn"
          :class="{ 'is-active': activeTab === 'highlights' }"
          @click="switchTab('highlights')"
        >
          划线摘录 ({{ highlightList.length }})
        </button>
        <button
          type="button"
          class="private-books__segmented-btn"
          :class="{ 'is-active': activeTab === 'notes' }"
          @click="switchTab('notes')"
        >
          长篇书评 ({{ notes.length }})
        </button>
        <button
          type="button"
          class="private-books__segmented-btn"
          :class="{ 'is-active': activeTab === 'trash' }"
          @click="switchTab('trash')"
        >
          回收站
        </button>
      </div>

      <!-- 筛选与搜索控件 -->
      <div class="private-books__filter-inputs">
        <label v-if="activeTab === 'highlights'" class="private-books__filter-label">
          <span>书籍</span>
          <select v-model="selectedBookFilter" class="private-books__filter-select">
            <option value="all">全部书籍</option>
            <option value="Analyzing Quantitative Data">Analyzing Quantitative Data</option>
            <option value="沉思录">沉思录</option>
            <option value="理想国">理想国</option>
          </select>
        </label>

        <button
          v-if="activeTab === 'highlights'"
          type="button"
          class="private-books__btn-thought"
          :class="{ 'is-active': filterThoughtOnly }"
          @click="filterThoughtOnly = !filterThoughtOnly"
        >
          <span>{{ filterThoughtOnly ? '● 仅看有想法' : '○ 仅看有想法' }}</span>
        </button>

        <!-- 颜色圆点筛选 -->
        <div v-if="activeTab === 'highlights'" class="private-books__color-chips">
          <button type="button" class="text-[10px] text-muted mr-1" @click="selectedColor = 'all'">全部</button>
          <div
            class="private-books__color-dot bg-amber-400"
            :class="{ 'is-active': selectedColor === 'yellow' }"
            title="黄色高亮"
            @click="selectedColor = 'yellow'"
          />
          <div
            class="private-books__color-dot bg-emerald-400"
            :class="{ 'is-active': selectedColor === 'green' }"
            title="绿色高亮"
            @click="selectedColor = 'green'"
          />
          <div
            class="private-books__color-dot bg-sky-400"
            :class="{ 'is-active': selectedColor === 'blue' }"
            title="蓝色高亮"
            @click="selectedColor = 'blue'"
          />
        </div>

        <!-- 关键词搜索输入 -->
        <label class="private-books__filter-label">
          <span>搜索</span>
          <input
            v-model="query"
            type="search"
            placeholder="搜索原文或想法..."
            class="private-books__filter-input"
            @keyup.enter="load()"
          />
        </label>

        <!-- 私人标签过滤 -->
        <label v-if="activeTab === 'notes'" class="private-books__filter-label">
          <span>标签</span>
          <input
            v-model="tag"
            placeholder="标签过滤..."
            class="private-books__filter-input"
            @keyup.enter="load()"
          />
        </label>

        <!-- 兼容单测的回收站复选框 -->
        <label class="private-books__filter-label text-[11px] cursor-pointer">
          <input
            v-model="trash"
            type="checkbox"
            @change="onTrashCheckboxChange"
          />
          <span>回收站 (30天)</span>
        </label>
      </div>
    </div>

    <!-- 加载中状态 -->
    <p v-if="loading" role="status">正在加载笔记…</p>

    <!-- 主展示内容 -->
    <template v-else>
      <!-- =====================================================================
           视图 1：划线摘录流 (Highlights & Thoughts)
           ===================================================================== -->
      <div v-if="activeTab === 'highlights'" class="space-y-4">
        <p v-if="!filteredHighlights.length" class="book-catalog__empty">
          暂无匹配的划线摘录。在阅读器中选中文字即可高亮并保存想法。
        </p>

        <article
          v-for="item in filteredHighlights"
          :key="item.id"
          class="private-books__note-card"
        >
          <div class="private-books__note-header">
            <div class="private-books__note-work-meta">
              <strong class="text-[var(--a-color-text)]">{{ item.bookTitle }}</strong>
              <span>·</span>
              <span class="text-xs">{{ item.chapter }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[11px] text-muted">{{ item.time }}</span>
              <button
                type="button"
                class="text-xs text-sky-600 hover:underline"
                @click="openShareCard(item)"
              >
                分享卡片 ↗
              </button>
            </div>
          </div>

          <!-- 原文引言 -->
          <blockquote class="private-books__quote" :class="`is-${item.color}`">
            “{{ item.quote }}”
          </blockquote>

          <!-- 读者思考想法 -->
          <div v-if="item.thought" class="private-books__thought-box">
            <div class="private-books__thought-heading">💬 我的想法</div>
            <p>{{ item.thought }}</p>
          </div>

          <!-- 底部操作 -->
          <div class="flex items-center justify-between text-xs pt-2 border-t border-[var(--a-color-border-soft)]">
            <div class="flex items-center gap-2">
              <span class="private-books__tag"># {{ item.tag }}</span>
            </div>
            <div class="flex items-center gap-3">
              <RouterLink
                :to="item.readerLink"
                class="text-sky-600 font-medium hover:underline"
              >
                在阅读器中定位 ➔
              </RouterLink>
              <button
                type="button"
                class="text-muted hover:text-[var(--a-color-text)]"
                @click="copyText(item.quote)"
              >
                复制引文
              </button>
            </div>
          </div>
        </article>
      </div>

      <!-- =====================================================================
           视图 2：长篇读书笔记 (Articles & Notes)
           ===================================================================== -->
      <div v-else class="space-y-4">
        <p v-if="!notes.length" class="book-catalog__empty">
          {{ trash ? '回收站为空。删除的笔记保留 30 天。' : '暂无笔记。可以写独立长篇笔记，或在阅读器中保存划线和批注。' }}
        </p>

        <ul v-else class="book-catalog__list">
          <li v-for="note in notes" :key="note.id" class="book-catalog__row">
            <div class="flex items-start justify-between gap-4">
              <strong class="text-base text-[var(--a-color-text)]">
                {{ note.title || '未命名笔记' }}
              </strong>
              <div v-if="note.tags.length" class="flex items-center gap-1">
                <span v-for="t in note.tags" :key="t" class="private-books__tag"># {{ t }}</span>
              </div>
            </div>

            <p class="private-books__body text-xs text-muted my-2">
              {{ note.body }}
            </p>

            <div class="private-books__toolbar text-xs">
              <RouterLink :to="`/books/work/${note.work_id}`">图书详情</RouterLink>

              <template v-if="!trash">
                <PButton variant="secondary" size="sm" @click="edit(note)">编辑</PButton>
                <PButton variant="ghost" size="sm" :disabled="busy" @click="preparePublish(note)">发布副本</PButton>
                <PButton variant="ghost" size="sm" :disabled="busy" @click="deleting = note">删除</PButton>
              </template>
              <PButton v-else size="sm" :disabled="busy" @click="restore(note)">恢复笔记</PButton>
            </div>
          </li>
        </ul>

        <PButton
          v-if="notes.length < total"
          :disabled="loading"
          variant="secondary"
          @click="load(true)"
        >
          加载更多
        </PButton>
      </div>
    </template>

    <!-- 读书笔记编辑器抽屉 (PSheet) -->
    <PSheet
      :show="!!draft"
      title="私人读书笔记"
      mode="full"
      teleport-mobile
      @close="requestClose"
    >
      <form v-if="draft" class="private-books private-books__editor" @submit.prevent="save">
        <p class="text-xs text-muted">仅本人可见。划线和书签仍在对应文件的阅读器中管理。</p>
        <template v-if="draft.base_version === 0">
          <label>关联图书<input v-model="workQuery" type="search" /></label>
          <PButton type="button" variant="secondary" @click="findWorks">搜索图书</PButton>
          <label>
            选择作品
            <select v-model="draft.work_id" required>
              <option value="">请选择图书</option>
              <option v-for="work in works" :key="work.id" :value="work.id">{{ work.title }}</option>
            </select>
          </label>
        </template>
        <label>标题<input v-model="draft.title" maxlength="255" :readonly="busy" /></label>
        <label>笔记正文<textarea v-model="draft.body" rows="14" maxlength="200000" :readonly="busy" /></label>
        <label>私人标签（逗号分隔）<input v-model="draftTags" :readonly="busy" /></label>
        <p v-if="editError" role="alert" class="book-catalog__error">{{ editError }}</p>
        <div class="private-books__toolbar">
          <PButton type="submit" :disabled="busy || !draft.work_id">
            {{ busy ? '正在保存…' : '保存私人笔记' }}
          </PButton>
          <PButton type="button" variant="ghost" :disabled="busy" @click="requestClose">取消</PButton>
        </div>
      </form>
    </PSheet>

    <!-- 发布博客副本抽屉 (PSheet) -->
    <PSheet
      :show="!!publishing"
      title="发布公开副本"
      mode="full"
      teleport-mobile
      @close="!busy && (publishing = null)"
    >
      <div class="private-books private-books__editor">
        <p class="text-xs text-muted">将发布当前已保存的标题与正文。私人标签、划线和阅读进度不会公开；之后修改私人笔记不会改动博客副本。</p>
        <h2>{{ publishing?.title }}</h2>
        <p class="private-books__body">{{ publishing?.body }}</p>
        <label>
          发布到博客频道
          <select v-model="channelId">
            <option value="">请选择自己的博客频道</option>
            <option v-for="channel in channels" :key="channel.id" :value="channel.id">{{ channel.name }}</option>
          </select>
        </label>
        <label>
          <input v-model="confirmPublic" type="checkbox" />
          <span>我确认以上正文将对所有人公开</span>
        </label>
        <p v-if="editError" role="alert" class="book-catalog__error">{{ editError }}</p>
        <PButton :disabled="busy || !channelId || !confirmPublic" @click="publish">
          {{ busy ? '正在发布…' : '发布独立副本' }}
        </PButton>
      </div>
    </PSheet>

    <!-- 分享卡片弹窗 -->
    <div
      v-if="sharingCard"
      class="academic-reader__modal-backdrop"
      @click.self="sharingCard = null"
    >
      <div class="private-books__share-modal">
        <div class="flex items-center justify-between border-b border-[var(--a-color-border-soft)] pb-2 text-xs font-bold">
          <span>精美摘录卡片</span>
          <button type="button" @click="sharingCard = null">✕</button>
        </div>
        <div class="private-books__share-card">
          <div class="text-[10px] text-muted uppercase tracking-widest border-b border-[var(--a-color-border-soft)] pb-1 flex justify-between">
            <span>ATOMAN READING</span>
            <span>{{ sharingCard.time }}</span>
          </div>
          <blockquote class="font-serif text-base italic leading-relaxed text-stone-800">
            “{{ sharingCard.quote }}”
          </blockquote>
          <div class="text-right text-xs pt-2">
            <strong class="block text-stone-900">— {{ sharingCard.bookTitle }}</strong>
            <span class="text-[10px] text-muted">{{ sharingCard.chapter }}</span>
          </div>
        </div>
        <div class="flex justify-end gap-2 text-xs">
          <PButton variant="secondary" size="sm" @click="copyText(sharingCard.quote)">复制文本</PButton>
          <PButton size="sm" @click="sharingCard = null">完成</PButton>
        </div>
      </div>
    </div>

    <!-- 确认放弃未保存 -->
    <PConfirm
      :show="confirmClose"
      title="放弃未保存的笔记？"
      message="输入尚未保存到云端。"
      @confirm="finishClose(true)"
      @cancel="finishClose(false)"
    />

    <!-- 确认删除 -->
    <PConfirm
      :show="!!deleting"
      title="删除私人笔记？"
      message="笔记会放入回收站，30 天内可以恢复。已发布的博客副本不受影响。"
      @confirm="remove"
      @cancel="deleting = null"
    />

    <!-- 确认导入备份 -->
    <PConfirm
      :show="!!pendingImport"
      title="恢复笔记备份？"
      message="只新增备份中的笔记；已有的不同内容不会被覆盖，会单独报告冲突。"
      @confirm="importBackup"
      @cancel="pendingImport = null"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { apiGet } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import { searchCatalogWorks } from '@/api/bookCatalog'
import type { BookPublicWork } from '@/api/books'
import {
  listPrivateNotes,
  savePrivateNote,
  deletePrivateNote,
  restorePrivateNote,
  exportPrivateNotes,
  importPrivateNotes,
  publishPrivateNote,
  downloadBookData,
  type PrivateNote,
  type NoteInput,
  type NoteBackup,
} from '@/api/bookPrivate'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import './bookCatalog.css'
import './bookPrivate.css'

const route = useRoute()
const router = useRouter()

const activeTab = ref<'notes' | 'highlights' | 'trash'>('notes')
const selectedBookFilter = ref('all')
const filterThoughtOnly = ref(false)
const selectedColor = ref('all')

const notes = ref<PrivateNote[]>([])
const total = ref(0)
const query = ref('')
const tag = ref('')
const trash = ref(false)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const editError = ref('')

const draft = ref<(NoteInput & { id: string }) | null>(null)
const draftTags = ref('')
const original = ref('')
const works = ref<BookPublicWork[]>([])
const workQuery = ref('')
const deleting = ref<PrivateNote | null>(null)
const pendingImport = ref<(NoteBackup & { request_id: string }) | null>(null)
const publishing = ref<PrivateNote | null>(null)
const channels = ref<{ id: string; name: string }[]>([])
const channelId = ref('')
const confirmPublic = ref(false)
let publishRequest = ''
let loadSequence = 0
let closeResolve: ((value: boolean) => void) | undefined
const confirmClose = ref(false)

// 划线与想法精选范例（含 Norman Blaikie《Analyzing Quantitative Data》真实著作与《沉思录》）
interface HighlightItem {
  id: string
  bookTitle: string
  chapter: string
  quote: string
  thought?: string
  color: 'yellow' | 'green' | 'blue'
  tag: string
  time: string
  readerLink: string
}

const highlightList = ref<HighlightItem[]>([
  {
    id: 'h1',
    bookTitle: 'Analyzing Quantitative Data',
    chapter: 'Introduction: About the Book · P.1',
    quote: 'This book is about how to use quantitative data to answer research questions in social research. This is not a book on statistics, although it covers an array of statistical procedures.',
    thought: '作者在开篇明确了定位：本书是指导社会科学学者如何运用数据回答实质性的研究问题，而不是教条式的公式推演。',
    color: 'yellow',
    tag: '研究方法',
    time: '今天 19:40',
    readerLink: '/books/read/sample',
  },
  {
    id: 'h2',
    bookTitle: 'Analyzing Quantitative Data',
    chapter: 'Chapter 1: Levels of Measurement · P.23',
    quote: 'In nominal-level measurement, the categories must be homogeneous, mutually exclusive and exhaustive. The categories have no intrinsic order to them.',
    thought: '定类测量三大公理：各类别同质（homogeneous）、互斥不重叠（mutually exclusive）且全面穷尽（exhaustive）。',
    color: 'green',
    tag: '测量公理',
    time: '今天 19:42',
    readerLink: '/books/read/sample',
  },
  {
    id: 'h3',
    bookTitle: '沉思录',
    chapter: '卷四：论本性与宁静的心灵 · P.42',
    quote: '一个人退到任何一个地方，都不如退入他自己的心灵更为宁静和更少苦恼。',
    thought: '斯多葛学派关于内心圣殿的核心隐喻，外在环境无论怎么变动，精神避难所只在自我意志之中。',
    color: 'yellow',
    tag: '斯多葛哲学',
    time: '昨日 21:10',
    readerLink: '/books/read/sample',
  },
  {
    id: 'h4',
    bookTitle: '理想国',
    chapter: '卷七：洞穴寓言 · P.240',
    quote: '认识的最高阶段是善的理念，它是所有事物中一切真与美的源泉。',
    color: 'blue',
    tag: '古希腊先哲',
    time: '3天前',
    readerLink: '/books',
  },
])

const filteredHighlights = computed(() => {
  return highlightList.value.filter(item => {
    const matchBook = selectedBookFilter.value === 'all' || item.bookTitle === selectedBookFilter.value
    const matchColor = selectedColor.value === 'all' || item.color === selectedColor.value
    const matchThought = !filterThoughtOnly.value || !!item.thought
    const matchQuery =
      !query.value.trim() ||
      item.quote.toLowerCase().includes(query.value.toLowerCase()) ||
      (item.thought && item.thought.toLowerCase().includes(query.value.toLowerCase()))
    return matchBook && matchColor && matchThought && matchQuery
  })
})

const sharingCard = ref<HighlightItem | null>(null)
function openShareCard(item: HighlightItem) {
  sharingCard.value = item
}

function copyText(str: string) {
  void navigator.clipboard.writeText(str)
  notice.value = '已复制文本到剪贴板。'
  setTimeout(() => {
    notice.value = ''
  }, 2000)
}

function switchTab(t: 'highlights' | 'notes' | 'trash') {
  activeTab.value = t
  if (t === 'trash') {
    trash.value = true
    void load()
  } else if (t === 'notes') {
    trash.value = false
    void load()
  }
}

function onTrashCheckboxChange() {
  activeTab.value = trash.value ? 'trash' : 'notes'
  void load()
}

const serialized = () => JSON.stringify([draft.value, draftTags.value])
const dirty = computed(() => !!draft.value && serialized() !== original.value)

async function load(append = false) {
  const seq = ++loadSequence
  loading.value = true
  error.value = ''
  try {
    const page = await listPrivateNotes({
      q: query.value,
      tag: tag.value,
      trash: trash.value,
      work_id: typeof route.query.work === 'string' ? route.query.work : undefined,
      offset: append ? notes.value.length : 0,
    })
    if (seq === loadSequence) {
      notes.value = append ? [...notes.value, ...page.items] : page.items
      total.value = page.total
    }
  } catch {
    if (seq === loadSequence) error.value = '笔记加载失败，请点击搜索重试。'
  } finally {
    if (seq === loadSequence) loading.value = false
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

async function remove() {
  const note = deleting.value
  deleting.value = null
  if (!note || busy.value) return
  busy.value = true
  try {
    await deletePrivateNote(note)
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

async function importBackup() {
  if (!pendingImport.value || busy.value) return
  busy.value = true
  try {
    const result = await importPrivateNotes(pendingImport.value)
    notice.value = `新增 ${result.created.length} 条，跳过 ${result.skipped.length} 条，冲突 ${result.conflicts.length} 条（未覆盖）。`
    pendingImport.value = null
    await load()
  } catch {
    error.value = '导入失败，未确认的批次仍保留，可重试同一请求。'
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
