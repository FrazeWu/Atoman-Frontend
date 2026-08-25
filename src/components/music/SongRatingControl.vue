<template>
  <section class="song-rating" :class="`song-rating--${size}`" :aria-label="`${songTitle} 评分`">
    <div class="song-rating__stars" @mouseleave="hoverScore = null">
      <button
        v-for="star in 5"
        :key="star"
        type="button"
        class="song-rating__star"
        :class="{ 'is-filled': star <= activeScore }"
        :disabled="disabled || loading"
        :aria-label="`${songTitle} ${star} 星`"
        @mouseenter="hoverScore = star"
        @focus="hoverScore = star"
        @blur="hoverScore = null"
        @click="emit('rate', star)"
      >
        <Star :size="iconSize" :fill="star <= activeScore ? 'currentColor' : 'none'" aria-hidden="true" />
      </button>
    </div>
    <span v-if="ratingCount" class="song-rating__summary">{{ ratingScore.toFixed(1) }} · {{ ratingCount }}</span>
    <span v-else class="song-rating__summary">暂无评分</span>
    <button
      v-if="viewerRating && !disabled"
      type="button"
      class="song-rating__clear"
      :disabled="loading"
      :aria-label="`清除 ${songTitle} 的评分`"
      title="清除评分"
      @click="emit('clear')"
    >
      <X :size="size === 'compact' ? 12 : 14" aria-hidden="true" />
    </button>
    <RouterLink v-if="disabled" class="song-rating__login" to="/login">登录后评分</RouterLink>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star, X } from 'lucide-vue-next'

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
  clear: []
}>()

const hoverScore = ref<number | null>(null)
const activeScore = computed(() => hoverScore.value ?? props.viewerRating ?? Math.round(props.ratingScore))
const iconSize = computed(() => props.size === 'compact' ? 14 : 18)
</script>

<style scoped>
.song-rating { display: inline-flex; align-items: center; min-height: 2.25rem; gap: 0.35rem; color: var(--a-color-muted); font-size: var(--a-text-sm); }
.song-rating__stars { display: inline-flex; align-items: center; }
.song-rating__star { display: inline-grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 0; background: transparent; color: var(--a-color-border); cursor: pointer; transition: color 0.15s ease, transform 0.15s ease; }
.song-rating--compact .song-rating__star { width: 1.5rem; height: 1.75rem; }
.song-rating__star.is-filled { color: #d97706; }
.song-rating__star:hover:not(:disabled), .song-rating__star:focus-visible { color: #b45309; transform: scale(1.08); }
.song-rating__star:disabled { cursor: default; }
.song-rating__star:focus-visible, .song-rating__clear:focus-visible { outline: 2px solid var(--a-color-fg); outline-offset: 2px; }
.song-rating__summary { white-space: nowrap; color: var(--a-color-muted); font-variant-numeric: tabular-nums; }
.song-rating__clear { display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--a-color-muted); cursor: pointer; }
.song-rating__clear:hover:not(:disabled) { color: var(--a-color-fg); background: var(--a-color-surface-muted); }
.song-rating__login { color: var(--a-color-muted); text-decoration: underline; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .song-rating__star { transition: none; } }
</style>
