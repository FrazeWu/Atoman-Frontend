<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { isAdminRole } from '@/utils/roles'
import ASelect from '@/components/ui/ASelect.vue'
import {
  listMusicEdits,
  approveMusicEdit,
  rejectMusicEdit,
  cancelMusicEdit,
  revertMusicEdit,
  type MusicEntityType,
  type MusicEditStatus,
} from '@/api/musicV1'
import MusicEditReviewShell, { type MusicEditReviewItem } from '@/components/music/MusicEditReviewShell.vue'

const authStore = useAuthStore()
const api = useApi()

const activeTab = ref<'review' | 'entries'>('review')
const reviewItems = ref<MusicEditReviewItem[]>([])
const loading = ref(true)
const statusFilter = ref('open')
const entityTypeFilter = ref('')

const entries = ref<any[]>([])
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
      reason: item.type,
      createdAt: item.created_at,
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
  return runReviewAction(approveMusicEdit, id, '通过后台审核')
}

function reject(id: string) {
  return runReviewAction(rejectMusicEdit, id, '后台驳回')
}

function cancel(id: string) {
  return runReviewAction(cancelMusicEdit, id, '后台取消')
}

function revert(id: string) {
  return runReviewAction(revertMusicEdit, id, '后台回滚')
}

const fetchEntries = async () => {
  entriesLoading.value = true
  try {
    const params = new URLSearchParams({
      type: entriesTypeFilter.value,
      status: entriesStatusFilter.value,
      page_size: '30',
    })
    const res = await fetch(`${api.music.adminMusicReview}?${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const data = await res.json()
    entries.value = data.data || []
    entriesTotal.value = data.total || 0
  } catch (e) {
    console.error('Failed to fetch entries:', e)
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
})
</script>

<template>
  <div class="max-w-5xl mx-auto px-8 py-20">
    <div class="mb-8">
      <h1 class="text-4xl font-black tracking-tighter mb-4">音乐管理</h1>
      <div class="admin-tabs">
        <button :class="['admin-tab', activeTab === 'review' ? 'admin-tab-active' : '']" @click="activeTab = 'review'">
          审核队列 ({{ reviewItems.length }})
        </button>
        <button :class="['admin-tab', activeTab === 'entries' ? 'admin-tab-active' : '']" @click="activeTab = 'entries'; fetchEntries()">
          条目管理
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'entries'">
      <div class="entries-filters">
        <ASelect v-model="entriesTypeFilter" :options="entriesTypeOptions" class="filter-select" />
        <ASelect v-model="entriesStatusFilter" :options="entriesStatusOptions" class="filter-select" />
        <span class="entries-total">共 {{ entriesTotal }} 条</span>
      </div>

      <div v-if="entriesLoading" class="text-center py-12 text-gray-400">加载中...</div>
      <div v-else class="entries-list">
        <div v-for="entry in entries" :key="entry.id" class="entry-row">
          <div class="entry-info">
            <RouterLink :to="entry.type === 'album' ? `/album/${entry.id}` : `/artist/${entry.id}`" class="entry-name">{{ entry.name }}</RouterLink>
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
        @revert="revert"
      />
    </div>
  </div>
</template>

<style scoped>
.admin-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--a-color-fg); margin-bottom: 1.5rem; }
.admin-tab {
  padding: 0.5rem 1.5rem;
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 2px solid transparent;
  border-bottom: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.admin-tab:hover { background: #f3f4f6; }
.admin-tab-active { border-color: var(--a-color-fg); border-bottom-color: var(--a-color-bg); background: var(--a-color-bg); margin-bottom: -2px; }
.entries-filters { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
.filter-select {
  border: 2px solid var(--a-color-fg);
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
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
  border: 2px solid var(--a-color-fg);
  border-bottom-width: 0;
  transition: background 0.1s;
}
.entry-row:last-child { border-bottom-width: 2px; }
.entry-row:hover { background: #f9fafb; }
.entry-info { display: flex; align-items: center; gap: 0.75rem; }
.entry-name {
  font-size: 0.9375rem;
  font-weight: 700;
  text-decoration: none;
  color: var(--a-color-fg);
}
.entry-name:hover { text-decoration: underline; }
.entry-type {
  font-size: 0.5rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 1px solid var(--a-color-fg);
  padding: 0.125rem 0.375rem;
}
.entry-album-type {
  font-size: 0.5rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  border: 1px solid var(--a-color-muted-soft);
  color: var(--a-color-muted);
  padding: 0.125rem 0.375rem;
}
.entry-meta { display: flex; align-items: center; gap: 0.75rem; }
.entry-status {
  font-size: 0.5rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.125rem 0.5rem;
  border: 1px solid;
}
.entry-status-confirmed { border-color: #166534; color: #166534; }
.entry-status-disputed { border-color: #991b1b; color: #991b1b; }
.entry-status-open { border-color: var(--a-color-muted-soft); color: var(--a-color-muted); }
.entry-disc { font-size: 0.75rem; color: var(--a-color-muted); }
.entry-editor { font-size: 0.75rem; color: var(--a-color-muted-soft); }
.entry-date { font-size: 0.75rem; color: var(--a-color-muted-soft); }
</style>
