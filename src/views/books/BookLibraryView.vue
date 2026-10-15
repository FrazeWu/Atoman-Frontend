<template>
  <div class="book-library-view">
    <!-- Header -->
    <header class="book-library-header">
      <div class="book-library-header__title-row">
        <div class="book-library-header__heading">
          <h1 class="book-library-header__title">我的书架</h1>
          <p class="book-library-header__sub">管理个人藏书、阅读进度与本地电子书</p>
        </div>
        <div class="book-library-header__actions">
          <PButton variant="primary" size="sm" @click="isUploadModalOpen = true">
            <IconUpload :size="15" aria-hidden="true" />
            <span>导入电子书</span>
          </PButton>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="book-library-metrics">
        <div class="book-library-metric-item">
          <span class="book-library-metric-label">藏书总数</span>
          <span class="book-library-metric-value">{{ totalCount }}</span>
        </div>
        <div class="book-library-metric-item">
          <span class="book-library-metric-label">在读中</span>
          <span class="book-library-metric-value">{{ readingCount }}</span>
        </div>
        <div class="book-library-metric-item">
          <span class="book-library-metric-label">已读完</span>
          <span class="book-library-metric-value">{{ readCount }}</span>
        </div>
        <div class="book-library-metric-item">
          <span class="book-library-metric-label">想法与划线</span>
          <span class="book-library-metric-value">{{ notesCount }}</span>
        </div>
      </div>
    </header>

    <!-- Continue Reading Section (在读直达) -->
    <section v-if="continueItems.length > 0" class="book-library-continue" aria-labelledby="continue-reading-title">
      <div class="book-library-section-header">
        <h2 id="continue-reading-title" class="book-library-section-title">在读直达</h2>
        <span class="book-library-section-count">{{ continueItems.length }} 本</span>
      </div>
      <div class="book-library-continue-grid">
        <BookLibraryContinueCard
          v-for="item in continueItems"
          :key="item.asset_id"
          :item="item"
          @read="handleReadBook"
        />
      </div>
    </section>

    <!-- Toolbar: Tabs, Search, View Switcher -->
    <div class="book-library-toolbar">
      <nav class="book-library-tabs" aria-label="书架分类">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="book-library-tab-btn"
          :class="{ 'book-library-tab-btn--active': activeTab === tab.key }"
          :data-tab="tab.key"
          @click="activeTab = tab.key"
        >
          <span>{{ tab.label }}</span>
          <span v-if="tab.count !== undefined" class="book-library-tab-count">
            {{ tab.count }}
          </span>
        </button>
      </nav>

      <div class="book-library-toolbar__controls">
        <div class="book-library-search-box">
          <IconSearch :size="15" class="book-library-search-icon" aria-hidden="true" />
          <input
            v-model="searchKeyword"
            type="search"
            class="book-library-search-input"
            placeholder="搜索书名、作者或文件名"
            aria-label="搜索书架"
            data-testid="library-search"
          />
        </div>

        <div class="book-library-view-switcher" role="group" aria-label="视图切换">
          <button
            type="button"
            class="book-library-view-btn"
            :class="{ 'book-library-view-btn--active': viewMode === 'grid' }"
            data-view="grid"
            title="网格视图"
            aria-label="网格视图"
            @click="viewMode = 'grid'"
          >
            <IconLayoutGrid :size="16" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="book-library-view-btn"
            :class="{ 'book-library-view-btn--active': viewMode === 'list' }"
            data-view="list"
            title="列表视图"
            aria-label="列表视图"
            @click="viewMode = 'list'"
          >
            <IconList :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <!-- Feedback Message -->
    <p v-if="errorMessage" class="book-library-feedback book-library-feedback--error" role="alert">
      {{ errorMessage }}
    </p>

    <!-- Main Content Stream -->
    <div v-if="isLoading" class="book-library-loading" aria-live="polite">
      正在加载书架...
    </div>

    <div v-else-if="displayItems.length === 0" class="book-library-empty">
      <IconBookOff :size="36" class="book-library-empty__icon" aria-hidden="true" />
      <p class="book-library-empty__title">暂无相关书籍</p>
      <p class="book-library-empty__desc">
        {{ searchKeyword ? '没有找到符合搜索条件的书籍' : '你可以导入本地电子书，或去书库发现感兴趣的作品' }}
      </p>
      <div class="book-library-empty__actions">
        <PButton variant="secondary" size="sm" @click="isUploadModalOpen = true">
          导入电子书
        </PButton>
        <RouterLink to="/books" class="book-library-empty__link">
          去浏览书库 →
        </RouterLink>
      </div>
    </div>

    <div
      v-else
      class="book-library-stream"
      :class="{ 'book-library-stream--list': viewMode === 'list', 'book-library-stream--grid': viewMode === 'grid' }"
    >
      <BookLibraryCard
        v-for="item in displayItems"
        :key="itemKey(item)"
        :item="item"
        :view-mode="viewMode"
        :reading-percent="getReadingPercent(item)"
        @read="handleReadBook"
        @update-status="handleUpdateStatus"
        @delete="handleDeleteItem"
        @link-work="handleLinkWork"
        @retry="handleRetryImport"
      />
    </div>

    <!-- Upload Modal -->
    <BookImportUploadModal
      v-model="isUploadModalOpen"
      @success="handleUploadSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  IconUpload,
  IconSearch,
  IconLayoutGrid,
  IconList,
  IconBookOff,
} from '@tabler/icons-vue'
import type {
  BookShelfItem,
  BookContinueReading,
  BookImportSession,
} from '@/api/books'
import {
  listBookShelf,
  listContinueReading,
  listBookImports,
  listBookNotes,
  deleteBookShelf,
  saveBookShelf,
  deleteBookImport,
  retryBookImport,
  linkBookImportToCatalog,
} from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import BookLibraryCard from '@/components/books/BookLibraryCard.vue'
import BookLibraryContinueCard from '@/components/books/BookLibraryContinueCard.vue'
import BookImportUploadModal from '@/components/books/BookImportUploadModal.vue'

const router = useRouter()

const isLoading = ref(true)
const errorMessage = ref('')
const isUploadModalOpen = ref(false)

const viewMode = ref<'grid' | 'list'>('grid')
const activeTab = ref<'all' | 'reading' | 'want_to_read' | 'read' | 'imports'>('all')
const searchKeyword = ref('')

const shelves = ref<BookShelfItem[]>([])
const continueItems = ref<BookContinueReading[]>([])
const imports = ref<BookImportSession[]>([])
const notesCount = ref(0)

const totalCount = computed(() => shelves.value.length + imports.value.length)
const readingCount = computed(() => shelves.value.filter((i) => i.status === 'reading').length + continueItems.value.length)
const readCount = computed(() => shelves.value.filter((i) => i.status === 'read').length)

const tabs = computed(() => [
  { key: 'all' as const, label: '全部', count: totalCount.value },
  { key: 'reading' as const, label: '在读', count: readingCount.value },
  { key: 'want_to_read' as const, label: '想读', count: shelves.value.filter((i) => i.status === 'want_to_read').length },
  { key: 'read' as const, label: '读完', count: readCount.value },
  { key: 'imports' as const, label: '本地导入', count: imports.value.length },
])

const displayItems = computed<(BookShelfItem | BookImportSession)[]>(() => {
  let combined: (BookShelfItem | BookImportSession)[] = []

  if (activeTab.value === 'imports') {
    combined = imports.value
  } else if (activeTab.value === 'all') {
    combined = [...shelves.value, ...imports.value]
  } else {
    combined = shelves.value.filter((item) => item.status === activeTab.value)
  }

  const query = searchKeyword.value.trim().toLowerCase()
  if (!query) return combined

  return combined.filter((item) => {
    if ('work' in item && item.work) {
      const titleMatch = item.work.title?.toLowerCase().includes(query)
      const authorMatch = item.work.authors?.some((a) => a.name.toLowerCase().includes(query))
      return titleMatch || authorMatch
    }
    const imp = item as BookImportSession
    const titleMatch = imp.title?.toLowerCase().includes(query)
    const authorMatch = imp.author?.toLowerCase().includes(query)
    const fileMatch = imp.file_name?.toLowerCase().includes(query)
    return titleMatch || authorMatch || fileMatch
  })
})

function itemKey(item: BookShelfItem | BookImportSession): string {
  if ('work' in item) {
    return `shelf-${item.id}`
  }
  return `import-${item.id}`
}

function getReadingPercent(item: BookShelfItem | BookImportSession): number | undefined {
  if (!('work' in item)) {
    const imp = item as BookImportSession
    if (imp.asset_id) {
      const cont = continueItems.value.find((c) => c.asset_id === imp.asset_id)
      return cont?.reading_percent
    }
  }
  return undefined
}

async function loadLibrary() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [shelfRes, continueRes, importRes, notesRes] = await Promise.all([
      listBookShelf('', 100, 0),
      listContinueReading(20),
      listBookImports(),
      listBookNotes({ limit: 1 }),
    ])
    shelves.value = shelfRes.items || []
    continueItems.value = continueRes || []
    imports.value = importRes || []
    notesCount.value = notesRes.total || 0
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '书架数据加载失败，请刷新重试'
  } finally {
    isLoading.value = false
  }
}

function handleReadBook(assetId: string) {
  void router.push(`/books/read/${encodeURIComponent(assetId)}`)
}

async function handleUpdateStatus(workId: string, status: string) {
  try {
    await saveBookShelf(workId, status as any)
    const target = shelves.value.find((i) => i.work_id === workId)
    if (target) {
      target.status = status
    }
  } catch {
    errorMessage.value = '更新阅读状态失败，请重试'
  }
}

async function handleDeleteItem(id: string) {
  const isShelf = shelves.value.some((i) => i.work_id === id || i.id === id)
  if (isShelf) {
    if (!window.confirm('确定要将该书移出书架吗？')) return
    try {
      await deleteBookShelf(id)
      shelves.value = shelves.value.filter((i) => i.work_id !== id && i.id !== id)
    } catch {
      errorMessage.value = '移出书架失败，请稍后重试'
    }
  } else {
    if (!window.confirm('确定要删除该本地导入记录吗？')) return
    try {
      await deleteBookImport(id)
      imports.value = imports.value.filter((i) => i.id !== id)
    } catch {
      errorMessage.value = '删除本地导入记录失败，请稍后重试'
    }
  }
}

async function handleLinkWork(importId: string) {
  const workId = window.prompt('请输入关联的公共作品 ID')?.trim()
  if (!workId) return
  try {
    const linked = await linkBookImportToCatalog(importId, { work_id: workId })
    imports.value = imports.value.map((i) => (i.id === importId ? linked : i))
  } catch {
    errorMessage.value = '关联公共作品失败，请核对作品 ID'
  }
}

async function handleRetryImport(importId: string) {
  try {
    const retried = await retryBookImport(importId)
    imports.value = imports.value.map((i) => (i.id === importId ? retried : i))
  } catch {
    errorMessage.value = '重试解析失败，请检查文件格式'
  }
}

function handleUploadSuccess(session: BookImportSession) {
  imports.value = [session, ...imports.value.filter((i) => i.id !== session.id)]
}

onMounted(() => {
  void loadLibrary()
})
</script>

<style scoped>
.book-library-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem 0;
  color: var(--a-color-fg);
}

.book-library-header {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.book-library-header__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.book-library-header__heading {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.book-library-header__title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 500;
  line-height: 1.3;
  color: var(--a-color-fg);
}

.book-library-header__sub {
  margin: 0;
  font-size: 0.875rem;
  color: var(--a-color-text-muted);
}

.book-library-metrics {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.book-library-metric-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.book-library-metric-label {
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
}

.book-library-metric-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

/* Continue reading section */
.book-library-continue {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.book-library-section-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.book-library-section-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.book-library-section-count {
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
}

.book-library-continue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* Toolbar */
.book-library-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.book-library-tabs {
  display: flex;
  gap: 0.25rem;
  background: var(--a-color-surface-muted);
  padding: 0.25rem;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
}

.book-library-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-muted);
  background: transparent;
  border: none;
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.book-library-tab-btn:hover {
  color: var(--a-color-fg);
}

.book-library-tab-btn--active {
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-sm);
}

.book-library-tab-count {
  font-size: 0.6875rem;
  opacity: 0.8;
}

.book-library-toolbar__controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.book-library-search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  width: 220px;
}

.book-library-search-box:focus-within {
  border-color: var(--a-color-primary);
}

.book-library-search-icon {
  color: var(--a-color-text-muted);
  flex-shrink: 0;
}

.book-library-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.8125rem;
  color: var(--a-color-fg);
}

.book-library-search-input::placeholder {
  color: var(--a-color-text-muted);
}

.book-library-view-switcher {
  display: flex;
  gap: 0.125rem;
  background: var(--a-color-surface-muted);
  padding: 0.125rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}

.book-library-view-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.4rem;
  border: none;
  background: transparent;
  color: var(--a-color-text-muted);
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.book-library-view-btn:hover {
  color: var(--a-color-fg);
}

.book-library-view-btn--active {
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-sm);
}

/* Main Stream */
.book-library-stream--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 1.25rem;
}

.book-library-stream--list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.book-library-loading,
.book-library-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1.5rem;
  text-align: center;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
}

.book-library-loading {
  font-size: 0.875rem;
  color: var(--a-color-text-muted);
}

.book-library-empty__icon {
  color: var(--a-color-text-muted);
  margin-bottom: 0.75rem;
}

.book-library-empty__title {
  margin: 0 0 0.375rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.book-library-empty__desc {
  margin: 0 0 1.25rem;
  font-size: 0.8125rem;
  color: var(--a-color-text-muted);
  max-width: 320px;
}

.book-library-empty__actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.book-library-empty__link {
  font-size: 0.8125rem;
  color: var(--a-color-primary);
  text-decoration: none;
}

.book-library-empty__link:hover {
  text-decoration: underline;
}

.book-library-feedback {
  margin: 0;
  font-size: 0.8125rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--a-radius-control);
}

.book-library-feedback--error {
  color: var(--a-color-danger);
  background: color-mix(in srgb, var(--a-color-danger) 8%, transparent);
}
</style>
