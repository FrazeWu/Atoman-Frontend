<template>
  <PMediaCard
    variant="square"
    class="music-playlist-card"
    @click="$emit('click')"
  >
    <div class="cover-frame">
      <button
        type="button"
        class="cover-action"
        data-testid="playlist-card-cover"
        :aria-label="`打开歌单 ${displayTitle}`"
      >
        <img
          v-if="coverUrl"
          :src="coverUrl"
          :alt="playlist.title"
          class="cover-image"
          loading="lazy"
        />
        <span v-else class="cover-placeholder">
          <Music2 :size="28" aria-hidden="true" />
        </span>
      </button>

      <div class="cover-stats" aria-label="歌单统计">
        <span class="cover-stat">
          <Headphones class="cover-stat__icon" :size="13" aria-hidden="true" />
          {{ formattedPlayCount }}
        </span>
        <span class="cover-stat">
          <Bookmark class="cover-stat__icon" :size="13" :fill="isBookmarked ? 'currentColor' : 'none'" aria-hidden="true" />
          {{ formattedBookmarkCount }}
        </span>
      </div>

      <button
        v-if="showBookmarkButton"
        type="button"
        class="bookmark-btn"
        :class="{ 'is-bookmarked': isBookmarked }"
        :aria-label="isBookmarked ? '取消收藏' : '收藏'"
        @click.stop="$emit('toggle-bookmark')"
      >
        <Bookmark
          :size="17"
          :fill="isBookmarked ? 'currentColor' : 'none'"
          aria-hidden="true"
        />
      </button>
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
  </PMediaCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconBookmark as Bookmark, IconHeadphones as Headphones, IconMusic as Music2 } from '@tabler/icons-vue'

import PMediaCard from '@/components/ui/PMediaCard.vue'

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
}

.music-playlist-card:hover .cover-frame {
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
  transition: border-color 0.2s;
}

.cover-action {
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

.cover-action:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
}

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
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.25s ease;
  box-shadow: var(--a-shadow-dropdown);
  padding: 0;
  opacity: 0;
}

.music-playlist-card:hover .bookmark-btn,
.music-playlist-card:focus-within .bookmark-btn {
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
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1;
  text-shadow: none;
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
  background: var(--a-color-surface-muted);
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
