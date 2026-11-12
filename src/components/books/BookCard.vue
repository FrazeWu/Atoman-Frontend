<template>
  <RouterLink :to="target" class="book-card">
    <!-- 抽象书籍作品卡片：纯平 2B 现代经典封面（有图渲染图，无图渲染 2B） -->
    <BookCover
      variant="work"
      :src="coverSrc"
      :title="work.title"
      :seed="work.id"
      :subtitle="work.subtitle"
      :author="authorText"
      :category="categoryText"
      :eager="eager"
    />

    <!-- 卡片下方：书名、评分与作者/版本信息 -->
    <div class="book-card__meta">
      <div class="book-card__meta-line">
        <strong class="book-card__title" :title="work.title">{{ work.title }}</strong>
        <span v-if="ratingText" class="book-card__rating">
          <Star :size="12" fill="currentColor" aria-hidden="true" />
          <span>{{ ratingText }}</span>
        </span>
      </div>
      <div class="book-card__sub-line">
        <span class="book-card__author" :title="authorText">{{ authorText || '未知作者' }}</span>
        <span class="book-card__sep" aria-hidden="true">·</span>
        <span class="book-card__editions">{{ editionCountText }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Star } from 'lucide-vue-next'
import type { BookPublicWork } from '@/api/books'
import BookCover from './BookCover.vue'

const props = defineProps<{ work: BookPublicWork; eager?: boolean }>()
const route = useRoute()

const target = computed(() => ({
  path: `/books/work/${props.work.id}`,
  query: { ...route.query, ...(route.path === '/books/library' ? { from: '/books/library' } : {}) },
}))

const authorText = computed(() => props.work.authors?.map(a => a.name).join(' / ') || '')

const coverSrc = computed(() => {
  return props.work.cover_url || props.work.editions?.[0]?.cover_url || ''
})

const editionCount = computed(() => {
  if (Array.isArray(props.work.editions)) {
    return props.work.editions.length
  }
  return 0
})

const editionCountText = computed(() => {
  return `${editionCount.value} 个版本`
})

const categoryText = computed(() => {
  // 从作品或第一版提取分类/语言作为 2B 顶标
  return (props.work as any).category || (props.work as any).primary_language || 'BOOK'
})

const ratingText = computed(() => {
  if (props.work.rating_score && props.work.rating_score > 0) {
    return props.work.rating_score.toFixed(1)
  }
  return null
})
</script>

<style scoped>
.book-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
  color: var(--a-color-fg, #0f172a);
  text-decoration: none;
  box-shadow: none !important;
}

.book-card:hover :deep(.book-cover) {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px -4px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.06);
}

.book-card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.book-card__meta-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.book-card__title {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--a-color-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-card__rating {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #d97706;
  flex-shrink: 0;
}

.book-card__sub-line {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: var(--a-color-text-secondary);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  min-width: 0;
}

.book-card__author {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  min-width: 0;
}

.book-card__sep {
  margin: 0 0.3rem;
  color: var(--a-color-text-secondary);
  opacity: 0.5;
  flex-shrink: 0;
  user-select: none;
}

.book-card__editions {
  flex-shrink: 0;
  color: var(--a-color-text-secondary);
  opacity: 0.85;
}

.book-card:hover .book-card__editions {
  opacity: 1;
}
</style>
