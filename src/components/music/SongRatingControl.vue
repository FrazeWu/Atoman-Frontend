<template>
  <section class="song-rating" :class="`song-rating--${size}`" :aria-label="`${songTitle} 评分`">
    <div class="song-rating__summary">
      <template v-if="ratingCount">
        <span class="song-rating__label">评分</span>
        <strong class="song-rating__score">{{ ratingScore.toFixed(1) }}</strong>
        <span class="song-rating__count">（{{ ratingCount }} 人）</span>
      </template>
      <span v-else class="song-rating__insufficient">暂无评分</span>
    </div>
    <div class="song-rating__stars" @mouseleave="hoverScore = null">
      <button
        v-for="star in 5"
        :key="star"
        type="button"
        class="song-rating__star"
        :disabled="disabled || loading"
        :aria-label="`${songTitle} ${star} 星`"
        @mouseenter="hoverScore = star"
        @focus="hoverScore = star"
        @blur="hoverScore = null"
        @click="emit('rate', star)"
      >
        <Star :size="iconSize" class="song-rating__star-outline" aria-hidden="true" />
        <span
          class="song-rating__star-fill"
          :style="{ width: `${fillWidth(star)}px`, left: `calc(50% - ${iconSize / 2}px)` }"
          aria-hidden="true"
        >
          <Star :size="iconSize" fill="currentColor" />
        </span>
      </button>
    </div>
    <RouterLink v-if="disabled" class="song-rating__login" to="/login">登录后评分</RouterLink>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  songTitle: string
  ratingScore?: number
  ratingCount?: number
  viewerRating?: number | null
  disabled?: boolean
  loading?: boolean
  size?: 'compact' | 'regular'
}>(), {
  ratingScore: 0,
  ratingCount: 0,
  viewerRating: null,
  disabled: false,
  loading: false,
  size: 'regular',
})

const emit = defineEmits<{
  rate: [score: number]
}>()

const hoverScore = ref<number | null>(null)
const activeScore = computed(() => {
  const score = hoverScore.value ?? props.viewerRating ?? 0
  return Math.max(0, Math.min(5, score))
})
const iconSize = computed(() => props.size === 'compact' ? 14 : 18)

function fillWidth(star: number) {
  return Math.max(0, Math.min(1, activeScore.value - (star - 1))) * iconSize.value
}
</script>

<style scoped>
.song-rating { display: inline-flex; align-items: center; min-height: 2.25rem; gap: 0.35rem; color: var(--a-color-muted); font-size: var(--a-text-sm); }
.song-rating__summary { display: inline-flex; align-items: baseline; gap: 0.2rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
.song-rating__label, .song-rating__insufficient, .song-rating__count { color: var(--a-color-muted); }
.song-rating__score { color: #b45309; font-size: 1.15rem; font-weight: 750; line-height: 1; }
.song-rating__stars { display: inline-flex; align-items: center; }
.song-rating__star { position: relative; display: inline-grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 0; background: transparent; color: var(--a-color-border); cursor: pointer; transition: color 0.15s ease, transform 0.15s ease; }
.song-rating--compact { gap: 0.15rem; }
.song-rating--compact .song-rating__label { display: none; }
.song-rating--compact .song-rating__score { font-size: var(--a-text-sm); }
.song-rating--compact .song-rating__star { width: 1.5rem; height: 1.75rem; }
.song-rating__star-outline { position: absolute; top: 50%; left: 50%; pointer-events: none; transform: translate(-50%, -50%); }
.song-rating__star-fill { position: absolute; top: 50%; overflow: hidden; color: #d97706; pointer-events: none; transform: translateY(-50%); }
.song-rating__star:hover:not(:disabled), .song-rating__star:focus-visible { color: #b45309; transform: scale(1.08); }
.song-rating__star:disabled { cursor: default; }
.song-rating__star:focus-visible { outline: 2px solid var(--a-color-fg); outline-offset: 2px; }
.song-rating__login { color: var(--a-color-muted); text-decoration: underline; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .song-rating__star { transition: none; } }
</style>
