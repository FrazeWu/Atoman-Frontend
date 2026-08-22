<template>
  <section class="studio-interactions">
    <header class="studio-interactions__header">
      <div>
        <h2>互动管理</h2>
        <p>集中处理评论与回复。</p>
      </div>
      <div class="studio-interactions__filters" aria-label="互动筛选">
        <label>
          <input v-model="filters.unreplied" data-testid="unreplied-filter" type="checkbox" @change="changeFilters">
          未回复
        </label>
        <label v-if="module !== 'blog'">
          <input v-model="filters.anchored" data-testid="anchored-filter" type="checkbox" @change="changeFilters">
          时间锚点
        </label>
      </div>
    </header>

    <p v-if="loading" class="studio-interactions__message">加载中...</p>
    <p v-else-if="error" class="studio-interactions__message" role="alert">{{ error }}</p>
    <PEmpty v-else-if="!studio.interactions[module].length" kicker="" title="暂无互动" />
    <div v-else class="studio-interactions__list">
      <article v-for="item in studio.interactions[module]" :key="item.id" class="studio-interactions__item">
        <header>
          <div>
            <strong>{{ item.author.display_name || item.author.username }}</strong>
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
import { Pin, Reply, Trash2 } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

import { commentApi, type CommentTargetKind, type CommentTargetRef } from '@/api/comments'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioInteractionItem, StudioModule } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const loading = ref(true)
const mutating = ref(false)
const error = ref('')
const replyingID = ref('')
const replyDraft = ref('')
const pendingDelete = ref<StudioInteractionItem | null>(null)
const filters = reactive({ unreplied: route.query.unreplied === 'true', anchored: false, page: 1 })
const pagination = computed(() => studio.interactionPagination[module.value])
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
  void loadInteractions()
}

function changePage(page: number) {
  filters.page = page
  void loadInteractions()
}

function startReply(id: string) {
  replyingID.value = id
  replyDraft.value = ''
}

function cancelReply() {
  replyingID.value = ''
  replyDraft.value = ''
}

async function sendReply(item: StudioInteractionItem) {
  const content = replyDraft.value.trim()
  if (!content) return
  mutating.value = true
  error.value = ''
  try {
    await commentApi.create(target(item), { content, reply_to_id: item.id, mentions: [], attachment_ids: [] })
    cancelReply()
    await loadInteractions()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '回复失败'
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
    await loadInteractions()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    loading.value = false
  }
})

watch(module, () => {
  filters.unreplied = false
  filters.anchored = false
  filters.page = 1
  void loadInteractions()
})
</script>

<style scoped>
.studio-interactions { display: grid; gap: 1rem; }
.studio-interactions__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .studio-interactions__header > div:first-child { min-width: 0; }
  .studio-interactions__header p { margin: 0.25rem 0 0; color: var(--a-color-muted); font-size: 0.8125rem; }
  .studio-interactions h2, .studio-interactions__message, .studio-interactions__item p, .studio-interactions__confirm { margin: 0; }
  .studio-interactions h2 { font-size: 1.25rem; }
.studio-interactions__filters { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.studio-interactions__filters label { min-height: 2.5rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0 0.625rem; border-radius: var(--a-radius-control); color: var(--a-color-muted); font-size: 0.8rem; cursor: pointer; transition: background-color 0.18s ease, color 0.18s ease; }
.studio-interactions__filters label:has(input:checked) { background: var(--a-color-surface-muted); color: var(--a-color-text); }
.studio-interactions__filters input { width: 1rem; height: 1rem; accent-color: var(--a-color-primary); }
.studio-interactions__message { margin: 0; padding: 0.75rem 1rem; border: 1px solid var(--a-color-danger-border); border-radius: var(--a-radius-card); color: var(--a-color-danger); }
.studio-interactions__list { display: grid; gap: 0.75rem; }
.studio-interactions__item { display: grid; gap: 0.75rem; padding: 1rem 1.125rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); transition: border-color 0.18s ease, box-shadow 0.18s ease; }
.studio-interactions__item:hover { border-color: var(--a-color-border); box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); }
.studio-interactions__item > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.studio-interactions__item > header div { display: flex; align-items: center; flex-wrap: wrap; gap: 0.625rem; }
.studio-interactions__pinned { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.4rem; border-radius: 999px; background: color-mix(in srgb, var(--a-color-primary) 10%, var(--a-color-bg)); color: var(--a-color-primary); font-size: 0.7rem; font-weight: 600; }
.studio-interactions__item time, .studio-interactions__item > header a { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-interactions__item > header a { text-align: right; }
.studio-interactions__item p { line-height: 1.6; }
.studio-interactions__anchors { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.studio-interactions__anchors span { padding: 0.2rem 0.45rem; background: var(--a-color-surface-muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.studio-interactions__reply { display: grid; gap: 0.5rem; max-width: 42rem; }
.studio-interactions__reply > div { display: flex; justify-content: flex-end; gap: 0.5rem; }
.studio-interactions__item footer { display: flex; align-items: center; gap: 0.5rem; }
.studio-interactions__item footer button { min-height: 40px; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0 0.625rem; border: 1px solid transparent; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-muted); cursor: pointer; transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease; }
.studio-interactions__item footer button:hover { border-color: var(--a-color-border-soft); background: var(--a-color-surface-muted); color: var(--a-color-text); }
.studio-interactions__item footer button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
@media (max-width: 600px) {
  .studio-interactions__header, .studio-interactions__item > header { align-items: flex-start; flex-direction: column; }
  .studio-interactions__filters { width: 100%; }
  .studio-interactions__filters label { flex: 1; justify-content: center; }
  .studio-interactions__item > header a { text-align: left; }
}
</style>
