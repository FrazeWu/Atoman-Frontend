<template>
  <main class="a-page-md books-page">
    <PSectionHeader title="读书" kicker="BOOKS" rule />
    <nav class="books-nav" aria-label="读书模块">
      <RouterLink to="/books" exact-active-class="is-active">发现</RouterLink>
      <RouterLink to="/books/search" exact-active-class="is-active">搜索</RouterLink>
      <RouterLink to="/books/library" exact-active-class="is-active">我的书库</RouterLink>
      <RouterLink to="/books/contributions" exact-active-class="is-active">贡献</RouterLink>
      <RouterLink to="/books/review" exact-active-class="is-active">审核</RouterLink>
    </nav>

    <section v-if="isLibrary" class="books-library" aria-labelledby="library-title">
      <header class="books-library__header">
        <div>
          <h2 id="library-title">我的书库</h2>
          <p class="books-library__meta">私有导入仅对你可见</p>
        </div>
        <div class="books-library__actions">
          <select v-model="shelfStatusFilter" aria-label="筛选书架状态" @change="loadLibraryData">
            <option value="">全部书架</option>
            <option value="want_to_read">想读</option>
            <option value="reading">在读</option>
            <option value="read">读过</option>
            <option value="on_hold">搁置</option>
            <option value="dropped">弃读</option>
          </select>
          <input
            ref="fileInput"
            class="books-file-input"
            type="file"
            accept=".epub,.pdf,application/epub+zip,application/pdf"
            aria-label="选择电子书文件"
            @change="handleFileChange"
          />
          <PButton
            type="button"
            variant="secondary"
            :loading="isUploading"
            loading-text="上传中..."
            @click="openFilePicker"
          >
            <Upload :size="16" aria-hidden="true" />
            <span>导入电子书</span>
          </PButton>
        </div>
      </header>

      <section v-if="continueItems.length > 0" class="books-library__section" aria-labelledby="continue-title">
        <header class="books-library__section-header">
          <h2 id="continue-title">继续阅读</h2>
          <span>{{ continueItems.length }} 本</span>
        </header>
        <ul class="books-continue-list">
          <li v-for="item in continueItems" :key="item.asset_id">
            <RouterLink :to="`/books/read/${item.asset_id}`">
              <BookOpen :size="18" aria-hidden="true" />
              <span>
                <strong>{{ item.title || item.file_name }}</strong>
                <small>{{ Math.round(item.reading_percent * 100) }}% · {{ item.file_name }}</small>
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="shelves.length > 0" class="books-library__section" aria-labelledby="shelf-list-title">
        <header class="books-library__section-header">
          <h2 id="shelf-list-title">书架</h2>
          <span>{{ shelfTotal }} 本</span>
        </header>
        <ul class="books-shelf-list">
          <li v-for="item in shelves" :key="item.id">
            <RouterLink :to="`/books/work/${item.work_id}`">
              <strong>{{ item.work.title }}</strong>
              <span>{{ shelfStatusLabel(item.status) }} · {{ authorLabel(item.work) }}</span>
            </RouterLink>
            <button class="books-icon-button" type="button" :aria-label="`移出书架 ${item.work.title}`" title="移出书架" @click="removeShelf(item.work_id)">
              <Trash2 :size="16" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <p v-if="shelfError" class="books-feedback books-feedback--error" role="alert">{{ shelfError }}</p>

      <p v-if="isUploading" class="books-feedback" aria-live="polite">正在上传 {{ uploadProgress }}%</p>
      <p v-if="errorMessage" class="books-feedback books-feedback--error" role="alert">{{ errorMessage }}</p>
      <p v-else-if="isLoading" class="books-feedback" aria-live="polite">正在加载书库...</p>

      <section class="books-library__section" aria-labelledby="imports-title">
        <header class="books-library__section-header">
          <h2 id="imports-title">私有导入</h2>
          <span v-if="imports.length > 0">{{ imports.length }} 个</span>
        </header>
        <p v-if="!isLoading && imports.length === 0" class="books-empty">还没有私有导入</p>

        <ul v-if="imports.length > 0" class="books-import-list">
        <li v-for="item in imports" :key="item.id" class="books-import-row">
          <div class="books-import-row__icon" aria-hidden="true">
            <BookOpen :size="20" />
          </div>
          <div class="books-import-row__body">
            <RouterLink
              v-if="item.asset_id && item.processing_status === 'private_available'"
              class="books-import-row__link"
              :to="`/books/read/${item.asset_id}`"
            >
              <strong>{{ item.title || item.file_name }}</strong>
            </RouterLink>
            <strong v-else>{{ item.title || item.file_name }}</strong>
            <span>{{ item.file_name }} · {{ formatSize(item.size) }}</span>
            <RouterLink v-if="item.work_id" class="books-import-row__catalog-link" :to="`/books/work/${item.work_id}`">已关联公共作品</RouterLink>
          </div>
          <div class="books-import-row__status">
            <span>{{ statusLabel(item) }}</span>
            <small v-if="item.error_message">{{ item.error_message }}</small>
          </div>
          <div class="books-import-row__actions">
            <button
              class="books-icon-button"
              type="button"
              title="关联公共作品"
              aria-label="关联公共作品"
              @click="linkImport(item)"
            >
              <Link2 :size="16" aria-hidden="true" />
            </button>
            <button
              v-if="item.status === 'failed' && item.processing_status !== 'quarantined'"
              class="books-icon-button"
              type="button"
              title="重试处理"
              aria-label="重试处理"
              :disabled="retryingId === item.id"
              @click="retryImport(item)"
            >
              <RotateCcw :size="16" aria-hidden="true" />
            </button>
            <button
              class="books-icon-button"
              type="button"
              title="删除导入"
              aria-label="删除导入"
              :disabled="deletingId === item.id"
              @click="removeImport(item)"
            >
              <Trash2 :size="16" aria-hidden="true" />
            </button>
          </div>
        </li>
        </ul>
      </section>
    </section>

    <section v-else-if="isCatalog" class="books-catalog" aria-labelledby="catalog-title">
      <header class="books-catalog__header">
        <div>
          <h2 id="catalog-title">公共书目</h2>
          <p class="books-library__meta">只展示已审核公开的书目资料</p>
        </div>
        <form class="books-catalog__search" role="search" @submit.prevent="submitCatalogSearch">
          <input v-model="searchInput" type="search" placeholder="搜索标题或作者" aria-label="搜索公共书目" />
          <PButton type="submit" variant="secondary" :loading="catalogLoading" loading-text="搜索中...">
            <Search :size="16" aria-hidden="true" />
            <span>搜索</span>
          </PButton>
        </form>
      </header>

      <p v-if="catalogError" class="books-feedback books-feedback--error" role="alert">{{ catalogError }}</p>
      <p v-else-if="catalogLoading" class="books-feedback" aria-live="polite">正在加载公共书目...</p>
      <p v-else-if="catalogItems.length === 0" class="books-empty">还没有公开书目</p>
      <ul v-else class="books-catalog-list">
        <li v-for="work in catalogItems" :key="work.id" class="books-catalog-row">
          <RouterLink :to="`/books/work/${work.id}`" class="books-catalog-row__link">
            <strong>{{ work.title }}</strong>
            <span>{{ authorLabel(work) }}</span>
            <small>{{ editionLabel(work) }}</small>
          </RouterLink>
        </li>
      </ul>
    </section>
    <section v-else class="books-empty books-empty--discovery">
      <BookOpen :size="22" aria-hidden="true" />
      <p>公共书目和阅读器正在建设中</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { BookOpen, Link2, RotateCcw, Search, Trash2, Upload } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import { ApiErrorResponseError } from '@/api/client'
import {
  deleteBookImport,
  deleteBookShelf,
  linkBookImportToCatalog,
  listBookImports,
  listBookShelf,
  listContinueReading,
  retryBookImport,
  searchPublicBooks,
  uploadBookFile,
  type BookContinueReading,
  type BookImportSession,
  type BookPublicWork,
  type BookShelfItem,
} from '@/api/books'

let refreshTimer: ReturnType<typeof setInterval> | undefined

const route = useRoute()
const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)
const imports = ref<BookImportSession[]>([])
const shelves = ref<BookShelfItem[]>([])
const continueItems = ref<BookContinueReading[]>([])
const shelfStatusFilter = ref('')
const shelfTotal = ref(0)
const shelfLoading = ref(false)
const shelfError = ref('')
const catalogItems = ref<BookPublicWork[]>([])
const searchInput = ref('')
const catalogLoading = ref(false)
const catalogError = ref('')
const isLoading = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const deletingId = ref('')
const retryingId = ref('')
const errorMessage = ref('')
const isLibrary = computed(() => route.path === '/books/library')
const isCatalog = computed(() => route.path === '/books' || route.path === '/books/search')

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function statusLabel(item: BookImportSession): string {
  if (item.status === 'scanning' || item.processing_status === 'scanning') return '等待扫描'
  if (item.processing_status === 'processing') return '正在解析'
  if (item.processing_status === 'publication_requested' || item.processing_status === 'pending_review') return '等待公共发布审核'
  if (item.processing_status === 'quarantined') return '已隔离'
  if (item.status === 'metadata_ready') return '可以阅读'
  if (item.status === 'failed') return '处理失败'
  if (item.status === 'cancelled' || item.status === 'deleted') return '已删除'
  if (item.status === 'completing') return '正在整理'
  return '上传中'
}

function authorLabel(work: BookPublicWork): string {
  return work.authors.length > 0 ? work.authors.map((author) => author.name).join('、') : '作者信息待补充'
}

function editionLabel(work: BookPublicWork): string {
  const edition = work.editions[0]
  if (!edition) return '暂无版本资料'
  return [edition.publisher, edition.language, edition.page_count ? `${edition.page_count} 页` : ''].filter(Boolean).join(' · ') || '版本资料'
}

function shelfStatusLabel(status: string): string {
  switch (status) {
    case 'want_to_read': return '想读'
    case 'reading': return '在读'
    case 'read': return '读过'
    case 'on_hold': return '搁置'
    case 'dropped': return '弃读'
    default: return status
  }
}

async function loadLibraryData() {
  if (!isLibrary.value) return
  shelfLoading.value = true
  shelfError.value = ''
  try {
    const [shelfResult, continueResult] = await Promise.all([
      listBookShelf(shelfStatusFilter.value),
      listContinueReading(),
    ])
    shelves.value = shelfResult.items
    shelfTotal.value = shelfResult.total
    continueItems.value = continueResult
  } catch {
    shelfError.value = '书架加载失败，请稍后重试'
  } finally {
    shelfLoading.value = false
  }
}

async function removeShelf(workID: string) {
  if (!window.confirm('确定移出书架吗？')) return
  try {
    await deleteBookShelf(workID)
    shelves.value = shelves.value.filter((item) => item.work_id !== workID)
    shelfTotal.value = Math.max(0, shelfTotal.value - 1)
  } catch {
    shelfError.value = '移出书架失败，请稍后重试'
  }
}

async function loadCatalog() {
  if (!isCatalog.value) return
  catalogLoading.value = true
  catalogError.value = ''
  try {
    searchInput.value = typeof route.query.q === 'string' ? route.query.q : ''
    const result = await searchPublicBooks(searchInput.value)
    catalogItems.value = result.items
  } catch {
    catalogError.value = '公共书目加载失败，请稍后重试'
  } finally {
    catalogLoading.value = false
  }
}

async function submitCatalogSearch() {
  const query = searchInput.value.trim()
  await router.push({ path: '/books/search', query: query ? { q: query } : {} })
}

async function loadImports() {
  if (!isLibrary.value) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    imports.value = await listBookImports()
  } catch (error) {
    errorMessage.value = error instanceof ApiErrorResponseError && error.status === 401
      ? '登录后才能查看私有书库'
      : '书库加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const extension = file.name.toLowerCase().split('.').pop()
  if (!extension || !['epub', 'pdf'].includes(extension)) {
    errorMessage.value = '仅支持 EPUB 和 PDF 文件'
    return
  }

  isUploading.value = true
  uploadProgress.value = 0
  errorMessage.value = ''
  try {
    const session = await uploadBookFile(file, {
      onProgress: ({ loaded, total }) => {
        uploadProgress.value = total > 0 ? Math.round((loaded / total) * 100) : 0
      },
    })
    imports.value = [session, ...imports.value.filter((item) => item.id !== session.id)]
    void loadLibraryData()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '电子书上传失败，请稍后重试'
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

async function linkImport(item: BookImportSession) {
  const workID = window.prompt('请输入公共作品 UUID', item.work_id || '')?.trim()
  if (!workID) return
  try {
    const linked = await linkBookImportToCatalog(item.id, { work_id: workID })
    imports.value = imports.value.map((candidate) => candidate.id === item.id ? linked : candidate)
  } catch {
    errorMessage.value = '公共书目关联失败，请确认作品 UUID 后重试'
  }
}

async function retryImport(item: BookImportSession) {
  retryingId.value = item.id
  errorMessage.value = ''
  try {
    const retried = await retryBookImport(item.id)
    imports.value = imports.value.map((candidate) => candidate.id === item.id ? retried : candidate)
  } catch {
    errorMessage.value = '重试失败，请稍后重试'
  } finally {
    retryingId.value = ''
  }
}

async function removeImport(item: BookImportSession) {
  if (deletingId.value || !window.confirm(`确定删除“${item.title || item.file_name}”吗？`)) return
  deletingId.value = item.id
  errorMessage.value = ''
  try {
    await deleteBookImport(item.id)
    imports.value = imports.value.filter((candidate) => candidate.id !== item.id)
  } catch {
    errorMessage.value = '删除失败，请稍后重试'
  } finally {
    deletingId.value = ''
  }
}

onMounted(() => {
  void loadImports()
  void loadLibraryData()
  void loadCatalog()
  refreshTimer = setInterval(() => {
    if (isLibrary.value && !isUploading.value && !isLoading.value) void loadImports()
  }, 5000)
})
watch(isLibrary, () => {
  void loadImports()
  void loadLibraryData()
})
watch(() => route.query.q, loadCatalog)
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.books-page {
  display: grid;
  gap: 1.5rem;
  padding-top: var(--a-page-start-space);
}

.books-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-nav a {
  padding: 0.5rem 0 0.75rem;
  border-bottom: 2px solid transparent;
  color: var(--a-color-muted);
  text-decoration: none;
}

.books-nav a:hover,
.books-nav a:focus-visible,
.books-nav a.is-active {
  border-bottom-color: var(--a-color-fg);
  color: var(--a-color-fg);
}

.books-library {
  display: grid;
  gap: 1rem;
}

.books-library__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-library__header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: var(--a-font-weight-strong, 700);
}

.books-library__meta,
.books-import-row__body span,
.books-import-row__status small {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.8125rem;
}

.books-library__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.books-library__actions select {
  height: 2.25rem;
  border: 1px solid var(--a-color-border);
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  padding: 0 0.5rem;
  font: inherit;
}

.books-library__section {
  display: grid;
  gap: 0.65rem;
}

.books-library__section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.books-library__section-header h2 {
  margin: 0;
  font-size: 1.05rem;
}

.books-library__section-header span {
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.books-continue-list,
.books-shelf-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--a-color-border-soft);
}

.books-continue-list li,
.books-shelf-list li {
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-continue-list a,
.books-shelf-list li {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.75rem 0;
  color: var(--a-color-fg);
  text-decoration: none;
}

.books-continue-list a:hover strong,
.books-shelf-list a:hover strong {
  text-decoration: underline;
}

.books-continue-list a > span,
.books-shelf-list a {
  min-width: 0;
  flex: 1;
}

.books-continue-list strong,
.books-continue-list small,
.books-shelf-list strong,
.books-shelf-list span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.books-continue-list small,
.books-shelf-list span {
  margin-top: 0.2rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.books-shelf-list li > .books-icon-button {
  flex-shrink: 0;
}

.books-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.books-feedback,
.books-empty {
  margin: 0;
  color: var(--a-color-muted);
}

.books-feedback--error {
  color: var(--a-color-danger);
}

.books-empty--discovery {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 4rem 1rem;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
  text-align: center;
}

.books-import-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--a-color-border-soft);
}

.books-import-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(7rem, auto) auto;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-import-row__icon {
  color: var(--a-color-muted);
}

.books-import-row__body {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.books-import-row__body strong,
.books-import-row__body span,
.books-import-row__status span,
.books-import-row__status small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.books-import-row__link {
  min-width: 0;
  color: var(--a-color-fg);
  text-decoration: none;
}

.books-import-row__link:hover strong {
  text-decoration: underline;
}

.books-import-row__status {
  display: grid;
  justify-items: end;
  gap: 0.15rem;
  color: var(--a-color-fg);
  font-size: 0.875rem;
}

.books-import-row__actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.books-icon-button {
  display: inline-grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.books-icon-button:hover:not(:disabled),
.books-icon-button:focus-visible {
  border-color: var(--a-color-danger);
  color: var(--a-color-danger);
}

.books-icon-button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.books-catalog {
  display: grid;
  gap: 1rem;
}

.books-catalog__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-catalog__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.books-catalog__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: min(28rem, 100%);
}

.books-catalog__search input {
  min-width: 0;
  flex: 1;
  height: 2.35rem;
  border: 1px solid var(--a-color-border);
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  padding: 0 0.7rem;
  font: inherit;
}

.books-catalog-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--a-color-border-soft);
}

.books-catalog-row {
  border-bottom: 1px solid var(--a-color-border-soft);
}

.books-catalog-row__link {
  display: grid;
  gap: 0.2rem;
  padding: 1rem 0;
  color: inherit;
  text-decoration: none;
}

.books-catalog-row__link:hover strong,
.books-catalog-row__link:focus-visible strong {
  text-decoration: underline;
}

.books-catalog-row__link span,
.books-catalog-row__link small {
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .books-library__actions {
    justify-content: start;
  }

  .books-library__actions select {
    max-width: 100%;
  }

  .books-library__header,
  .books-catalog__header {
    align-items: start;
    flex-direction: column;
  }

  .books-catalog__search {
    width: 100%;
    min-width: 0;
  }

  .books-import-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .books-import-row__status {
    grid-column: 2;
    justify-items: start;
  }

  .books-import-row__actions {
    grid-column: 3;
    grid-row: 1 / span 2;
  }

  .books-icon-button {
    grid-column: auto;
    grid-row: auto;
  }
}
</style>
