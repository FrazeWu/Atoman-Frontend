<template>
  <section class="book-catalog private-books">
    <!-- 加载中与错误反馈 -->
    <p v-if="loading" role="status" class="book-catalog__status-text">正在加载图书…</p>
    <div v-else-if="error" role="alert" class="book-catalog__error-box">
      <p class="book-catalog__error">{{ error }}</p>
      <PButton variant="secondary" @click="load">重试</PButton>
    </div>

    <template v-else-if="work">
      <!-- 顶部主体区：左侧 2B 现代经典封面，右侧主要信息与标准评分组件 -->
      <div class="book-catalog__hero">
        <div class="book-catalog__cover-col">
          <BookCover
            variant="work"
            :src="work.cover_url || work.editions?.[0]?.cover_url"
            :title="work.title"
            :seed="work.id"
            :subtitle="work.subtitle || work.original_title"
            :author="work.authors.map(author => author.name).join(' / ')"
            eager
          />
        </div>

        <div class="book-catalog__info-col">
          <div class="book-catalog__work-header">
            <h1 class="book-catalog__work-title">{{ work.title }}</h1>
            <div class="book-catalog__work-authors">
              <RouterLink
                v-for="author in work.authors"
                :key="author.id"
                :to="{ path: '/books', query: { q: author.name } }"
                class="book-catalog__author-badge book-catalog__author-link"
              >
                {{ author.name }}
              </RouterLink>
              <span v-if="work.editions.length" class="book-catalog__author-sep">·</span>
              <span v-if="work.editions.length" class="book-catalog__work-edition-meta">
                {{ work.editions.length }} 个版本
              </span>
            </div>
          </div>

          <div v-if="work.subtitle || work.original_title" class="book-catalog__meta-row">
            <span v-if="work.subtitle" class="book-catalog__meta-pill">{{ work.subtitle }}</span>
            <span v-if="work.original_title" class="book-catalog__meta-pill book-catalog__meta-pill--subtle">
              原作名：{{ work.original_title }}
            </span>
          </div>

          <div v-if="work.description" class="book-catalog__description-wrap">
            <p class="book-catalog__description">
              {{ work.description }}
            </p>
          </div>

          <!-- 读者星级评分组件：使用全站标准公共 RatingControl -->
          <div class="book-catalog__rating-card">
            <div class="book-catalog__rating-score-block">
              <span class="book-catalog__rating-big-score">
                {{ (workRating?.rating_active ? (workRating.weighted_rating_score ?? workRating.rating_score) : (workRating?.rating_score ?? work.rating_score ?? 0)).toFixed(1) }}
              </span>
              <span class="book-catalog__rating-total-label">/ 10</span>
            </div>
            <div class="book-catalog__rating-control-block">
              <RatingControl
                :aria-label="`${work.title} 评分`"
                :rating-score="workRating?.rating_active ? (workRating.weighted_rating_score ?? workRating.rating_score) : (workRating?.rating_score ?? work.rating_score)"
                show-reference-score
                :minimum-rating-count="workRating?.minimum_rating_count ?? 6"
                :rating-active="workRating?.rating_active"
                :rating-count="workRating?.rating_count ?? work.rating_count"
                :viewer-rating="workRating?.viewer_rating"
                :disabled="!auth.isAuthenticated"
                :loading="ratingBusy || !workRating"
                :error-message="ratingError"
                @rate="handleRate"
                @clear="handleClearRate"
              />
            </div>
          </div>

          <div class="book-catalog__hero-actions">
            <PButton
              v-if="work.editions.length"
              :to="'/books/edition/' + work.editions[0].id"
              class="book-catalog__hero-primary-btn"
            >
              开始阅读
            </PButton>
            <PButton v-if="auth.isAuthenticated" variant="secondary" :to="`/books/work/${work.id}/notes`">
              我的笔记
            </PButton>
            <PButton
              v-if="auth.isAuthenticated"
              variant="secondary"
              :to="{ path: '/books/new', query: { ...route.query, work: work.id } }"
            >
              + 添加版本
            </PButton>
          </div>
        </div>
      </div>

      <!-- 详情页分栏导航 (Segmented Tabs) -->
      <div class="book-catalog__tabs-wrap">
        <PSegmentedControl
          v-model="activeTab"
          :options="tabOptions"
          size="md"
          class="book-catalog__main-tabs"
        />
      </div>

      <!-- 选项卡内容区 -->
      <div class="book-catalog__tabs-body">
        <!-- 1. 简介 Tab -->
        <section v-show="activeTab === 'overview'" class="book-catalog__tab-panel" aria-label="简介">
          <div class="book-overview-section">
            <h3 class="book-overview-heading">简介</h3>
            <p class="book-catalog__description book-overview-text">
              {{ work.description || '暂无简介。' }}
            </p>
          </div>

          <div v-if="work.authors?.length" class="book-overview-section">
            <h3 class="book-overview-heading">作者</h3>
            <div class="book-overview-authors">
              <div v-for="author in work.authors" :key="author.id" class="book-overview-author-card">
                <div class="book-overview-author-info">
                  <span class="book-overview-author-name">{{ author.name }}</span>
                  <span class="book-overview-author-role">作者</span>
                </div>
                <BookWikiPanel
                  kind="person"
                  :entity-id="author.id"
                  :authenticated="auth.isAuthenticated"
                  button-text="修改资料"
                  size="sm"
                  variant="ghost"
                  @changed="refreshWork"
                />
              </div>
            </div>
          </div>

          <div class="book-overview-section">
            <div class="book-overview-wiki-card">
              <div class="book-overview-wiki-info">
                <h4 class="book-overview-wiki-title">作品资料</h4>
              </div>
              <BookWikiPanel
                kind="work"
                :entity-id="work.id"
                :authenticated="auth.isAuthenticated"
                button-text="修改资料"
                size="sm"
                variant="secondary"
                @changed="refreshWork"
              />
            </div>
          </div>
        </section>

        <!-- 2. 版本与译本 Tab (Option 1A) -->
        <section v-show="activeTab === 'editions'" class="book-catalog__tab-panel" aria-label="版本与译本">
          <div class="book-editions-header">
            <div class="book-editions-title-row">
              <h3 class="book-editions-heading">版本与译本</h3>
              <span v-if="work.editions.length" class="book-catalog__badge">{{ work.editions.length }} 个版本</span>
            </div>
            <PButton
              size="sm"
              variant="secondary"
              :to="auth.isAuthenticated ? { path: '/books/new', query: { ...route.query, work: work.id } } : { path: '/login', query: { redirect: route.fullPath } }"
            >
              + 添加版本
            </PButton>
          </div>

          <!-- 语言快捷小胶囊筛选 (Option 1A) -->
          <div v-if="languageFilterOptions.length > 2" class="book-editions-filter-bar">
            <PSegmentedControl
              v-model="selectedLanguage"
              :options="languageFilterOptions"
              size="sm"
            />
          </div>

          <p v-if="!work.editions.length" class="book-catalog__empty-hint">暂无出版信息，不影响图书公开展示。</p>
          <p v-else-if="!filteredEditions.length" class="book-catalog__empty-hint">该分类下暂无对应版本。</p>
          <ul v-else class="book-catalog__edition-cards">
            <li v-for="edition in filteredEditions" :key="edition.id" class="book-catalog__edition-card">
              <div class="book-catalog__edition-cover-col">
                <BookCover
                  variant="edition"
                  :src="edition.cover_url || work.cover_url"
                  :title="edition.title || work.title"
                  :author="edition.publisher || work.authors.map(author => author.name).join(' / ')"
                />
              </div>

              <div class="book-catalog__edition-meta">
                <div class="book-catalog__edition-header-row">
                  <RouterLink :to="`/books/edition/${edition.id}`" class="book-catalog__edition-title-link">
                    {{ edition.title || work.title }}
                  </RouterLink>
                  <span v-if="edition.edition_statement" class="book-catalog__edition-statement-pill">
                    {{ edition.edition_statement }}
                  </span>
                  <span v-if="edition.subtitle" class="book-catalog__edition-sub">{{ edition.subtitle }}</span>
                </div>
                <div class="book-catalog__edition-info-lines">
                  <div class="book-catalog__edition-line">
                    <span v-if="edition.publisher" class="book-catalog__edition-publisher">{{ edition.publisher }}</span>
                    <span v-if="edition.published_date" class="book-catalog__edition-date">{{ edition.published_date.slice(0, 7) }}</span>
                    <span v-if="edition.translators?.length" class="book-catalog__edition-translators">
                      {{ edition.translators.map(p => p.name).join(' / ') }} 译
                    </span>
                  </div>
                  <div class="book-catalog__edition-line book-catalog__edition-line--subtle">
                    <span v-if="edition.isbn13 || edition.isbn10">ISBN {{ edition.isbn13 || edition.isbn10 }}</span>
                    <span v-if="edition.language">{{ edition.language === 'zh' ? '中文' : edition.language }}</span>
                    <span v-if="edition.page_count">{{ edition.page_count }} 页</span>
                  </div>
                </div>

                <div class="book-catalog__edition-footer-row">
                  <PButton size="sm" variant="secondary" :to="'/books/edition/' + edition.id">
                    查看版本
                  </PButton>
                  <div class="book-catalog__edition-wiki-inline">
                    <BookWikiPanel
                      kind="edition"
                      :entity-id="edition.id"
                      :work-id="work.id"
                      :authenticated="auth.isAuthenticated"
                      button-text="修改资料"
                      size="sm"
                      variant="ghost"
                      @changed="refreshWork"
                    />
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <!-- 3. 书评与研讨 Tab (Option 2A) -->
        <section v-show="activeTab === 'reviews'" class="book-catalog__tab-panel" aria-label="书评">
          <BookWorkCommunity
            v-model:rating-state="workRating"
            :key="`${work.id}:${auth.user?.uuid || 'guest'}`"
            :work-id="work.id"
            :authenticated="auth.isAuthenticated"
          />
        </section>

        <!-- 4. 书摘 Tab -->
        <section v-show="activeTab === 'quotes'" class="book-catalog__tab-panel" aria-label="书摘">
          <div class="book-quotes-header">
            <div>
              <h3 class="book-quotes-title">书摘</h3>
            </div>
            <PButton
              v-if="auth.isAuthenticated"
              size="sm"
              variant="secondary"
              :to="`/books/work/${work.id}/notes`"
            >
              我的笔记
            </PButton>
          </div>

          <div v-if="quotesLoading" class="book-quotes-loading" role="status">
            正在载入书摘…
          </div>

          <div v-else-if="quotes.length" class="book-quotes-grid">
            <article v-for="q in quotes" :key="q.id" class="book-quote-card">
              <blockquote class="book-quote-text">{{ formatQuote(q.quote || q.note) }}</blockquote>
              <div class="book-quote-meta">
                <span v-if="q.anchor?.pdf_page">第 {{ q.anchor.pdf_page }} 页</span>
                <span v-if="q.chapter_anchor?.chapter_title">{{ q.chapter_anchor.chapter_title }}</span>
                <span v-if="q.source?.edition_label">{{ q.source.edition_label }}</span>
                <span v-else-if="q.source?.format">{{ q.source.format.toUpperCase() }}</span>
              </div>
            </article>
          </div>

          <PEmpty
            v-else
            title="暂无书摘"
            description="阅读时选中文本划线，即可公开为书摘。"
          >
            <template #icon>
              <Quote :size="32" :stroke-width="1.5" />
            </template>
            <template #action>
              <PButton
                v-if="work.editions.length"
                size="sm"
                :to="'/books/edition/' + work.editions[0].id"
              >
                开始阅读
              </PButton>
            </template>
          </PEmpty>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { Quote } from 'lucide-vue-next'
import BookWorkCommunity from '@/components/books/BookWorkCommunity.vue'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import BookCover from '@/components/books/BookCover.vue'
import RatingControl from '@/components/shared/RatingControl.vue'
import { ApiErrorResponseError } from '@/api/client'
import { getCatalogWork, type CatalogWork } from '@/api/bookCatalog'
import { setWorkRating, removeWorkRating, type WorkRating } from '@/api/bookCommunity'
import { listWorkNotes, type WorkNoteItem } from '@/api/bookReading'
import './bookCatalog.css'
import './bookPrivate.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const work = ref<CatalogWork>()
const workRating = ref<WorkRating | null>(null)
const ratingBusy = ref(false)
const ratingError = ref('')
const loading = ref(true)
const error = ref('')
let alive = true

type WorkTab = 'overview' | 'editions' | 'reviews' | 'quotes'

const activeTab = ref<WorkTab>(
  ['overview', 'editions', 'reviews', 'quotes'].includes(String(route.query.tab))
    ? (String(route.query.tab) as WorkTab)
    : 'overview'
)

const tabOptions = computed(() => [
  { label: '简介', value: 'overview' as WorkTab },
  { label: `版本与译本${work.value?.editions?.length ? ` (${work.value.editions.length})` : ''}`, value: 'editions' as WorkTab },
  { label: '书评', value: 'reviews' as WorkTab },
  { label: '书摘', value: 'quotes' as WorkTab },
])

const selectedLanguage = ref<string>('all')

const languageCounts = computed(() => {
  if (!work.value?.editions) return {}
  const map: Record<string, number> = {}
  for (const ed of work.value.editions) {
    const lang = (ed.language || 'zh').toLowerCase()
    map[lang] = (map[lang] || 0) + 1
  }
  return map
})

const languageFilterOptions = computed(() => {
  if (!work.value?.editions?.length) return []
  const opts = [{ label: `全部 (${work.value.editions.length})`, value: 'all' }]
  const langNames: Record<string, string> = {
    zh: '中文',
    en: '英文',
    ja: '日文',
    fr: '法文',
    de: '德文',
    ru: '俄文',
    es: '西文',
  }
  for (const [lang, count] of Object.entries(languageCounts.value)) {
    opts.push({
      label: `${langNames[lang] || lang.toUpperCase()} (${count})`,
      value: lang,
    })
  }
  return opts
})

const filteredEditions = computed(() => {
  if (!work.value?.editions) return []
  if (selectedLanguage.value === 'all') return work.value.editions
  return work.value.editions.filter(ed => (ed.language || 'zh').toLowerCase() === selectedLanguage.value)
})

const quotes = ref<WorkNoteItem[]>([])
const quotesLoading = ref(false)

async function loadQuotes() {
  if (!work.value || !auth.isAuthenticated) return
  quotesLoading.value = true
  try {
    const res = await listWorkNotes(work.value.id, { kind: 'highlight', limit: 20 })
    quotes.value = res.items
  } catch {
    // Guest or no notes
  } finally {
    quotesLoading.value = false
  }
}

function formatQuote(text?: string) {
  if (!text) return ''
  const trimmed = text.trim()
  if ((trimmed.startsWith('“') && trimmed.endsWith('”')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed
  }
  return `“${trimmed}”`
}

watch(activeTab, (tab) => {
  if (tab === 'quotes') {
    void loadQuotes()
  }
})

async function refreshWork() {
  if (!work.value) return
  const targetId = work.value.id
  try {
    const fresh = await getCatalogWork(targetId)
    if (!alive || work.value?.id !== targetId) return
    work.value = fresh
  } catch (err) {
    if (!alive) return
    if (err instanceof ApiErrorResponseError && err.status === 404) {
      error.value = '图书不存在或已下架'
    }
  }
}

async function handleRate(score: number) {
  if (!work.value) return
  if (!auth.isAuthenticated) {
    void router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  ratingBusy.value = true
  ratingError.value = ''
  try {
    workRating.value = await setWorkRating(work.value.id, score)
  } catch {
    ratingError.value = '评分保存失败，请稍后重试'
  } finally {
    ratingBusy.value = false
  }
}

async function handleClearRate() {
  if (!work.value || !auth.isAuthenticated) return
  ratingBusy.value = true
  ratingError.value = ''
  try {
    workRating.value = await removeWorkRating(work.value.id)
  } catch {
    ratingError.value = '评分清除失败，请稍后重试'
  } finally {
    ratingBusy.value = false
  }
}

async function load() {
  const id = String(route.params.workId || '')
  if (!id) {
    error.value = '图书标识缺失。'
    loading.value = false
    return
  }

  loading.value = true
  workRating.value = null
  error.value = ''
  try {
    const result = await getCatalogWork(id)
    if (!alive || String(route.params.workId || '') !== id) return
    if (result.id !== id) {
      await router.replace({ path: `/books/work/${result.id}`, query: route.query })
      return
    }
    work.value = result
    loading.value = false
    if (activeTab.value === 'quotes') {
      void loadQuotes()
    }
  } catch (err) {
    if (!alive) return
    loading.value = false
    error.value = err instanceof ApiErrorResponseError && err.status === 404
      ? '图书不存在或已下架'
      : '图书加载失败，请检查网络后重试。'
  }
}

watch(
  () => route.params.workId,
  () => {
    void load()
  },
  { immediate: true }
)

watch(() => auth.user?.uuid, () => {
  workRating.value = null
  ratingError.value = ''
})

onBeforeUnmount(() => {
  alive = false
})
</script>

<style scoped>
.book-catalog__rating-wrapper {
  margin-block: 0.25rem;
}

.book-catalog__status-text {
  font-size: 0.875rem;
  color: var(--a-color-text-secondary);
  padding: 1.5rem 0;
}

.book-catalog__error-box {
  padding: 1.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg);
}

.book-catalog__upload-actions {
  margin-top: 1.5rem;
}
</style>
