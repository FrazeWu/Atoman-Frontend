<template>
  <div
    class="music-album-card"
    @click="$emit('click')"
  >
    <div class="cover-frame">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="album.title"
        class="cover-image"
        loading="lazy"
      />
      <div v-else class="cover-placeholder">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.25">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5z"/>
        </svg>
      </div>

      <!-- Bookmark Button on Top Right -->
      <button
        type="button"
        class="bookmark-btn"
        :class="{ 'is-bookmarked': isBookmarked }"
        @click.stop="$emit('toggle-bookmark')"
        :aria-label="isBookmarked ? '取消收藏' : '收藏'"
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

      <div class="stats-overlay">
        <div class="stats-row">
          <div class="stat-item">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            </svg>
            <span class="stat-val">{{ formattedPlayCount }}</span>
          </div>
          <div class="stat-item">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span class="stat-val">{{ formattedListeners }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="music-info">
      <div class="music-text">
        <h3 class="music-title a-clamp-1" :title="album.title">{{ album.title }}</h3>
        <p class="music-summary a-clamp-2" :title="`${artistNames} · ${albumYear}`">{{ artistNames }} · {{ albumYear }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface MusicAlbumCardItem {
  id: string
  title: string
  cover_url?: string
  cover_s3_key?: string
  image_url?: string
  release_date?: string
  year?: number | string
  artists?: { name: string }[]
  summary?: string
  target_path?: string
  play_count?: number
  bookmark_count?: number
}

const props = withDefaults(defineProps<{
  album: MusicAlbumCardItem
  isBookmarked?: boolean
  playCount?: number | string
  listenerCount?: number | string
}>(), {
  isBookmarked: false,
})

const publicAssetBase = import.meta.env.VITE_R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '') || ''

defineEmits<{
  (e: 'click'): void
  (e: 'toggle-bookmark'): void
}>()

const formattedPlayCount = computed(() => {
  const value = props.playCount ?? props.album.play_count
  if (value !== undefined) return String(value)
  return '0'
})

const formattedListeners = computed(() => {
  const value = props.listenerCount ?? props.album.bookmark_count
  if (value !== undefined) return String(value)
  return '0'
})

const coverUrl = computed(() => {
  if (props.album.cover_url) return props.album.cover_url
  if (props.album.image_url) return props.album.image_url
  if (props.album.cover_s3_key && publicAssetBase) {
    return `${publicAssetBase}/${props.album.cover_s3_key.replace(/^\/+/, '')}`
  }
  return ''
})

const artistNames = computed(() => {
  if (props.album.artists && props.album.artists.length) {
    return props.album.artists.map((a) => a.name).join(' / ')
  }
  if (props.album.summary) {
    const parts = props.album.summary.split(' · ')
    if (parts[0]) return parts[0]
  }
  return '未知艺术家'
})

function displayYear(value: number | string | undefined) {
  const year = String(value ?? '').slice(0, 4)
  const numericYear = Number(year)
  return Number.isInteger(numericYear) && numericYear >= 1000 ? year : ''
}

const albumYear = computed(() => {
  const storedYear = displayYear(props.album.year)
  if (storedYear) return storedYear
  const releaseYear = displayYear(props.album.release_date?.trim())
  if (releaseYear) return releaseYear
  if (props.album.summary) {
    const parts = props.album.summary.split(' · ')
    if (parts[1]) return parts[1]
  }
  return '未知年份'
})
</script>

<style scoped>
.music-album-card {
  display: block;
  text-decoration: none;
  color: inherit;
  border: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
}

.cover-frame {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--a-color-surface);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
}

.music-album-card:hover .cover-image {
  transform: scale(1.03);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
  display: block;
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

.stats-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.68), rgba(0, 0, 0, 0.18) 32%, transparent 58%);
  z-index: 2;
  pointer-events: none;
}

.stats-row {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #fff;
  font-size: 0.82rem;
  font-family: var(--a-font-sans);
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.stat-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

/* Bookmark Button */
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

.music-album-card:hover .bookmark-btn {
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

.music-info {
  display: flex;
  gap: 10px;
  padding: 10px 0 0;
}

.music-text {
  min-width: 0;
  flex: 1;
}

.music-title {
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1.35;
  color: var(--a-color-fg);
  margin: 0 0 0.25rem 0;
  transition: color 0.2s;
}

.music-album-card:hover .music-title {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.music-summary {
  margin: 0;
  color: var(--a-color-muted-soft);
  line-height: 1.4;
  font-size: 0.775rem;
}

.a-clamp-1 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.a-clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

@media (max-width: 767px) {
  .bookmark-btn {
    width: 44px;
    height: 44px;
    opacity: 1;
  }
}
</style>
