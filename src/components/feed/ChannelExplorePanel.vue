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
      <FeedSourceIdentityCard
        v-for="source in items"
        :key="source.id"
        :source="source"
        :color="buildSourceColor(source.title || source.rssUrl || source.id)"
        :avatar-label="buildSourceAvatarLabel(source.title)"
        :display-url="normalizeSourceUrlForCard(source.rssUrl, source.title)"
        data-test="channel-card"
        @select="emit('open-source', $event)"
      />
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
import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { buildSourceAvatarLabel, buildSourceColor, normalizeSourceUrlForCard } from '@/utils/feedSourcePresentation'
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

.channel-panel-feedback {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-paper-sm);
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
