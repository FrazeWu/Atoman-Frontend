<template>
  <article class="music-album-card">
    <div class="cover-frame">
      <button type="button" class="cover-action" :aria-label="`打开专辑 ${album.title}`" @click="emit('click')">
        <img
          v-if="coverUrl"
          :src="coverUrl"
          :alt="album.title"
          class="cover-image"
          :loading="priority ? 'eager' : 'lazy'"
          :fetchpriority="priority ? 'high' : 'auto'"
        />
        <span v-else class="cover-placeholder">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.25">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5z"/>
          </svg>
        </span>
      </button>

      <!-- Status Tag Badge for Draft / Importing Albums -->
      <span v-if="statusBadgeText" class="status-tag" :data-status="album.status || album.entry_status">
        {{ statusBadgeText }}
      </span>

      <!-- Bookmark Button on Top Right -->
      <button
        v-if="showBookmark"
        type="button"
        class="bookmark-btn"
        :class="{ 'is-bookmarked': isBookmarked }"
        @click="emit('toggle-bookmark')"
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
        <h3 class="music-title a-clamp-1">
          <RouterLink
            :to="`/music/album/${album.id}`"
            class="album-title-btn"
            :title="album.title"
            @click.prevent.stop="emit('click')"
          >{{ album.title }}</RouterLink>
        </h3>
        <p class="music-summary a-clamp-2" :title="`${artistNames} · ${albumYear}`">
          <template v-if="album.artists?.length">
            <template v-for="(artist, index) in album.artists" :key="artist.id || `${artist.name}-${index}`">
              <span v-if="index" aria-hidden="true"> / </span>
              <RouterLink
                v-if="artist.id"
                :to="`/music/artist/${artist.id}`"
                class="artist-link"
                :aria-label="`打开艺人 ${artist.name}`"
                @click.prevent.stop="emit('click-artist', String(artist.id))"
              >{{ artist.name }}</RouterLink>
              <span v-else>{{ artist.name }}</span>
            </template>
          </template>
          <template v-else>{{ artistNames }}</template>
          <span aria-hidden="true"> · </span>{{ albumYear }}
        </p>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface MusicAlbumCardItem {
  id: string
  title: string
  status?: string
  entry_status?: string
  cover_url?: string
  cover_s3_key?: string
  image_url?: string
  release_date?: string
  year?: number | string
  artists?: { id?: string; name: string }[]
  summary?: string
  target_path?: string
  play_count?: number
  bookmark_count?: number
}

const props = withDefaults(defineProps<{
  album: MusicAlbumCardItem
  isBookmarked?: boolean
  showBookmark?: boolean
  playCount?: number | string
  listenerCount?: number | string
  priority?: boolean
}>(), {
  isBookmarked: false,
  showBookmark: true,
  priority: false,
})

const statusBadgeText = computed(() => {
  const s = props.album.status || props.album.entry_status
  if (!s) return ''
  if (s === 'ready') return '等待提交'
  if (['pending_upload', 'uploading'].includes(s)) return '上传中'
  if (['queued', 'extracting', 'analyzing', 'transcoding'].includes(s)) return '解析中'
  if (s === 'needs_attention') return '待处理'
  if (s === 'draft') return '草稿'
  return ''
})

const publicAssetBase = import.meta.env.VITE_R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '') || ''

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'click-artist', artistId: string): void
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
  background: transparent;
  width: 100%;
}

.cover-frame {
  position: relative;
  aspect-ratio: 1 / 1;
  width: 100%;
  background: var(--a-color-surface-muted, #f4f4f5);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  box-shadow: var(--a-shadow-sm);
  transition: border-color 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
}

.music-album-card:hover .cover-frame {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--a-color-primary, #2563eb) 35%, var(--a-color-border-soft));
  box-shadow: var(--a-shadow-md);
}

.cover-action {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.cover-action:focus-visible,
.album-title-btn:focus-visible,
.artist-link:focus-visible,
.bookmark-btn:focus-visible {
  outline: 2px solid var(--a-color-focus, var(--a-color-text));
  outline-offset: 2px;
}

.bookmark-btn:focus-visible {
  opacity: 1;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
  display: block;
}

.cover-action:hover .cover-image {
  transform: scale(1.05);
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
  font-weight: var(--a-font-weight-strong, 700);
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
  border-radius: var(--a-radius-pill, 999px);
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

:root.dark .bookmark-btn.is-bookmarked {
  color: #fcd34d;
  border-color: rgba(252, 211, 77, 0.2);
  background: rgba(252, 211, 77, 0.1);
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
  font-weight: 500;
  line-height: 1.35;
  color: var(--a-color-fg);
  margin: 0 0 0.25rem 0;
  transition: color 0.2s;
}

.album-title-btn {
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.album-title-btn:hover {
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

.artist-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.artist-link:hover {
  color: var(--a-color-text);
  text-decoration: underline;
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

.status-tag {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.2;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.status-tag[data-status="ready"] {
  background: #16a34a;
  color: #ffffff;
}

.status-tag[data-status="needs_attention"] {
  background: #dc2626;
  color: #ffffff;
}

.status-tag[data-status="extracting"],
.status-tag[data-status="analyzing"],
.status-tag[data-status="transcoding"] {
  background: #2563eb;
  color: #ffffff;
}

@media (max-width: 767px) {
  .bookmark-btn {
    width: 44px;
    height: 44px;
    opacity: 1;
  }
}
</style>
