<template>
  <section class="setting-music">
    <header class="setting-music__page-head">
      <div>
        <h2>音乐管理</h2>
        <p>处理资料修改并查看音乐条目。</p>
      </div>
      <span v-if="activeTab === 'review' && reviewItems.length" class="setting-music__count">
        {{ reviewItems.length }} 条待处理
      </span>
      <span v-else-if="activeTab === 'entries'" class="setting-music__count">共 {{ entriesTotal }} 条</span>
    </header>

    <div class="setting-music__tabs" role="tablist" aria-label="音乐管理内容">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'review'"
        :class="{ 'is-active': activeTab === 'review' }"
        @click="openTab('review')"
      >
        审核队列
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'entries'"
        :class="{ 'is-active': activeTab === 'entries' }"
        @click="openTab('entries')"
      >
        条目管理
      </button>
    </div>

    <div v-if="activeTab === 'review'" role="tabpanel">
      <p v-if="reviewError" class="setting-music__message setting-music__message--error" role="alert">{{ reviewError }}</p>
      <p v-if="loading" class="setting-music__loading" role="status">正在加载审核队列...</p>
      <MusicEditReviewShell
        v-else
        :items="reviewItems"
        :status="statusFilter"
        :entity-type="entityTypeFilter"
        @update:status="statusFilter = $event"
        @update:entity-type="entityTypeFilter = $event"
        @approve="approve"
        @reject="reject"
        @cancel="cancel"
      />
    </div>

    <div v-else role="tabpanel" class="setting-music__entries">
      <div class="setting-music__entry-filters">
        <PSelect v-model="entriesTypeFilter" label="资料类型" :options="entriesTypeOptions" />
        <PSelect v-model="entriesStatusFilter" label="条目状态" :options="entriesStatusOptions" />
        <PButton variant="secondary" :loading="entriesLoading" loading-text="刷新中..." @click="fetchEntries">刷新</PButton>
      </div>

      <p v-if="entriesError" class="setting-music__message setting-music__message--error" role="alert">{{ entriesError }}</p>
      <p v-if="entriesLoading" class="setting-music__loading" role="status">正在加载音乐条目...</p>
      <p v-else-if="entries.length === 0" class="setting-music__empty">暂无符合条件的条目。</p>

      <div v-else class="setting-music__entries-table" role="table" aria-label="音乐条目">
        <div class="setting-music__entry-head" role="row">
          <span role="columnheader">名称</span>
          <span role="columnheader">类型</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">讨论</span>
          <span role="columnheader">最近更新</span>
        </div>
        <div v-for="entry in entries" :key="entry.id" class="setting-music__entry-row" role="row">
          <div role="cell">
            <RouterLink :to="entryHref(entry)" class="setting-music__entry-name">{{ entry.name }}</RouterLink>
            <small v-if="entry.last_editor">编辑者：{{ entry.last_editor }}</small>
          </div>
          <span role="cell">{{ entry.type === 'album' ? '专辑' : '艺术家' }}</span>
          <span role="cell" class="setting-music__entry-status">
            <i :class="entryStatusTone(entry.entry_status)" aria-hidden="true" />
            {{ entryStatusLabel(entry.entry_status) }}
          </span>
          <span role="cell">{{ entry.open_discussion_count || 0 }} 个讨论</span>
          <span role="cell">{{ formatDate(entry.updated_at) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
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
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'

type ManagedMusicEntry = {
  id: string
  name: string
  type: 'album' | 'artist'
  entry_status: 'open' | 'confirmed' | 'disputed' | string
  open_discussion_count?: number
  last_editor?: string
  updated_at?: string
}

const authStore = useAuthStore()
const api = useApi()

const activeTab = ref<'review' | 'entries'>('review')
const reviewItems = ref<MusicEditReviewItem[]>([])
const loading = ref(true)
const reviewError = ref('')
const statusFilter = ref('open')
const entityTypeFilter = ref('')

const entries = ref<ManagedMusicEntry[]>([])
const entriesTotal = ref(0)
const entriesLoading = ref(false)
const entriesLoaded = ref(false)
const entriesError = ref('')
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

async function fetchReviewItems() {
  loading.value = true
  reviewError.value = ''
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
      targetTitle: item.entity_id || '未命名资料',
      reason: item.submitted_by ? `提交人：${item.submitted_by}` : '',
      createdAt: item.created_at,
    }))
  } catch (err) {
    reviewError.value = err instanceof Error ? err.message : '加载审核队列失败，请重试'
  } finally {
    loading.value = false
  }
}

async function runReviewAction(action: (id: string, reason: string) => Promise<unknown>, id: string, reason: string) {
  reviewError.value = ''
  try {
    await action(id, reason)
    await fetchReviewItems()
  } catch (err) {
    reviewError.value = err instanceof Error ? err.message : '处理失败，请重试'
  }
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

async function fetchEntries() {
  entriesLoading.value = true
  entriesError.value = ''
  try {
    const params = new URLSearchParams({
      type: entriesTypeFilter.value,
      status: entriesStatusFilter.value,
      page_size: '30',
    })
    const response = await fetch(`${api.music.adminMusicReview}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '加载音乐条目失败')

    entries.value = data.data || []
    entriesTotal.value = data.total || 0
    entriesLoaded.value = true
  } catch (err) {
    entriesError.value = err instanceof Error ? err.message : '加载音乐条目失败，请重试'
  } finally {
    entriesLoading.value = false
  }
}

function openTab(tab: 'review' | 'entries') {
  activeTab.value = tab
  if (tab === 'entries' && !entriesLoaded.value) void fetchEntries()
}

function entryHref(entry: ManagedMusicEntry) {
  return entry.type === 'album' ? `/music?album=${entry.id}` : `/music?artist=${entry.id}`
}

function entryStatusLabel(status: string) {
  if (status === 'confirmed') return '已确认'
  if (status === 'disputed') return '争议'
  return '开放'
}

function entryStatusTone(status: string) {
  if (status === 'confirmed') return 'is-confirmed'
  if (status === 'disputed') return 'is-disputed'
  return 'is-open'
}

function formatDate(value?: string) {
  if (!value) return '暂无记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(date)
}

watch([entriesTypeFilter, entriesStatusFilter], () => {
  if (activeTab.value === 'entries' && entriesLoaded.value) void fetchEntries()
})

watch([statusFilter, entityTypeFilter], () => {
  if (activeTab.value === 'review') void fetchReviewItems()
})

onMounted(() => {
  if (authStore.isAuthenticated && isAdminRole(authStore.user?.role)) {
    void fetchReviewItems()
  } else {
    loading.value = false
  }
})
</script>

<style scoped>
.setting-music {
  display: grid;
  gap: 1.25rem;
}

.setting-music__page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
}

.setting-music__page-head h2,
.setting-music__page-head p,
.setting-music__message {
  margin: 0;
}

.setting-music__page-head h2 {
  font-size: 1.5rem;
}

.setting-music__page-head p,
.setting-music__count,
.setting-music__message,
.setting-music__loading,
.setting-music__empty {
  color: var(--a-color-ink-muted);
}

.setting-music__count {
  font-size: var(--a-text-xs);
}

.setting-music__tabs {
  display: flex;
  gap: 1.5rem;
  border-bottom: 1px solid var(--a-color-line);
}

.setting-music__tabs button {
  min-height: 2.75rem;
  padding: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--a-color-ink-soft);
  font: inherit;
  font-weight: var(--a-font-weight-strong);
  cursor: pointer;
}

.setting-music__tabs button:hover,
.setting-music__tabs button:focus-visible,
.setting-music__tabs button.is-active {
  color: var(--a-color-ink);
}

.setting-music__tabs button.is-active {
  border-bottom-color: var(--a-color-ink);
}

.setting-music__tabs button:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: -2px;
}

.setting-music__entry-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 12rem)) auto;
  gap: 0.75rem;
  align-items: end;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--a-color-line);
}

.setting-music__entry-filters > :deep(.p-button) {
  justify-self: start;
}

.setting-music__message--error {
  color: var(--a-color-danger-ink);
}

.setting-music__loading,
.setting-music__empty {
  padding: 3rem 0;
  border-bottom: 1px solid var(--a-color-line);
  text-align: center;
}

.setting-music__entries-table {
  border-bottom: 1px solid var(--a-color-line);
}

.setting-music__entry-head,
.setting-music__entry-row {
  display: grid;
  grid-template-columns: minmax(12rem, 1.2fr) 6rem 7rem 7rem minmax(8rem, 0.8fr);
  gap: 1rem;
  align-items: center;
}

.setting-music__entry-head {
  min-height: 2.25rem;
  padding: 0 0.75rem;
  background: var(--a-color-paper-soft);
  color: var(--a-color-ink-muted);
  font-size: 0.7rem;
  font-weight: var(--a-font-weight-strong);
}

.setting-music__entry-row {
  min-height: 4.25rem;
  padding: 0.75rem;
  border-top: 1px solid var(--a-color-line-soft);
}

.setting-music__entry-row > div:first-child small {
  display: block;
  color: var(--a-color-ink-muted);
}

.setting-music__entry-name {
  color: var(--a-color-ink);
  font-weight: var(--a-font-weight-strong);
  text-decoration: none;
}

.setting-music__entry-name:hover,
.setting-music__entry-name:focus-visible {
  text-decoration: underline;
}

.setting-music__entry-status {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.setting-music__entry-status i {
  width: 0.45rem;
  height: 0.45rem;
  background: var(--a-color-muted-soft);
}

.setting-music__entry-status i.is-confirmed {
  background: #177245;
}

.setting-music__entry-status i.is-disputed {
  background: var(--a-color-accent-destructive);
}

@media (max-width: 900px) {
  .setting-music__entry-head {
    display: none;
  }

  .setting-music__entry-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.4rem 1rem;
    padding: 1rem 0;
  }

  .setting-music__entry-row > :first-child,
  .setting-music__entry-row > :last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .setting-music__page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .setting-music__entry-filters {
    grid-template-columns: 1fr;
  }
}
</style>
