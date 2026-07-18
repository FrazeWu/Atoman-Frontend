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
    <div class="feed-source-card__avatar" data-test="feed-source-avatar" :style="{ '--feed-source-color': color }">
      <img v-if="imageUrl" :src="imageUrl" :alt="source.title" class="feed-source-card__avatar-image" />
      <template v-else>{{ avatarLabel }}</template>
    </div>

    <div class="feed-source-card__main">
      <div class="feed-source-card__topline">
        <div class="feed-source-card__copy">
          <p v-if="eyebrow" class="feed-source-card__eyebrow" data-test="feed-source-eyebrow">{{ eyebrow }}</p>
          <h3 data-test="feed-source-title">{{ source.title }}</h3>
          <p v-if="displayUrl" class="feed-source-card__url" data-test="feed-source-url">{{ displayUrl }}</p>
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
          {{ subscribeButtonLabel }}
        </button>
      </div>

      <p v-if="summaryText" class="feed-source-card__summary">
        {{ summaryText }}
      </p>

      <p v-else class="feed-source-card__summary">
        {{ source.subscriptionCount }} 位订阅 · {{ source.recentItemCount }} 篇近期内容 · {{ formattedLastUpdated }}
      </p>

      <ul v-if="showPreviews && source.recentItems.length" class="feed-source-card__previews">
        <li v-for="item in source.recentItems.slice(0, 3)" :key="item.id" data-test="feed-source-preview-title">
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
  width: 100%;
  display: grid;
  grid-template-columns: 4.25rem minmax(0, 1fr);
  gap: 1.1rem;
  align-items: start;
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-left: 3px solid color-mix(in srgb, var(--feed-source-color, var(--a-color-border)) 24%, var(--a-color-border-soft));
  background: var(--a-color-bg);
  color: inherit;
  text-align: left;
  border-radius: 4px;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  cursor: pointer;
}

.feed-source-card:hover,
.feed-source-card:focus-visible {
  border-left-color: color-mix(in srgb, var(--feed-source-color, var(--a-color-text)) 68%, var(--a-color-text));
  box-shadow: var(--a-shadow-sm);
}

.feed-source-card__meta {
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
}

.feed-source-card__avatar {
  display: grid;
  place-items: center;
  width: 4.25rem;
  height: 4.25rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--feed-source-color) 18%, white);
  color: color-mix(in srgb, var(--feed-source-color) 72%, black);
  font-size: 1.35rem;
  font-weight: 500;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--feed-source-color) 22%, white);
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
  gap: 0.75rem;
}

.feed-source-card__topline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: start;
}

.feed-source-card__copy {
  min-width: 0;
}

.feed-source-card__eyebrow {
  margin: 0 0 0.3rem;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
}

.feed-source-card__copy h3 {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 500;
  line-height: 1.35;
}

.feed-source-card__url {
  margin: 0.3rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.84rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.feed-source-card__subscribe {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 5.5rem;
  min-height: 2rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--a-color-border);
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  font-family: var(--a-font-sans);
  font-size: 0.74rem;
  font-weight: 500;
  letter-spacing: 0;
  cursor: pointer;
}

.feed-source-card__subscribe.is-subscribed,
.feed-source-card__subscribe:disabled {
  color: var(--a-color-muted);
  background: var(--a-color-bg);
  cursor: default;
}

.feed-source-card__summary {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.88rem;
  line-height: 1.55;
}

.feed-source-card__previews {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--a-color-fg);
  font-size: 0.9rem;
  line-height: 1.45;
}

.feed-source-card__previews li {
  position: relative;
  min-width: 0;
  padding-left: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-source-card__previews li::before {
  content: "";
  position: absolute;
  left: 0.1rem;
  top: 0.72em;
  width: 0.25rem;
  height: 0.25rem;
  border-radius: 4px;
  background: var(--a-color-muted-soft);
}

.feed-source-card__meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, max-content));
  align-items: center;
  gap: 1.5rem;
  color: var(--a-color-muted-soft);
}

.feed-source-card.is-compact {
  padding: 1rem 1.1rem;
}

.feed-source-card.is-compact .feed-source-card__main {
  gap: 0.4rem;
}

.feed-source-card.is-compact .feed-source-card__copy h3 {
  font-size: 0.98rem;
}

.feed-source-card.is-recommend {
  border-radius: 0;
  background: var(--a-color-bg);
  box-shadow: none;
}

.feed-source-card.is-recommend .feed-source-card__avatar {
  border-radius: 0;
  box-shadow: inset 0 0 0 1px var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
}

@media (max-width: 640px) {
  .feed-source-card {
    grid-template-columns: 3.25rem minmax(0, 1fr);
    gap: 0.85rem;
    padding: 1rem;
  }

  .feed-source-card__avatar {
    width: 3.25rem;
    height: 3.25rem;
    font-size: 1.05rem;
  }

  .feed-source-card__topline {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.65rem;
  }

  .feed-source-card__subscribe {
    width: fit-content;
    min-width: 4.5rem;
  }

  .feed-source-card__meta {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
}
</style>
