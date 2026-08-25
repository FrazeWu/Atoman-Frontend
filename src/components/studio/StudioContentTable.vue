<template>
  <div class="studio-content-table">
    <PEmpty v-if="items.length === 0" kicker="" :title="`暂无${config.itemLabel}`">
      <template #action>
        <slot name="empty-action" />
      </template>
    </PEmpty>
    <div v-else class="studio-content-table__scroll">
      <table>
        <thead>
          <tr>
            <th>选择</th>
            <th>标题</th>
            <th>状态</th>
            <th>可见范围</th>
            <th>合集</th>
			<th v-if="module !== 'blog'">时长</th>
			<th v-for="column in metricColumns" :key="column.key">{{ column.label }}</th>
			<th v-if="module === 'blog'">发布时间</th>
			<th v-if="module === 'video'">处理状态</th>
            <th>更新时间</th>
            <th><span class="sr-only">操作</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td data-label="选择" :class="{ 'is-empty-selection': !item.collection_conflict }"><input v-if="item.collection_conflict" type="checkbox" :aria-label="`选择${item.title || config.itemLabel}`" @change="emit('selectConflict', item, ($event.target as HTMLInputElement).checked)" /></td>
            <td data-label="标题">
              <strong>{{ item.title || `未命名${config.itemLabel}` }}</strong>
              <span v-if="item.processing_status && item.processing_status !== 'ready'">{{ item.processing_status }}</span>
            </td>
            <td data-label="状态">{{ statusLabel(item.status) }}</td>
            <td data-label="可见范围">{{ visibilityLabel(item.visibility) }}</td>
            <td data-label="合集">
              <span v-if="item.collection_conflict" class="studio-content-table__collection-conflict">
                待确认{{ item.collections.length ? `：${item.collections.map(collection => collection.name).join('、')}` : '' }}
                <select :aria-label="`确认${item.title || config.itemLabel}的合集`" @change="selectCandidate(item, $event)">
                  <option value="">选择合集</option>
                  <option v-for="collection in item.collections" :key="collection.id" :value="collection.id">{{ collection.name }}</option>
                </select>
              </span>
              <span v-else>{{ item.collection?.name || item.collections.map(collection => collection.name).join('、') || '未加入合集' }}</span>
            </td>
			<td v-if="module !== 'blog'" data-label="时长">{{ formatDuration(item.duration_sec || 0) }}</td>
			<td v-for="column in metricColumns" :key="column.key" :data-label="column.label">{{ formatNumber(item.metrics?.[column.key] ?? 0) }}</td>
			<td v-if="module === 'blog'" data-label="发布时间">{{ item.scheduled_at ? `定时 ${formatDateTime(item.scheduled_at)}` : item.published_at ? formatDate(item.published_at) : '—' }}</td>
			<td v-if="module === 'video'" data-label="处理状态">{{ item.processing_status || 'ready' }}</td>
            <td data-label="更新时间"><time :datetime="item.updated_at">{{ formatDate(item.updated_at) }}</time></td>
			<td data-label="操作">
			  <div class="studio-content-table__actions">
				<RouterLink class="studio-content-table__action" :to="`/studio/${module}/${item.id}/edit`" aria-label="编辑" title="编辑">
				  <Pencil :size="16" aria-hidden="true" />
				</RouterLink>
				<button
				  v-if="canReorder && !item.collection_conflict"
				  type="button"
				  :disabled="items.findIndex(candidate => candidate.id === item.id) === 0"
				  aria-label="上移"
				  title="上移"
				  @click="$emit('reorder', item, -1)"
				>
				  <ArrowUp :size="16" aria-hidden="true" />
				</button>
				<button
				  v-if="canReorder && !item.collection_conflict"
				  type="button"
				  :disabled="items.findIndex(candidate => candidate.id === item.id) === items.length - 1"
				  aria-label="下移"
				  title="下移"
				  @click="$emit('reorder', item, 1)"
				>
				  <ArrowDown :size="16" aria-hidden="true" />
				</button>
                <button
                  v-if="item.status === 'scheduled'"
                  type="button"
                  :data-testid="`cancel-schedule-${item.id}`"
                  aria-label="取消定时发布"
                  title="取消定时发布"
                  @click="$emit('cancelSchedule', item)"
                >
                  <CalendarX :size="16" aria-hidden="true" />
                </button>
				<button
				  type="button"
				  :data-testid="`toggle-status-${item.id}`"
				  :aria-label="item.status === 'published' ? '转为草稿' : '发布'"
				  :title="item.status === 'published' ? '转为草稿' : '发布'"
				  @click="$emit('status', item, item.status === 'published' ? 'draft' : 'published')"
				>
				  <ArchiveRestore v-if="item.status === 'published'" :size="16" aria-hidden="true" />
				  <Send v-else :size="16" aria-hidden="true" />
				</button>
				<button
				  v-if="item.status === 'published' && item.visibility !== 'private'"
				  type="button"
				  :data-testid="`share-${item.id}`"
				  aria-label="分享"
				  title="分享"
				  @click="$emit('share', item)"
				>
				  <Share2 :size="16" aria-hidden="true" />
				</button>
				<button
				  v-if="module === 'podcast' || module === 'video'"
				  type="button"
				  :data-testid="`reupload-${item.id}`"
				  aria-label="重新上传"
				  title="重新上传"
				  @click="$emit('reupload', item)"
				>
				  <Upload :size="16" aria-hidden="true" />
				</button>
				<button
				  v-if="module === 'video'"
				  type="button"
				  :data-testid="`reprocess-${item.id}`"
				  aria-label="重新处理"
				  title="重新处理"
				  @click="$emit('reprocess', item)"
				>
				  <RefreshCw :size="16" aria-hidden="true" />
				</button>
				<button
				  type="button"
				  :data-testid="`delete-${item.id}`"
				  aria-label="删除"
				  title="删除"
				  @click="$emit('delete', item)"
				>
				  <Trash2 :size="16" aria-hidden="true" />
				</button>
			  </div>
			</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="pagination && (pagination.page > 1 || pagination.has_more)" class="studio-content-table__pagination" aria-label="内容分页">
      <button type="button" :disabled="pagination.page <= 1" aria-label="上一页" title="上一页" @click="$emit('page', pagination.page - 1)">
        <ArrowLeft :size="17" aria-hidden="true" />
      </button>
      <span>第 {{ pagination.page }} 页</span>
      <button type="button" :disabled="!pagination.has_more" aria-label="下一页" title="下一页" @click="$emit('page', pagination.page + 1)">
        <ArrowRight :size="17" aria-hidden="true" />
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArchiveRestore, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarX, Pencil, RefreshCw, Send, Share2, Trash2, Upload } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

import PEmpty from '@/components/ui/PEmpty.vue'
import { studioModules } from '@/config/studioModules'
import type { StudioContentItem, StudioContentStatus, StudioModule, StudioPagination, StudioPublishStatus, StudioVisibility } from '@/types'

const props = withDefaults(defineProps<{
  items: StudioContentItem[]
  module: StudioModule
  pagination: StudioPagination | null
  canReorder?: boolean
}>(), { canReorder: false })

const emit = defineEmits<{
  page: [page: number]
  status: [item: StudioContentItem, status: StudioPublishStatus]
  cancelSchedule: [item: StudioContentItem]
  share: [item: StudioContentItem]
  delete: [item: StudioContentItem]
  reupload: [item: StudioContentItem]
  reprocess: [item: StudioContentItem]
  selectConflict: [item: StudioContentItem, selected: boolean]
  candidate: [item: StudioContentItem, collectionID: string]
  reorder: [item: StudioContentItem, direction: -1 | 1]
}>()

function selectCandidate(item: StudioContentItem, event: Event) {
  const collectionID = (event.target as HTMLSelectElement).value
  if (collectionID) emit('candidate', item, collectionID)
}

const config = computed(() => studioModules[props.module])
const metricColumns = computed(() => ({
  blog: [
    { key: 'view', label: '阅读' }, { key: 'comment', label: '评论' }, { key: 'like', label: '点赞' },
    { key: 'bookmark', label: '收藏' }, { key: 'share', label: '分享' },
  ],
  podcast: [
    { key: 'play', label: '播放' }, { key: 'complete', label: '完播' }, { key: 'comment', label: '评论' },
    { key: 'bookmark', label: '收藏' }, { key: 'share', label: '分享' },
  ],
  video: [
    { key: 'play', label: '播放' }, { key: 'comment', label: '评论' }, { key: 'like', label: '点赞' },
    { key: 'bookmark', label: '收藏' }, { key: 'share', label: '分享' },
  ],
}[props.module]))

function statusLabel(status: StudioContentStatus) {
  return { published: '已发布', scheduled: '定时发布', draft: '草稿' }[status]
}

function visibilityLabel(visibility: StudioVisibility) {
  return { public: '公开', subscribers: '订阅者', private: '私密' }[visibility]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}
</script>

<style scoped>
.studio-content-table { min-width: 0; max-width: 100%; display: grid; gap: 1rem; }
.studio-content-table__scroll { min-width: 0; width: 100%; max-width: 100%; overflow-x: auto; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
table { width: 100%; border-collapse: collapse; min-width: 1180px; }
th, td { padding: 0.75rem 0.625rem; border-bottom: 1px solid var(--a-color-border-soft); text-align: left; vertical-align: middle; }
th { background: var(--a-color-surface); color: var(--a-color-muted); font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
td { font-size: 0.875rem; }
tbody tr:hover { background: var(--a-color-surface); }
td:first-child { min-width: 3.5rem; }
td strong, td span { display: block; }
td span { margin-top: 0.2rem; color: var(--a-color-muted); font-size: 0.75rem; }
.studio-content-table__collection-conflict { color: var(--a-color-danger); font-weight: 600; }
.studio-content-table__collection-conflict select { min-height: 2.25rem; max-width: 100%; margin-top: 0.4rem; padding: 0 0.5rem; border: 1px solid var(--a-color-danger-border); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-text); font: inherit; }
.studio-content-table__collection-conflict select:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 1px; }
.studio-content-table__actions { display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem; }
.studio-content-table__action, .studio-content-table__actions button { width: 40px; height: 40px; display: inline-grid; place-items: center; flex: 0 0 40px; border: 1px solid transparent; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-text); cursor: pointer; transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease; }
.studio-content-table__action:hover, .studio-content-table__actions button:hover { border-color: var(--a-color-border); background: var(--a-color-surface-muted); color: var(--a-color-primary); }
.studio-content-table__action:focus-visible, .studio-content-table__actions button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 1px; }
.studio-content-table__pagination { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; color: var(--a-color-muted); font-size: 0.8rem; }
.studio-content-table__pagination button { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-text); cursor: pointer; }
.studio-content-table__pagination button:disabled { opacity: 0.45; cursor: not-allowed; }
.studio-content-table__pagination button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 760px) {
  .studio-content-table__scroll { overflow: visible; border: 0; background: transparent; }
  table, tbody { display: block; width: 100%; min-width: 0; }
  thead { display: none; }
  tbody { display: grid; gap: 0.75rem; }
  tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.625rem 1rem;
    padding: 1rem;
    border: 1px solid var(--a-color-border-soft);
    border-radius: var(--a-radius-card);
    background: var(--a-color-bg);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
  }
  td { min-width: 0; padding: 0; border: 0; overflow-wrap: anywhere; }
  td:first-child, td:last-child { grid-column: 1 / -1; }
  td.is-empty-selection { display: none; }
  td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 0.2rem;
    color: var(--a-color-muted);
    font-size: 0.7rem;
    font-weight: 600;
  }
  .studio-content-table__actions { justify-content: flex-start; flex-wrap: wrap; gap: 0.5rem; }
}
</style>
