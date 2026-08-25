<template>
  <section class="post-rating" :class="`post-rating--${size}`" aria-label="文章评分">
    <!-- 综合评分与统计 -->
    <div class="post-rating__summary">
      <span class="post-rating__label">评分</span>
      <strong class="post-rating__score-num">{{ formattedScore }}</strong>
      <span class="post-rating__count">({{ ratingCount }})</span>
    </div>

    <!-- 交互打分星星区域（只读或交互态） -->
    <div
      class="post-rating__control"
      :class="{ 'is-readonly': disabled }"
      @mouseleave="disabled ? null : (hoverScore = null)"
    >
      <div
        v-for="star in 5"
        :key="star"
        class="post-rating__star"
        :class="{ 'is-animating': lastRatedStar === star }"
      >
        <Star :size="starIconSize" class="post-rating__star-outline" aria-hidden="true" />
        <span class="post-rating__star-fill" :style="{ width: `${fillWidth(star)}px` }" aria-hidden="true">
          <Star :size="starIconSize" fill="currentColor" />
        </span>
        <template v-if="!disabled">
          <button
            type="button"
            class="post-rating__half post-rating__half--left"
            :aria-label="`${formatStarScore(star * 2 - 1)} 星`"
            :disabled="loading"
            @mouseenter="hoverScore = star * 2 - 1"
            @focus="hoverScore = star * 2 - 1"
            @click="handleRate(star * 2 - 1, star)"
            @keydown="handleKeydown($event, star * 2 - 1)"
          />
          <button
            type="button"
            class="post-rating__half post-rating__half--right"
            :aria-label="`${formatStarScore(star * 2)} 星`"
            :disabled="loading"
            @mouseenter="hoverScore = star * 2"
            @focus="hoverScore = star * 2"
            @click="handleRate(star * 2, star)"
            @keydown="handleKeydown($event, star * 2)"
          />
        </template>
      </div>

      <!-- 清除按钮 -->
      <button
        v-if="!disabled && viewerRating !== null && viewerRating !== undefined"
        type="button"
        class="post-rating__clear"
        :disabled="loading"
        aria-label="清除评分"
        title="清除评分"
        @click="emit('clear')"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </div>

    <label v-if="!disabled" class="post-rating__slider">
      <span class="sr-only">选择 0.5 至 5 星评分</span>
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        :value="activeScore"
        :disabled="loading"
        aria-label="选择 0.5 至 5 星评分"
        @input="hoverScore = Number(($event.target as HTMLInputElement).value)"
        @change="handleRate(Number(($event.target as HTMLInputElement).value), Math.ceil(Number(($event.target as HTMLInputElement).value) / 2))"
      >
      <output aria-live="polite">{{ formatStarScore(activeScore) }} 星</output>
    </label>

    <!-- 动态分值提示与评分标准说明 -->
    <div class="post-rating__meta-box">
      <!-- 分数展示 -->
      <span v-if="hoverScore !== null" class="post-rating__dynamic-score">
        {{ formatStarScore(hoverScore) }} 星
      </span>
      <span v-else-if="viewerRating !== null && viewerRating !== undefined" class="post-rating__mine">
        我的评分 {{ formatStarScore(viewerRating) }} 星
      </span>
      <span v-if="errorMessage" class="post-rating__error" role="alert">{{ errorMessage }}</span>
      <RouterLink v-else-if="disabled" to="/login" class="post-rating__login">
        登录后评分
      </RouterLink>

      <!-- 评分标准建议问号图标与悬浮浮层 -->
      <PHelpTooltip
        title="评分参考"
        kicker="3 星为合格"
        placement="top-end"
        aria-label="查看评分参考标准"
      >
        <ul class="guidelines-list">
          <li class="guidelines-item">
            <span class="score-badge is-top">4.5 - 5</span>
            <div class="score-desc">
              <strong>力荐</strong>
              <span>卓越之作，深度与启发性兼备</span>
            </div>
          </li>
          <li class="guidelines-item">
            <span class="score-badge is-high">3.5 - 4</span>
            <div class="score-desc">
              <strong>推荐</strong>
              <span>内容扎实，值得完整阅读</span>
            </div>
          </li>
          <li class="guidelines-item">
            <span class="score-badge is-pass">2.5 - 3</span>
            <div class="score-desc">
              <strong>及格 / 还行</strong>
              <span>达到合格基准，内容基本完整</span>
            </div>
          </li>
          <li class="guidelines-item">
            <span class="score-badge is-low">1.5 - 2</span>
            <div class="score-desc">
              <strong>一般</strong>
              <span>内容偏单薄，存在明显不足</span>
            </div>
          </li>
          <li class="guidelines-item">
            <span class="score-badge is-bad">0.5 - 1</span>
            <div class="score-desc">
              <strong>较差</strong>
              <span>质量欠佳，缺乏参考价值</span>
            </div>
          </li>
        </ul>
      </PHelpTooltip>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star, X } from 'lucide-vue-next'
import PHelpTooltip from '@/components/ui/PHelpTooltip.vue'

const props = withDefaults(defineProps<{
  ratingScore?: number
  ratingCount?: number
  viewerRating?: number | null
  disabled?: boolean
  loading?: boolean
  errorMessage?: string
  size?: 'sm' | 'md'
}>(), {
  ratingScore: 0,
  ratingCount: 0,
  viewerRating: null,
  disabled: false,
  loading: false,
  errorMessage: '',
  size: 'md',
})

const emit = defineEmits<{
  rate: [score: number]
  clear: []
}>()

const hoverScore = ref<number | null>(null)
const lastRatedStar = ref<number | null>(null)

const activeScore = computed(() => hoverScore.value ?? props.viewerRating ?? Math.round(props.ratingScore * 2) / 2)
const formattedScore = computed(() => props.ratingCount ? `${formatStarScore(props.ratingScore)} / 5` : '—')

const starIconSize = computed(() => props.size === 'sm' ? 18 : 22)

function formatStarScore(score: number) {
  return (score / 2).toFixed(1)
}

function fillWidth(star: number) {
  const score = Math.max(0, Math.min(10, activeScore.value))
  const iconPixel = starIconSize.value
  return Math.max(0, Math.min(1, (score - (star - 1) * 2) / 2)) * iconPixel
}

function handleRate(score: number, starIndex: number) {
  lastRatedStar.value = starIndex
  setTimeout(() => {
    lastRatedStar.value = null
  }, 400)
  emit('rate', score)
}

function handleKeydown(event: KeyboardEvent, score: number) {
  const key = event.key
  if (key === 'Home' || key === 'End' || key.startsWith('Arrow')) {
    event.preventDefault()
    const nextScore = key === 'Home'
      ? 1
      : key === 'End'
        ? 10
        : key === 'ArrowLeft' || key === 'ArrowDown'
          ? Math.max(1, score - 1)
          : Math.min(10, score + 1)
    emit('rate', nextScore)
  }
}
</script>

<style scoped>
.post-rating {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  padding: 0.85rem 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.post-rating--sm {
  padding: 0.5rem 0;
  gap: 0.45rem 0.75rem;
}

.post-rating__summary,
.post-rating__control,
.post-rating__meta-box {
  display: inline-flex;
  align-items: center;
}

.post-rating__summary {
  gap: 0.35rem;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.post-rating__score-num {
  color: var(--a-color-fg);
  font-size: 1.05rem;
  font-weight: 650;
  min-width: 1.8rem;
}

.post-rating__count {
  color: var(--a-color-muted-soft);
  font-size: 0.8rem;
}

.post-rating__control {
  gap: 0.2rem;
}

.post-rating__star {
  position: relative;
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  color: var(--a-color-border-soft);
  transition: transform 0.15s ease;
}

.post-rating--sm .post-rating__star {
  width: 40px;
  height: 40px;
}

.post-rating__star.is-animating {
  animation: starBounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes starBounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.post-rating__star-outline,
.post-rating__star-fill {
  position: absolute;
  top: 11px;
  left: 11px;
  pointer-events: none;
}

.post-rating--sm .post-rating__star-outline,
.post-rating--sm .post-rating__star-fill {
  top: 11px;
  left: 11px;
}

.post-rating__star-fill {
  overflow: hidden;
  color: #f59e0b;
  pointer-events: none;
}

.post-rating__half {
  position: absolute;
  top: 0;
  z-index: 1;
  width: 50%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.post-rating__half--left { left: 0; }
.post-rating__half--right { right: 0; }

.post-rating__half:focus-visible,
.post-rating__clear:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

.post-rating__clear {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-left: 0.25rem;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 50%;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.post-rating__clear:hover:not(:disabled) {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.post-rating__meta-box {
  gap: 0.45rem;
  margin-left: auto;
}

.post-rating__dynamic-score {
  font-size: 0.82rem;
  font-weight: 650;
  color: #d97706;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  padding: 0.15em 0.55em;
  border-radius: var(--a-radius-pill, 999px);
}

.post-rating__mine,
.post-rating__error {
  color: var(--a-color-muted);
  font-size: 0.78rem;
  font-weight: 500;
}

.post-rating__error {
  color: var(--a-color-danger, #b91c1c);
}

.post-rating__login {
  color: var(--a-color-fg);
  font-size: 0.78rem;
  text-decoration: underline;
}

.post-rating__slider {
  display: none;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.post-rating__slider .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.post-rating__slider input {
  flex: 1;
  min-width: 0;
  accent-color: #d97706;
}

.post-rating__slider output {
  min-width: 3.2rem;
  color: var(--a-color-fg);
  font-variant-numeric: tabular-nums;
}

@media (pointer: coarse) {
  .post-rating__slider {
    display: inline-flex;
  }
}

@media (prefers-reduced-motion: reduce) {
  .post-rating__star,
  .post-rating__clear {
    transition: none;
  }

  .post-rating__star.is-animating {
    animation: none;
  }
}

/* 评分指南内部条目样式（承载于 PHelpTooltip 中） */
.guidelines-list {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.guidelines-item {
  display: grid;
  grid-template-columns: 2.75rem 1fr;
  gap: 0.5rem;
  align-items: center;
}

.score-badge {
  display: inline-block;
  text-align: center;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.1em 0.3em;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.score-badge.is-top {
  background: #fef3c7;
  color: #b45309;
}

.score-badge.is-high {
  background: #ecfdf5;
  color: #047857;
}

.score-badge.is-pass {
  background: #eff6ff;
  color: #1d4ed8;
}

.score-badge.is-low {
  background: #f3f4f6;
  color: #4b5563;
}

.score-badge.is-bad {
  background: #fef2f2;
  color: #b91c1c;
}

.score-desc {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.score-desc strong {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

.score-desc span {
  font-size: 0.66rem;
  color: var(--a-color-muted);
}
</style>
