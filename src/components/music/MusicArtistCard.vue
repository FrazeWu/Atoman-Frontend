<template>
  <PMediaCard
    variant="square"
    class="music-artist-card"
    @click="$emit('click')"
  >
    <div class="avatar-frame">
      <button
        type="button"
        class="avatar-action"
        :aria-label="`打开艺人 ${displayName}`"
      >
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="displayName"
          class="avatar-image"
          loading="lazy"
        />
        <span v-else class="avatar-placeholder-text">{{ artistInitial }}</span>
      </button>

      <div class="stats-overlay">
        <div class="stats-row">
          <div class="stat-item">
            <Headphones class="stat-icon" :size="13" aria-hidden="true" />
            <span class="stat-val">{{ formattedPlayCount }}</span>
          </div>
          <div class="stat-item">
            <Users class="stat-icon" :size="13" aria-hidden="true" />
            <span class="stat-val">{{ formattedSubscribers }}</span>
          </div>
        </div>
      </div>
    </div>

    <button
      v-if="showBookmarkButton"
      type="button"
      class="bookmark-btn"
      :class="{ 'is-bookmarked': isBookmarked }"
      @click.stop="$emit('toggle-bookmark')"
      :aria-label="isBookmarked ? '取消收藏' : '收藏'"
    >
      <Bookmark
        :size="17"
        :fill="isBookmarked ? 'currentColor' : 'none'"
        aria-hidden="true"
      />
    </button>

    <div class="artist-info">
      <h3 class="artist-title" :title="displayName">
        <RouterLink
          :to="`/music/artist/${artist.id}`"
          class="artist-title-link"
          @click.prevent.stop="$emit('click')"
        >
          {{ displayName }}
          <span v-if="birthYear" class="birth-year">· {{ birthYear }}</span>
        </RouterLink>
      </h3>
    </div>
  </PMediaCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bookmark, Headphones, Users } from 'lucide-vue-next'
import PMediaCard from '@/components/ui/PMediaCard.vue'

export interface MusicArtistCardItem {
  id: string
  name: string
  display_name?: string
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

const displayName = computed(() => props.artist.display_name || props.artist.name)

const artistInitial = computed(() => {
  if (!displayName.value) return '?'
  return displayName.value.trim().charAt(0).toUpperCase()
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
  position: relative;
  display: block;
  text-decoration: none;
  color: inherit;
  background: transparent;
  cursor: pointer;
  width: 100%;
}

.music-artist-card:hover .avatar-frame {
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
  transition: border-color 0.2s;
}



.avatar-action {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.avatar-action:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
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
  background: var(--a-color-surface-muted);
  text-transform: uppercase;
  font-family: var(--a-font-sans);
  letter-spacing: 0;
  opacity: 0.85;
}

/* Bookmark Button */
.bookmark-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 5;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.25s ease, transform 0.1s ease;
  box-shadow: var(--a-shadow-dropdown);
  padding: 0;
  opacity: 0;
}

.music-artist-card:hover .bookmark-btn,
.music-artist-card:focus-within .bookmark-btn {
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

:root.dark .bookmark-btn.is-bookmarked {
  color: #fcd34d;
  border-color: rgba(252, 211, 77, 0.2);
  background: rgba(252, 211, 77, 0.1);
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

.artist-title-link {
  color: inherit;
  text-decoration: none;
}

.artist-title-link:focus-visible {
  outline: 2px solid var(--a-color-focus, var(--a-color-text));
  outline-offset: 2px;
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
