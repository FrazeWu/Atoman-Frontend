<template>
  <section class="book-catalog">
    <PPageHeader title="发现图书" sub="收录经典著作与学术文献，探索人类思想谱系。" />

    <!-- 统一工具栏：分类过滤与搜索排布 -->
    <div class="book-discover__controls">
      <!-- 左侧：图书/榜单切换 -->
      <div class="p-segmented-control" role="tablist">
        <RouterLink
          :to="{ path: '/books' }"
          class="p-segmented-item"
          :class="{ active: !ranked }"
          role="tab"
          :aria-selected="!ranked"
        >
          全部图书
        </RouterLink>
        <RouterLink
          :to="{ path: '/books', query: { sort: 'high-rated' } }"
          class="p-segmented-item"
          :class="{ active: ranked }"
          role="tab"
          :aria-selected="ranked"
        >
          高分榜
        </RouterLink>
      </div>

      <!-- 右侧：统一搜索栏 (Option 1A) 与添加操作 -->
      <div class="book-discover__search-area">
        <PSearchInput
          v-model="query"
          v-model:scope="searchType"
          variant="bar"
          size="md"
          :scopes="searchScopes"
          placeholder="输入书名、作者或关键词..."
          aria-label="搜索书名、作者或关键词"
          action-button-text="搜索"
          class="book-discover__search-bar"
          @search="search"
        />
        <PButton
          class="book-discover__add-btn"
          :to="auth.isAuthenticated ? { path: '/books/new', query: route.query } : { path: '/login', query: { redirect: '/books/new' } }"
        >
          添加图书
        </PButton>
      </div>
    </div>

    <!-- 错误重试状态 -->
    <div v-if="error" role="alert" class="book-catalog__error-box">
      <p class="book-catalog__error">{{ error }}</p>
      <PButton variant="secondary" @click="load">重试</PButton>
    </div>

    <!-- 加载中状态 -->
    <p v-else-if="loading" role="status" class="book-catalog__loading-status">正在加载图书…</p>

    <!-- 主体内容 -->
    <template v-else>
      <!-- 高分榜单视图 -->
      <template v-if="ranked">
        <p class="book-discover__meta-note">按加权评分与读者研读热度综合排序。</p>
        <p v-if="!rankings.length" class="book-catalog__empty-hint">暂无满足门槛的图书。</p>
        <ul v-else class="book-catalog__list">
          <li v-for="item in rankings" :key="item.work_id" class="book-catalog__row">
            <RouterLink :to="`/books/work/${item.work_id}`">{{ item.title }}</RouterLink>
            <span>加权评分 {{ item.weighted_rating_score }} · {{ item.rating_count }} 人研读</span>
          </li>
        </ul>
      </template>

      <!-- 作者检索视图 -->
      <template v-else-if="route.query.type === 'people'">
        <p class="book-discover__meta-note">{{ total }} 位作者</p>
        <p v-if="!people.length" class="book-catalog__empty-hint">没有找到作者，试试其他姓名。</p>
        <ul v-else class="book-catalog__list">
          <li v-for="person in people" :key="person.id" class="book-catalog__row">
            <strong>{{ person.name }}</strong>
            <p>{{ person.description || '作者简介待补充' }}</p>
            <PButton variant="ghost" :to="{ path: '/books', query: { q: person.name } }">查看相关作品</PButton>
            <BookWikiPanel kind="person" :entity-id="person.id" :authenticated="auth.isAuthenticated" />
          </li>
        </ul>
      </template>

      <!-- 作品书库网格视图（核心主视图） -->
      <template v-else>
        <div class="book-discover__count-row">
          <span class="book-discover__total-count">{{ total }} 本图书</span>
        </div>
        <PEmpty
          v-if="!works.length"
          class="book-catalog__empty"
          :description="route.query.q ? '没有找到图书，试试其他关键词，或添加这本书。' : '还没有图书，添加第一本书即可公开展示。'"
        />
        <ul v-else class="book-catalog__grid">
          <li v-for="(work, index) in works" :key="work.id">
            <BookCard :work="work" :eager="index < 6" />
          </li>
        </ul>
      </template>
    </template>

    <PaginationBar
      :meta="{ page, page_size: 24, total, has_more: page * 24 < total }"
      :loading="loading"
      @change="changePage"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { searchLocation, unifiedSearchEnabled } from '@/utils/searchUrl'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { catalogRevision, searchCatalogWorks } from '@/api/bookCatalog'
import { highRatedWorks, type WorkRating } from '@/api/bookCommunity'
import { searchWikiPeople } from '@/api/bookWiki'
import BookWikiPanel from '@/components/books/BookWikiPanel.vue'
import BookCard from '@/components/books/BookCard.vue'
import type { BookPublicWork } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import PSearchInput, { type SearchScopeOption } from '@/components/ui/PSearchInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import './bookCatalog.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const query = ref('')
const searchType = ref('works')
const searchScopes: SearchScopeOption[] = [
  { label: '图书', value: 'works' },
  { label: '作者', value: 'people' },
  { label: '书单', value: 'lists' },
]
const people = ref<{ id: string; name: string; description?: string }[]>([])
const page = computed(() => Math.max(1, Math.floor(Number(route.query.page) || 1)))
const works = ref<BookPublicWork[]>([])
const rankings = ref<(WorkRating & { work_id: string; title: string })[]>([])
const ranked = computed(() => route.query.sort === 'high-rated' && route.query.type !== 'people')
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
    if (route.query.type === 'people') {
      const result = await searchWikiPeople(String(route.query.q || ''), (page.value - 1) * 24, 24)
      if (current !== generation) return
      people.value = result.items
      total.value = result.total
      return
    }
    if (ranked.value) {
      const result = await highRatedWorks((page.value - 1) * 24)
      if (current !== generation) return
      rankings.value = result.items
      total.value = result.total
      return
    }
    const result = await searchCatalogWorks(String(route.query.q || ''), 24, (page.value - 1) * 24, request.signal)
    if (current !== generation) return
    works.value = result.items
    total.value = result.total
  } catch {
    if (current === generation) error.value = '图书加载失败，请重试。'
  } finally {
    if (current === generation) loading.value = false
  }
}
function search() {
  if (unifiedSearchEnabled) {
    void router.push(searchLocation(query.value, 'books', [searchType.value === 'people' ? 'author' : searchType.value === 'lists' ? 'book_list' : 'work']))
    return
  }
  void router.push({
    path: searchType.value === 'lists' ? '/books/lists' : '/books',
    query: {
      ...(query.value.trim() ? { q: query.value.trim() } : {}),
      ...(searchType.value === 'people' ? { type: 'people' } : {}),
    },
  })
}

function changePage(value: number) {
  void router.push({ path: '/books', query: { ...route.query, page: value > 1 ? String(value) : undefined } })
}

// 打开详情不重新挂载发现页；搜索与分页仍由 URL 恢复。
watch(
  [() => route.query.q, () => route.query.page, () => route.query.sort, () => route.query.type, () => catalogRevision.value],
  () => {
    query.value = String(route.query.q || '')
    searchType.value = route.query.type === 'people' ? 'people' : 'works'
    void load()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  generation++
  request?.abort()
})
</script>

<style scoped>
.book-discover__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-block: 1.25rem;
}

.book-discover__search-area {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  max-width: 640px;
}

.book-discover__search-bar {
  flex: 1;
  min-width: 200px;
}

.book-discover__add-btn {
  height: 38px;
  flex-shrink: 0;
}

.book-discover__count-row {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.book-discover__total-count {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
}

.book-discover__meta-note {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin-bottom: 1rem;
}

.book-catalog__error-box {
  padding: 1.5rem;
  margin-block: 1rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  background: #ffffff;
}
</style>
