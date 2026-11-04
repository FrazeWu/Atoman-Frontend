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
            :seed="work.id"
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

          <div class="book-catalog__hero-actions">
            <p class="book-catalog__step-intro">阅读书架只收录具体电子书；请在下方出版版本中选择文件后加入。</p>
            <PButton v-if="auth.isAuthenticated" variant="secondary" :to="`/books/work/${work.id}/notes`">我的笔记（跨版本）</PButton>
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

              <div class="book-catalog__edition-resources">
                <PButton size="sm" variant="secondary" :to="'/books/edition/' + edition.id">
                  查看推荐阅读文件与历史版本
                </PButton>
              </div>
              <div class="book-catalog__edition-wiki-row">
                <BookWikiPanel kind="edition" :entity-id="edition.id" :work-id="work.id" :authenticated="auth.isAuthenticated" @changed="refreshWork" />
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- 读者研讨与社区 -->
      <section class="book-catalog__section">
        <BookWorkCommunity v-model:rating-state="workRating" :key="`${work.id}:${auth.user?.uuid || 'guest'}`" :work-id="work.id" :authenticated="auth.isAuthenticated" />
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
import BookWorkCommunity from '@/components/books/BookWorkCommunity.vue'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import BookCover from '@/components/books/BookCover.vue'
import RatingControl from '@/components/shared/RatingControl.vue'
import { ApiErrorResponseError } from '@/api/client'
import { getCatalogWork, type CatalogWork } from '@/api/bookCatalog'
import { setWorkRating, removeWorkRating, type WorkRating } from '@/api/bookCommunity'
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
