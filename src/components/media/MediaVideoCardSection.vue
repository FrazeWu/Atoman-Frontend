<template>
  <section class="media-section">
    <div class="media-section-head">
      <h2>视频</h2>
    </div>
    <div class="media-video-grid">
      <RouterLink
        v-for="video in items"
        :key="video.id"
        :to="modulePathUrl('media', `/videos/watch/${video.id}`)"
        class="a-card-sm media-video-card"
      >
        <div class="media-video-cover">{{ video.cover_url ? '封面' : 'VIDEO' }}</div>
        <h3>{{ video.title }}</h3>
        <p class="a-muted">{{ video.updated_at }}</p>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { MediaVideoItem } from '@/composables/useMediaOverview'
import { modulePathUrl } from '@/router/siteUrls'

withDefaults(defineProps<{
  items?: MediaVideoItem[]
}>(), {
  items: () => [],
})
</script>
