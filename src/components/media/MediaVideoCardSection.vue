<template>
  <section class="media-section">
    <div class="media-section-head">
      <h2>视频</h2>
    </div>
    <div class="media-video-grid">
      <article v-for="video in items" :key="video.id" class="a-card-sm media-video-card">
        <div class="media-video-cover">{{ video.cover_url ? '封面' : 'VIDEO' }}</div>
        <h3>{{ video.title }}</h3>
        <p class="a-muted">{{ video.updated_at }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MediaVideoItem } from '@/composables/useMediaOverview'

withDefaults(defineProps<{
  items?: MediaVideoItem[]
}>(), {
  items: () => [],
})
</script>
