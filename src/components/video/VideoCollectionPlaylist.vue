<script setup lang="ts">
import { Check, Play } from 'lucide-vue-next'
import { computed } from 'vue'

import type { Collection, Video } from '@/types'

const props = withDefaults(defineProps<{
  collection: Collection
  videos: Video[]
  currentVideoId: string
  completedVideoIds?: string[]
}>(), {
  completedVideoIds: () => [],
})

const emit = defineEmits<{
  select: [videoId: string]
}>()

const currentIndex = computed(() => {
  const index = props.videos.findIndex((video) => video.id === props.currentVideoId)
  return index >= 0 ? index + 1 : 0
})

function fmtDuration(seconds: number) {
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function isComplete(videoId: string) {
  return props.completedVideoIds.includes(videoId)
}
</script>

<template>
  <aside class="vcp" data-test="video-collection-playlist" :aria-label="`${collection.name} 播放列表`">
    <header class="vcp__header">
      <div>
        <p class="vcp__eyebrow">合集</p>
        <h2 class="vcp__title">{{ collection.name }}</h2>
      </div>
      <span class="vcp__count">{{ currentIndex }} / {{ videos.length }}</span>
    </header>

    <ol class="vcp__list">
      <li v-for="(item, index) in videos" :key="item.id" class="vcp__item" :class="{ 'is-current': item.id === currentVideoId }">
        <button
          type="button"
          class="vcp__item-button"
          :disabled="item.id === currentVideoId"
          :aria-current="item.id === currentVideoId ? 'true' : undefined"
          :aria-label="`${index + 1}. ${item.title}${item.id === currentVideoId ? '，正在播放' : ''}`"
          @click="emit('select', item.id)"
        >
          <span class="vcp__state" aria-hidden="true">
            <Play v-if="item.id === currentVideoId" :size="14" fill="currentColor" />
            <Check v-else-if="isComplete(item.id)" :size="14" />
            <span v-else>{{ index + 1 }}</span>
          </span>
          <span class="vcp__copy">
            <span class="vcp__item-title">{{ item.title }}</span>
            <span v-if="item.id === currentVideoId" class="vcp__status">正在播放</span>
            <span v-else-if="isComplete(item.id)" class="vcp__status">已看完</span>
          </span>
          <time v-if="item.duration_sec" class="vcp__duration">{{ fmtDuration(item.duration_sec) }}</time>
        </button>
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.vcp {
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
}

.vcp__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.vcp__eyebrow {
  margin: 0 0 0.2rem;
  color: var(--a-color-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.vcp__title {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 0.9rem;
  font-weight: 650;
  line-height: 1.35;
}

.vcp__count {
  flex: 0 0 auto;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.vcp__list {
  display: grid;
  max-height: min(34rem, calc(100dvh - 12rem));
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.vcp__item + .vcp__item {
  border-top: 1px solid var(--a-color-border-soft);
}

.vcp__item-button {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  align-items: center;
  width: 100%;
  min-height: 3.25rem;
  gap: 0.55rem;
  padding: 0.55rem 0.7rem;
  border: 0;
  border-left: 3px solid transparent;
  color: var(--a-color-fg);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.vcp__item-button:hover:not(:disabled),
.vcp__item-button:focus-visible {
  background: var(--a-color-surface-muted);
  outline: none;
}

.vcp__item-button:focus-visible {
  box-shadow: inset 0 0 0 2px var(--a-color-primary);
}

.vcp__item-button:disabled {
  cursor: default;
}

.is-current .vcp__item-button {
  border-left-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
}

.vcp__state {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.is-current .vcp__state {
  color: var(--a-color-primary);
}

.vcp__copy {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.vcp__item-title {
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 550;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vcp__status,
.vcp__duration {
  color: var(--a-color-muted);
  font-size: 0.7rem;
}

.vcp__duration {
  font-variant-numeric: tabular-nums;
}
</style>
