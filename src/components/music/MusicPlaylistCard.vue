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

      <button
        v-if="showBookmarkButton"
        type="button"
        class="bookmark-btn"
        :class="{ 'is-bookmarked': isBookmarked }"
        :aria-label="isBookmarked ? '取消收藏' : '收藏'"
        @click.stop="$emit('toggle-bookmark')"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          :fill="isBookmarked ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <div class="cover-stats" aria-label="歌单统计">
        <span class="cover-stat">
          <svg class="cover-stat__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
          {{ formattedPlayCount }}
        </span>
        <span class="cover-stat">
          <svg class="cover-stat__icon" viewBox="0 0 24 24" :fill="isBookmarked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          {{ formattedBookmarkCount }}
        </span>
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

const props = withDefaults(defineProps<{
  playlist: MusicPlaylistCardItem
  isBookmarked?: boolean
  showBookmarkButton?: boolean
}>(), {
  isBookmarked: false,
  showBookmarkButton: true,
})

defineEmits<{
  (e: 'click'): void
  (e: 'toggle-bookmark'): void
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
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  box-shadow: none;
  transition: border-color 0.2s, transform 0.2s;
}

.music-playlist-card:hover {
  transform: translateY(1px);
  border-color: var(--a-color-muted-soft);
}

.cover-frame {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--a-color-surface);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}

.bookmark-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 5;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.25s ease;
  box-shadow: var(--a-shadow-dropdown);
  padding: 0;
  opacity: 0;
}

.music-playlist-card:hover .bookmark-btn {
  opacity: 1;
}

.bookmark-btn:hover {
  background: var(--a-color-surface);
  color: var(--a-color-text);
}

.bookmark-btn.is-bookmarked {
  color: #eaaa08;
  border-color: #fce99f;
  background: #fefcf0;
}

.cover-stats {
  position: absolute;
  left: 0.6rem;
  right: 0.6rem;
  bottom: 0.6rem;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  pointer-events: none;
}

.cover-stat {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.28rem 0.46rem;
  border-radius: 999px;
  background: rgba(18, 18, 18, 0.62);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}

.cover-stat__icon {
  width: 0.82rem;
  height: 0.82rem;
  flex: 0 0 auto;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
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
  font-weight: 500;
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
