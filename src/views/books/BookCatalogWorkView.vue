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
            :src="work.cover_url"
            :title="work.title"
            :subtitle="work.subtitle || work.original_title"
            :author="work.authors.map(author => author.name).join(' / ')"
            eager
          />
        </div>

        <div class="book-catalog__info-col">
          <PPageHeader
            :title="work.title"
            :sub="work.authors.map(author => author.name).join(' / ')"
          />
          <p v-if="work.subtitle" class="book-catalog__work-subtitle">{{ work.subtitle }}</p>
          <p v-if="work.original_title" class="book-catalog__work-original">原作名：{{ work.original_title }}</p>
          <p class="book-catalog__description">
            {{ work.description || '暂无简介，书目信息可以后续补充。' }}
          </p>

          <!-- 读者星级评分组件：使用全站标准公共 RatingControl -->
          <div class="book-catalog__rating-wrapper">
            <RatingControl
              :aria-label="`${work.title} 评分`"
              :rating-score="workRating?.rating_score ?? work.rating_score"
              :rating-count="workRating?.rating_count ?? work.rating_count"
              :viewer-rating="workRating?.viewer_rating"
              :disabled="!auth.isAuthenticated"
              :loading="ratingBusy"
              :error-message="ratingError"
              @rate="handleRate"
              @clear="handleClearRate"
            />
          </div>

          <div class="book-catalog__hero-actions">
            <BookShelfAction v-if="auth.isAuthenticated" :key="auth.user?.uuid" :work-id="work.id" />
            <PButton
              v-if="auth.isAuthenticated"
              variant="secondary"
              :to="{ path: '/books/new', query: { ...route.query, work: work.id } }"
            >
              + 补充版本或文件
            </PButton>
          </div>
        </div>
      </div>

      <!-- 出版版本区 -->
      <section aria-labelledby="catalog-editions-title" class="book-catalog__section">
        <div class="book-catalog__section-header">
          <h2 id="catalog-editions-title">出版版本</h2>
          <PButton v-if="auth.isAuthenticated" size="sm" :to="{ path: '/books/new', query: { ...route.query, work: work.id } }">
            + 补充版本
          </PButton>
        </div>
        <p v-if="!work.editions.length" class="book-catalog__empty-hint">暂无出版信息，不影响图书公开展示。</p>
        <ul v-else class="book-catalog__edition-cards">
          <li v-for="edition in work.editions" :key="edition.id" class="book-catalog__edition-card">
            <!-- 版本封面：原图封面或方案 2B 现代经典风回退 -->
            <div class="book-catalog__edition-cover-col">
              <BookCover
                variant="edition"
                :src="edition.cover_url"
                :title="edition.title || work.title"
                :author="edition.publisher || work.authors.map(author => author.name).join(' / ')"
              />
            </div>

            <!-- 版本元数据 -->
            <div class="book-catalog__edition-meta">
              <div class="book-catalog__edition-title-row">
                <PButton variant="ghost" :to="`/books/edition/${edition.id}`">
                  {{ edition.title || work.title }}
                </PButton>
                <span v-if="edition.subtitle" class="book-catalog__edition-sub">{{ edition.subtitle }}</span>
              </div>
              <div class="book-catalog__edition-details">
                <span v-if="edition.translators?.length">{{ edition.translators.map(p => p.name).join(' / ') }} 译</span>
                <span v-if="edition.language || edition.edition_statement">{{ [edition.language, edition.edition_statement].filter(Boolean).join(' · ') }}</span>
                <span>{{ edition.publisher || '出版社待补充' }}</span>
                <span v-if="edition.published_date">{{ edition.published_date.slice(0, 10) }}</span>
                <span v-if="edition.isbn13 || edition.isbn10">ISBN {{ edition.isbn13 || edition.isbn10 }}</span>
                <span v-if="edition.page_count">{{ edition.page_count }} 页</span>
              </div>

              <!-- 该版本下的可读电子书文件 -->
              <div class="book-catalog__edition-resources">
                <div
                  v-for="asset in resources.filter(asset => asset.edition_id === edition.id)"
                  :key="asset.id"
                  class="book-catalog__resource-chip"
                >
                  <span class="book-catalog__resource-badge">{{ asset.format.toUpperCase() }}</span>
                  <span class="book-catalog__resource-name">{{ asset.title || edition.title || work.title }} · {{ asset.language }}</span>
                  <PButton
                    v-if="asset.current_revision_id"
                    size="sm"
                    :to="resourceReaderPath(work.id, asset.id, asset.current_revision_id)"
                  >
                    开始阅读
                  </PButton>
                  <BookResourceVersions :asset="asset" :authenticated="auth.isAuthenticated" />
                </div>
              </div>

              <div class="book-catalog__edition-wiki-row">
                <BookWikiPanel kind="edition" :entity-id="edition.id" :work-id="work.id" :authenticated="auth.isAuthenticated" @changed="refreshWork" />
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- 电子书文件区 -->
      <section aria-labelledby="catalog-resources-title" class="book-catalog__section">
        <h2 id="catalog-resources-title">电子书文件</h2>
        <div v-if="resourceError" role="alert" class="book-catalog__error-box">
          <p class="book-catalog__error">{{ resourceError }}</p>
          <PButton variant="secondary" @click="loadResources">重试加载文件</PButton>
        </div>
        <p v-else-if="resourcesLoading" role="status" class="book-catalog__status-text">正在检查可用文件…</p>
        <p v-else-if="!resources.length" class="book-catalog__empty-hint">图书已公开，暂时没有通过自动安全检查的电子书文件。</p>
        <div v-else>
          <p class="book-catalog__step-intro">文件按版本／译本展示。旧文件保持原状，不自动推断所属版本。</p>
          <ul class="book-catalog__list">
            <li v-for="asset in resources" :key="asset.id" class="book-catalog__row">
              <strong>{{ asset.title || work.title }}</strong>
              <span>{{ asset.format.toUpperCase() }} · {{ asset.language }}</span>
              <span>文件已通过自动安全检查</span>
              <PButton v-if="asset.current_revision_id" :to="resourceReaderPath(work.id, asset.id, asset.current_revision_id)">开始阅读</PButton>
              <BookResourceVersions :asset="asset" :authenticated="auth.isAuthenticated" />
            </li>
          </ul>
        </div>
        <div class="book-catalog__upload-actions">
          <PButton v-if="!auth.isAuthenticated" variant="secondary" :to="{ path: '/login', query: { redirect: route.fullPath } }">
            登录后上传文件
          </PButton>
        </div>
      </section>

      <!-- 读者研讨与社区 -->
      <section class="book-catalog__section">
        <BookWorkCommunity :key="`${work.id}:${auth.user?.uuid || 'guest'}`" :work-id="work.id" :authenticated="auth.isAuthenticated" />
      </section>

      <!-- 开放 Wiki 词条 -->
      <section class="book-catalog__section book-catalog__wiki-section">
        <div class="book-catalog__wiki-panels">
          <BookWikiPanel kind="work" :entity-id="work.id" :authenticated="auth.isAuthenticated" @changed="refreshWork" />
          <div v-for="author in work.authors" :key="author.id" class="book-catalog__author-wiki-card">
            <span class="book-catalog__author-name">{{ author.name }}</span>
            <BookWikiPanel kind="person" :entity-id="author.id" :authenticated="auth.isAuthenticated" @changed="refreshWork" />
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import BookResourceVersions from '@/components/books/BookResourceVersions.vue'
import BookShelfAction from '@/components/books/BookShelfAction.vue'
import BookWorkCommunity from '@/components/books/BookWorkCommunity.vue'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import BookCover from '@/components/books/BookCover.vue'
import RatingControl from '@/components/shared/RatingControl.vue'
import { ApiErrorResponseError } from '@/api/client'
import { getCatalogWork, listCatalogResources, type CatalogResource, type CatalogWork } from '@/api/bookCatalog'
import { resourceReaderPath } from '@/api/bookResources'
import { getWorkRating, setWorkRating, removeWorkRating, type WorkRating } from '@/api/bookCommunity'
import './bookCatalog.css'
import './bookPrivate.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const work = ref<CatalogWork>()
const workRating = ref<WorkRating | null>(null)
const ratingBusy = ref(false)
const ratingError = ref('')
const resources = ref<CatalogResource[]>([])
const loading = ref(true)
const resourcesLoading = ref(false)
const error = ref('')
const resourceError = ref('')
let alive = true

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

async function loadRating(workId: string) {
  try {
    workRating.value = await getWorkRating(workId)
  } catch {
    workRating.value = null
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

async function loadResources() {
  if (!work.value) return
  const targetId = work.value.id
  resourcesLoading.value = true
  resourceError.value = ''
  try {
    const list = await listCatalogResources(targetId)
    if (!alive || work.value?.id !== targetId) return
    resources.value = list.items
  } catch (err) {
    if (!alive || work.value?.id !== targetId) return
    resourceError.value = '文件信息加载失败，图书书目仍然公开。'
  } finally {
    if (alive && work.value?.id === targetId) {
      resourcesLoading.value = false
    }
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
  error.value = ''
  try {
    const result = await getCatalogWork(id)
    if (!alive) return
    if (result.id !== id) {
      await router.replace({ path: `/books/work/${result.id}`, query: route.query })
      return
    }
    work.value = result
    loading.value = false
    void loadRating(id)
    void loadResources()
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
  color: var(--a-color-text-secondary, #64748b);
  padding: 1.5rem 0;
}

.book-catalog__error-box {
  padding: 1.5rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg, #ffffff);
}

.book-catalog__upload-actions {
  margin-top: 1.5rem;
}
</style>
