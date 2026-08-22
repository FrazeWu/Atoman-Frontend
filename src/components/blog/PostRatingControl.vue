<template>
  <section class="post-rating" aria-label="文章评分">
    <div class="post-rating__summary">
      <span class="post-rating__label">评分</span>
      <strong>{{ formattedScore }}</strong>
      <span class="post-rating__count">({{ ratingCount }})</span>
    </div>

    <div v-if="!disabled" class="post-rating__control" @mouseleave="hoverScore = null">
      <div v-for="star in 5" :key="star" class="post-rating__star">
        <Star :size="24" class="post-rating__star-outline" aria-hidden="true" />
        <span class="post-rating__star-fill" :style="{ width: `${fillWidth(star)}%` }" aria-hidden="true">
          <Star :size="24" fill="currentColor" />
        </span>
        <button
          type="button"
          class="post-rating__half post-rating__half--left"
          :aria-label="`${star * 2 - 1} 分`"
          :disabled="loading"
          @mouseenter="hoverScore = star * 2 - 1"
          @focus="hoverScore = star * 2 - 1"
          @click="emit('rate', star * 2 - 1)"
        />
        <button
          type="button"
          class="post-rating__half post-rating__half--right"
          :aria-label="`${star * 2} 分`"
          :disabled="loading"
          @mouseenter="hoverScore = star * 2"
          @focus="hoverScore = star * 2"
          @click="emit('rate', star * 2)"
        />
      </div>
      <button
        v-if="viewerRating !== null && viewerRating !== undefined"
        type="button"
        class="post-rating__clear"
        :disabled="loading"
        aria-label="清除评分"
        title="清除评分"
        @click="emit('clear')"
      >
        <X :size="16" aria-hidden="true" />
      </button>
    </div>

    <span v-if="viewerRating !== null && viewerRating !== undefined" class="post-rating__mine">
      我的评分 {{ viewerRating }}
    </span>
    <RouterLink v-else-if="disabled" to="/login" class="post-rating__login">登录后评分</RouterLink>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  ratingScore?: number
  ratingCount?: number
  viewerRating?: number | null
  disabled?: boolean
  loading?: boolean
}>(), {
  ratingScore: 0,
  ratingCount: 0,
  viewerRating: null,
  disabled: false,
  loading: false,
})

const emit = defineEmits<{
  rate: [score: number]
  clear: []
}>()

const hoverScore = ref<number | null>(null)
const activeScore = computed(() => hoverScore.value ?? props.viewerRating ?? Math.round(props.ratingScore * 2) / 2)
const formattedScore = computed(() => props.ratingCount ? props.ratingScore.toFixed(1) : '—')

function fillWidth(star: number) {
  const remainder = activeScore.value - (star - 1) * 2
  return Math.max(0, Math.min(2, remainder)) * 50
}
</script>

<style scoped>
.post-rating {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  padding: 1rem 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.post-rating__summary,
.post-rating__control {
  display: inline-flex;
  align-items: center;
}

.post-rating__summary {
  gap: 0.35rem;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.post-rating__summary strong {
  color: var(--a-color-fg);
  font-size: 1rem;
  font-weight: 650;
}

.post-rating__count {
  color: var(--a-color-muted-soft);
}

.post-rating__control {
  gap: 0.15rem;
}

.post-rating__star {
  position: relative;
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  color: var(--a-color-border);
}

.post-rating__star-outline,
.post-rating__star-fill {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 24px;
  height: 24px;
}

.post-rating__star-fill {
  overflow: hidden;
  color: var(--a-color-accent);
  pointer-events: none;
}

.post-rating__half {
  position: absolute;
  top: 0;
  z-index: 1;
  width: 50%;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.post-rating__half--left { left: 0; }
.post-rating__half--right { right: 0; }
.post-rating__half:focus-visible,
.post-rating__clear:focus-visible {
  outline: 2px solid var(--a-color-focus, var(--a-color-fg));
  outline-offset: 2px;
}

.post-rating__clear {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-left: 0.35rem;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 50%;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
}

.post-rating__clear:hover:not(:disabled) {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
}

.post-rating__mine,
.post-rating__login {
  color: var(--a-color-muted);
  font-size: 0.78rem;
}

.post-rating__login {
  color: var(--a-color-fg);
  text-decoration: underline;
}
</style>
