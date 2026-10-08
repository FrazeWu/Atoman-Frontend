<template>
  <RouterLink :to="target" class="book-card">
    <BookCover :src="edition?.cover_url" :title="work.title" />
    <div class="book-card__heading">
      <strong>{{ work.title }}</strong>
      <ArrowRight :size="16" aria-hidden="true" />
    </div>
    <span class="book-card__authors">{{ work.authors.map(author => author.name).join(' / ') || '作者待补充' }}</span>
    <small>{{ edition?.publisher || '出版信息待补充' }}</small>
    <small v-if="needsChineseTitle">中文书名待补充</small>
    <span class="book-card__rating">
      <Star :size="13" aria-hidden="true" />
      {{ work.rating_count >= 5 ? work.rating_score.toFixed(1) : '暂无评分' }}
      <small v-if="work.rating_count"> · {{ work.rating_count }} 人</small>
    </span>
  </RouterLink>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { IconArrowRight as ArrowRight, IconStar as Star } from '@tabler/icons-vue'
import type { BookPublicWork } from '@/api/books'
import BookCover from './BookCover.vue'
const props = defineProps<{ work: BookPublicWork }>()
const route = useRoute()
const target = computed(() => ({
  path: `/books/work/${props.work.id}`,
  query: { ...route.query, ...(route.path === '/books/library' ? { from: '/books/library' } : {}) },
}))
const edition = computed(() => props.work.editions.find(item => item.cover_url) || props.work.editions[0])
const needsChineseTitle = computed(() => ['chi', 'zho', 'zh'].includes(props.work.language || '') && /\p{L}/u.test(props.work.title) && !/\p{Script=Han}/u.test(props.work.title))
</script>
<style scoped>
.book-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  color: var(--a-color-fg);
  text-decoration: none;
  box-shadow: none;
}

.book-card__heading {
  display: flex;
  align-items: start;
  gap: 0.5rem;
  margin-top: 0.4rem;
  color: var(--a-color-fg);
  transition: color 0.15s ease;
}

.book-card__heading strong {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
  font-size: 0.9375rem;
  font-weight: 500;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color 0.15s ease;
}

.book-card__heading svg {
  flex-shrink: 0;
  margin-top: 0.2rem;
  color: var(--a-color-muted);
  transition: color 0.15s ease;
}

.book-card__authors,
.book-card small {
  color: var(--a-color-muted);
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-card__rating {
  display: flex;
  align-items: center;
  font-size: 0.8125rem;
  gap: 0.25rem;
  font-variant-numeric: tabular-nums;
  color: var(--a-color-muted);
}

.book-card__rating svg {
  flex-shrink: 0;
}

.book-card:hover .book-card__heading,
.book-card:focus-visible .book-card__heading {
  color: var(--a-color-primary);
}

.book-card:hover .book-card__heading svg,
.book-card:focus-visible .book-card__heading svg {
  color: var(--a-color-primary);
}

.book-card:active {
  opacity: 0.8;
}

.book-card:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 5px;
}
</style>

