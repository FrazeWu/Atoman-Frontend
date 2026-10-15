<template>
  <article class="book-continue-card" :aria-label="`继续阅读 ${item.title || item.file_name}`">
    <div class="book-continue-card__cover">
      <BookCover :title="item.title || item.file_name" />
    </div>

    <div class="book-continue-card__body">
      <div class="book-continue-card__meta">
        <span class="book-continue-card__badge">{{ item.format.toUpperCase() }}</span>
        <span v-if="lastReadText" class="book-continue-card__time">{{ lastReadText }}</span>
      </div>

      <h3 class="book-continue-card__title">
        <RouterLink :to="`/books/read/${item.asset_id}`">
          {{ item.title || item.file_name }}
        </RouterLink>
      </h3>

      <p class="book-continue-card__author">{{ item.author || '未知作者' }}</p>

      <div class="book-continue-card__progress-wrap">
        <div class="book-continue-card__progress-header">
          <span>阅读进度</span>
          <span class="book-continue-card__percent">{{ percentText }}</span>
        </div>
        <div
          class="book-continue-card__bar-bg"
          role="progressbar"
          :aria-valuenow="Math.round(item.reading_percent * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="book-continue-card__bar-fill" :style="{ width: `${progressWidth}%` }" />
        </div>
      </div>

      <div class="book-continue-card__action">
        <PButton
          variant="primary"
          size="sm"
          data-action="continue-read"
          @click="$emit('read', item.asset_id)"
        >
          <BookOpen :size="15" aria-hidden="true" />
          <span>继续阅读</span>
        </PButton>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen } from 'lucide-vue-next'
import type { BookContinueReading } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import BookCover from './BookCover.vue'

const props = defineProps<{
  item: BookContinueReading
}>()

defineEmits<{
  read: [assetId: string]
}>()

const percentText = computed(() => {
  return `${Math.round(props.item.reading_percent * 100)}%`
})

const progressWidth = computed(() => {
  return Math.min(100, Math.max(0, Math.round(props.item.reading_percent * 100)))
})

const lastReadText = computed(() => {
  if (!props.item.last_read_at) return ''
  try {
    const diff = Date.now() - new Date(props.item.last_read_at).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return '刚刚阅读'
    if (hours < 24) return `${hours} 小时前阅读`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} 天前阅读`
    return '较早前阅读'
  } catch {
    return ''
  }
})
</script>

<style scoped>
.book-continue-card {
  display: flex;
  gap: 1.25rem;
  padding: 1.125rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  transition: border-color 0.15s ease;
}

.book-continue-card:hover {
  border-color: var(--a-color-border);
}

.book-continue-card__cover {
  width: 90px;
  flex-shrink: 0;
}

.book-continue-card__body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}

.book-continue-card__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.book-continue-card__badge {
  display: inline-block;
  padding: 0.1rem 0.35rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.2;
  color: var(--a-color-text-muted);
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}

.book-continue-card__time {
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
}

.book-continue-card__title {
  margin: 0 0 0.25rem;
  font-size: 1.0625rem;
  font-weight: 500;
  line-height: 1.35;
  color: var(--a-color-fg);
}

.book-continue-card__title a {
  color: inherit;
  text-decoration: none;
}

.book-continue-card__title a:hover {
  color: var(--a-color-primary);
}

.book-continue-card__author {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--a-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-continue-card__progress-wrap {
  margin-bottom: 0.875rem;
}

.book-continue-card__progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
}

.book-continue-card__percent {
  font-weight: 600;
  color: var(--a-color-fg);
}

.book-continue-card__bar-bg {
  width: 100%;
  height: 4px;
  background: var(--a-color-border-soft);
  border-radius: 2px;
  overflow: hidden;
}

.book-continue-card__bar-fill {
  height: 100%;
  background: var(--a-color-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.book-continue-card__action {
  display: flex;
  align-items: center;
}

@media (max-width: 640px) {
  .book-continue-card {
    gap: 1rem;
    padding: 1rem;
  }

  .book-continue-card__cover {
    width: 76px;
  }

  .book-continue-card__title {
    font-size: 0.9375rem;
  }
}
</style>
