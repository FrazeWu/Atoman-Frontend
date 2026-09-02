<template>
  <PIdentityCard
    v-bind="rootAttrs"
    class="feed-source-card"
    :class="{
      'is-compact': compact,
      'is-recommend': variant === 'recommend',
    }"
    :compact="compact"
    interactive
    @activate="emit('select', source)"
  >
    <template #visual>
      <div class="feed-source-card__avatar" data-test="feed-source-avatar" :style="{ '--feed-source-color': color }">
        <img v-if="avatarImageURL" :src="avatarImageURL" :alt="source.title" class="feed-source-card__avatar-image" @error="advanceAvatarImage" />
        <template v-else>{{ avatarLabel }}</template>
      </div>
    </template>

    <template #title>
      <h3 data-test="feed-source-title" class="feed-source-card__title">{{ source.title }}</h3>
    </template>
    <template v-if="eyebrow" #badge>
      <span class="feed-source-card__tag" data-test="feed-source-eyebrow">{{ eyebrow }}</span>
    </template>
    <template #description>
      <p v-if="displayUrl && !summaryText" class="feed-source-card__url" data-test="feed-source-url">{{ displayUrl }}</p>
      <p v-if="summaryText" class="feed-source-card__summary">{{ summaryText }}</p>
      <p v-else-if="source.description" class="feed-source-card__summary">{{ source.description }}</p>
    </template>
    <template v-if="showSubscribe" #actions>
      <button
        type="button"
        class="feed-source-card__sub-btn"
        :class="{ 'is-subscribed': source.subscribed }"
        :disabled="source.subscribed || subscribeBusy"
        data-test="feed-source-subscribe"
        @click.stop="emit('subscribe', source)"
      >
        <Check v-if="source.subscribed" :size="13" aria-hidden="true" />
        <Plus v-else :size="13" aria-hidden="true" />
        <span>{{ subscribeButtonLabel }}</span>
      </button>
    </template>

    <template v-if="showPreviews && source.recentItems && source.recentItems.length" #previews>
      <ul class="feed-source-card__previews">
        <li v-for="item in source.recentItems.slice(0, 2)" :key="item.id" data-test="feed-source-preview-title">
          <span class="preview-bullet" aria-hidden="true">›</span>
          <span class="preview-title">{{ item.title }}</span>
        </li>
      </ul>
    </template>

    <template v-if="showMeta" #footer>
      <template v-if="metadataText">
        <span>{{ metadataText }}</span>
      </template>
      <template v-else>
        <span data-test="feed-source-count" class="footer-stat">
          <Users :size="12" aria-hidden="true" />
          {{ compactCount(source.subscriptionCount) }} 订阅
        </span>
        <span v-if="source.recentItemCount" class="footer-stat">
          <FileText :size="12" aria-hidden="true" />
          {{ source.recentItemCount }} 近期
        </span>
        <span v-if="formattedLastUpdated" class="footer-stat">
          <Clock :size="12" aria-hidden="true" />
          {{ formattedLastUpdated }}
        </span>
      </template>
    </template>
  </PIdentityCard>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

import { computed, ref, useAttrs, watch } from 'vue'
import { IconCheck as Check, IconClock as Clock, IconFileText as FileText, IconPlus as Plus, IconUsers as Users } from '@tabler/icons-vue'
import PIdentityCard from '@/components/ui/PIdentityCard.vue'
import type { FeedExploreSource } from '@/types'
import { buildSourceFaviconURL } from '@/utils/feedSourcePresentation'
import { resolveMediaURL } from '@/utils/mediaUrl'

const props = withDefaults(defineProps<{
  source: FeedExploreSource
  color: string
  avatarLabel: string
  displayUrl?: string
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
  displayUrl: '',
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

const avatarImageCandidates = computed(() => {
  const candidates = [
    props.imageUrl,
    props.source.coverUrl,
    buildSourceFaviconURL(props.source.rssUrl),
  ].map((value) => value?.trim() || '')
  return [...new Set(candidates.filter(Boolean))]
})
const avatarImageIndex = ref(0)
const avatarImageURL = computed(() => {
  const value = avatarImageCandidates.value[avatarImageIndex.value] || ''
  return value ? resolveMediaURL(value) : ''
})

function advanceAvatarImage() {
  avatarImageIndex.value += 1
}

watch(avatarImageCandidates, () => {
  avatarImageIndex.value = 0
})

const formattedLastUpdated = computed(() => {
  if (!props.source.lastPublishedAt) return ''
  return new Date(props.source.lastPublishedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + '更新'
})

const subscribeButtonLabel = computed(() => {
  if (props.source.subscribed) return '已订阅'
  if (props.subscribeBusy) return '处理中'
  return '订阅'
})

const compactCount = (value: number) => {
  if (value >= 10000) return `${Math.round(value / 1000) / 10}万`
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(value || 0)
}
</script>

<style scoped>
.feed-source-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  padding: 0.85rem 0.95rem;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
  outline: none;
}

.feed-source-card:hover,
.feed-source-card:focus-visible {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

/* 头部 */
.feed-source-card__avatar {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
  background: color-mix(in srgb, var(--feed-source-color) 18%, var(--a-color-bg));
  color: color-mix(in srgb, var(--feed-source-color) 75%, var(--a-color-fg));
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  font-weight: 650;
  overflow: hidden;
  flex-shrink: 0;
}

.feed-source-card__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-source-card__title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--a-color-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-source-card__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1em 0.45em;
  border-radius: var(--a-radius-control);
  font-size: 0.65rem;
  font-weight: 600;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.feed-source-card__url {
  margin: 0;
  font-size: 0.74rem;
  color: var(--a-color-muted-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-source-card__summary {
  margin: 0;
  font-size: 0.76rem;
  color: var(--a-color-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 常驻订阅按钮 */
.feed-source-card__sub-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.85rem;
  padding: 0 0.65rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.feed-source-card__sub-btn:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
}

.feed-source-card__sub-btn.is-subscribed,
.feed-source-card__sub-btn:disabled {
  color: #10b981;
  border-color: color-mix(in srgb, #10b981 40%, var(--a-color-border-soft));
  background: color-mix(in srgb, #10b981 8%, transparent);
  cursor: default;
}

/* 预览文章列表 */
.feed-source-card__previews {
  margin: 0;
  padding: 0.4rem 0.65rem;
  list-style: none;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
  display: grid;
  gap: 0.25rem;
}

.feed-source-card__previews li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.74rem;
  color: var(--a-color-fg);
  min-width: 0;
}

.preview-bullet {
  color: var(--a-color-muted-soft);
  font-weight: 600;
  flex-shrink: 0;
}

.preview-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部数据 */
.feed-source-card__footer {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 0.7rem;
  color: var(--a-color-muted-soft);
  padding-top: 0.1rem;
}

.footer-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

/* 紧凑变体适配 */
.feed-source-card.is-compact .feed-source-card__summary {
  -webkit-line-clamp: 1;
}
</style>
