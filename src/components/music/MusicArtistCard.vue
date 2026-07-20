<template>
  <div
    class="music-artist-card"
    @click="$emit('click')"
  >
    <div class="avatar-frame">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="artist.name"
        class="avatar-image"
        loading="lazy"
      />
      <div v-else class="avatar-placeholder-text">{{ artistInitial }}</div>

      <!-- Bookmark/Star Button on Top Right -->
      <button
        v-if="showBookmarkButton"
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
            <span class="stat-val">{{ formattedSubscribers }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="artist-info">
      <h3 class="artist-title" :title="artist.name">
        {{ artist.name }}
        <span v-if="birthYear" class="birth-year">· {{ birthYear }}</span>
      </h3>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface MusicArtistCardItem {
  id: string
  name: string
  legal_name?: string
  bio?: string
  image_url?: string
  nationality?: string
  birth_year?: number | string
  birth_date?: string
  entry_status?: string
  play_count?: number
  bookmark_count?: number
}

const props = withDefaults(defineProps<{
  artist: MusicArtistCardItem
  isBookmarked?: boolean
  playCount?: number | string
  subscriberCount?: number | string
  showBookmarkButton?: boolean
}>(), {
  isBookmarked: false,
  showBookmarkButton: true,
})

defineEmits<{
  (e: 'click'): void
  (e: 'toggle-bookmark'): void
}>()

const imageUrl = computed(() => {
  return props.artist.image_url || ''
})

const artistInitial = computed(() => {
  if (!props.artist.name) return '?'
  return props.artist.name.trim().charAt(0).toUpperCase()
})

const birthYear = computed(() => {
  if (props.artist.birth_year) return String(props.artist.birth_year)
  if (props.artist.birth_date?.trim()) {
    const yearStr = props.artist.birth_date.slice(0, 4)
    if (yearStr && !isNaN(Number(yearStr))) {
      return yearStr
    }
  }
  return ''
})

const formattedPlayCount = computed(() => {
  const value = props.playCount ?? props.artist.play_count
  if (value !== undefined) return String(value)
  return '0'
})

const formattedSubscribers = computed(() => {
  const value = props.subscriberCount ?? props.artist.bookmark_count
  if (value !== undefined) return String(value)
  return '0'
})
</script>

<style scoped>
.music-artist-card {
  display: block;
  text-decoration: none;
  color: inherit;
  background: transparent;
  cursor: pointer;
  width: 100%;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  box-shadow: none;
  transition: border-color 0.2s, transform 0.2s;
}

.music-artist-card:hover {
  transform: translateY(1px);
  border-color: var(--a-color-muted-soft);
}

.avatar-frame {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--a-color-surface);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}



.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
  display: block;
}

.avatar-placeholder-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  font-weight: 900;
  color: var(--a-color-text);
  background: linear-gradient(135deg, var(--a-color-surface), var(--a-color-border-soft));
  text-transform: uppercase;
  font-family: var(--a-font-sans);
  letter-spacing: 0;
  opacity: 0.85;
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
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.25s ease, transform 0.1s active;
  box-shadow: var(--a-shadow-dropdown);
  padding: 0;
  opacity: 0;
}

.music-artist-card:hover .bookmark-btn {
  opacity: 1;
}

.bookmark-btn:hover {
  background: var(--a-color-surface);
  color: var(--a-color-text);
}

.bookmark-btn.is-bookmarked {
  color: #eaaa08; /* Star gold */
  border-color: #fce99f;
  background: #fefcf0;
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
  gap: 6px;
  color: #fff;
  font-size: 0.85rem;
  font-family: var(--a-font-sans);
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.stat-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Artist Info below image */
.artist-info {
  display: flex;
  gap: 8px;
  padding: 10px 0 0;
  text-align: left;
}

.artist-title {
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.35;
  color: var(--a-color-fg);
  margin: 0;
  transition: color 0.2s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.music-artist-card:hover .artist-title {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.birth-year {
  font-weight: 400;
  color: var(--a-color-muted-soft);
  font-size: 0.85rem;
}

@media (max-width: 767px) {
  .bookmark-btn {
    width: 44px;
    height: 44px;
    opacity: 1;
  }
}
</style>
