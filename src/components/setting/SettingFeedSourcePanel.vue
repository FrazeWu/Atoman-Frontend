<template>
  <PSurface class="setting-feed-panel" :layer="1">
    <div class="setting-feed-panel__header">
      <div>
        <h3 class="a-subtitle">订阅源管理</h3>
        <p class="a-muted">仅管理 external_rss 订阅源，支持增改查与手工爬取。</p>
      </div>
      <div class="setting-feed-panel__header-actions">
        <PButton
          variant="secondary"
          size="sm"
          :disabled="loading"
          :loading="loading"
          loading-text="刷新中..."
          @click="refresh"
        >
          刷新
        </PButton>
      </div>
    </div>

    <div
      class="setting-feed-panel__filter-frame"
      data-testid="feed-source-status-filter-frame"
      aria-label="订阅源状态筛选"
    >
      <div class="setting-feed-panel__filters">
        <button
          v-for="option in statusFilterOptions"
          :key="option.value || 'all'"
          type="button"
          class="setting-feed-panel__filter"
          :class="{ 'is-active': statusFilter === option.value }"
          @click="setStatusFilter(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="setting-feed-panel__opml">
      <input
        ref="opmlInput"
        class="setting-feed-panel__file-input"
        type="file"
        accept=".opml,.xml"
        @change="importOPML"
      />
      <PButton
        size="sm"
        variant="secondary"
        :disabled="importingOPML"
        :loading="importingOPML"
        loading-text="导入中..."
        @click="openOPMLPicker"
      >
        导入 OPML
      </PButton>
      <PButton
        size="sm"
        variant="secondary"
        :disabled="exportingOPML"
        :loading="exportingOPML"
        loading-text="导出中..."
        @click="exportOPML"
      >
        导出 OPML
      </PButton>
    </div>

    <div class="setting-feed-panel__editor">
      <div class="setting-feed-panel__editor-grid">
        <PInput
          v-model="draft.title"
          label="订阅源名称"
          placeholder="可选，方便后台识别"
        />
        <PInput
          v-model="draft.rssUrl"
          label="RSS 地址"
          placeholder="https://example.com/feed.xml"
        />
      </div>

      <div class="setting-feed-panel__actions">
        <PButton
          size="sm"
          :disabled="submitting || !canSubmit"
          :loading="submitting"
          :loading-text="editingId ? '保存中...' : '添加中...'"
          @click="submitSource"
        >
          {{ editingId ? '保存修改' : '添加订阅源' }}
        </PButton>
        <PButton
          v-if="editingId"
          size="sm"
          variant="secondary"
          @click="resetForm"
        >
          取消编辑
        </PButton>
      </div>
    </div>

    <p v-if="message" class="setting-feed-panel__message">{{ message }}</p>
    <p v-if="error" class="setting-feed-panel__message setting-feed-panel__message--error">{{ error }}</p>

    <div v-if="sources.length" class="setting-feed-panel__list">
      <PSurface
        v-for="source in sources"
        :key="source.id"
        class="setting-feed-panel__row"
        tone="soft"
        :layer="0"
      >
        <div class="setting-feed-panel__meta">
          <strong @click="openItemsSheet(source)">{{ source.title || '未命名订阅源' }}</strong>
          <small>{{ source.rss_url }}</small>
          <small>
            状态：{{ source.status || 'healthy' }} ·
            待处理 {{ source.pending_count || 0 }} ·
            重试 {{ source.retry_count || 0 }}
          </small>
          <small>
            收藏 {{ source.bookmark_count || 0 }} · 阅读 {{ source.read_count || 0 }}
          </small>
          <small v-if="source.recent_events?.length" class="setting-feed-panel__events">
            最近事件：
            <span v-for="event in source.recent_events" :key="`${source.id}-${event.event_type}-${event.created_at}`">
              {{ event.event_type }}
            </span>
          </small>
        </div>

        <div class="setting-feed-panel__row-actions">
          <label class="setting-feed-panel__toggle">
            <span>全文抓取</span>
            <input
              :checked="source.full_text_enabled"
              type="checkbox"
              :disabled="fullTextMode !== 'per_source' || pendingSourceIds.has(source.id)"
              @click.prevent="toggleSource(source)"
            />
          </label>
          <PButton size="sm" variant="secondary" @click="startEdit(source)">编辑</PButton>
          <PButton
            size="sm"
            variant="secondary"
            :disabled="syncingSourceIds.has(source.id)"
            :loading="syncingSourceIds.has(source.id)"
            loading-text="爬取中..."
            @click="runSync(source.id)"
          >
            手工爬取
          </PButton>
        </div>
      </PSurface>
    </div>

    <p v-else class="setting-feed-panel__empty">暂无外部 RSS 订阅源。</p>

    <SettingFeedSourceItemsSheet
      :show="itemsSheetOpen"
      :source-title="selectedSource?.title || ''"
      :items="selectedSourceItems"
      :loading="itemsSheetLoading"
      :error="itemsSheetError"
      @close="itemsSheetOpen = false"
      @retry="retryItem"
    />
  </PSurface>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import SettingFeedSourceItemsSheet from '@/components/setting/SettingFeedSourceItemsSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSurface from '@/components/ui/PSurface.vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminFeedFulltextStore, type AdminFeedFulltextSourceRow } from '@/stores/adminFeedFulltext'

const props = defineProps<{
  fullTextMode: 'disabled' | 'per_source'
  allowAddSource?: boolean
}>()

const authStore = useAuthStore()
const adminFeedFulltextStore = useAdminFeedFulltextStore()

const loading = ref(false)
const submitting = ref(false)
const importingOPML = ref(false)
const exportingOPML = ref(false)
const editingId = ref('')
const message = ref('')
const error = ref('')
const statusFilter = ref<'healthy' | 'degraded' | 'failing' | ''>('')
const pendingSourceIds = ref(new Set<string>())
const syncingSourceIds = ref(new Set<string>())
const itemsSheetOpen = ref(false)
const itemsSheetLoading = ref(false)
const itemsSheetError = ref('')
const selectedSource = ref<AdminFeedFulltextSourceRow | null>(null)
const selectedSourceItems = ref([])
const opmlInput = ref<HTMLInputElement | null>(null)
const draft = ref({
  title: '',
  rssUrl: '',
})

const sources = computed(() => adminFeedFulltextStore.sources as AdminFeedFulltextSourceRow[])
const canSubmit = computed(() => draft.value.rssUrl.trim().length > 0)
const statusFilterOptions = [
  { label: '全部', value: '' },
  { label: '正常', value: 'healthy' },
  { label: '降级', value: 'degraded' },
  { label: '无效', value: 'failing' },
] as const

function sourceFetchOptions() {
  return statusFilter.value
    ? { limit: 100, status: statusFilter.value }
    : { limit: 100 }
}

function resetForm() {
  editingId.value = ''
  draft.value = {
    title: '',
    rssUrl: '',
  }
}

async function refresh() {
  if (!authStore.token) return
  loading.value = true
  error.value = ''
  try {
    await adminFeedFulltextStore.fetchSources(authStore.token, sourceFetchOptions())
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载订阅源失败'
  } finally {
    loading.value = false
  }
}

async function setStatusFilter(nextStatus: typeof statusFilter.value) {
  if (statusFilter.value === nextStatus) return
  statusFilter.value = nextStatus
  await refresh()
}

async function submitSource() {
  if (!authStore.token || !canSubmit.value) return

  submitting.value = true
  error.value = ''
  message.value = ''
  try {
    const payload = {
      title: draft.value.title.trim(),
      rss_url: draft.value.rssUrl.trim(),
    }

    if (editingId.value) {
      await adminFeedFulltextStore.updateSource(editingId.value, payload, authStore.token)
      message.value = '订阅源已更新'
    } else {
      await adminFeedFulltextStore.createSource(payload, authStore.token)
      message.value = '订阅源已添加'
    }

    resetForm()
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存订阅源失败'
  } finally {
    submitting.value = false
  }
}

function openOPMLPicker() {
  opmlInput.value?.click()
}

async function importOPML(event: Event) {
  if (!authStore.token) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importingOPML.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await adminFeedFulltextStore.importGlobalOPML(file, authStore.token)
    message.value = `导入 ${result.imported || 0}，复用 ${result.reused || 0}，失败 ${result.failed || 0}`
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '导入 OPML 失败'
  } finally {
    importingOPML.value = false
    input.value = ''
  }
}

async function exportOPML() {
  if (!authStore.token) return

  exportingOPML.value = true
  error.value = ''
  message.value = ''
  try {
    const blob = await adminFeedFulltextStore.exportGlobalOPML(authStore.token)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'atoman-feed-sources.opml'
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '导出 OPML 失败'
  } finally {
    exportingOPML.value = false
  }
}

function startEdit(source: AdminFeedFulltextSourceRow) {
  editingId.value = source.id
  draft.value = {
    title: source.title || '',
    rssUrl: source.rss_url || '',
  }
}

async function openItemsSheet(source: AdminFeedFulltextSourceRow) {
  if (!authStore.token) return

  selectedSource.value = source
  itemsSheetOpen.value = true
  itemsSheetLoading.value = true
  itemsSheetError.value = ''

  try {
    selectedSourceItems.value = await adminFeedFulltextStore.fetchItems(authStore.token, {
      sourceId: source.id,
      page: 1,
      limit: 20,
    })
  } catch (err) {
    itemsSheetError.value = err instanceof Error ? err.message : '加载条目失败'
    selectedSourceItems.value = []
  } finally {
    itemsSheetLoading.value = false
  }
}

async function toggleSource(source: AdminFeedFulltextSourceRow) {
  if (!authStore.token || props.fullTextMode !== 'per_source') return

  const next = new Set(pendingSourceIds.value)
  next.add(source.id)
  pendingSourceIds.value = next
  error.value = ''
  message.value = ''

  try {
    await adminFeedFulltextStore.updateSourceEnabled(source.id, !source.full_text_enabled, authStore.token)
    message.value = source.full_text_enabled ? '已关闭全文抓取' : '已开启全文抓取'
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新全文抓取失败'
  } finally {
    const current = new Set(pendingSourceIds.value)
    current.delete(source.id)
    pendingSourceIds.value = current
  }
}

async function runSync(sourceId: string) {
  if (!authStore.token) return

  const next = new Set(syncingSourceIds.value)
  next.add(sourceId)
  syncingSourceIds.value = next
  error.value = ''
  message.value = ''

  try {
    await adminFeedFulltextStore.syncSource(sourceId, authStore.token)
    message.value = '已开始手工爬取'
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '手工爬取失败'
  } finally {
    const current = new Set(syncingSourceIds.value)
    current.delete(sourceId)
    syncingSourceIds.value = current
  }
}

async function retryItem(itemId: string) {
  if (!authStore.token || !selectedSource.value) return

  itemsSheetError.value = ''
  try {
    await adminFeedFulltextStore.retryItem(itemId, authStore.token)
    selectedSourceItems.value = await adminFeedFulltextStore.fetchItems(authStore.token, {
      sourceId: selectedSource.value.id,
      page: 1,
      limit: 20,
    })
  } catch (err) {
    itemsSheetError.value = err instanceof Error ? err.message : '重试条目失败'
  }
}

onMounted(() => {
  refresh()
})
</script>

<style scoped>
.setting-feed-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.setting-feed-panel__header,
.setting-feed-panel__row,
.setting-feed-panel__row-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.setting-feed-panel__header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  align-items: center;
}

.setting-feed-panel__filter-frame {
  max-width: 100%;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.4rem 0.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--a-color-paper);
  -webkit-overflow-scrolling: touch;
}

.setting-feed-panel__filters {
  display: flex;
  flex-wrap: nowrap;
  width: fit-content;
  gap: 0.35rem;
}

.setting-feed-panel__filter {
  flex: 0 0 auto;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.34rem 0.6rem;
  background: var(--a-color-paper);
  color: var(--a-color-ink-muted);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.setting-feed-panel__filter.is-active {
  border-color: var(--a-color-ink);
  color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-sm);
}

.setting-feed-panel__header h3,
.setting-feed-panel__header p {
  margin: 0;
}

.setting-feed-panel__editor,
.setting-feed-panel__list,
.setting-feed-panel__meta {
  display: grid;
  gap: 0.75rem;
}

.setting-feed-panel__editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.setting-feed-panel__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.setting-feed-panel__opml {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.setting-feed-panel__file-input {
  display: none;
}

.setting-feed-panel__row {
  padding: 0.9rem 1rem;
}

.setting-feed-panel__meta {
  min-width: 0;
}

.setting-feed-panel__meta small,
.setting-feed-panel__empty,
.setting-feed-panel__message {
  color: var(--a-color-ink-muted);
}

.setting-feed-panel__row-actions {
  align-items: center;
  flex-wrap: wrap;
}

.setting-feed-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.setting-feed-panel__toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--a-color-ink);
}

.setting-feed-panel__message {
  margin: 0;
}

.setting-feed-panel__message--error {
  color: var(--a-color-danger-ink);
}

@media (max-width: 720px) {
  .setting-feed-panel__editor-grid {
    grid-template-columns: 1fr;
  }

  .setting-feed-panel__header,
  .setting-feed-panel__row {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-feed-panel__header-actions,
  .setting-feed-panel__actions,
  .setting-feed-panel__opml,
  .setting-feed-panel__row-actions {
    justify-content: flex-start;
  }
}
</style>
