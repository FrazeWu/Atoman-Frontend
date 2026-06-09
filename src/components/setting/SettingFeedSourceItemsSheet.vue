<template>
  <PaperSheet
    :show="show"
    title="FEED_SOURCE_ITEMS"
    close-type="header"
    width="min(100%, 560px)"
    @close="$emit('close')"
  >
    <div v-if="source" class="setting-feed-sheet">
      <header class="setting-feed-sheet__summary">
        <div class="setting-feed-sheet__summary-copy">
          <p class="setting-feed-sheet__kicker">EXTERNAL RSS</p>
          <h2>{{ source.title || '未命名订阅源' }}</h2>
          <a :href="source.rss_url" target="_blank" rel="noreferrer">{{ source.rss_url }}</a>
        </div>
        <div class="setting-feed-sheet__summary-stats">
          <PaperBadge :type="sourceStatusBadgeType" :fill="source.status === 'failing' || source.status === 'disabled'">
            {{ sourceStatusLabel }}
          </PaperBadge>
          <p>同步连续失败 {{ source.consecutive_sync_failures ?? 0 }}</p>
          <p>最近同步失败 {{ formatDateTime(source.last_sync_failed_at) }}</p>
        </div>
      </header>

      <div v-if="source.last_sync_error" class="setting-feed-sheet__failure">
        <strong>最近同步失败</strong>
        <p>{{ source.last_sync_error }}</p>
      </div>

      <div class="setting-feed-sheet__items">
        <article
          v-for="item in sortedItems"
          :key="item.id"
          class="setting-feed-sheet__item"
          :class="{ 'setting-feed-sheet__item--failed': item.full_text_status === 'failed' }"
        >
          <div class="setting-feed-sheet__item-head">
            <div>
              <h3>{{ item.title }}</h3>
              <a :href="item.link" target="_blank" rel="noreferrer">{{ item.link }}</a>
            </div>
            <PaperBadge :type="badgeTypeForItem(item.full_text_status)" :fill="item.full_text_status === 'failed'">
              {{ item.full_text_status }}
            </PaperBadge>
          </div>

          <div class="setting-feed-sheet__item-meta">
            <span>attempt {{ item.attempt_count }}</span>
            <span>上次 {{ formatDateTime(item.last_attempt_at) }}</span>
            <span>发布时间 {{ formatDateTime(item.published_at) }}</span>
          </div>

          <p v-if="item.error_message" class="setting-feed-sheet__item-error">{{ item.error_message }}</p>

          <div class="setting-feed-sheet__item-actions">
            <a :href="item.link" target="_blank" rel="noreferrer">打开原文</a>
            <ABtn
              v-if="item.full_text_status === 'failed'"
              variant="secondary"
              size="sm"
              :loading="retryingIds.has(item.id)"
              loading-text="重试中..."
              @click="$emit('retry', item.id)"
            >
              手动重试
            </ABtn>
          </div>
        </article>

        <p v-if="sortedItems.length === 0" class="setting-feed-sheet__empty">当前源暂无条目。</p>
      </div>
    </div>
  </PaperSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ABtn from '@/components/ui/ABtn.vue'
import PaperBadge from '@/components/ui/PaperBadge.vue'
import PaperSheet from '@/components/ui/PaperSheet.vue'
import type { AdminFeedFulltextItemRow, AdminFeedFulltextItemStatus, AdminFeedFulltextSourceRow } from '@/stores/adminFeedFulltext'

const props = withDefaults(defineProps<{
  show: boolean
  source: AdminFeedFulltextSourceRow | null
  items: AdminFeedFulltextItemRow[]
  retryingIds?: Set<string>
}>(), {
  retryingIds: () => new Set<string>(),
})

defineEmits<{
  (e: 'close'): void
  (e: 'retry', itemId: string): void
}>()

const statusOrder: Record<AdminFeedFulltextItemStatus, number> = {
  failed: 0,
  retry: 1,
  pending: 2,
  fetching: 3,
  success: 4,
}

const sortedItems = computed(() => (
  [...props.items].sort((a, b) => {
    const rankDiff = statusOrder[a.full_text_status] - statusOrder[b.full_text_status]
    if (rankDiff !== 0) return rankDiff
    return toTime(b.last_attempt_at || b.published_at) - toTime(a.last_attempt_at || a.published_at)
  })
))

const sourceStatusBadgeType = computed(() => (
  props.source?.status === 'healthy' ? 'internal' : 'external'
))

const sourceStatusLabel = computed(() => {
  const status = props.source?.status || 'healthy'
  return status.toUpperCase()
})

function toTime(value?: string) {
  if (!value) return 0
  return new Date(value).getTime()
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function badgeTypeForItem(status: AdminFeedFulltextItemStatus) {
  return status === 'failed' ? 'external' : 'internal'
}
</script>

<style scoped>
.setting-feed-sheet {
  display: grid;
  gap: 1.25rem;
}

.setting-feed-sheet__summary {
  display: grid;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.setting-feed-sheet__summary-copy,
.setting-feed-sheet__summary-stats {
  display: grid;
  gap: 0.45rem;
}

.setting-feed-sheet__kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.7rem;
  font-weight: 950;
  letter-spacing: 0.18em;
}

.setting-feed-sheet__summary-copy h2,
.setting-feed-sheet__summary-copy a,
.setting-feed-sheet__summary-stats p,
.setting-feed-sheet__failure p,
.setting-feed-sheet__item h3,
.setting-feed-sheet__item-meta,
.setting-feed-sheet__item-error,
.setting-feed-sheet__empty {
  margin: 0;
}

.setting-feed-sheet__summary-copy a,
.setting-feed-sheet__item-head a,
.setting-feed-sheet__item-actions a {
  color: var(--a-color-ink-muted);
  text-decoration: none;
  word-break: break-all;
}

.setting-feed-sheet__summary-copy a:hover,
.setting-feed-sheet__item-head a:hover,
.setting-feed-sheet__item-actions a:hover {
  text-decoration: underline;
}

.setting-feed-sheet__failure {
  padding: 0.9rem 1rem;
  border: 1px dashed var(--a-color-danger-line);
  background: color-mix(in srgb, var(--a-color-danger-ink) 4%, white);
}

.setting-feed-sheet__failure strong {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--a-color-danger-ink);
}

.setting-feed-sheet__items {
  display: grid;
  gap: 0.9rem;
}

.setting-feed-sheet__item {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
}

.setting-feed-sheet__item--failed {
  border-color: var(--a-color-danger-line);
  box-shadow: inset 4px 0 0 var(--a-color-danger-line);
}

.setting-feed-sheet__item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.setting-feed-sheet__item-head h3 {
  margin-bottom: 0.35rem;
  color: var(--a-color-ink);
  font-size: 1rem;
  line-height: 1.4;
}

.setting-feed-sheet__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--a-color-ink-soft);
  font-size: 0.82rem;
}

.setting-feed-sheet__item-error {
  color: var(--a-color-danger-ink);
  font-size: 0.9rem;
}

.setting-feed-sheet__item-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.setting-feed-sheet__empty {
  color: var(--a-color-ink-soft);
  font-size: var(--a-text-sm);
}
</style>
