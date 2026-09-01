<script setup lang="ts">
import type { Video } from '@/types'

const props = defineProps<{
  videos: Video[]
}>()

function fmtDuration(seconds: number) {
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function sourceLabel(video: Video) {
  const channelName = video.channel?.name?.trim()
  const accountName = video.user?.username?.trim()
  return [channelName, accountName].filter(Boolean).join(' · ')
}
</script>

<template>
  <section v-if="videos.length" class="vrr" data-test="video-recommendations" aria-label="推荐视频">
    <header class="vrr__header">
      <h2>推荐视频</h2>
    </header>
    <div class="vrr__grid">
      <RouterLink v-for="item in videos" :key="item.id" class="vrr__card" :to="`/videos/watch/${item.id}`">
        <div class="vrr__thumbnail">
          <img v-if="item.thumbnail_url" :src="item.thumbnail_url" :alt="item.title" loading="lazy">
          <span v-else class="vrr__placeholder" aria-hidden="true" />
          <time v-if="item.duration_sec" class="vrr__duration">{{ fmtDuration(item.duration_sec) }}</time>
        </div>
        <h3 class="vrr__title">{{ item.title }}</h3>
        <p v-if="sourceLabel(item)" class="vrr__source">{{ sourceLabel(item) }}</p>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.vrr {
  min-width: 0;
}

.vrr__header {
  margin-bottom: 0.65rem;
}

.vrr__header h2 {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 0.95rem;
  font-weight: 650;
}

.vrr__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.vrr__card {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  color: inherit;
  text-decoration: none;
}

.vrr__thumbnail {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-surface-muted);
}

.vrr__thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 150ms ease;
}

.vrr__card:hover .vrr__thumbnail img,
.vrr__card:focus-visible .vrr__thumbnail img {
  transform: scale(1.03);
}

.vrr__card:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 3px;
}

.vrr__placeholder {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--a-color-surface-muted);
}

.vrr__duration {
  position: absolute;
  right: 0.3rem;
  bottom: 0.3rem;
  padding: 0.1rem 0.25rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.78);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.vrr__title {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--a-color-fg);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.vrr__source {
  overflow: hidden;
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .vrr__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
