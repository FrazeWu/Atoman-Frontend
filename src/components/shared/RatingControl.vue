<template>
  <section
    class="rating-control"
    :class="`rating-control--${size}`"
    :aria-label="ariaLabel"
    :aria-busy="loading"
  >
    <span class="rating-control__prefix">评分</span>
    <div class="rating-control__summary">
      <template v-if="publicRatingVisible">
        <strong class="rating-control__public-score">{{ normalizedPublicScore.toFixed(1) }} / 10</strong>
        <span>· {{ normalizedRatingCount }} 人</span>
      </template>
      <span v-else class="rating-control__insufficient">
        评分人数不足（{{ normalizedRatingCount }}/{{ PUBLIC_RATING_MIN_COUNT }}）
      </span>
    </div>

    <div class="rating-control__stars" role="group" aria-label="选择评分" @mouseleave="hoverScore = null">
      <span v-for="star in 5" :key="star" class="rating-control__star">
        <Star :size="iconSize" class="rating-control__star-outline" aria-hidden="true" />
        <span
          class="rating-control__star-fill"
          :style="{ width: `${fillWidth(star)}px` }"
          aria-hidden="true"
        >
          <Star :size="iconSize" fill="currentColor" />
        </span>
        <button
          v-for="score in [star * 2 - 1, star * 2]"
          :key="score"
          type="button"
          class="rating-control__score-target"
          :class="score % 2 ? 'rating-control__score-target--left' : 'rating-control__score-target--right'"
          :data-score="score"
          :aria-label="scoreLabel(score)"
          :disabled="disabled || loading"
          @mouseenter="hoverScore = score"
          @focus="hoverScore = score"
          @blur="hoverScore = null"
          @click="rate(score)"
          @keydown="handleKeydown($event, score)"
        />
      </span>
    </div>

    <button
      v-if="!disabled && viewerRating !== null && viewerRating !== undefined"
      type="button"
      class="rating-control__clear"
      :disabled="loading"
      aria-label="清除评分"
      title="清除评分"
      @click="emit('clear')"
    >
      <X :size="15" aria-hidden="true" />
    </button>

    <div class="rating-control__meta" aria-live="polite">
      <span v-if="hoverScore !== null" class="rating-control__preview">{{ formatViewerRating(hoverScore) }}</span>
      <span v-else-if="viewerRating !== null && viewerRating !== undefined" class="rating-control__mine">
        我的评分 {{ formatViewerRating(viewerRating) }}
      </span>
      <RouterLink v-else-if="disabled" class="rating-control__login" to="/login">登录后评分</RouterLink>
      <span v-if="errorMessage" class="rating-control__error" role="alert">{{ errorMessage }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconStar as Star, IconX as X } from '@tabler/icons-vue'

import {
  PUBLIC_RATING_MIN_COUNT,
  formatViewerRating,
  hasPublicRating,
  scoreToStars,
} from '@/utils/rating'

const props = withDefaults(defineProps<{
  ratingScore?: number | null
  ratingCount?: number | null
  viewerRating?: number | null
  disabled?: boolean
  loading?: boolean
  errorMessage?: string
  size?: 'compact' | 'regular'
  ariaLabel?: string
}>(), {
  ratingScore: 0,
  ratingCount: 0,
  viewerRating: null,
  disabled: false,
  loading: false,
  errorMessage: '',
  size: 'regular',
  ariaLabel: '内容评分',
})

const emit = defineEmits<{
  rate: [score: number]
  clear: []
}>()

const hoverScore = ref<number | null>(null)
const activeScore = computed(() => hoverScore.value ?? props.viewerRating ?? 0)
const normalizedRatingCount = computed(() => Math.max(0, Number(props.ratingCount || 0)))
const normalizedPublicScore = computed(() => Math.max(0, Math.min(10, Number(props.ratingScore || 0))))
const publicRatingVisible = computed(() => hasPublicRating(normalizedRatingCount.value))
const iconSize = computed(() => props.size === 'compact' ? 16 : 22)

watch(() => props.loading, (loading) => {
  if (loading) hoverScore.value = null
})

function fillWidth(star: number): number {
  const score = Math.max(0, Math.min(10, activeScore.value))
  return Math.max(0, Math.min(1, (score - (star - 1) * 2) / 2)) * iconSize.value
}

function scoreLabel(score: number): string {
  return `${score} 分，${scoreToStars(score)} 星`
}

function rate(score: number) {
  hoverScore.value = null
  emit('rate', score)
}

function handleKeydown(event: KeyboardEvent, score: number) {
  if (event.key !== 'Home' && event.key !== 'End' && !event.key.startsWith('Arrow')) return
  event.preventDefault()
  const nextScore = event.key === 'Home'
    ? 1
    : event.key === 'End'
      ? 10
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? Math.max(1, score - 1)
        : Math.min(10, score + 1)
  rate(nextScore)
}
</script>

<style scoped>
.rating-control {
  display: flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  color: var(--a-color-muted);
  font-size: var(--a-text-sm);
}

.rating-control__prefix {
  color: var(--a-color-muted);
  font-weight: 600;
  white-space: nowrap;
}

.rating-control__summary {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.rating-control__public-score {
  color: #b45309;
  font-size: 1.1rem;
  line-height: 1;
}

.rating-control__insufficient {
  color: var(--a-color-muted-soft);
  font-size: 0.78rem;
}

.rating-control__stars {
  display: inline-flex;
  align-items: center;
}

.rating-control__star {
  position: relative;
  display: inline-grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: var(--a-color-border);
}

.rating-control__star-outline,
.rating-control__star-fill {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.rating-control__star-fill {
  left: calc(50% - 11px);
  overflow: hidden;
  color: #d97706;
  transform: translateY(-50%);
}

.rating-control__score-target {
  position: absolute;
  z-index: 1;
  top: 0;
  width: 50%;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.rating-control__score-target--left {
  left: 0;
}

.rating-control__score-target--right {
  right: 0;
}

.rating-control__score-target:disabled {
  cursor: default;
}

.rating-control__score-target:focus-visible,
.rating-control__clear:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 1px;
}

.rating-control__clear {
  display: inline-grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.rating-control__clear:hover:not(:disabled) {
  color: var(--a-color-fg);
}

.rating-control__meta {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
}

.rating-control__preview,
.rating-control__mine {
  color: var(--a-color-muted);
  white-space: nowrap;
}

.rating-control__preview {
  color: #b45309;
}

.rating-control__login {
  color: var(--a-color-fg);
  text-decoration: underline;
  white-space: nowrap;
}

.rating-control__error {
  color: var(--a-color-danger, #b91c1c);
}

.rating-control--compact {
  gap: 0.2rem 0.35rem;
}

.rating-control--compact .rating-control__prefix {
  display: none;
}

.rating-control--compact .rating-control__public-score {
  font-size: var(--a-text-sm);
}

.rating-control--compact .rating-control__star {
  width: 28px;
}

.rating-control--compact .rating-control__star-fill {
  left: calc(50% - 8px);
}

@media (max-width: 640px) {
  .rating-control__meta {
    width: 100%;
  }
}
</style>
