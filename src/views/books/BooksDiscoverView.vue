<template>
  <section class="book-catalog">
    <PPageHeader title="发现图书" sub="所有图书直接公开；无需上传文件，也可以完善书目。" />
    <form class="book-catalog__toolbar" role="search" @submit.prevent="search">
      <PInput id="catalog-query" v-model="query" label="搜索书名或作者" placeholder="输入书名或作者" />
      <PButton type="submit" variant="secondary">搜索</PButton>
      <PButton :to="auth.isAuthenticated ? { path: '/books/new', query: route.query } : { path: '/login', query: { redirect: '/books/new' } }">添加图书</PButton>
    </form>
    <div v-if="error" role="alert"><p class="book-catalog__error">{{ error }}</p><PButton variant="secondary" @click="load">重试</PButton></div>
    <p v-else-if="loading" role="status">正在加载图书…</p>
    <template v-else>
      <p>{{ total }} 本图书</p>
      <p v-if="!works.length" class="book-catalog__empty">{{ route.query.q ? '没有找到图书，试试其他关键词，或添加这本书。' : '还没有图书，添加第一本书即可公开展示。' }}</p>
      <ul v-else class="book-catalog__grid">
        <li v-for="(work, index) in works" :key="work.id">
          <RouterLink :to="{ path: `/books/work/${work.id}`, query: route.query }" class="book-catalog__card">
            <BookCover :title="work.title" :src="work.editions?.[0]?.cover_url" :eager="index < 6" />
            <strong>{{ work.title }}</strong>
            <span>{{ work.authors.map(author => author.name).join(' / ') }}</span>
            <small>{{ work.editions?.[0]?.publisher || '出版信息待补充' }}</small>
          </RouterLink>
        </li>
      </ul>
    </template>
    <PaginationBar :meta="{ page, page_size: 24, total, has_more: page * 24 < total }" :loading="loading" @change="changePage" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { catalogRevision, searchCatalogWorks } from '@/api/bookCatalog'
import type { BookPublicWork } from '@/api/books'
import BookCover from '@/components/books/BookCover.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import './bookCatalog.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const query = ref('')
const page = computed(() => Math.max(1, Math.floor(Number(route.query.page) || 1)))
const works = ref<BookPublicWork[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
let request: AbortController | undefined
let generation = 0
async function load() {
  request?.abort()
  request = new AbortController()
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await searchCatalogWorks(String(route.query.q || ''), 24, (page.value - 1) * 24, request.signal)
    if (current !== generation) return
    works.value = result.items
    total.value = result.total
  } catch { if (current === generation) error.value = '图书加载失败，请重试。' }
  finally { if (current === generation) loading.value = false }
}
function search() { void router.push({ path: '/books', query: query.value.trim() ? { q: query.value.trim() } : {} }) }
function changePage(value: number) { void router.push({ path: '/books', query: { ...route.query, page: value > 1 ? String(value) : undefined } }) }
// 打开详情不重新挂载发现页；搜索与分页仍由 URL 恢复。
watch([() => route.query.q, () => route.query.page, () => catalogRevision.value], () => { query.value = String(route.query.q || ''); void load() }, { immediate: true })
onBeforeUnmount(() => { generation++; request?.abort() })
</script>
