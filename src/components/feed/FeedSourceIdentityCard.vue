<template>
  <article
    v-bind="rootAttrs"
    role="button"
    tabindex="0"
    class="feed-source-card"
    :class="{
      'is-compact': compact,
      'is-recommend': variant === 'recommend',
    }"
    @click="emit('select', source)"
    @keydown.enter.prevent="emit('select', source)"
    @keydown.space.prevent="emit('select', source)"
  >
    <div class="feed-source-card__visual">
      <div class="feed-source-card__avatar" data-test="feed-source-avatar" :style="{ '--feed-source-color': color }">
        <img v-if="imageUrl" :src="imageUrl" :alt="source.title" class="feed-source-card__avatar-image" />
        <template v-else>{{ avatarLabel }}</template>
      </div>
      <button
        v-if="showSubscribe"
        type="button"
        class="feed-source-card__subscribe"
        :class="{ 'is-subscribed': source.subscribed }"
        :disabled="source.subscribed || subscribeBusy"
        data-test="feed-source-subscribe"
        @click.stop="emit('subscribe', source)"
      >
        <Check v-if="source.subscribed" :size="14" aria-hidden="true" />
        <Plus v-else :size="14" aria-hidden="true" />
        {{ subscribeButtonLabel }}
      </button>
    </div>

    <div class="feed-source-card__main">
      <div class="feed-source-card__topline">
        <div class="feed-source-card__copy">
          <p v-if="eyebrow" class="feed-source-card__eyebrow" data-test="feed-source-eyebrow">{{ eyebrow }}</p>
          <h3 data-test="feed-source-title">{{ source.title }}</h3>
          <p v-if="displayUrl" class="feed-source-card__url" data-test="feed-source-url">{{ displayUrl }}</p>
        </div>
      </div>

      <p v-if="summaryText" class="feed-source-card__summary">
        {{ summaryText }}
      </p>

      <p v-else class="feed-source-card__summary">
        {{ source.subscriptionCount }} 位订阅 · {{ source.recentItemCount }} 篇近期内容 · {{ formattedLastUpdated }}
      </p>

      <ul v-if="showPreviews && source.recentItems.length" class="feed-source-card__previews">
        <li v-for="item in source.recentItems.slice(0, 2)" :key="item.id" data-test="feed-source-preview-title">
          {{ item.title }}
        </li>
      </ul>

      <div v-if="metadataText || showMeta" class="feed-source-card__meta">
        <span v-if="metadataText">{{ metadataText }}</span>
      </div>

      <div v-if="showMeta && !metadataText" class="feed-source-card__meta">
        <span data-test="feed-source-count">{{ compactCount(source.subscriptionCount) }} 订阅</span>
        <span>{{ source.recentItemCount }} 近期</span>
        <span>{{ formattedLastUpdated }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

import { Check, Plus } from 'lucide-vue-next'
import { computed, useAttrs } from 'vue'

import type { FeedExploreSource } from '@/types'

const props = withDefaults(defineProps<{
  source: FeedExploreSource
  color: string
  avatarLabel: string
  displayUrl: string
  subscribeBusy?: boolean
  imageUrl?: string
  eyebrow?: string
  summaryText?: string
  metadataText?: string
  showSubscribe?: boolean
  showPreviews?: boolean
  showMeta?: boolean
  compact?: boolean
  variant?: 'default' | 'recommend'
}>(), {
  imageUrl: undefined,
  eyebrow: '',
  summaryText: '',
  metadataText: '',
  showSubscribe: true,
  showPreviews: true,
  showMeta: true,
  compact: false,
  variant: 'default',
})

const emit = defineEmits<{
  (e: 'select', source: FeedExploreSource): void
  (e: 'subscribe', source: FeedExploreSource): void
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

const subscribeButtonLabel = computed(() => {
  if (props.source.subscribed) return '已订阅'
  if (props.subscribeBusy) return '订阅中'
  return '订阅'
})

const compactCount = (value: number) => {
  if (value >= 10000) return `${Math.round(value / 1000) / 10}万`
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(value)
}
</script>

<style scoped>
.feed-source-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.feed-source-card:hover,
.feed-source-card:focus-visible {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: inset 4px 0 0 var(--a-color-text), var(--a-shadow-sm);
}

.feed-source-card__visual {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.feed-source-card__avatar {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: color-mix(in srgb, var(--feed-source-color) 18%, var(--a-color-bg));
  color: color-mix(in srgb, var(--feed-source-color) 72%, var(--a-color-fg));
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 600;
  overflow: hidden;
}

.feed-source-card__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-source-card__main {
  display: grid;
  min-width: 0;
  gap: 0.65rem;
  padding: 1rem;
}

.feed-source-card__topline {
  display: grid;
  min-width: 0;
}

.feed-source-card__copy {
  min-width: 0;
}

.feed-source-card__eyebrow {
  margin: 0 0 0.3rem;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.7rem;
  font-weight: 600;
}

.feed-source-card__copy h3 {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--a-color-fg);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-source-card__url,
.feed-source-card__summary {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.feed-source-card__url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-source-card__summary {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-source-card__subscribe {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-width: 5.75rem;
  min-height: 2.25rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.feed-source-card:hover .feed-source-card__subscribe,
.feed-source-card:focus-within .feed-source-card__subscribe {
  opacity: 1;
  pointer-events: auto;
}

.feed-source-card__subscribe:hover:not(:disabled) {
  box-shadow: var(--a-shadow-sm);
  transform: translate(-50%, -50%) translateY(-1px);
}

.feed-source-card__subscribe.is-subscribed,
.feed-source-card__subscribe:disabled {
  color: var(--a-color-success);
  border-color: color-mix(in srgb, var(--a-color-success) 45%, var(--a-color-border-soft));
  cursor: default;
}

.feed-source-card__previews {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  color: var(--a-color-fg);
  font-size: 0.8rem;
  line-height: 1.45;
  list-style: none;
}

.feed-source-card__previews li {
  position: relative;
  min-width: 0;
  overflow: hidden;
  padding-left: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-source-card__previews li::before {
  position: absolute;
  top: 0.65em;
  left: 0.1rem;
  width: 0.25rem;
  height: 0.25rem;
  border-radius: 50%;
  background: var(--a-color-muted-soft);
  content: "";
}

.feed-source-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.85rem;
  color: var(--a-color-muted-soft);
  font-family: var(--a-font-sans);
  font-size: 0.7rem;
  font-weight: 500;
}

.feed-source-card.is-compact {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.7rem;
  border-radius: var(--a-radius-control);
}

.feed-source-card.is-compact .feed-source-card__visual {
  aspect-ratio: 1;
  border-radius: var(--a-radius-control);
}

.feed-source-card.is-compact .feed-source-card__main {
  gap: 0.35rem;
  padding: 0;
}

.feed-source-card.is-compact .feed-source-card__subscribe {
  min-width: 4.5rem;
  min-height: 2rem;
  font-size: 0.7rem;
}

.feed-source-card.is-recommend {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

@media (max-width: 640px) {
  .feed-source-card__subscribe {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
