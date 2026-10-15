<template>
  <article
    class="book-library-card"
    :class="{ 'book-library-card--list': viewMode === 'list' }"
    :aria-label="title"
  >
    <!-- Cover -->
    <div class="book-library-card__cover">
      <BookCover :src="coverUrl" :title="title" />
    </div>

    <!-- Content -->
    <div class="book-library-card__content">
      <div class="book-library-card__header-meta">
        <span v-if="formatBadge" class="book-library-card__badge">{{ formatBadge }}</span>
        <span v-if="statusBadge" class="book-library-card__status" :data-status="shelfStatus">
          {{ statusBadge }}
        </span>
        <span v-if="ratingText" class="book-library-card__rating">
          <Star :size="12" aria-hidden="true" />
          <span>{{ ratingText }}</span>
        </span>
      </div>

      <h3 class="book-library-card__title">
        <RouterLink v-if="primaryLink" :to="primaryLink">
          {{ title }}
        </RouterLink>
        <span v-else>{{ title }}</span>
      </h3>

      <p class="book-library-card__author">{{ authorText }}</p>

      <div v-if="progressPercent !== undefined" class="book-library-card__progress">
        <div class="book-library-card__progress-info">
          <span>阅读进度</span>
          <span>{{ progressPercent }}%</span>
        </div>
        <div class="book-library-card__progress-bar">
          <div class="book-library-card__progress-fill" :style="{ width: `${progressPercent}%` }" />
        </div>
      </div>

      <div v-if="isImport && importErrorMessage" class="book-library-card__error" role="alert">
        {{ importErrorMessage }}
      </div>

      <!-- Actions -->
      <div class="book-library-card__actions">
        <PButton
          v-if="readableAssetId"
          variant="secondary"
          size="sm"
          data-action="read"
          @click="$emit('read', readableAssetId)"
        >
          <BookOpen :size="14" aria-hidden="true" />
          <span>阅读</span>
        </PButton>

        <PButton
          v-if="isImport && canRetry"
          variant="ghost"
          size="sm"
          data-action="retry"
          @click="$emit('retry', item.id)"
        >
          <RotateCw :size="14" aria-hidden="true" />
          <span>重试</span>
        </PButton>

        <PButton
          v-if="isImport && !isLinkedWork"
          variant="ghost"
          size="sm"
          data-action="link-work"
          title="关联公共作品"
          @click="$emit('link-work', item.id)"
        >
          <Link :size="14" aria-hidden="true" />
          <span>关联</span>
        </PButton>

        <PButton
          variant="ghost"
          size="sm"
          data-action="delete"
          :title="isImport ? '删除本地记录' : '移出书架'"
          class="book-library-card__delete-btn"
          @click="$emit('delete', actionItemId)"
        >
          <Trash2 :size="14" aria-hidden="true" />
          <span>{{ isImport ? '删除' : '移出' }}</span>
        </PButton>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  BookOpen,
  Link,
  RotateCw,
  Star,
  Trash2,
} from 'lucide-vue-next'
import type { BookShelfItem, BookImportSession } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import BookCover from './BookCover.vue'

const props = withDefaults(
  defineProps<{
    item: BookShelfItem | BookImportSession
    viewMode?: 'grid' | 'list'
    readingPercent?: number
  }>(),
  {
    viewMode: 'grid',
    readingPercent: undefined,
  }
)

defineEmits<{
  read: [assetId: string]
  'update-status': [id: string, status: string]
  delete: [id: string]
  'link-work': [id: string]
  retry: [id: string]
}>()

const isShelfItem = (item: BookShelfItem | BookImportSession): item is BookShelfItem => {
  return 'work' in item && typeof (item as BookShelfItem).work === 'object'
}

const isImport = computed(() => !isShelfItem(props.item))

const actionItemId = computed(() => {
  if (isShelfItem(props.item)) {
    return props.item.work_id || props.item.id
  }
  return props.item.id
})

const title = computed(() => {
  if (isShelfItem(props.item)) {
    return props.item.work?.title || '未知书籍'
  }
  return props.item.title || props.item.file_name || '未命名电子书'
})

const authorText = computed(() => {
  if (isShelfItem(props.item)) {
    return props.item.work?.authors?.map((a) => a.name).join(' / ') || '作者待补充'
  }
  return props.item.author || '未知作者'
})

const coverUrl = computed(() => {
  if (isShelfItem(props.item)) {
    const work = props.item.work
    const ed = work?.editions?.find((e) => e.cover_url) || work?.editions?.[0]
    return ed?.cover_url
  }
  return undefined
})

const formatBadge = computed(() => {
  if (isImport.value) {
    const imp = props.item as BookImportSession
    return imp.format ? imp.format.toUpperCase() : '电子书'
  }
  return ''
})

const shelfStatus = computed(() => {
  if (isShelfItem(props.item)) {
    return props.item.status
  }
  return ''
})

const statusBadge = computed(() => {
  if (isShelfItem(props.item)) {
    switch (props.item.status) {
      case 'reading':
        return '在读'
      case 'want_to_read':
        return '想读'
      case 'read':
        return '读过'
      case 'dropped':
        return '弃读'
      case 'on_hold':
        return '搁置'
      default:
        return '书架'
    }
  }
  const imp = props.item as BookImportSession
  if (imp.processing_status === 'private_available') return '可阅读'
  if (imp.processing_status === 'processing' || imp.status === 'scanning') return '解析中'
  if (imp.status === 'failed' || imp.processing_status === 'failed') return '处理失败'
  return ''
})

const ratingText = computed(() => {
  if (isShelfItem(props.item)) {
    const score = props.item.work?.rating_score
    if (score && score > 0) return score.toFixed(1)
  }
  return ''
})

const readableAssetId = computed(() => {
  if (isImport.value) {
    const imp = props.item as BookImportSession
    if (imp.asset_id && imp.processing_status === 'private_available') {
      return imp.asset_id
    }
  }
  return undefined
})

const primaryLink = computed(() => {
  if (isShelfItem(props.item)) {
    return `/books/work/${props.item.work_id}`
  }
  if (readableAssetId.value) {
    return `/books/read/${readableAssetId.value}`
  }
  return undefined
})

const isLinkedWork = computed(() => {
  if (isImport.value) {
    return Boolean((props.item as BookImportSession).work_id)
  }
  return true
})

const canRetry = computed(() => {
  if (isImport.value) {
    const imp = props.item as BookImportSession
    return (
      (imp.status === 'failed' || imp.processing_status === 'failed') &&
      imp.processing_status !== 'quarantined'
    )
  }
  return false
})

const importErrorMessage = computed(() => {
  if (isImport.value) {
    return (props.item as BookImportSession).error_message
  }
  return undefined
})

const progressPercent = computed(() => {
  if (props.readingPercent !== undefined) {
    return Math.round(props.readingPercent * 100)
  }
  return undefined
})
</script>

<style scoped>
.book-library-card {
  display: flex;
  flex-direction: column;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  padding: 0.875rem;
  transition: border-color 0.15s ease;
  min-width: 0;
}

.book-library-card:hover {
  border-color: var(--a-color-border);
}

.book-library-card__cover {
  width: 100%;
  margin-bottom: 0.75rem;
}

.book-library-card__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.book-library-card__header-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
  flex-wrap: wrap;
}

.book-library-card__badge {
  display: inline-block;
  padding: 0.08rem 0.3rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.2;
  color: var(--a-color-text-muted);
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}

.book-library-card__status {
  display: inline-block;
  padding: 0.08rem 0.3rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.2;
  color: var(--a-color-text-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}

.book-library-card__status[data-status="reading"] {
  color: var(--a-color-primary);
  border-color: color-mix(in srgb, var(--a-color-primary) 35%, transparent);
}

.book-library-card__status[data-status="want_to_read"] {
  color: var(--a-color-fg);
}

.book-library-card__status[data-status="read"] {
  color: var(--a-color-text-muted);
}

.book-library-card__rating {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
  margin-left: auto;
}

.book-library-card__rating svg {
  color: var(--a-color-primary);
}

.book-library-card__title {
  margin: 0 0 0.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--a-color-fg);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-library-card__title a {
  color: inherit;
  text-decoration: none;
}

.book-library-card__title a:hover {
  color: var(--a-color-primary);
}

.book-library-card__author {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--a-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-library-card__progress {
  margin-bottom: 0.75rem;
}

.book-library-card__progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--a-color-text-muted);
  margin-bottom: 0.25rem;
}

.book-library-card__progress-bar {
  width: 100%;
  height: 3px;
  background: var(--a-color-border-soft);
  border-radius: 2px;
  overflow: hidden;
}

.book-library-card__progress-fill {
  height: 100%;
  background: var(--a-color-primary);
  border-radius: 2px;
}

.book-library-card__error {
  font-size: 0.75rem;
  color: var(--a-color-danger);
  margin-bottom: 0.5rem;
  word-break: break-all;
}

.book-library-card__actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.book-library-card__delete-btn {
  margin-left: auto;
  color: var(--a-color-text-muted);
}

.book-library-card__delete-btn:hover {
  color: var(--a-color-danger);
}

/* List view mode */
.book-library-card--list {
  flex-direction: row;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
}

.book-library-card--list .book-library-card__cover {
  width: 48px;
  margin-bottom: 0;
  flex-shrink: 0;
}

.book-library-card--list .book-library-card__content {
  flex-direction: row;
  align-items: center;
  gap: 1.5rem;
}

.book-library-card--list .book-library-card__title {
  margin: 0;
  flex: 2;
  -webkit-line-clamp: 1;
}

.book-library-card--list .book-library-card__author {
  margin: 0;
  flex: 1;
}

.book-library-card--list .book-library-card__header-meta {
  margin-bottom: 0;
  flex-shrink: 0;
}

.book-library-card--list .book-library-card__actions {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .book-library-card--list .book-library-card__content {
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
  }

  .book-library-card--list .book-library-card__actions {
    margin-top: 0.375rem;
    padding-top: 0.375rem;
    border-top: 1px solid var(--a-color-border-soft);
  }
}
</style>
