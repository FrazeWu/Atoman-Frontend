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
          v-if="optimizedCoverUrl"
          :src="optimizedCoverUrl"
          :alt="playlist.title"
          class="cover-image"
          width="320"
          height="320"
          :loading="priority ? 'eager' : 'lazy'"
          :fetchpriority="priority ? 'high' : 'auto'"
          decoding="async"
        />
        <span v-else class="cover-placeholder">
          <Music2 :size="28" aria-hidden="true" />
        </span>
      </button>

      <button
        v-if="showBookmarkButton"
        type="button"
        class="bookmark-btn"
        :class="{ 'is-bookmarked': isBookmarked }"
        :aria-label="isBookmarked ? '取消收藏' : '收藏'"
        @click.stop="$emit('toggle-bookmark')"
      >
        <BookmarkCheck
          v-if="isBookmarked"
          :size="17"
          aria-hidden="true"
        />
        <Bookmark
          v-else
          :size="17"
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
import { Bookmark, BookmarkCheck, Music2 } from 'lucide-vue-next'

import PMediaCard from '@/components/ui/PMediaCard.vue'
import { resolveMediaImageURL } from '@/utils/mediaUrl'

export interface MusicPlaylistCardItem {
  id: string
  title: string
  description?: string
  cover_url?: string
  song_count: number
  owner_username?: string
  bookmark_count?: number
  play_count?: number
}

const props = withDefaults(defineProps<{
  playlist: MusicPlaylistCardItem
  isBookmarked?: boolean
  showBookmarkButton?: boolean
  priority?: boolean
}>(), {
  isBookmarked: false,
  showBookmarkButton: true,
  priority: false,
})

defineEmits<{
  (e: 'click'): void
  (e: 'toggle-bookmark'): void
}>()

const coverUrl = computed(() => props.playlist.cover_url || '')
const optimizedCoverUrl = computed(() => coverUrl.value ? resolveMediaImageURL(coverUrl.value, { width: 320 }) : '')

const displayTitle = computed(() => {
  const owner = props.playlist.owner_username?.trim()
  return owner ? `${owner}/${props.playlist.title}` : props.playlist.title
})

const formattedBookmarkCount = computed(() => String(props.playlist.bookmark_count ?? 0))
const formattedPlayCount = computed(() => String(props.playlist.play_count ?? 0))
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
  background: var(--a-color-surface-muted);
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
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.25s ease;
  box-shadow: none;
  padding: 0;
  opacity: 0;
}

.music-playlist-card:hover .bookmark-btn,
.music-playlist-card:focus-within .bookmark-btn {
  opacity: 1;
}


.bookmark-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.bookmark-btn.is-bookmarked {
  color: var(--a-color-warning);
  border-color: color-mix(in srgb, var(--a-color-warning) 30%, transparent);
  background: color-mix(in srgb, var(--a-color-warning) 10%, var(--a-color-bg));
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
  font-weight: 500;
  color: var(--a-color-muted-soft);
}
</style>
