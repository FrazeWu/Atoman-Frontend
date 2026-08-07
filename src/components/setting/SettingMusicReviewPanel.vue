<script setup lang="ts">
import { apiRequest } from '@/api/client'
import { reportError } from '@/utils/logger'
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { isAdminRole } from '@/utils/roles'
import PSelect from '@/components/ui/PSelect.vue'
import {
  listMusicEdits,
  approveMusicEdit,
  rejectMusicEdit,
  cancelMusicEdit,
  type MusicEntityType,
  type MusicEditStatus,
} from '@/api/musicV1'
import MusicEditReviewShell, { type MusicEditReviewItem } from '@/components/music/MusicEditReviewShell.vue'

const authStore = useAuthStore()
const api = useApi()

const activeTab = ref<'review' | 'entries' | 'quality'>('review')
const reviewItems = ref<MusicEditReviewItem[]>([])
const loading = ref(true)
const statusFilter = ref('open')
const entityTypeFilter = ref('')

type MusicReviewEntry = {
  id: string
  name: string
  type: 'album' | 'artist'
  album_type?: string
  entry_status: string
  open_discussion_count?: number
  last_editor?: string
  updated_at?: string
}

const entries = ref<MusicReviewEntry[]>([])
const entriesTotal = ref(0)
const entriesLoading = ref(false)
const entriesTypeFilter = ref('all')
const entriesStatusFilter = ref('all')
const entriesTypeOptions = [
  { label: '全部类型', value: 'all' },
  { label: '专辑', value: 'album' },
  { label: '艺术家', value: 'artist' },
]
const entriesStatusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '开放', value: 'open' },
  { label: '已确认', value: 'confirmed' },
  { label: '争议', value: 'disputed' },
]
type MusicQualityIssue = { type: string; entity_type: 'album' | 'artist' | 'song' | 'import'; entity_id: string; title: string }
const qualityIssues = ref<MusicQualityIssue[]>([])
const qualityLoading = ref(false)
const qualityFilter = ref('all')
const qualityPage = ref(1)
const qualityTotal = ref(0)
const qualityHasMore = ref(false)
const qualityOptions = [
  { label: '全部问题', value: 'all' },
  { label: '缺少封面', value: 'missing_cover' },
  { label: '缺少曲目', value: 'missing_tracks' },
  { label: '缺少音频', value: 'missing_audio' },
  { label: '缺少关键信息', value: 'missing_metadata' },
  { label: '重复候选', value: 'duplicate_candidate' },
  { label: '处理失败', value: 'processing_failed' },
  { label: '导入失败', value: 'import_failed' },
]

async function fetchQualityIssues(page = qualityPage.value) {
  qualityLoading.value = true
  try {
    const response = await apiRequest(`${api.music.adminMusicQuality}?type=${qualityFilter.value}&page=${page}&page_size=30`, { headers: { Authorization: `Bearer ${authStore.token}` } })
    const data = await response.json() as { data?: MusicQualityIssue[]; total?: number; has_more?: boolean }
    qualityIssues.value = data.data ?? []
    qualityPage.value = page
    qualityTotal.value = data.total ?? qualityIssues.value.length
    qualityHasMore.value = data.has_more ?? false
  } catch (error) {
    reportError(error, '加载音乐资料问题失败')
  } finally {
    qualityLoading.value = false
  }
}

function qualityLabel(type: string) {
  return ({ missing_cover: '缺少封面', missing_tracks: '缺少曲目', missing_audio: '缺少音频', missing_metadata: '缺少关键信息', duplicate_candidate: '重复候选', processing_failed: '处理失败', import_failed: '导入失败' } as Record<string, string>)[type] ?? type
}

function qualityPath(issue: MusicQualityIssue) {
  if (issue.entity_type === 'album') return `/music/album/${issue.entity_id}`
  if (issue.entity_type === 'artist') return `/music/artist/${issue.entity_id}`
  if (issue.entity_type === 'song') return `/music/song/${issue.entity_id}`
  return '/music/imports'
}

async function fetchReviewItems() {
  loading.value = true
  try {
    const result = await listMusicEdits({
      status: statusFilter.value ? (statusFilter.value as MusicEditStatus) : undefined,
      entity_type: entityTypeFilter.value ? (entityTypeFilter.value as MusicEntityType) : undefined,
      page_size: 50,
    })

    reviewItems.value = result.data.map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      entityType: item.entity_type,
      targetTitle: item.entity_id || item.type,
      reason: item.reason || item.type,
      createdAt: item.created_at,
      submittedBy: item.submitted_by,
      votes: item.votes,
      payload: item.payload,
      changes: item.changes,
      sources: item.sources,
    }))
  } finally {
    loading.value = false
  }
}

async function runReviewAction(action: (id: string, reason: string) => Promise<unknown>, id: string, reason: string) {
  await action(id, reason)
  await fetchReviewItems()
}

function approve(id: string) {
  return runReviewAction(approveMusicEdit, id, '已通过')
}

function reject(id: string) {
  return runReviewAction(rejectMusicEdit, id, '已驳回')
}

function cancel(id: string) {
  return runReviewAction(cancelMusicEdit, id, '已取消')
}

const fetchEntries = async () => {
  entriesLoading.value = true
  try {
    const params = new URLSearchParams({
      type: entriesTypeFilter.value,
      status: entriesStatusFilter.value,
      page_size: '30',
    })
    const res = await apiRequest(`${api.music.adminMusicReview}?${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const data = await res.json() as { data?: MusicReviewEntry[]; total?: number }
    entries.value = data.data || []
    entriesTotal.value = data.total || 0
  } catch (e) {
    reportError(e, '加载音乐审核列表失败')
  } finally {
    entriesLoading.value = false
  }
}

const entryStatusLabel = (s: string) => {
  if (s === 'confirmed') return '已确认'
  if (s === 'disputed') return '争议'
  return '开放'
}

watch([entriesTypeFilter, entriesStatusFilter], () => {
  if (activeTab.value === 'entries') fetchEntries()
})

watch(qualityFilter, () => { qualityPage.value = 1; if (activeTab.value === 'quality') void fetchQualityIssues(1) })

watch([statusFilter, entityTypeFilter], () => {
  if (activeTab.value === 'review') {
    void fetchReviewItems()
  }
})

onMounted(async () => {
  if (!authStore.isAuthenticated || !isAdminRole(authStore.user?.role)) {
    return
  }
  await fetchReviewItems()
  await fetchEntries()
  await fetchQualityIssues()
})
</script>

<template>
  <div class="setting-music-review-panel">
    <div>
      <div class="admin-tabs">
        <button :class="['admin-tab', activeTab === 'review' ? 'admin-tab-active' : '']" @click="activeTab = 'review'">
          审核队列 ({{ reviewItems.length }})
        </button>
        <button :class="['admin-tab', activeTab === 'entries' ? 'admin-tab-active' : '']" @click="activeTab = 'entries'; fetchEntries()">
          条目管理
        </button>
        <button :class="['admin-tab', activeTab === 'quality' ? 'admin-tab-active' : '']" @click="activeTab = 'quality'; fetchQualityIssues()">
          资料问题 ({{ qualityIssues.length }})
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'entries'">
      <div class="entries-filters">
        <PSelect v-model="entriesTypeFilter" :options="entriesTypeOptions" class="filter-select" />
        <PSelect v-model="entriesStatusFilter" :options="entriesStatusOptions" class="filter-select" />
        <span class="entries-total">共 {{ entriesTotal }} 条</span>
      </div>

      <div v-if="entriesLoading" class="text-center py-12 text-gray-400">加载中...</div>
      <div v-else class="entries-list">
        <div v-for="entry in entries" :key="entry.id" class="entry-row">
          <div class="entry-info">
            <RouterLink :to="entry.type === 'album' ? `/music/album/${entry.id}` : `/music/artist/${entry.id}`" class="entry-name">{{ entry.name }}</RouterLink>
            <span class="entry-type">{{ entry.type === 'album' ? '专辑' : '艺术家' }}</span>
            <span v-if="entry.album_type" class="entry-album-type">{{ entry.album_type.toUpperCase() }}</span>
          </div>
          <div class="entry-meta">
            <span :class="['entry-status', `entry-status-${entry.entry_status}`]">{{ entryStatusLabel(entry.entry_status) }}</span>
            <span v-if="entry.open_discussion_count" class="entry-disc">💬 {{ entry.open_discussion_count }}</span>
            <span class="entry-editor" v-if="entry.last_editor">by {{ entry.last_editor }}</span>
            <span class="entry-date">{{ entry.updated_at?.slice(0, 10) }}</span>
          </div>
        </div>
        <div v-if="entries.length === 0" class="text-gray-400 py-8 text-center">暂无条目</div>
      </div>
    </div>

    <div v-else-if="activeTab === 'quality'">
      <div class="entries-filters"><PSelect v-model="qualityFilter" :options="qualityOptions" class="filter-select" /><span class="entries-total">共 {{ qualityTotal }} 条</span></div>
      <div v-if="qualityLoading" class="text-center py-12 text-gray-400">加载中...</div>
      <div v-else class="entries-list">
        <RouterLink v-for="issue in qualityIssues" :key="`${issue.type}-${issue.entity_id}`" :to="qualityPath(issue)" class="entry-row">
          <div class="entry-info"><span class="entry-name">{{ issue.title || '未命名导入' }}</span><span class="entry-type">{{ issue.entity_type === 'import' ? '导入' : issue.entity_type === 'album' ? '专辑' : issue.entity_type === 'artist' ? '艺术家' : '歌曲' }}</span></div>
          <span class="entry-status entry-status-disputed">{{ qualityLabel(issue.type) }}</span>
        </RouterLink>
        <div v-if="!qualityIssues.length" class="text-gray-400 py-8 text-center">暂无资料问题</div>
        <div v-if="qualityPage > 1 || qualityHasMore" class="quality-pagination">
          <button type="button" :disabled="qualityLoading || qualityPage <= 1" @click="fetchQualityIssues(qualityPage - 1)">上一页</button>
          <span>第 {{ qualityPage }} 页</span>
          <button type="button" :disabled="qualityLoading || !qualityHasMore" @click="fetchQualityIssues(qualityPage + 1)">下一页</button>
        </div>
      </div>
    </div>

    <div v-else>
      <div v-if="loading" class="text-center py-20">
        <p class="text-gray-400 font-medium">加载中...</p>
      </div>
      <MusicEditReviewShell
        v-else
        :items="reviewItems"
        :status="statusFilter"
        :entity-type="entityTypeFilter"
        @update:status="(value) => statusFilter = value"
        @update:entity-type="(value) => entityTypeFilter = value"
        @approve="approve"
        @reject="reject"
        @cancel="cancel"
      />
    </div>
  </div>
</template>

<style scoped>
.setting-music-review-panel { display: grid; gap: 1.25rem; min-width: 0; }
.admin-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--a-color-border-soft); margin-bottom: 1.5rem; }
.admin-tab {
  padding: 0.5rem 1.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.admin-tab:hover { background: var(--a-color-surface-muted); }
.admin-tab-active { border-color: var(--a-color-border-soft); border-bottom-color: var(--a-color-bg); background: var(--a-color-bg); margin-bottom: -1px; }
.entries-filters { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
.filter-select {
  border: 1px solid var(--a-color-border-soft);
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--a-color-bg);
  cursor: pointer;
}
.entries-total { font-size: 0.75rem; color: var(--a-color-muted); font-weight: 600; margin-left: auto; }
.entries-list { display: flex; flex-direction: column; gap: 0; }
.entry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-bottom-width: 0;
  transition: background 0.1s;
}
.entry-row:last-child { border-bottom-width: 1px; }
.entry-row:hover { background: #f9fafb; }
.entry-info { display: flex; align-items: center; gap: 0.75rem; }
.entry-name {
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  color: var(--a-color-fg);
}
.entry-name:hover { text-decoration: underline; }
.entry-type {
  font-size: 0.5rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  border: 1px solid var(--a-color-fg);
  padding: 0.125rem 0.375rem;
}
.entry-album-type {
  font-size: 0.5rem;
  font-weight: 500;
  letter-spacing: 0;
  border: 1px solid var(--a-color-muted-soft);
  color: var(--a-color-muted);
  padding: 0.125rem 0.375rem;
}
.entry-meta { display: flex; align-items: center; gap: 0.75rem; }
.entry-status {
  font-size: 0.5rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  padding: 0.125rem 0.5rem;
  border: 1px solid;
}
.entry-status-confirmed { border-color: #166534; color: #166534; }
.entry-status-disputed { border-color: #991b1b; color: #991b1b; }
.entry-status-open { border-color: var(--a-color-muted-soft); color: var(--a-color-muted); }
.entry-disc { font-size: 0.75rem; color: var(--a-color-muted); }
.entry-editor { font-size: 0.75rem; color: var(--a-color-muted-soft); }
.entry-date { font-size: 0.75rem; color: var(--a-color-muted-soft); }
.quality-pagination { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-top: 1rem; color: var(--a-color-muted); font-size: 0.75rem; }
.quality-pagination button { min-height: 2.75rem; padding: 0.5rem 0.85rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: inherit; cursor: pointer; }
.quality-pagination button:disabled { cursor: default; opacity: 0.45; }
</style>
