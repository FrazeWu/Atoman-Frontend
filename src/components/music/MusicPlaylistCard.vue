<template>
  <article class="music-playlist-card" @click="$emit('click')">
    <div class="cover-frame">
      <img v-if="playlist.cover_url" :src="playlist.cover_url" :alt="playlist.title" loading="lazy" />
      <div v-else class="cover-placeholder" aria-hidden="true">
        <ListMusic :size="28" />
      </div>
    </div>
    <div class="playlist-info">
      <h3 :title="playlist.title">{{ playlist.title }}</h3>
      <p v-if="playlist.description" class="playlist-description">{{ playlist.description }}</p>
      <p class="playlist-stats">{{ playlist.song_count || 0 }} 首歌曲</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ListMusic } from 'lucide-vue-next'

defineProps<{
  playlist: {
    id: string
    title: string
    cover_url?: string
    description?: string
    song_count?: number
  }
}>()

defineEmits<{ (event: 'click'): void }>()
</script>

<style scoped>
.music-playlist-card { min-width: 0; cursor: pointer; }
.cover-frame { position: relative; aspect-ratio: 1; overflow: hidden; border: 1px solid var(--a-color-line-soft); border-radius: 8px; background: var(--a-color-surface); }
.cover-frame img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s ease; }
.music-playlist-card:hover img { transform: scale(1.03); }
.cover-placeholder { position: absolute; inset: 0; display: grid; place-items: center; color: var(--a-color-muted); }
.playlist-info { padding-top: 10px; }
.playlist-info h3 { margin: 0 0 0.25rem; overflow: hidden; color: var(--a-color-fg); font-size: 0.95rem; font-weight: 800; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.playlist-info p { margin: 0; overflow: hidden; color: var(--a-color-muted-soft); font-size: 0.775rem; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.playlist-description { margin-bottom: 0.2rem !important; }
.playlist-stats { font-variant-numeric: tabular-nums; }
</style>
