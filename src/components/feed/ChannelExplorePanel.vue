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

  <div v-else class="channel-panel">
    <div class="channel-category-tabs" data-test="channel-category-tabs">
      <button
        v-for="option in categoryOptions"
        :key="option.value"
        type="button"
        class="channel-category-tab a-font-meta"
        :class="{ 'is-active': option.value === activeCategory }"
        :data-test="`channel-category-${option.value}`"
        @click="emit('change-category', option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="!items.length" class="channel-panel-state channel-panel-feedback">
      <p>暂无可浏览的频道</p>
    </div>

    <div v-else class="channel-list" data-test="channel-list">
      <FeedSourceIdentityCard
        v-for="source in items"
        :key="source.id"
        :source="source"
        :color="buildSourceColor(source.title || source.rssUrl || source.id)"
        :avatar-label="buildSourceAvatarLabel(source.title)"
        :display-url="normalizeSourceUrlForCard(source.rssUrl, source.title)"
        :subscribe-busy="subscribingSourceId === source.id"
        data-test="channel-card"
        @select="emit('open-source', $event)"
        @subscribe="emit('subscribe-source', $event)"
      />
    </div>

    <FeedTimelineFooter
      v-if="items.length"
      :page="page"
      :page-size="pageSize"
      :total="totalItems"
      :loading="loading"
      @change-page="emit('change-page', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { buildSourceAvatarLabel, buildSourceColor, normalizeSourceUrlForCard } from '@/utils/feedSourcePresentation'
import type { FeedExploreSource, FeedSourceCategory } from '@/types'

defineProps<{
  categoryOptions: Array<{ label: string; value: FeedSourceCategory | 'all' }>
  activeCategory: FeedSourceCategory | 'all'
  items: FeedExploreSource[]
  loading: boolean
  error: string
  totalItems: number
  page: number
  pageSize: number
  subscribingSourceId?: string
}>()

const emit = defineEmits<{
  (e: 'open-source', source: FeedExploreSource): void
  (e: 'subscribe-source', source: FeedExploreSource): void
  (e: 'change-category', category: FeedSourceCategory | 'all'): void
  (e: 'retry'): void
  (e: 'change-page', page: number): void
}>()
</script>

<style scoped>
.channel-panel,
.channel-panel-state {
  display: grid;
  gap: 1rem;
}

.channel-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
}

.channel-category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  padding: 0.25rem;
  border: 1px solid var(--a-color-line-soft);
  background: color-mix(in srgb, var(--a-color-bg) 72%, var(--a-color-paper));
  box-shadow: var(--a-shadow-paper-sm);
}

.channel-category-tab {
  min-height: 2rem;
  padding: 0.38rem 0.78rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.channel-category-tab:hover {
  border-color: var(--a-color-line);
  background: var(--a-color-paper);
  color: var(--a-color-fg);
  box-shadow: var(--a-shadow-paper-sm);
  transform: translateY(-1px);
}

.channel-category-tab:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--a-color-accent-confirm) 62%, transparent);
  outline-offset: 2px;
}

.channel-category-tab.is-active {
  border-color: color-mix(in srgb, var(--a-color-accent-confirm) 52%, var(--a-color-line));
  background: color-mix(in srgb, var(--a-color-accent-confirm) 14%, var(--a-color-paper));
  color: var(--a-color-accent-confirm);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--a-color-accent-confirm) 20%, transparent), var(--a-shadow-paper-sm);
}

.channel-category-tab.is-active:hover {
  border-color: color-mix(in srgb, var(--a-color-accent-confirm) 68%, var(--a-color-line));
  background: color-mix(in srgb, var(--a-color-accent-confirm) 18%, var(--a-color-paper));
  color: var(--a-color-accent-confirm);
  transform: translateY(-1px);
}

.channel-panel-feedback {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-paper-sm);
}

.channel-card-skeleton {
  height: 11rem;
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
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0.45rem 0.85rem;
  border: 1px solid var(--a-color-line);
  background: var(--a-color-paper);
  color: var(--a-color-fg);
}
</style>
