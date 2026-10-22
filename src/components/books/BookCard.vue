<template>
  <RouterLink :to="target" class="book-card">
    <!-- 抽象书籍作品卡片：纯平 + 我们设计的典雅排版封面 -->
    <BookCover
      variant="work"
      :title="work.title"
      :subtitle="work.subtitle"
      :author="authorText"
      :eager="eager"
    />

    <!-- 卡片下方：严格单行【书名 + 评分】 -->
    <div class="book-card__meta-line">
      <strong class="book-card__title">{{ work.title }}</strong>
      <span v-if="ratingText" class="book-card__rating">
        <Star :size="12" aria-hidden="true" />
        <span>{{ ratingText }}</span>
      </span>
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
  gap: 0.375rem;
  min-width: 0;
  color: var(--a-color-fg);
  text-decoration: none;
  box-shadow: none !important;
}

.book-card__meta-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
  margin-top: 0.25rem;
}

.book-card__title {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.35;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.book-card:hover .book-card__title,
.book-card:focus-visible .book-card__title {
  color: var(--a-color-primary);
}

.book-card__rating {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: #d97706;
  flex-shrink: 0;
}

.book-card__rating svg {
  flex-shrink: 0;
}

.book-card:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 4px;
  border-radius: var(--a-radius-card, 4px);
}
</style>
