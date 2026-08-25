<template>
  <section class="studio-interactions">
    <header class="studio-interactions__header">
      <div>
        <h2>互动管理</h2>
        <p>集中处理评论与回复。</p>
      </div>
      <form class="studio-interactions__filters" aria-label="互动筛选" @submit.prevent="changeFilters">
        <PInput v-model="filters.q" label="搜索" placeholder="搜索评论" />
        <PSelect v-model="filters.content_id" label="内容" :options="contentOptions" />
        <PSelect v-model="filters.handled" label="处理状态" :options="handledOptions" @update:model-value="changeFilters" />
        <PSelect v-model="filters.priority" label="优先级" :options="priorityOptions" @update:model-value="changeFilters" />
        <PButton type="submit" variant="secondary" aria-label="搜索互动" title="搜索互动">
          <Search :size="17" aria-hidden="true" />
        </PButton>
        <label>
          <input v-model="filters.unreplied" data-testid="unreplied-filter" type="checkbox" @change="changeFilters">
          未回复
        </label>
        <label v-if="module !== 'blog'">
          <input v-model="filters.anchored" data-testid="anchored-filter" type="checkbox" @change="changeFilters">
          时间锚点
        </label>
      </form>
      <div v-if="selectedIDs.length" class="studio-interactions__bulk-actions">
        <span>已选 {{ selectedIDs.length }} 项</span>
        <PButton type="button" size="sm" :loading="mutating" @click="setSelectedHandled(true)">
          <CheckCheck :size="16" aria-hidden="true" />
          标记已处理
        </PButton>
        <PButton type="button" variant="secondary" size="sm" :loading="mutating" @click="setSelectedHandled(false)">
          <RotateCcw :size="16" aria-hidden="true" />
          恢复待处理
        </PButton>
      </div>
    </header>

    <p v-if="loading" class="studio-interactions__message">加载中...</p>
    <p v-else-if="error" class="studio-interactions__message" role="alert">{{ error }}</p>
    <PEmpty v-else-if="!studio.interactions[module].length" kicker="" title="暂无互动" />
    <div v-else class="studio-interactions__list">
      <article v-for="item in studio.interactions[module]" :key="item.id" class="studio-interactions__item">
        <header>
          <div>
            <input
              class="studio-interactions__select"
              type="checkbox"
              :checked="selectedIDs.includes(item.id)"
              :aria-label="`选择${item.content_title}`"
              @change="toggleSelected(item.id)"
            >
            <strong>{{ item.author.display_name || item.author.username }}</strong>
            <span v-if="item.handled" class="studio-interactions__state">已处理</span>
            <span v-if="item.priority === 'high'" class="studio-interactions__priority"><Flag :size="13" aria-hidden="true" /> 高优先级</span>
            <span v-if="item.pinned" class="studio-interactions__pinned"><Pin :size="13" aria-hidden="true" /> 已置顶</span>
            <time :datetime="item.created_at">{{ formatDate(item.created_at) }}</time>
          </div>
          <RouterLink :to="contentPath(item)">{{ item.content_title }}</RouterLink>
        </header>
        <p>{{ item.content }}</p>
        <div v-if="item.time_anchors.length" class="studio-interactions__anchors">
          <span v-for="anchor in item.time_anchors" :key="`${anchor.start}-${anchor.end}-${anchor.seconds}`">
            {{ formatDuration(anchor.seconds) }}
          </span>
        </div>
        <form v-if="replyingID === item.id" class="studio-interactions__reply" @submit.prevent="sendReply(item)">
          <div class="studio-interactions__reply-tools">
            <PSelect v-model="selectedTemplateID" label="回复模板" :options="templateOptions" @update:model-value="applyTemplate" />
            <PButton type="button" variant="secondary" size="sm" aria-label="管理回复模板" title="管理回复模板" @click="templateModalOpen = true">
              <NotebookPen :size="17" aria-hidden="true" />
            </PButton>
          </div>
          <PTextarea
            v-model="replyDraft"
            :data-testid="`reply-input-${item.id}`"
            label="回复"
            placeholder="输入回复"
            :rows="3"
          />
          <div>
            <PButton type="button" variant="ghost" size="sm" @click="cancelReply">取消</PButton>
            <PButton
              type="button"
              size="sm"
              :data-testid="`send-reply-${item.id}`"
              :disabled="!replyDraft.trim()"
              :loading="mutating"
              @click="sendReply(item)"
            >发送</PButton>
          </div>
        </form>
        <footer>
          <button type="button" :aria-pressed="item.handled" @click="toggleHandled(item)">
            <CheckCheck :size="16" aria-hidden="true" /> {{ item.handled ? '恢复待处理' : '标记已处理' }}
          </button>
          <button type="button" :aria-pressed="item.priority === 'high'" @click="togglePriority(item)">
            <Flag :size="16" aria-hidden="true" /> {{ item.priority === 'high' ? '普通优先级' : '高优先级' }}
          </button>
          <button type="button" :data-testid="`reply-${item.id}`" @click="startReply(item.id)">
            <Reply :size="16" aria-hidden="true" /> 回复
          </button>
          <button type="button" :data-testid="`pin-${item.id}`" @click="togglePin(item)">
            <Pin :size="16" aria-hidden="true" /> {{ item.pinned ? '取消置顶' : '置顶' }}
          </button>
          <button type="button" :data-testid="`delete-${item.id}`" @click="pendingDelete = item">
            <Trash2 :size="16" aria-hidden="true" /> 删除
          </button>
        </footer>
      </article>
    </div>

    <PaginationBar
      v-if="paginationMeta && (paginationMeta.page > 1 || paginationMeta.has_more)"
      :meta="paginationMeta"
      :loading="loading"
      @change="changePage"
    />
  </section>

  <PModal v-model="templateModalOpen" title="回复模板" size="md">
    <form class="studio-interactions__template-form" @submit.prevent="createTemplate">
      <PInput v-model="templateName" label="模板名称" placeholder="输入名称" />
      <PTextarea v-model="templateContent" label="回复内容" placeholder="输入回复内容" :rows="4" />
      <p v-if="templateError" class="studio-interactions__template-error" role="alert">{{ templateError }}</p>
      <PButton type="submit" :disabled="!templateName.trim() || !templateContent.trim()" :loading="templateSaving">保存模板</PButton>
    </form>
    <ul v-if="studio.replyTemplates.length" class="studio-interactions__templates">
      <li v-for="template in studio.replyTemplates" :key="template.id">
        <span><strong>{{ template.name }}</strong><small>{{ template.content }}</small></span>
        <PButton type="button" variant="ghost" size="sm" :aria-label="`删除${template.name}`" :title="`删除${template.name}`" @click="deleteTemplate(template.id)">
          <Trash2 :size="17" aria-hidden="true" />
        </PButton>
      </li>
    </ul>
  </PModal>

  <PModal v-model="deleteModalOpen" title="删除评论" size="sm">
    <p class="studio-interactions__confirm">确定删除这条评论吗？</p>
    <template #footer>
      <PButton variant="secondary" @click="pendingDelete = null">取消</PButton>
      <PButton data-testid="confirm-delete-comment" variant="danger" :loading="mutating" @click="deleteComment">删除</PButton>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { CheckCheck, Flag, NotebookPen, Pin, Reply, RotateCcw, Search, Trash2 } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

import { commentApi, type CommentTargetKind, type CommentTargetRef } from '@/api/comments'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioInteractionFilters, StudioInteractionItem, StudioModule } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const loading = ref(true)
const mutating = ref(false)
const error = ref('')
const replyingID = ref('')
const replyDraft = ref('')
const pendingDelete = ref<StudioInteractionItem | null>(null)
const selectedIDs = ref<string[]>([])
const selectedTemplateID = ref('')
const templateModalOpen = ref(false)
const templateName = ref('')
const templateContent = ref('')
const templateSaving = ref(false)
const templateError = ref('')
const filters = reactive<StudioInteractionFilters>({
  q: '',
  content_id: '',
  unreplied: route.query.unreplied === 'true',
  anchored: false,
  handled: '',
  priority: '',
  page: 1,
})
const pagination = computed(() => studio.interactionPagination[module.value])
const contentOptions = computed(() => [
  { label: '全部内容', value: '' },
  ...studio.contents[module.value].map(item => ({ label: item.title || '未命名内容', value: item.id })),
])
const handledOptions = [
  { label: '全部处理状态', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '已处理', value: 'handled' },
]
const priorityOptions = [
  { label: '全部优先级', value: '' },
  { label: '普通优先级', value: 'normal' },
  { label: '高优先级', value: 'high' },
]
const templateOptions = computed(() => [
  { label: '不使用模板', value: '' },
  ...studio.replyTemplates.map(template => ({ label: template.name, value: template.id })),
])
const paginationMeta = computed(() => {
  const value = pagination.value
  return value ? { ...value, has_more: Boolean(value.has_more) } : null
})
const deleteModalOpen = computed({
  get: () => pendingDelete.value !== null,
  set: value => { if (!value) pendingDelete.value = null },
})

function target(item: StudioInteractionItem): CommentTargetRef {
  return { kind: item.target_kind as CommentTargetKind, resourceId: item.content_id }
}

function contentPath(item: StudioInteractionItem) {
	if (module.value === 'blog') return `/posts/post/${item.content_id}`
	if (module.value === 'podcast') return `/podcasts/episode/${item.content_id}`
  return `/videos/watch/${item.content_id}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

async function loadInteractions() {
  if (!studio.currentChannel) return
  loading.value = true
  error.value = ''
  try {
    await studio.loadInteractions(module.value, { ...filters })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function changeFilters() {
  filters.page = 1
  selectedIDs.value = []
  void loadInteractions()
}

function changePage(page: number) {
  filters.page = page
  void loadInteractions()
}

function toggleSelected(id: string) {
  selectedIDs.value = selectedIDs.value.includes(id)
    ? selectedIDs.value.filter(selectedID => selectedID !== id)
    : [...selectedIDs.value, id]
}

async function setSelectedHandled(handled: boolean) {
  if (!selectedIDs.value.length || mutating.value) return
  mutating.value = true
  error.value = ''
  try {
    await studio.setInteractionsHandled(module.value, selectedIDs.value, handled)
    selectedIDs.value = []
    await loadInteractions()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '处理状态更新失败'
  } finally {
    mutating.value = false
  }
}

async function toggleHandled(item: StudioInteractionItem) {
  if (mutating.value) return
  mutating.value = true
  error.value = ''
  try {
    await studio.updateInteractionState(module.value, item.id, { handled: !item.handled })
    await loadInteractions()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '处理状态更新失败'
  } finally {
    mutating.value = false
  }
}

async function togglePriority(item: StudioInteractionItem) {
  if (mutating.value) return
  mutating.value = true
  error.value = ''
  try {
    await studio.updateInteractionState(module.value, item.id, {
      priority: item.priority === 'high' ? 'normal' : 'high',
    })
    await loadInteractions()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '优先级更新失败'
  } finally {
    mutating.value = false
  }
}

function startReply(id: string) {
  replyingID.value = id
  replyDraft.value = ''
  selectedTemplateID.value = ''
}

function applyTemplate() {
  const template = studio.replyTemplates.find(item => item.id === selectedTemplateID.value)
  if (template) replyDraft.value = template.content
}

async function createTemplate() {
  if (!templateName.value.trim() || !templateContent.value.trim() || templateSaving.value) return
  templateSaving.value = true
  templateError.value = ''
  try {
    await studio.createReplyTemplate({ name: templateName.value, content: templateContent.value })
    templateName.value = ''
    templateContent.value = ''
  } catch (cause) {
    templateError.value = cause instanceof Error ? cause.message : '保存模板失败'
  } finally {
    templateSaving.value = false
  }
}

async function deleteTemplate(id: string) {
  templateError.value = ''
  try {
    await studio.deleteReplyTemplate(id)
    if (selectedTemplateID.value === id) selectedTemplateID.value = ''
  } catch (cause) {
    templateError.value = cause instanceof Error ? cause.message : '删除模板失败'
  }
}

function cancelReply() {
  replyingID.value = ''
  replyDraft.value = ''
  selectedTemplateID.value = ''
}

async function sendReply(item: StudioInteractionItem) {
  const content = replyDraft.value.trim()
  if (!content) return
  mutating.value = true
  error.value = ''
  let replySent = false
  try {
    await commentApi.create(target(item), { content, reply_to_id: item.id, mentions: [], attachment_ids: [] })
    replySent = true
    cancelReply()
    await studio.updateInteractionState(module.value, item.id, { handled: true })
    await loadInteractions()
  } catch (cause) {
    error.value = replySent
      ? '回复已发送，但处理状态未更新'
      : cause instanceof Error ? cause.message : '回复失败'
  } finally {
    mutating.value = false
  }
}

async function togglePin(item: StudioInteractionItem) {
  mutating.value = true
  error.value = ''
  try {
    if (item.pinned) await commentApi.unmark(target(item))
    else await commentApi.mark(target(item), item.id)
    await loadInteractions()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作失败'
  } finally {
    mutating.value = false
  }
}

async function deleteComment() {
  if (!pendingDelete.value) return
  mutating.value = true
  error.value = ''
  try {
    await commentApi.delete(pendingDelete.value.id)
    pendingDelete.value = null
    await loadInteractions()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '删除失败'
  } finally {
    mutating.value = false
  }
}

onMounted(async () => {
  try {
    await studio.loadState()
    await Promise.all([
      loadInteractions(),
      studio.loadContents(module.value, { q: '', status: '', visibility: '', collection_id: '', page: 1 }, false),
      studio.loadReplyTemplates(),
    ])
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    loading.value = false
  }
})

watch(module, () => {
  filters.q = ''
  filters.content_id = ''
  filters.unreplied = false
  filters.anchored = false
  filters.handled = ''
  filters.priority = ''
  filters.page = 1
  selectedIDs.value = []
  void Promise.all([
    loadInteractions(),
    studio.loadContents(module.value, { q: '', status: '', visibility: '', collection_id: '', page: 1 }, false),
  ])
})
</script>

<style scoped>
.studio-interactions { display: grid; gap: 1rem; }
.studio-interactions__header { display: flex; align-items: center; flex-wrap: wrap; gap: 1rem; }
.studio-interactions__header > div:first-child { min-width: 0; flex: 1 1 12rem; }
  .studio-interactions__header p { margin: 0.25rem 0 0; color: var(--a-color-muted); font-size: 0.8125rem; }
  .studio-interactions h2, .studio-interactions__message, .studio-interactions__item p, .studio-interactions__confirm { margin: 0; }
  .studio-interactions h2 { font-size: 1.25rem; }
.studio-interactions__filters { flex: 1 1 42rem; display: grid; grid-template-columns: minmax(10rem, 1.5fr) repeat(3, minmax(8rem, 1fr)) auto auto auto; align-items: end; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.studio-interactions__filters :deep(.p-field) { min-width: 0; }
.studio-interactions__filters :deep(.p-button) { width: 2.75rem; min-height: 2.75rem; padding: 0; }
.studio-interactions__filters label { min-height: 2.75rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0 0.625rem; border-radius: var(--a-radius-control); color: var(--a-color-muted); font-size: 0.8rem; cursor: pointer; transition: background-color 0.18s ease, color 0.18s ease; }
.studio-interactions__filters label:has(input:checked) { background: var(--a-color-surface-muted); color: var(--a-color-text); }
.studio-interactions__filters input { width: 1rem; height: 1rem; accent-color: var(--a-color-primary); }
.studio-interactions__message { margin: 0; padding: 0.75rem 1rem; border: 1px solid var(--a-color-danger-border); border-radius: var(--a-radius-card); color: var(--a-color-danger); }
.studio-interactions__list { display: grid; gap: 0.75rem; }
.studio-interactions__item { display: grid; gap: 0.75rem; padding: 1rem 1.125rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); transition: border-color 0.18s ease, box-shadow 0.18s ease; }
.studio-interactions__item:hover { border-color: var(--a-color-border); box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); }
.studio-interactions__item > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.studio-interactions__item > header div { display: flex; align-items: center; flex-wrap: wrap; gap: 0.625rem; }
.studio-interactions__pinned { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.4rem; border-radius: 999px; background: color-mix(in srgb, var(--a-color-primary) 10%, var(--a-color-bg)); color: var(--a-color-primary); font-size: 0.7rem; font-weight: 600; }
.studio-interactions__bulk-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.studio-interactions__bulk-actions > span { color: var(--a-color-muted); font-size: 0.8rem; }
.studio-interactions__select { width: 1rem; height: 1rem; margin: 0; accent-color: var(--a-color-primary); }
.studio-interactions__state, .studio-interactions__priority { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.4rem; border-radius: var(--a-radius-control); font-size: 0.7rem; font-weight: 600; }
.studio-interactions__state { background: color-mix(in srgb, var(--a-color-success) 12%, var(--a-color-bg)); color: var(--a-color-success); }
.studio-interactions__priority { background: color-mix(in srgb, var(--a-color-danger) 10%, var(--a-color-bg)); color: var(--a-color-danger); }
.studio-interactions__item time, .studio-interactions__item > header a { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-interactions__item > header a { text-align: right; }
.studio-interactions__item p { line-height: 1.6; }
.studio-interactions__anchors { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.studio-interactions__anchors span { padding: 0.2rem 0.45rem; background: var(--a-color-surface-muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.studio-interactions__reply { display: grid; gap: 0.5rem; max-width: 42rem; }
.studio-interactions__reply-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; align-items: end; }
.studio-interactions__reply-tools :deep(.p-button) { width: 2.75rem; min-height: 2.75rem; padding: 0; }
.studio-interactions__reply > div:not(.studio-interactions__reply-tools) { display: flex; justify-content: flex-end; gap: 0.5rem; }
.studio-interactions__template-form { display: grid; gap: 0.75rem; }
.studio-interactions__template-error { margin: 0; color: var(--a-color-danger); font-size: 0.8rem; }
.studio-interactions__templates { display: grid; gap: 0; margin: 1rem 0 0; padding: 0; border-top: 1px solid var(--a-color-border-soft); list-style: none; }
.studio-interactions__templates li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 4.25rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-interactions__templates span { min-width: 0; display: grid; gap: 0.25rem; }
.studio-interactions__templates small { overflow: hidden; color: var(--a-color-muted); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.studio-interactions__templates :deep(.p-button) { width: 2.75rem; min-height: 2.75rem; padding: 0; }
.studio-interactions__item footer { display: flex; align-items: center; gap: 0.5rem; }
.studio-interactions__item footer button { min-height: 40px; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0 0.625rem; border: 1px solid transparent; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-muted); cursor: pointer; transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease; }
.studio-interactions__item footer button:hover { border-color: var(--a-color-border-soft); background: var(--a-color-surface-muted); color: var(--a-color-text); }
.studio-interactions__item footer button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
@media (max-width: 600px) {
  .studio-interactions__header, .studio-interactions__item > header { align-items: flex-start; flex-direction: column; }
  .studio-interactions__filters { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-interactions__filters :deep(.p-field:first-child) { grid-column: 1 / -1; }
  .studio-interactions__filters :deep(.p-button) { grid-column: 1; }
  .studio-interactions__filters label { justify-content: center; }
  .studio-interactions__item > header a { text-align: left; }
}
</style>
