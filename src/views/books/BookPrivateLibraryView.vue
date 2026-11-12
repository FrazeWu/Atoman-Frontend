<template>
  <section class="book-catalog file-library">
    <PPageHeader title="我的书架" sub="管理与阅读已添加的图书及离线文件。" />

    <!-- 顶部状态切换 (Cupertino Segmented Control) -->
    <div class="file-library__nav">
      <PSegmentedControl
        :model-value="status"
        :options="statusOptions"
        @update:model-value="handleStatusChange"
      />
    </div>

    <!-- 离线存储管理条 -->
    <div class="file-library__storage-bar">
      <div class="file-library__storage-info">
        <HardDrive :size="16" class="file-library__storage-icon" aria-hidden="true" />
        <span class="file-library__storage-text">
          本地存储：{{ storageInfo.count > 0 ? `${storageInfo.count} 本已缓存 · 占用 ${storageSizeFormatted}` : '暂无离线文件' }}
        </span>
      </div>
      <div class="file-library__storage-actions">
        <PButton
          v-if="storageInfo.count > 0"
          size="sm"
          variant="ghost"
          class="file-library__storage-purge-btn"
          @click="confirmPurge = true"
        >
          <Trash2 :size="13" aria-hidden="true" />
          <span>清理离线缓存</span>
        </PButton>
        <PButton
          size="sm"
          variant="ghost"
          class="file-library__storage-refresh-btn"
          title="刷新本地缓存状态"
          @click="refreshStorageInfo"
        >
          <RotateCw :size="13" aria-hidden="true" />
        </PButton>
      </div>
    </div>

    <!-- 筛选、排序与搜索工具栏 -->
    <div class="file-library__toolbar">
      <div class="file-library__filters">
        <label class="file-library__control-group">
          <span class="file-library__control-label">归档</span>
          <select v-model="archiveFilter" class="file-library__select">
            <option value="all">全部（含归档）</option>
            <option value="active">未归档</option>
            <option value="archived">已归档</option>
          </select>
        </label>
        <label class="file-library__control-group">
          <span class="file-library__control-label">排序</span>
          <select v-model="sort" class="file-library__select" @change="load">
            <option value="activity">最近活动</option>
            <option value="added">最近加入</option>
            <option value="progress">阅读进度</option>
            <option value="title">书名</option>
          </select>
        </label>
      </div>
      <div class="file-library__search-wrapper">
        <Search :size="13" class="file-library__search-icon" aria-hidden="true" />
        <input v-model.trim="query" class="file-library__search-input" placeholder="搜索书名..." />
      </div>
      <PButton size="sm" variant="ghost" to="/books" class="file-library__discover-btn">
        <Compass :size="15" aria-hidden="true" />
        <span>发现图书</span>
      </PButton>
    </div>

    <p v-if="error" role="alert" class="book-catalog__error">
      {{ error }} <PButton size="sm" variant="secondary" @click="load">重试</PButton>
    </p>
    <p v-if="loading" role="status">正在加载书架…</p>
    <template v-else>
      <p class="file-library__count">共 {{ visible.length }} 本图书</p>
      <PEmpty v-if="!visible.length" description="暂无符合条件的图书。可前往发现页浏览并加入书架。" />
      <ul v-else class="file-library__grid">
        <li v-for="entry in visible" :key="entry.revision_id" class="file-library__card">
          <button
            type="button"
            class="file-library__cover"
            :disabled="!entry.file_available"
            :aria-label="'阅读 ' + entry.title"
            @click="read(entry)"
          >
            <BookCover variant="edition" :src="entry.cover_url" :title="entry.title" :category="entry.format.toUpperCase()" />
          </button>
          <div class="file-library__body">
            <div class="file-library__header">
              <button
                type="button"
                class="file-library__title"
                :disabled="!entry.file_available"
                :title="entry.title"
                @click="read(entry)"
              >{{ entry.title }}</button>
              <div class="file-library__meta">
                <span>{{ entry.format.toUpperCase() }} · {{ labelForStatus(entry.status) }}</span>
                <span v-if="isCached(entry.revision_id)" class="file-library__offline-badge" title="已保存在本机离线存储">
                  <Check :size="11" aria-hidden="true" />
                  <span>已离线</span>
                </span>
              </div>
            </div>
            <div v-if="entry.archived || entry.has_better || !entry.file_available" class="file-library__flags">
              <span v-if="entry.archived" class="file-library__flag--archived">已归档</span>
              <span v-if="entry.has_better" class="file-library__flag--better">有更优版本</span>
              <span v-if="!entry.file_available" class="file-library__flag--unavailable">文件暂不可用</span>
            </div>
            <div class="file-library__progress-wrapper">
              <div
                class="file-library__progress"
                role="progressbar"
                :aria-valuenow="Math.round(entry.furthest_percent * 100)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div :style="{ width: String(Math.round(entry.furthest_percent * 100)) + '%' }"></div>
              </div>
              <small>最远阅读 {{ Math.round(entry.furthest_percent * 100) }}%</small>
            </div>
            <PButton block size="sm" :disabled="!entry.file_available" class="file-library__read-btn" @click="read(entry)">继续阅读</PButton>
            <div class="file-library__tools">
              <PButton v-if="entry.has_better && entry.edition_id" size="sm" variant="ghost" class="file-library__better-btn" :to="'/books/edition/' + entry.edition_id">查看更优版本</PButton>
              <details class="file-library__menu">
                <summary class="file-library__summary" title="管理图书">
                  <MoreHorizontal :size="15" aria-hidden="true" />
                  <span class="file-library__summary-text">管理</span>
                </summary>
                <div class="file-library__dropdown">
                  <label>阅读状态
                    <select :value="entry.status" :disabled="!!busy" @change="update(entry, { status: ($event.target as HTMLSelectElement).value as FileShelfStatus })">
                      <option v-for="item in shelfStatuses" :key="item.value" :value="item.value">{{ item.label }}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    :disabled="!!busy || cachingRevisionId === entry.revision_id"
                    @click="toggleOfflineCache(entry)"
                  >
                    {{ cachingRevisionId === entry.revision_id ? '正在下载…' : (isCached(entry.revision_id) ? '清除离线缓存' : '下载离线阅读') }}
                  </button>
                  <button type="button" :disabled="!!busy" @click="update(entry, { archived: !entry.archived })">{{ entry.archived ? '取消归档' : '归档' }}</button>
                  <button type="button" class="file-library__remove-btn" :disabled="!!busy" @click="removing = entry">移出书架</button>
                </div>
              </details>
            </div>
          </div>
        </li>
      </ul>
      <PButton v-if="entries.length < total" size="sm" variant="secondary" :disabled="!!busy" @click="more">加载更多</PButton>
    </template>

    <PConfirm
      :show="!!removing"
      title="移出书架？"
      message="移出后可在图书页面重新添加，阅读进度与笔记仍将保留。"
      @confirm="remove"
      @cancel="removing = null"
    />

    <PConfirm
      :show="confirmPurge"
      title="清理全部离线缓存？"
      message="将释放本机占用的离线存储空间。连接网络后可随时重新下载。"
      @confirm="handlePurgeAllCache"
      @cancel="confirmPurge = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Compass, MoreHorizontal, HardDrive, Trash2, RotateCw, Check } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import BookCover from '@/components/books/BookCover.vue'
import { listFileShelf, saveFileShelf, removeFileShelf, type FileShelfStatus, type FileShelfSort, type FileShelfItem } from '@/api/bookFileShelf'
import { resourceReaderPath } from '@/api/bookResources'
import {
  initBookOfflineCache,
  isRevisionCachedSync,
  cacheBookRevision,
  removeCachedBookRevision,
  getBookOfflineStorageInfo,
  clearAllBookOfflineCache,
  formatStorageBytes,
  type BookOfflineStorageInfo,
} from '@/utils/bookOfflineCache'
import './bookCatalog.css'

const router = useRouter()

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'reading', label: '在读' },
  { value: 'unstarted', label: '想读' },
  { value: 'finished', label: '已读' },
  { value: 'offline', label: '本地离线' },
]

const shelfStatuses: { value: FileShelfStatus; label: string }[] = [
  { value: 'unstarted', label: '未开始' },
  { value: 'reading', label: '在读' },
  { value: 'finished', label: '已读' },
  { value: 'paused', label: '暂停' },
]

const entries = ref<FileShelfItem[]>([])
const total = ref(0)
const status = ref('')
const archiveFilter = ref('all')
const sort = ref<FileShelfSort>('activity')
const query = ref('')
const loading = ref(true)
const busy = ref('')
const error = ref('')
const removing = ref<FileShelfItem | null>(null)
const confirmPurge = ref(false)
const cachingRevisionId = ref('')

const storageInfo = ref<BookOfflineStorageInfo>({
  count: 0,
  totalBytes: 0,
  revisionIds: [],
})

const cachedRevisionsSet = computed(() => new Set(storageInfo.value.revisionIds))
const storageSizeFormatted = computed(() => formatStorageBytes(storageInfo.value.totalBytes))

const visible = computed(() => entries.value.filter(e => {
  const matchesArchive = archiveFilter.value === 'all' || (archiveFilter.value === 'archived' ? e.archived : !e.archived)
  const matchesQuery = !query.value || e.title.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())
  const matchesStatus = !status.value || status.value === 'offline' || e.status === status.value
  const matchesOffline = status.value !== 'offline' || cachedRevisionsSet.value.has(e.revision_id)
  return matchesArchive && matchesQuery && matchesStatus && matchesOffline
}))

const labelForStatus = (s: FileShelfStatus) => shelfStatuses.find(x => x.value === s)?.label ?? s

function isCached(revisionId: string): boolean {
  return cachedRevisionsSet.value.has(revisionId) || isRevisionCachedSync(revisionId)
}

async function refreshStorageInfo() {
  const ids = await initBookOfflineCache()
  const info = await getBookOfflineStorageInfo()
  storageInfo.value = {
    ...info,
    revisionIds: Array.from(new Set([...info.revisionIds, ...Array.from(ids)])),
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const apiStatus = status.value === 'offline' ? '' : status.value
    const result = await listFileShelf({ sort: sort.value, status: apiStatus })
    entries.value = result.items
    total.value = result.total
  } catch {
    error.value = '加载书架失败，请重试。'
  } finally {
    loading.value = false
  }
}

function handleStatusChange(val: string) {
  status.value = val
  if (val !== 'offline') {
    void load()
  } else if (entries.value.length === 0) {
    void load()
  }
}

async function more() {
  if (busy.value) return
  busy.value = 'more'
  try {
    const apiStatus = status.value === 'offline' ? '' : status.value
    const result = await listFileShelf({ sort: sort.value, status: apiStatus, offset: entries.value.length })
    entries.value.push(...result.items)
    total.value = result.total
  } catch {
    error.value = '加载更多失败。'
  } finally {
    busy.value = ''
  }
}

function read(entry: FileShelfItem) {
  if (!entry.file_available) return
  void router.push(resourceReaderPath(entry.work_id, entry.asset_id, entry.revision_id))
}

async function update(entry: FileShelfItem, patch: { status?: FileShelfStatus; archived?: boolean }) {
  busy.value = entry.id
  try {
    await saveFileShelf(entry.revision_id, patch)
    await load()
  } catch {
    error.value = '更新书架失败，请重试。'
  } finally {
    busy.value = ''
  }
}

async function remove() {
  if (!removing.value) return
  busy.value = removing.value.id
  try {
    await removeFileShelf(removing.value.revision_id)
    removing.value = null
    await load()
  } catch {
    error.value = '移出书架失败。'
  } finally {
    busy.value = ''
  }
}

async function toggleOfflineCache(entry: FileShelfItem) {
  const revisionId = entry.revision_id
  if (isCached(revisionId)) {
    await removeCachedBookRevision(revisionId)
    await refreshStorageInfo()
  } else {
    cachingRevisionId.value = revisionId
    try {
      await cacheBookRevision(revisionId)
      await refreshStorageInfo()
    } finally {
      cachingRevisionId.value = ''
    }
  }
}

async function handlePurgeAllCache() {
  confirmPurge.value = false
  await clearAllBookOfflineCache()
  await refreshStorageInfo()
}

onMounted(() => {
  void load()
  void refreshStorageInfo()
})
</script>

<style scoped>
.file-library {
  display: grid;
  gap: 1.25rem;
}

.file-library__nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.file-library__storage-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 0.75rem;
}

.file-library__storage-info {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-text-secondary, #64748b);
  font-weight: 500;
}

.file-library__storage-icon {
  color: var(--a-color-text-secondary, #94a3b8);
}

.file-library__storage-text {
  font-size: 0.75rem;
}

.file-library__storage-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.file-library__storage-purge-btn {
  height: 24px;
  padding: 0 0.5rem;
  font-size: 0.6875rem;
  color: var(--a-color-danger, #e11d48);
}

.file-library__storage-refresh-btn {
  height: 24px;
  width: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.file-library__toolbar {
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

.file-library__filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.file-library__control-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

.file-library__control-label {
  font-weight: 500;
  user-select: none;
}

.file-library__select {
  height: 28px;
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text, #0f172a);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.file-library__select:focus-visible {
  outline: 2px solid var(--a-color-primary, #007aff);
  outline-offset: -1px;
}

.file-library__search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 140px;
  max-width: 240px;
}

.file-library__search-icon {
  position: absolute;
  left: 0.5rem;
  color: var(--a-color-text-secondary, #94a3b8);
  pointer-events: none;
}

.file-library__search-input {
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

.file-library__search-input:focus-visible {
  outline: 2px solid var(--a-color-primary, #007aff);
  outline-offset: -1px;
}

.file-library__discover-btn {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 6px;
  padding: 0 0.65rem;
}

.file-library__count {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
  font-weight: 500;
  margin: 0;
}

.file-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  padding: 0;
  list-style: none;
  gap: 1.5rem;
}

.file-library__card {
  background: var(--a-color-bg, #ffffff);
  border-radius: 8px;
  padding: 0.875rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.file-library__card:hover {
  box-shadow: 0 6px 18px -2px rgba(0, 0, 0, 0.07), 0 2px 5px rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.08);
}

.file-library__cover {
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  aspect-ratio: 2 / 3;
  overflow: visible;
  display: block;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.file-library__cover:disabled {
  cursor: default;
  opacity: 0.6;
}

.file-library__cover:hover:not(:disabled) {
  transform: translateY(-2px);
}

.file-library__cover :deep(.book-cover) {
  border-radius: 4px;
  box-shadow: 0 6px 18px -2px rgba(0, 0, 0, 0.14), 0 2px 5px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.file-library__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.file-library__header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.file-library__title {
  font-weight: 600;
  font-size: 0.875rem;
  line-height: 1.35;
  text-align: left;
  background: none;
  border: none;
  padding: 0;
  color: var(--a-color-text, #0f172a);
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  transition: color 0.15s ease;
}

.file-library__title:hover:not(:disabled) {
  color: var(--a-color-primary, #007aff);
}

.file-library__title:disabled {
  cursor: default;
}

.file-library__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  color: var(--a-color-text-secondary, #64748b);
  font-size: 0.75rem;
  font-weight: 500;
}

.file-library__offline-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.6875rem;
  color: #10b981;
  background: rgba(16, 185, 129, 0.08);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-weight: 500;
}

.file-library__flags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.6875rem;
  font-weight: 500;
}

.file-library__flags span {
  border: none;
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  line-height: 1.2;
}

.file-library__flag--better {
  background: rgba(0, 122, 255, 0.08) !important;
  color: #007aff !important;
}

.file-library__flag--archived {
  background: rgba(0, 0, 0, 0.04) !important;
  color: #94a3b8 !important;
}

.file-library__flag--unavailable {
  background: rgba(239, 68, 68, 0.08) !important;
  color: #ef4444 !important;
}

.file-library__progress-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-library__progress {
  height: 4px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.file-library__progress div {
  height: 100%;
  background: var(--a-color-primary, #007aff);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.file-library__progress-wrapper small {
  color: var(--a-color-text-secondary, #64748b);
  font-size: 0.6875rem;
}

.file-library__read-btn {
  height: 30px;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 6px;
}

.file-library__tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.25rem;
  position: relative;
}

.file-library__better-btn {
  height: 24px;
  padding: 0 0.4rem;
  font-size: 0.6875rem;
  color: var(--a-color-primary, #007aff);
}

.file-library__menu {
  margin-left: auto;
  position: relative;
  font-size: 0.75rem;
}

.file-library__summary::-webkit-details-marker {
  display: none;
}

.file-library__summary {
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  color: var(--a-color-text-secondary, #64748b);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  user-select: none;
}

.file-library__summary:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--a-color-text, #0f172a);
}

.file-library__summary-text {
  font-size: 0.75rem;
}

.file-library__dropdown {
  position: absolute;
  right: 0;
  bottom: calc(100% + 4px);
  min-width: 150px;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 0.5rem;
  display: grid;
  gap: 0.4rem;
  z-index: 20;
}

.file-library__dropdown label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

.file-library__dropdown select {
  width: 100%;
  font-size: 0.75rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
}

.file-library__dropdown button {
  width: 100%;
  text-align: left;
  font-size: 0.75rem;
  padding: 0.35rem 0.5rem;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--a-color-text, #0f172a);
  transition: background 0.15s ease;
}

.file-library__dropdown button:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}

.file-library__dropdown button:disabled {
  opacity: 0.5;
  cursor: default;
}

.file-library__dropdown .file-library__remove-btn {
  color: var(--a-color-danger, #e11d48);
}

.file-library__dropdown .file-library__remove-btn:hover:not(:disabled) {
  background: rgba(225, 29, 72, 0.08);
}

@media (max-width: 640px) {
  .file-library__card {
    flex-direction: row;
    align-items: start;
    gap: 0.85rem;
  }
  .file-library__cover {
    width: 5.5rem;
    flex-shrink: 0;
    aspect-ratio: 2 / 3;
    align-self: start;
  }
  .file-library__body {
    flex: 1;
    min-width: 0;
  }
  .file-library__tools {
    flex-wrap: wrap;
  }
}
</style>
