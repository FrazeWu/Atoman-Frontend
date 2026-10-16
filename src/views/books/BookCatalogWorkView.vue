<template>
  <section class="book-catalog">
    <p v-if="loading" role="status">正在加载图书…</p>
    <div v-else-if="error" role="alert"><p class="book-catalog__error">{{ error }}</p><PButton variant="secondary" @click="load">重试</PButton></div>
    <template v-else-if="work">
      <PPageHeader :title="work.title" :sub="work.authors.map(author => author.name).join(' / ')" />
      <p v-if="work.subtitle">{{ work.subtitle }}</p>
      <p v-if="work.original_title">原作名：{{ work.original_title }}</p>
      <p class="book-catalog__description">{{ work.description || '暂无简介，书目信息可以后续补充。' }}</p>
      <section aria-labelledby="catalog-editions-title">
        <h2 id="catalog-editions-title">出版版本</h2>
        <p v-if="!work.editions.length">暂无出版信息，不影响图书公开展示。</p>
        <ul v-else class="book-catalog__list">
          <li v-for="edition in work.editions" :key="edition.id" class="book-catalog__row">
            <strong>{{ edition.title || work.title }}</strong>
            <span>{{ edition.publisher || '出版社待补充' }}</span>
            <span v-if="edition.isbn13 || edition.isbn10">ISBN {{ edition.isbn13 || edition.isbn10 }}</span>
            <span v-if="edition.page_count">{{ edition.page_count }} 页</span>
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
          </li>
        </ul>
        <BookResourceUpload v-if="auth.isAuthenticated" :key="auth.user?.uuid" :work-id="work.id" :title="work.title" @ready="loadResources" />
        <PButton v-else variant="secondary" :to="{ path: '/login', query: { redirect: route.fullPath } }">登录后上传文件</PButton>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { resourceReaderPath } from '@/api/bookResources'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import { ApiErrorResponseError } from '@/api/client'
import { getCatalogWork, listCatalogResources, type CatalogResource, type CatalogWork } from '@/api/bookCatalog'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import './bookCatalog.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const work = ref<CatalogWork | null>(null)
const resources = ref<CatalogResource[]>([])
const loading = ref(true)
const resourcesLoading = ref(false)
const error = ref('')
const resourceError = ref('')
let alive = true
async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await getCatalogWork(String(route.params.workId))
    if (!alive) return
    work.value = result
    if (result.id !== String(route.params.workId)) {
      await router.replace({ path: `/books/work/${result.id}`, query: route.query })
      return
    }
    void loadResources()
  } catch (err) { if (alive) error.value = err instanceof ApiErrorResponseError && err.status === 404 ? '图书不存在或已下架。' : '图书加载失败，请重试。' }
  finally { if (alive) loading.value = false }
}
async function loadResources() {
  if (!work.value) return
  resourcesLoading.value = true
  resourceError.value = ''
  try { const result = await listCatalogResources(work.value.id); if (alive) resources.value = result.items }
  catch { if (alive) resourceError.value = '文件信息加载失败。图书本身仍已公开，请重试加载文件。' }
  finally { if (alive) resourcesLoading.value = false }
}
onMounted(() => { void load(); if (!auth.isAuthenticated) void auth.restoreSession() })
onBeforeUnmount(() => { alive = false })
</script>
