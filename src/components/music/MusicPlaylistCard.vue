<template>
  <div
    class="music-playlist-card"
    @click="$emit('click')"
  >
    <div class="cover-frame">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="playlist.title"
        class="cover-image"
        loading="lazy"
      />
      <div v-else class="cover-placeholder">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    </div>

    <div class="playlist-info">
      <h3 class="playlist-title a-clamp-1" :title="displayTitle">{{ displayTitle }}</h3>
      <p class="playlist-summary a-clamp-2" :title="playlist.description || '歌单'">
        {{ playlist.description || '歌单' }}
      </p>
      <p class="playlist-count">
        <span>播放 {{ formattedPlayCount }}</span>
        <span>收藏 {{ formattedBookmarkCount }}</span>
        <span>{{ playlist.song_count }} 首</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface MusicPlaylistCardItem {
  id: string
  title: string
  description?: string
  cover_url?: string
  song_count: number
  owner_username?: string
  play_count?: number
  bookmark_count?: number
}

const props = defineProps<{
  playlist: MusicPlaylistCardItem
}>()

defineEmits<{
  (e: 'click'): void
}>()

const coverUrl = computed(() => props.playlist.cover_url || '')

const displayTitle = computed(() => {
  const owner = props.playlist.owner_username?.trim()
  return owner ? `${owner}/${props.playlist.title}` : props.playlist.title
})

const formattedPlayCount = computed(() => String(props.playlist.play_count ?? 0))
const formattedBookmarkCount = computed(() => String(props.playlist.bookmark_count ?? 0))
</script>

<style scoped>
.music-playlist-card {
  display: grid;
  gap: 0.75rem;
  color: inherit;
  cursor: pointer;
}

.cover-frame {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--a-color-surface);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--a-color-line-soft);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.music-playlist-card:hover .cover-image {
  transform: scale(1.03);
}

.cover-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08));
}

.playlist-info {
  display: grid;
  gap: 0.25rem;
}

.playlist-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--a-color-fg);
}

.playlist-summary {
  margin: 0;
  min-height: 2.4em;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--a-color-muted);
}

.playlist-count {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--a-color-muted-soft);
}
</style>
