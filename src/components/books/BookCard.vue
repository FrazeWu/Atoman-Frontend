<template>
  <RouterLink :to="target" class="book-card">
    <!-- 抽象书籍作品卡片：纯平 2B 现代经典封面（有图渲染图，无图渲染 2B） -->
    <BookCover
      variant="work"
      :src="coverSrc"
      :title="work.title"
      :subtitle="work.subtitle"
      :author="authorText"
      :category="categoryText"
      :eager="eager"
    />

    <!-- 卡片下方：书名、评分与作者信息 -->
    <div class="book-card__meta">
      <div class="book-card__meta-line">
        <strong class="book-card__title" :title="work.title">{{ work.title }}</strong>
        <span v-if="ratingText" class="book-card__rating">
          <Star :size="12" fill="currentColor" aria-hidden="true" />
          <span>{{ ratingText }}</span>
        </span>
      </div>
      <p class="book-card__author" :title="authorText">{{ authorText || '未知作者' }}</p>
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
  gap: 0.5rem;
  min-width: 0;
  color: var(--a-color-fg, #0f172a);
  text-decoration: none;
  box-shadow: none !important;
  transition: opacity 0.15s ease;
}

.book-card:hover {
  opacity: 0.85;
}

.book-card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
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

.book-card__author {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  line-height: 1.4;
}
</style>
