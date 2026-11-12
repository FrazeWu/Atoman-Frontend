<template>
  <section class="book-catalog book-edition-view">
    <p v-if="loading" role="status" class="book-catalog__status-text">正在加载出版版本…</p>
    <div v-else-if="error" role="alert" class="book-catalog__error-box">
      {{ error }} <PButton variant="secondary" @click="load">重试</PButton>
    </div>
    <template v-else-if="metadata && work && edition">
      <!-- 顶部返回导航 -->
      <nav class="book-edition__nav">
        <RouterLink :to="'/books/work/' + work.id" class="book-edition__back-link">
          <span class="book-edition__back-arrow">←</span> 返回《{{ work.title }}》
        </RouterLink>
      </nav>

      <div class="book-catalog__hero">
        <div class="book-catalog__cover-col">
          <BookCover
            variant="edition"
            :src="edition.cover_url || work.cover_url"
            :title="edition.title || work.title"
            :author="edition.publisher || work.authors.map(p => p.name).join(' / ')"
            eager
          />
        </div>
        <div class="book-catalog__info-col">
          <div class="book-catalog__work-header">
            <h1 class="book-catalog__work-title">{{ edition.title || work.title }}</h1>
            <p v-if="edition.subtitle" class="book-edition__subtitle">{{ edition.subtitle }}</p>
            <div class="book-catalog__work-authors">
              <RouterLink
                v-for="author in work.authors"
                :key="author.id"
                :to="{ path: '/books', query: { q: author.name } }"
                class="book-catalog__author-badge book-catalog__author-link"
              >
                {{ author.name }}
              </RouterLink>
              <span v-if="edition.translators?.length" class="book-catalog__author-badge book-catalog__author-badge--translator">
                {{ edition.translators.map(p => p.name).join(' / ') }} 译
              </span>
            </div>
          </div>

          <!-- 现代元数据网格 -->
          <div class="book-edition__meta-grid">
            <div v-for="field in fields" :key="field.key" class="book-edition__meta-cell">
              <span class="book-edition__meta-label">{{ field.label }}</span>
              <span class="book-edition__meta-value">{{ field.value || '待补充' }}</span>
            </div>
          </div>

          <div class="book-edition__wiki-wrap">
            <BookWikiPanel
              kind="edition"
              :entity-id="metadata.entity_id"
              :work-id="work.id"
              :authenticated="auth.isAuthenticated"
              @changed="load"
            />
          </div>
        </div>
      </div>

      <!-- 推荐阅读文件 -->
      <section class="book-catalog__section">
        <div class="book-catalog__section-header">
          <div class="book-catalog__section-title-wrap">
            <h2>推荐阅读文件</h2>
          </div>
        </div>
        <p v-if="resourceError" role="alert" class="book-catalog__error">{{ resourceError }}</p>
        <div v-else-if="bestFile" class="edition-best-card">
          <div class="edition-best-card__body">
            <div class="edition-best-card__badge-row">
              <span class="edition-best-card__format" :class="`edition-best-card__format--${bestFile.format.toLowerCase()}`">
                {{ bestFile.format.toUpperCase() }}
              </span>
              <span v-if="bestFile.is_best" class="edition-best-card__pill edition-best-card__pill--best">当前最优</span>
              <span class="edition-best-card__pill" :class="bestFile.is_public ? 'edition-best-card__pill--public' : 'edition-best-card__pill--private'">
                {{ bestFile.is_public ? '公开分享' : '仅自己可读' }}
              </span>
            </div>
            <strong class="edition-best-card__filename">{{ bestFile.file_name }}</strong>
          </div>
          <div class="edition-best-card__actions">
            <PButton size="sm" :to="resourceReaderPath(work.id, bestFile.asset_id, bestFile.revision_id)">
              开始阅读
            </PButton>
            <PButton v-if="auth.isAuthenticated" size="sm" variant="secondary" :disabled="!!busyFile" @click="addToShelf(bestFile)">
              加入书架
            </PButton>
            <PButton v-if="bestFile.can_manage" size="sm" variant="ghost" :disabled="!!busyFile" @click="confirmVisibility(bestFile)">
              {{ bestFile.is_public ? '停止公开' : '公开分享' }}
            </PButton>
          </div>
        </div>
        <p v-else class="book-catalog__empty-hint">暂无通过安全检查的文件。</p>

        <!-- 文件质量信息与对比 -->
        <details v-if="files.length" class="edition-file__quality" aria-label="文件质量信息与对比">
          <summary>{{ files.length > 1 ? '文件质量信息与对比' : '查看文件质量信息' }}</summary>
          <p class="edition-file__quality-intro">下列指标来自实际文件检查，仅供人工比较。不能判断是否缺页、错字或内容完整；不会按 EPUB、PDF 等格式自动排名，也不会替换你书架中的文件。</p>
          <div class="edition-file__quality-grid">
            <article v-for="item in files" :key="item.revision_id" class="edition-file__quality-item">
              <div class="edition-file__quality-heading">
                <strong>{{ item.file_name }}</strong>
                <small>{{ item.is_best ? '当前最优' : '其他文件' }} · {{ item.format.toUpperCase() }}</small>
              </div>
              <ul>
                <li v-for="(fact, index) in describeBookFileQuality(item.quality)" :key="index">{{ fact }}</li>
              </ul>
              <p v-for="(caveat, index) in item.quality?.limitations || []" :key="index" class="edition-file__quality-caveat">
                未检测范围：{{ caveat }}
              </p>
            </article>
          </div>
        </details>

        <p v-if="fileNotice" role="status" class="edition-file__notice">{{ fileNotice }}</p>

        <!-- 历史版本 -->
        <details v-if="otherFiles.length" class="edition-file__history">
          <summary>历史版本（{{ otherFiles.length }}）</summary>
          <ul class="book-catalog__list">
            <li v-for="item in otherFiles" :key="item.revision_id" class="book-catalog__row edition-file">
              <div class="edition-file__info">
                <strong>{{ item.file_name }}</strong>
                <p>{{ item.format.toUpperCase() }} · 历史文件 · {{ item.is_public ? '公开分享' : '仅自己可读' }}</p>
              </div>
              <div class="edition-file__actions">
                <PButton size="sm" variant="secondary" :to="resourceReaderPath(work.id, item.asset_id, item.revision_id)">阅读</PButton>
                <PButton v-if="auth.isAuthenticated" size="sm" variant="secondary" :disabled="!!busyFile" @click="addToShelf(item)">加入书架</PButton>
                <PButton v-if="auth.isAuthenticated" size="sm" variant="ghost" :disabled="!!busyFile" @click="bestCandidate = item">设为最优</PButton>
                <PButton v-if="item.can_manage" size="sm" variant="ghost" :disabled="!!busyFile" @click="confirmVisibility(item)">{{ item.is_public ? '停止公开' : '公开分享' }}</PButton>
              </div>
            </li>
          </ul>
        </details>

        <!-- 上传电子书区 -->
        <div class="edition-file__upload">
          <BookResourceUpload
            v-if="auth.isAuthenticated"
            :key="String(metadata.entity_id) + ':' + String(auth.user?.uuid)"
            :work-id="work.id"
            :edition-id="metadata.entity_id"
            :title="edition.title || work.title"
            :initial-language="edition.language"
            @ready="loadFiles"
          />
          <PButton v-else variant="secondary" :to="{ path: '/login', query: { redirect: route.fullPath } }">
            登录后上传文件
          </PButton>
        </div>
      </section>
    </template>
    <PConfirm
      :show="!!bestCandidate"
      title="设为此出版版本的当前最优文件？"
      message="系统仅展示已验证的技术指标，无法确定内容是否完整。确认后只更改出版版本的推荐文件，不影响任何用户书架、阅读进度或笔记。"
      @confirm="promote"
      @cancel="bestCandidate = null"
    />
    <PConfirm
      :show="!!visibilityCandidate"
      :title="visibilityCandidate?.is_public ? '停止公开此电子书？' : '公开分享此电子书？'"
      :message="visibilityCandidate?.is_public
        ? '其他读者将无法再打开该文件；他们已有的书架和笔记不会被删除。'
        : '请确认你拥有公开分享该电子书所需的权利。公开后，其他人可访问完整文件。'"
      @confirm="updateVisibility"
      @cancel="visibilityCandidate = null"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { wikiMetadata, type WikiMetadata } from '@/api/bookWiki'
import { getCatalogWork, type CatalogWork } from '@/api/bookCatalog'
import { listEditionFiles, saveFileShelf, selectEditionBestFile, setFilePublicAccess, type EditionFile } from '@/api/bookFileShelf'
import { resourceReaderPath } from '@/api/bookResources'
import { describeBookFileQuality } from '@/utils/bookFileQuality'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import BookCover from '@/components/books/BookCover.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import './bookCatalog.css'

const route = useRoute()
const auth = useAuthStore()
const metadata = ref<WikiMetadata>()
const work = ref<CatalogWork>()
const files = ref<EditionFile[]>([])
const error = ref('')
const resourceError = ref('')
const fileNotice = ref('')
const busyFile = ref('')
const bestCandidate = ref<EditionFile | null>(null)
const visibilityCandidate = ref<EditionFile | null>(null)
const loading = ref(true)
const edition = computed(() => work.value?.editions.find(item => item.id === metadata.value?.entity_id))
const bestFile = computed(() => files.value.find(item => item.is_best) || files.value[0])
const otherFiles = computed(() => files.value.filter(item => item.revision_id !== bestFile.value?.revision_id))
const fields = computed(() => [
  { key: 'publisher', label: '出版社', value: edition.value?.publisher },
  { key: 'language', label: '语言', value: edition.value?.language },
  { key: 'date', label: '出版年月', value: edition.value?.published_date?.slice(0, 7) },
  { key: 'edition', label: '版次', value: edition.value?.edition_statement },
  { key: 'isbn', label: 'ISBN', value: edition.value?.isbn13 || edition.value?.isbn10 },
  { key: 'pages', label: '页数', value: edition.value?.page_count ? String(edition.value.page_count) + ' 页' : undefined },
])
let generation = 0
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  files.value = []
  try {
    const meta = await wikiMetadata('edition', String(route.params.editionId || ''))
    if (current !== generation) return
    metadata.value = meta
    work.value = await getCatalogWork(String(meta.fields.work_id))
    if (current !== generation) return
    loading.value = false
    void loadFiles()
  } catch {
    if (current !== generation) return
    error.value = '加载出版版本失败，请重试。'
    loading.value = false
  }
}
async function loadFiles() {
  if (!edition.value) return
  resourceError.value = ''
  try { files.value = (await listEditionFiles(edition.value.id)).items }
  catch { resourceError.value = '读取电子书文件失败，请重试。' }
}
async function addToShelf(file: EditionFile) {
  busyFile.value = file.revision_id
  try {
    await saveFileShelf(file.revision_id)
    fileNotice.value = '已加入书架。此具体文件将持续保留在你的书架中。'
  } catch { fileNotice.value = '加入书架失败，请重试。' }
  finally { busyFile.value = '' }
}
async function promote() {
  const file = bestCandidate.value
  bestCandidate.value = null
  if (!edition.value || !file) return
  busyFile.value = file.revision_id
  try {
    await selectEditionBestFile(edition.value.id, file.revision_id)
    await loadFiles()
    fileNotice.value = '已设为当前最优文件。其他用户书架中的旧图书没有改变。'
  } catch { fileNotice.value = '设置最优文件失败，请重试。' }
  finally { busyFile.value = '' }
}
function confirmVisibility(file: EditionFile) { visibilityCandidate.value = file }
async function updateVisibility() {
  const item = visibilityCandidate.value
  visibilityCandidate.value = null
  if (!item) return
  busyFile.value = item.revision_id
  try {
    await setFilePublicAccess(item.revision_id, !item.is_public, !item.is_public)
    fileNotice.value = item.is_public ? '已停止公开，该文件仍属于原读者的书架。' : '已公开分享该文件。'
    await loadFiles()
  } catch { fileNotice.value = '更新文件公开状态失败，请重试。' }
  finally { busyFile.value = '' }
}
watch(() => route.params.editionId, () => { void load() }, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<style scoped>
.edition-file {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 10px;
  background: var(--a-color-bg);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.edition-file:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.edition-file p {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
  margin: 0.25rem 0 0;
}

.edition-file__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.edition-file__history,
.edition-file__quality {
  margin-top: 0.75rem;
  border: none;
  border-radius: 8px;
  padding: 0;
  background: transparent;
  transition: background-color 0.2s ease;
}

.edition-file__history summary,
.edition-file__quality summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--a-color-text);
  padding: 0.5rem 0.625rem;
  margin-left: -0.625rem;
  border-radius: 6px;
  user-select: none;
  transition: background-color 0.15s ease;
}

.edition-file__history summary:hover,
.edition-file__quality summary:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.edition-file__history[open],
.edition-file__quality[open] {
  background: rgba(0, 0, 0, 0.02);
  padding: 0.875rem 1.25rem 1.25rem;
  margin-left: 0;
  margin-top: 1rem;
}

.edition-file__history[open] summary,
.edition-file__quality[open] summary {
  margin-bottom: 0.75rem;
  margin-left: 0;
  padding: 0.25rem 0;
  border-bottom: none;
}

.edition-file__quality-intro {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
  line-height: 1.6;
  margin: 0 0 1rem;
  padding: 0.65rem 0.85rem;
  background: rgba(0, 0, 0, 0.025);
  border-radius: 6px;
}

.edition-file__quality-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.85rem;
}

.edition-file__quality-item {
  min-width: 0;
  border: none;
  border-radius: 6px;
  padding: 1rem;
  background: var(--a-color-bg, #ffffff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.edition-file__quality-heading {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  overflow-wrap: anywhere;
  margin-bottom: 0.5rem;
}

.edition-file__quality-heading strong {
  font-size: 0.875rem;
  color: var(--a-color-text);
}

.edition-file__quality-heading small {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary);
}

.edition-file__quality-item ul {
  font-size: 0.8125rem;
  padding-left: 1.2rem;
  line-height: 1.6;
  margin: 0.5rem 0 0;
  color: var(--a-color-text);
}

.edition-file__quality-caveat {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #c2410c;
  background: rgba(234, 88, 12, 0.08);
  padding: 4px 8px;
  border-radius: 4px;
}

.edition-file__upload {
  margin-top: 2rem;
}
</style>
