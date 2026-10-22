<template>
  <section class="book-catalog private-books">
    <!-- 顶栏标题与快捷操作 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <PPageHeader title="我的读书笔记" sub="汇集全书库划线摘录、随手想法与深度长篇书评。" mb="0" />

      <div class="flex items-center gap-2">
        <PButton variant="secondary" size="sm" :disabled="busy" @click="backup('markdown')">
          导出全部笔记
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
      <!-- 选项卡切换：长篇书评 / 划线摘录 / 回收站 -->
      <PSegmentedControl
        v-model="activeTab"
        :options="noteTabs"
        @change="onTabChange"
      />

      <!-- 筛选与搜索控件 (针对长篇笔记) -->
      <div v-if="activeTab !== 'highlights'" class="private-books__filter-inputs">
        <label class="private-books__filter-label">
          <span>搜索</span>
          <input
            v-model="query"
            type="search"
            placeholder="搜索笔记标题或内容..."
            class="private-books__filter-input"
            @keyup.enter="load()"
          />
        </label>

        <label v-if="activeTab === 'notes'" class="private-books__filter-label">
          <span>标签</span>
          <input
            v-model="tag"
            placeholder="标签过滤..."
            class="private-books__filter-input"
            @keyup.enter="load()"
          />
        </label>

        <!-- 保持辅助/单测兼容的回收站复选框 -->
        <label class="private-books__filter-label text-[11px] cursor-pointer">
          <input
            v-model="trash"
            type="checkbox"
            @change="onTrashCheckboxChange"
          />
          <span>回收站</span>
        </label>
      </div>
    </div>

    <!-- 加载中状态 -->
    <p v-if="loading && activeTab !== 'highlights'" role="status" class="text-xs text-[var(--a-color-text-secondary)]">正在加载笔记…</p>

    <template v-else>
      <!-- =====================================================================
           视图 1：划线摘录流 (复用升级后的 BookPrivateHighlights，真实后端)
           ===================================================================== -->
      <div v-if="activeTab === 'highlights'">
        <BookPrivateHighlights />
      </div>

      <!-- =====================================================================
           视图 2：长篇读书笔记与书评 (真实后端 /me/private-notes)
           ===================================================================== -->
      <div v-else class="space-y-4">
        <PEmpty
          v-if="!notes.length"
          :description="trash ? '回收站为空。删除的笔记保留 30 天。' : '暂无长篇笔记。点击上方“+ 写长篇笔记”开始记录。'"
        />

        <ul v-else class="book-catalog__list">
          <li v-for="item in notes" :key="item.id" class="book-catalog__row">
            <div class="flex items-start justify-between gap-4">
              <strong class="text-base text-[var(--a-color-text)]">
                {{ item.title || '未命名笔记' }}
              </strong>
              <div v-if="item.tags.length" class="flex items-center gap-1">
                <span v-for="t in item.tags" :key="t" class="private-books__tag"># {{ t }}</span>
              </div>
            </div>

            <p class="private-books__body text-sm">{{ item.body }}</p>

            <div class="private-books__toolbar">
              <RouterLink
                v-if="item.work_id"
                :to="{ path: `/books/work/${item.work_id}`, query: route.query }"
                class="private-books__action-link"
              >
                图书详情 ➔
              </RouterLink>

              <template v-if="trash">
                <PButton variant="secondary" size="sm" :disabled="busy" @click="restore(item)">
                  恢复笔记
                </PButton>
                <PButton variant="ghost" size="sm" :disabled="busy" @click="deleting = item">
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
                <PButton variant="ghost" size="sm" :disabled="busy" @click="deleting = item">
                  删除
                </PButton>
              </template>
            </div>
          </li>
        </ul>

        <!-- 加载更多 -->
        <PButton
          v-if="notes.length < total"
          variant="secondary"
          :disabled="loading"
          @click="load(true)"
        >
          加载更多笔记 ({{ notes.length }} / {{ total }})
        </PButton>
      </div>
    </template>

    <!-- 侧栏抽屉：编辑 / 新建私人笔记 -->
    <PSheet :show="!!draft" title="私人读书笔记" mode="full" @close="requestClose">
      <form v-if="draft" class="private-books__note-editor" @submit.prevent="save">
        <label>
          <span>关联图书作品</span>
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

        <label>
          <span>标题</span>
          <input
            v-model="draft.title"
            placeholder="笔记标题"
            class="private-books__filter-input"
          />
        </label>

        <label>
          <span>正文</span>
          <textarea
            v-model="draft.body"
            rows="12"
            placeholder="记录你的阅读心得、思想推演或书评…"
            class="private-books__filter-input font-mono text-sm leading-relaxed"
          />
        </label>

        <label>
          <span>分类标签</span>
          <input
            v-model="draftTags"
            placeholder="逗号分隔，如：政治哲学, 柏拉图"
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
      <div v-if="publishing" class="space-y-4 text-sm">
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

    <!-- 确认删除弹窗 -->
    <PConfirm
      :show="!!deleting"
      :title="trash ? '确定彻底销毁？' : '确定移入回收站？'"
      :message="trash ? '此操作将永久抹除该条笔记数据，无法恢复。' : '删除后可在 30 天内随时恢复。'"
      @confirm="remove"
      @cancel="deleting = null"
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
import { apiGet } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import {
  deletePrivateNote,
  downloadBookData,
  exportPrivateNotes,
  listPrivateNotes,
  publishPrivateNote,
  restorePrivateNote,
  savePrivateNote,
  type PrivateNote,
} from '@/api/bookPrivate'
import { searchCatalogWorks } from '@/api/bookCatalog'
import type { BookPublicWork } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import BookPrivateHighlights from '@/components/books/BookPrivateHighlights.vue'
import './bookCatalog.css'
import './bookPrivate.css'

const route = useRoute()
const router = useRouter()

// 选项卡状态：默认 'notes' 以兼容测试契约
const activeTab = ref<'notes' | 'highlights' | 'trash'>('notes')
const noteTabs = [
  { label: '长篇书评', value: 'notes' },
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
