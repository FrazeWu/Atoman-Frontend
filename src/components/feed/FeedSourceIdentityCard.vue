<template>
  <button
    v-bind="rootAttrs"
    type="button"
    class="feed-source-card"
    @click="emit('select', source)"
  >
    <div class="feed-source-card__hero" data-test="feed-source-hero" :style="{ '--feed-source-color': color }">
      <span class="feed-source-card__eyebrow">频道</span>
      <span class="feed-source-card__count" data-test="feed-source-count">{{ source.subscriptionCount }} 订阅</span>
    </div>

    <div class="feed-source-card__body">
      <div class="feed-source-card__identity">
        <div class="feed-source-card__avatar" data-test="feed-source-avatar" :style="{ '--feed-source-color': color }">
          {{ avatarLabel }}
        </div>

        <div class="feed-source-card__copy">
          <h3 data-test="feed-source-title">{{ source.title }}</h3>
          <p class="feed-source-card__url" data-test="feed-source-url">{{ displayUrl }}</p>
        </div>
      </div>

      <div class="feed-source-card__meta">
        <span>{{ source.recentItemCount }} 篇近期内容</span>
        <span>{{ formattedLastUpdated }}</span>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

import { computed, useAttrs } from 'vue'

import type { FeedExploreSource } from '@/types'

const props = defineProps<{
  source: FeedExploreSource
  color: string
  avatarLabel: string
  displayUrl: string
}>()

const emit = defineEmits<{
  (e: 'select', source: FeedExploreSource): void
}>()

const attrs = useAttrs()

const rootAttrs = computed(() => ({
  'data-test': 'feed-source-card',
  ...attrs,
}))

const formattedLastUpdated = computed(() => {
  if (!props.source.lastPublishedAt) return '暂无更新时间'
  return new Date(props.source.lastPublishedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
})
</script>

<style scoped>
.feed-source-card {
  width: 100%;
  border: none;
  border-bottom: 1.5px dashed color-mix(in srgb, var(--feed-source-color, var(--a-color-line-soft)) 38%, var(--a-color-line-soft));
  border-left: 3px solid transparent;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--feed-source-color, var(--a-color-bg)) 7%, white) 0%, var(--a-color-bg) 48%),
    var(--a-color-bg);
  color: inherit;
  text-align: left;
  overflow: hidden;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.feed-source-card:hover,
.feed-source-card:focus-visible {
  border-left-color: color-mix(in srgb, var(--feed-source-color, var(--a-color-ink)) 68%, var(--a-color-ink));
  transform: translateX(2px);
}

.feed-source-card__hero {
  --hero-wash: color-mix(in srgb, var(--feed-source-color) 15%, white);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--feed-source-color) 35%, white) 0%, transparent 48%),
    linear-gradient(135deg, color-mix(in srgb, var(--feed-source-color) 18%, white) 0%, var(--hero-wash) 100%);
}

.feed-source-card__eyebrow,
.feed-source-card__count,
.feed-source-card__meta {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.feed-source-card__count {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.2rem 0.7rem;
  border-radius: 0px;
  background: rgba(255, 255, 255, 0.8);
}

.feed-source-card__body {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.feed-source-card__identity {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.9rem;
  align-items: center;
}

.feed-source-card__avatar {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--feed-source-color) 18%, white);
  color: color-mix(in srgb, var(--feed-source-color) 72%, black);
  font-size: 1.15rem;
  font-weight: 900;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--feed-source-color) 22%, white);
}

.feed-source-card__copy {
  min-width: 0;
}

.feed-source-card__copy h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.35;
}

.feed-source-card__url {
  margin: 0.3rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.84rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.feed-source-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--a-color-muted-soft);
}
</style>
