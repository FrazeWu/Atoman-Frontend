<template>
  <div v-if="loading" class="channel-panel-state">
    <div v-for="i in 6" :key="i" class="a-skeleton channel-card-skeleton" />
  </div>

  <div v-else-if="error" class="channel-panel-state channel-panel-feedback">
    <p>{{ error }}</p>
    <button type="button" class="channel-retry-button a-font-meta" @click="emit('retry')">
      重试
    </button>
  </div>

  <div v-else-if="!items.length" class="channel-panel-state channel-panel-feedback">
    <p>暂无可浏览的频道</p>
  </div>

  <div v-else class="channel-panel">
    <div class="channel-grid">
      <button
        v-for="source in items"
        :key="source.id"
        type="button"
        class="channel-card"
        data-test="channel-card"
        @click="emit('open-source', source)"
      >
        <div class="channel-card-head">
          <span class="channel-card-kicker">频道</span>
          <span class="channel-card-count">{{ source.subscriptionCount }} 订阅</span>
        </div>
        <h3>{{ source.title }}</h3>
        <p class="channel-card-url">{{ source.rssUrl || 'RSS 源' }}</p>
        <div class="channel-card-meta">
          <span>{{ source.recentItemCount }} 篇近期内容</span>
          <span>{{ formatDate(source.lastPublishedAt) }}</span>
        </div>
      </button>
    </div>

    <FeedTimelineFooter
      :page="page"
      :page-size="pageSize"
      :total="totalItems"
      :loading="loading"
      @change-page="emit('change-page', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import type { FeedExploreSource } from '@/types'

defineProps<{
  items: FeedExploreSource[]
  loading: boolean
  error: string
  totalItems: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  (e: 'open-source', source: FeedExploreSource): void
  (e: 'retry'): void
  (e: 'change-page', page: number): void
}>()

const formatDate = (date?: string) => {
  if (!date) return '暂无更新时间'
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.channel-panel,
.channel-panel-state {
  display: grid;
  gap: 1rem;
}

.channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.channel-card,
.channel-panel-feedback {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-paper-sm);
}

.channel-card {
  display: grid;
  gap: 0.85rem;
  width: 100%;
  padding: 1rem;
  color: inherit;
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.channel-card:hover,
.channel-card:focus-visible {
  transform: translateY(-2px);
  border-color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper);
}

.channel-card-head,
.channel-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.channel-card-kicker,
.channel-card-count,
.channel-card-meta,
.channel-retry-button {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.channel-card h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.35;
}

.channel-card-url {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.84rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.channel-card-meta {
  color: var(--a-color-muted-soft);
}

.channel-card-skeleton {
  height: 8.5rem;
}

.channel-panel-feedback {
  justify-items: center;
  padding: 2rem 1rem;
  text-align: center;
}

.channel-panel-feedback p {
  margin: 0;
  color: var(--a-color-muted);
}

.channel-retry-button {
  padding: 0.45rem 0.85rem;
  border: 1px solid var(--a-color-line);
  background: var(--a-color-paper);
  color: var(--a-color-fg);
}
</style>
