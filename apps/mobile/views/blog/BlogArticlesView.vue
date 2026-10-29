<template>
  <div class="blog-articles-view">
    <!-- Header -->
    <header class="blog-articles-header">
      <div class="blog-articles-header__title-row">
        <h1 class="blog-articles-header__title">长文</h1>
        <span class="blog-articles-header__sub">深度专栏与系统思考</span>
      </div>

      <!-- Category Filter Chips -->
      <div v-if="categories.length > 1" class="blog-category-chips" role="tablist">
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="category-chip"
          :class="{ 'is-active': selectedCategory === cat }"
          :data-testid="`category-chip-${cat}`"
          role="tab"
          :aria-selected="selectedCategory === cat"
          @click="selectCategory(cat)"
        >
          {{ cat }}
        </button>
      </div>
    </header>

    <!-- Articles Content -->
    <main class="blog-articles-content">
      <!-- Loading Skeleton -->
      <div v-if="loading" class="blog-articles-loading">
        <div v-for="n in 3" :key="n" class="article-skeleton" />
      </div>

      <!-- API failures are distinct from empty article lists. -->
      <div v-else-if="loadError" class="blog-articles-empty" role="alert">
        <p class="blog-articles-empty__title">长文加载失败</p>
        <p class="blog-articles-empty__desc">{{ loadError }}</p>
        <button type="button" @click="loadData">重新加载</button>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredArticles.length === 0" class="blog-articles-empty" data-testid="articles-empty-state">
        <p class="blog-articles-empty__title">暂无该分类的长文</p>
        <p class="blog-articles-empty__desc">切换其他分类标签看看吧。</p>
      </div>

      <!-- Article Stream -->
      <div v-else class="blog-articles-stream">
        <RouterLink
          v-for="article in filteredArticles"
          :key="article.id"
          :to="'/post/' + article.id"
          class="article-card"
          data-testid="article-card"
        >
          <div class="article-card__header">
            <span v-if="article.category" class="article-category-badge">
              {{ article.category }}
            </span>
            <span v-if="article.reading_time_minutes" class="article-reading-time">
              {{ article.reading_time_minutes }} 分钟阅读
            </span>
          </div>

          <h2 class="article-card__title">{{ article.title }}</h2>
          <p v-if="article.excerpt" class="article-card__excerpt">{{ article.excerpt }}</p>

          <div class="article-card__footer">
            <div class="article-author-row">
              <MAvatar
                :src="article.author?.avatar"
                :name="article.author?.name || '作者'"
                :size="22"
              />
              <span class="article-author-name">{{ article.author?.name || '匿名' }}</span>
              <span class="article-dot">·</span>
              <span class="article-date">{{ formatDate(article.published_at) }}</span>
            </div>

            <div v-if="article.tags && article.tags.length > 0" class="article-tags-row">
              <span v-for="t in article.tags.slice(0, 2)" :key="t" class="article-tag">
                #{{ t }}
              </span>
            </div>
          </div>
        </RouterLink>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPostList } from '@/entities/post/api/postApi'
import MAvatar from '@mobile/components/ui/MAvatar.vue'

export interface ArticleItem {
  id: string
  title: string
  excerpt?: string
  author?: {
    name: string
    avatar?: string
  }
  reading_time_minutes?: number
  category?: string
  tags?: string[]
  published_at?: string
}

const props = withDefaults(
  defineProps<{
    initialArticles?: ArticleItem[]
  }>(),
  {
    initialArticles: undefined,
  }
)

const categories = computed(() => [
  '全部',
  ...new Set(articlesList.value.map(article => article.category).filter((cat): cat is string => Boolean(cat))),
])
const selectedCategory = ref('全部')
const loading = ref(false)
const loadError = ref('')

const articlesList = ref<ArticleItem[]>(
  props.initialArticles ? [...props.initialArticles] : []
)

const filteredArticles = computed<ArticleItem[]>(() => {
  if (selectedCategory.value === '全部') {
    return articlesList.value
  }
  return articlesList.value.filter(
    (a) => a.category === selectedCategory.value || a.tags?.includes(selectedCategory.value)
  )
})

function selectCategory(cat: string) {
  selectedCategory.value = cat
}

function formatDate(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return ''
  }
}

async function loadData() {
  if (props.initialArticles) return
  loading.value = true
  loadError.value = ''
  try {
    const res = await fetchPostList({ limit: 30 })
    if (res?.posts && res.posts.length > 0) {
      articlesList.value = res.posts.map((p) => {
        const words = (p.content || '').length
        const mins = Math.max(1, Math.round(words / 400))
        const catName = typeof p.category === 'string' ? p.category : (p.category as any)?.name || p.tags?.[0] || ''
        return {
          id: String(p.id),
          title: p.title,
          excerpt: p.summary || '',
          author: {
            name: p.author?.nickname || p.author?.username || p.user?.display_name || p.user?.username || '作者',
            avatar: p.author?.avatar || p.user?.avatar_url || '',
          },
          reading_time_minutes: mins,
          category: catName,
          tags: p.tags || [],
          published_at: p.published_at || p.created_at,
        }
      })
    }
  } catch {
    articlesList.value = []
    loadError.value = '请检查网络连接后重试。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!props.initialArticles) {
    void loadData()
  }
})
</script>

<style scoped>
.blog-articles-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--a-color-bg, #ffffff);
  padding-bottom: 32px;
}

.blog-articles-header {
  padding: 12px 16px;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-articles-header__title-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.blog-articles-header__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.blog-articles-header__sub {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

.blog-category-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.blog-category-chips::-webkit-scrollbar {
  display: none;
}

.category-chip {
  flex-shrink: 0;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e4e4e7);
  border-radius: var(--a-radius-control, 4px);
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #52525b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.category-chip.is-active {
  background: var(--a-color-text, #18181b);
  border-color: var(--a-color-text, #18181b);
  color: #ffffff;
}

.blog-articles-content {
  padding: 16px;
}

.blog-articles-stream {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.article-card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #ebebeb);
  border-radius: var(--a-radius-card, 4px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: background-color 0.15s ease;
}

.article-card:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }

.article-card:active {
  background: var(--a-color-surface-hover, #fafafa);
}

.article-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.article-category-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--a-color-primary, #10b981);
  background: color-mix(in srgb, var(--a-color-primary, #10b981) 10%, #ffffff);
  border-radius: var(--a-radius-control, 4px);
  padding: 2px 6px;
}

.article-reading-time {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

.article-card__title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.article-card__excerpt {
  font-size: 13px;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #52525b);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--a-color-border-soft, #f4f4f5);
}

.article-author-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.article-author-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-text, #27272a);
}

.article-dot {
  font-size: 12px;
  color: var(--a-color-border, #d4d4d8);
}

.article-date {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

.article-tags-row {
  display: flex;
  gap: 4px;
}

.article-tag {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

/* Empty State */
.blog-articles-empty {
  text-align: center;
  padding: 48px 16px;
}
.blog-articles-empty__title {
  font-size: 15px;
  font-weight: 500;
  color: var(--a-color-text, #18181b);
  margin: 0 0 6px;
}
.blog-articles-empty__desc {
  font-size: 13px;
  color: var(--a-color-text-secondary, #71717a);
  margin: 0;
}

/* Skeletons */
.article-skeleton {
  height: 120px;
  background: var(--a-color-surface-hover, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
  margin-bottom: 12px;
}
</style>
