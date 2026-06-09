<template>
  <section class="kanbo-section">
    <div class="kanbo-section-head">
      <h2>视频</h2>
    </div>
    <div class="kanbo-video-grid">
      <article v-for="video in items" :key="video.id" class="a-card-sm kanbo-video-card">
        <div class="kanbo-video-cover">{{ video.cover_url ? '封面' : 'VIDEO' }}</div>
        <h3>{{ video.title }}</h3>
        <p class="a-muted">{{ video.updated_at }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { KanboVideoItem } from '@/composables/useKanboOverview'

withDefaults(defineProps<{
  items?: KanboVideoItem[]
}>(), {
  items: () => [],
})
</script>
