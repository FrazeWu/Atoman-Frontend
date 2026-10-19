<template>
  <section class="book-catalog">
    <p v-if="loading" role="status">正在加载图书…</p>
    <div v-else-if="error" role="alert"><p class="book-catalog__error">{{ error }}</p><PButton variant="secondary" @click="load">重试</PButton></div>
    <template v-else-if="work">
      <PPageHeader :title="work.title" :sub="work.authors.map(author => author.name).join(' / ')" />
      <p v-if="work.subtitle">{{ work.subtitle }}</p>
      <p v-if="work.original_title">原作名：{{ work.original_title }}</p>
      <p class="book-catalog__description">{{ work.description || '暂无简介，书目信息可以后续补充。' }}</p>
      <BookWikiPanel kind="work" :entity-id="work.id" :authenticated="auth.isAuthenticated" @changed="refreshWork" />
      <div v-for="author in work.authors" :key="author.id"><span>{{ author.name }}</span><BookWikiPanel kind="person" :entity-id="author.id" :authenticated="auth.isAuthenticated" @changed="refreshWork" /></div>
      <BookShelfAction v-if="auth.isAuthenticated" :key="auth.user?.uuid" :work-id="work.id" />
      <section aria-labelledby="catalog-editions-title">
        <h2 id="catalog-editions-title">出版版本</h2>
        <BookAddEdition v-if="auth.isAuthenticated" :work-id="work.id" @saved="refreshWork" />
        <p v-if="!work.editions.length">暂无出版信息，不影响图书公开展示。</p>
        <ul v-else class="book-catalog__list">
          <li v-for="edition in work.editions" :key="edition.id" class="book-catalog__row">
            <strong>{{ edition.title || work.title }}</strong>
            <span>{{ edition.publisher || '出版社待补充' }}</span>
            <span v-if="edition.isbn13 || edition.isbn10">ISBN {{ edition.isbn13 || edition.isbn10 }}</span>
            <span v-if="edition.page_count">{{ edition.page_count }} 页</span>
            <BookWikiPanel kind="edition" :entity-id="edition.id" :work-id="work.id" :authenticated="auth.isAuthenticated" @changed="refreshWork" />
          </li>
        </ul>
      </section>
      <section aria-labelledby="catalog-resources-title">
        <h2 id="catalog-resources-title">电子书文件</h2>
        <div v-if="resourceError" role="alert"><p>{{ resourceError }}</p><PButton variant="secondary" @click="loadResources">重试加载文件</PButton></div>
        <p v-else-if="resourcesLoading" role="status">正在检查可用文件…</p>
        <p v-else-if="!resources.length">图书已公开，暂时没有通过自动安全检查的电子书文件。</p>
        <ul v-else class="book-catalog__list">
          <li v-for="asset in resources" :key="asset.id" class="book-catalog__row">
            <strong>{{ asset.title || work.title }}</strong><span>{{ asset.format.toUpperCase() }} · {{ asset.language }}</span><span>文件已通过自动安全检查</span>
            <PButton v-if="asset.current_revision_id" :to="resourceReaderPath(work.id, asset.id, asset.current_revision_id)">开始阅读</PButton>
            <BookResourceVersions :asset="asset" :authenticated="auth.isAuthenticated" />
          </li>
        </ul>
        <BookResourceUpload v-if="auth.isAuthenticated" :key="auth.user?.uuid" :work-id="work.id" :title="work.title" @ready="loadResources" />
        <PButton v-else variant="secondary" :to="{ path: '/login', query: { redirect: route.fullPath } }">登录后上传文件</PButton>
      </section>
      <BookWorkCommunity :key="`${work.id}:${auth.user?.uuid || 'guest'}`" :work-id="work.id" :authenticated="auth.isAuthenticated" />
    </template>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { resourceReaderPath } from '@/api/bookResources'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import BookResourceVersions from '@/components/books/BookResourceVersions.vue'
import BookShelfAction from '@/components/books/BookShelfAction.vue'
import BookWorkCommunity from '@/components/books/BookWorkCommunity.vue'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import BookAddEdition from '@/components/books/BookAddEdition.vue'
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
let alive = true

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
