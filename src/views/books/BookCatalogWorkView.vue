<template>
  <section class="book-catalog">
    <p v-if="loading" role="status">正在加载图书…</p>
    <div v-else-if="error" role="alert">
      <p class="book-catalog__error">{{ error }}</p>
      <PButton variant="secondary" @click="load">重试</PButton>
    </div>
    <template v-else-if="work">
      <!-- 顶部主体区：左侧纯白纯中文书页封面，右侧主要信息与评分 -->
      <div class="book-catalog__hero">
        <!-- 左侧通用纯白书页封面 -->
        <div class="book-catalog__cover-col">
          <div class="book-catalog__cover-page" aria-label="作品通用封面">
            <!-- 1. 书名与 2. 中文副标题 -->
            <div class="book-catalog__cover-header">
              <h1 class="book-catalog__cover-title">{{ work.title }}</h1>
              <div v-if="work.subtitle || work.original_title" class="book-catalog__cover-subtitle">
                {{ work.subtitle || work.original_title }}
              </div>
            </div>

            <!-- 3. 作者与 4. 一句话书摘 -->
            <div class="book-catalog__cover-body">
              <div class="book-catalog__cover-author">
                {{ work.authors.map(author => author.name).join(' / ') }} 著
              </div>
              <p class="book-catalog__cover-quote">
                {{ extractQuote(work.description) }}
              </p>
            </div>

            <!-- 5. 出版年份 -->
            <div class="book-catalog__cover-footer">
              {{ firstYear(work) }}
            </div>
          </div>
        </div>

        <!-- 右侧元数据、导言与评分组件 -->
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

          <!-- 读者星级评分组件 -->
          <div class="book-catalog__rating-card">
            <div class="book-catalog__rating-score-box">
              <div class="book-catalog__rating-score">{{ work.rating_score || '4.8' }}</div>
              <div class="book-catalog__rating-count">{{ work.rating_count ? `${work.rating_count} 人研读` : '读者研读推荐' }}</div>
            </div>
            <div class="book-catalog__rating-stars-box">
              <div class="book-catalog__rating-stars">
                <span
                  v-for="star in 5"
                  :key="star"
                  class="book-catalog__star-icon"
                  :class="{ active: star <= userRating }"
                  @click="rate(star)"
                >
                  ★
                </span>
                <span class="book-catalog__rating-hint">{{ ratingHint }}</span>
              </div>
              <div class="book-catalog__rating-subtext">高评分经典著作 · 读者社区共同研读分享</div>
            </div>
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

      <!-- 下方内容区域：出版版本与电子书文件 -->
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
            <!-- 版本具体封面或书名标牌 -->
            <div class="book-catalog__edition-cover">
              <div class="book-catalog__edition-publisher-tag">{{ edition.publisher || '出版社' }}</div>
              <div class="book-catalog__edition-cover-title">{{ edition.title || work.title }}</div>
              <div v-if="edition.translators?.length" class="book-catalog__edition-cover-trans">
                {{ edition.translators.map(p => p.name).join(' / ') }} 译
              </div>
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
        <div v-if="resourceError" role="alert">
          <p>{{ resourceError }}</p>
          <PButton variant="secondary" @click="loadResources">重试加载文件</PButton>
        </div>
        <p v-else-if="resourcesLoading" role="status">正在检查可用文件…</p>
        <p v-else-if="!resources.length" class="book-catalog__empty-hint">图书已公开，暂时没有通过自动安全检查的电子书文件。</p>
        <div v-else>
          <p class="book-catalog__step-intro">文件按版本／译本展示。旧文件保持原状，不自动推断所属版本。</p>
          <h3 v-if="resources.some(asset => !asset.edition_id)">尚未关联版本的旧文件</h3>
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
        <PButton v-if="!auth.isAuthenticated" variant="secondary" :to="{ path: '/login', query: { redirect: route.fullPath } }">
          登录后上传文件
        </PButton>
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
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { resourceReaderPath } from '@/api/bookResources'
import BookResourceVersions from '@/components/books/BookResourceVersions.vue'
import BookShelfAction from '@/components/books/BookShelfAction.vue'
import BookWorkCommunity from '@/components/books/BookWorkCommunity.vue'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import { ApiErrorResponseError } from '@/api/client'
import { getCatalogWork, listCatalogResources, type CatalogResource, type CatalogWork } from '@/api/bookCatalog'
import { useQueryClient } from '@tanstack/vue-query'
import { bookKeys } from '@/entities/book'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import './bookCatalog.css'
import './bookPrivate.css'

const moduleCatalogWorkCache = new Map<string, CatalogWork>()
const moduleCatalogResourcesCache = new Map<string, CatalogResource[]>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

let queryClient: ReturnType<typeof useQueryClient> | null = null
try {
  queryClient = useQueryClient()
} catch {
  // Graceful fallback for environments without VueQueryPlugin
}

const work = ref<CatalogWork | null>(null)
const resources = ref<CatalogResource[]>([])
const loading = ref(true)
const resourcesLoading = ref(false)
const error = ref('')
const resourceError = ref('')
const currentTab = ref<'editions' | 'resources' | 'community' | 'wiki'>('editions')
const userRating = ref(0)
const ratingHint = ref('点击评分')
let alive = true

function rate(star: number) {
  userRating.value = star
  const labels = ['', '很差', '较差', '还行', '推荐', '力荐']
  ratingHint.value = `已评 ${star} 星 · ${labels[star]}`
}

function extractQuote(desc?: string): string {
  if (!desc) return '“立身存笃信，景行胜将登。”'
  const sentences = desc.split(/[。！？\n]/).filter(s => s.trim().length > 8)
  if (sentences.length > 0) {
    return `“${sentences[0].trim()}”`
  }
  return `“${desc.slice(0, 48)}…”`
}

function firstYear(w: CatalogWork): string {
  const ed = w.editions?.find(e => !!e.published_date)
  if (ed?.published_date) {
    return `${ed.published_date.slice(0, 4)} 年`
  }
  return '初版年份待录'
}

async function refreshWork() {
  if (!work.value) return
  const targetId = work.value.id
  try {
    const result = await getCatalogWork(targetId)
    if (alive) {
      work.value = result
      moduleCatalogWorkCache.set(targetId, result)
      queryClient?.setQueryData(bookKeys.catalogWork(targetId), result)
      void queryClient?.invalidateQueries({ queryKey: bookKeys.catalogWork(targetId) })
    }
  } catch {
    error.value = '资料已保存，但详情刷新失败，请重新加载。'
  }
}

async function load() {
  const targetId = String(route.params.workId || '')
  if (!targetId) return
  error.value = ''

  const cachedWork = moduleCatalogWorkCache.get(targetId) || queryClient?.getQueryData<CatalogWork>(bookKeys.catalogWork(targetId))
  if (cachedWork) {
    work.value = cachedWork
    loading.value = false
  } else {
    loading.value = true
  }

  try {
    const result = await getCatalogWork(targetId)
    if (!alive) return
    work.value = result
    moduleCatalogWorkCache.set(targetId, result)
    moduleCatalogWorkCache.set(result.id, result)
    queryClient?.setQueryData(bookKeys.catalogWork(targetId), result)
    queryClient?.setQueryData(bookKeys.catalogWork(result.id), result)

    if (result.id !== targetId) {
      await router.replace({ path: `/books/work/${result.id}`, query: route.query })
      return
    }
    void loadResources()
  } catch (err) {
    if (alive) {
      if (!cachedWork) work.value = null
      error.value = err instanceof ApiErrorResponseError && err.status === 404
        ? '图书不存在或已下架。'
        : '图书加载失败，请重试。'
    }
  } finally {
    if (alive) loading.value = false
  }
}

async function loadResources() {
  if (!work.value) return
  const targetId = work.value.id
  resourceError.value = ''

  const cachedRes = moduleCatalogResourcesCache.get(targetId) || queryClient?.getQueryData<CatalogResource[]>(bookKeys.catalogResources(targetId))
  if (cachedRes) {
    resources.value = cachedRes
    resourcesLoading.value = false
  } else {
    resourcesLoading.value = true
  }

  try {
    const result = await listCatalogResources(targetId)
    if (!alive) return
    resources.value = result.items
    moduleCatalogResourcesCache.set(targetId, result.items)
    queryClient?.setQueryData(bookKeys.catalogResources(targetId), result.items)
  } catch {
    if (alive) {
      resourceError.value = '文件信息加载失败。图书本身仍已公开，请重试加载文件。'
    }
  } finally {
    if (alive) resourcesLoading.value = false
  }
}

onMounted(() => { void load(); if (!auth.isAuthenticated) void auth.restoreSession() })
onBeforeUnmount(() => { alive = false })
</script>
