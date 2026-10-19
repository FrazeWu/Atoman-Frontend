<template>
  <div
    class="player-info"
    :class="{ 'player-info--collapsed': isMetaCollapsed }"
  >
    <button
      type="button"
      class="cover-wrap"
      :aria-label="isPodcast ? '查看节目说明' : '打开歌词'"
      :title="isPodcast ? '查看节目说明' : '打开歌词'"
      data-hint="歌词 (Shift+F)"
      @click="$emit('toggle-lyrics')"
    >
      <img
        v-if="currentSong?.cover_url"
        :src="currentSong.cover_url"
        alt=""
        class="player-cover"
      />
      <div v-else class="player-cover-fallback">{{ resolvedCoverFallback }}</div>
      <span class="cover-overlay" aria-hidden="true"><PIcon name="chevron-up" size="lg" /></span>
    </button>
    <div
      class="player-meta"
      :class="{ 'player-meta--collapsed': isMetaCollapsed }"
    >
      <div class="player-tooltip-wrap">
        <RouterLink
          v-if="!isPodcast"
          class="player-title"
          :to="`/music/song/${currentSong?.id}`"
        >
          {{ currentSong?.title }}
        </RouterLink>
        <h3 v-else class="player-title">{{ currentSong?.title }}</h3>
        <div class="player-tooltip">{{ currentSong?.title }}</div>
      </div>
      <div class="player-tooltip-wrap">
        <p class="player-artist">
          TRACK //
          <template v-if="!isPodcast && currentSong?.artists?.length">
            <template v-for="(artist, index) in currentSong.artists" :key="artist.id">
              <span v-if="index" aria-hidden="true"> / </span>
              <button type="button" @click="$emit('open-artist', String(artist.id))">{{ artist.name }}</button>
            </template>
          </template>
          <span v-else>{{ resolvedArtistText }}</span>
          <template v-if="!isPodcast && currentSong?.album_id">
            <span aria-hidden="true"> · </span>
            <button type="button" @click="$emit('open-album', String(currentSong.album_id))">{{ currentSong.album }}</button>
          </template>
        </p>
        <div class="player-tooltip player-tooltip--subtle">
          TRACK // {{ resolvedArtistText }}
        </div>
      </div>
    </div>

    <!-- Track actions: Favorite & Add to Playlist -->
    <div class="player-actions" :class="{ 'player-actions--collapsed': isMetaCollapsed }">
      <button
        v-if="!isPodcast"
        type="button"
        class="player-fav-btn"
        :class="{ 'is-active': isFavorite }"
        :aria-label="isFavorite ? '移出最爱' : '添加到最爱'"
        :title="isFavorite ? '移出最爱' : '添加到最爱'"
        @click="$emit('toggle-favorite', String(currentSong?.id))"
      >
        <PIcon :name="isFavorite ? 'heart-filled' : 'heart'" size="md" class="fav-icon" :class="{ 'is-filled': isFavorite }" aria-hidden="true" />
      </button>

      <AudioPlayerPlaylistPopover
        :current-song-id="currentSong?.id"
        :is-podcast="isPodcast"
        :playlists="playlists"
        :playlist-load-error="playlistLoadError"
        @trigger-click="$emit('guard-playlist-menu', $event)"
        @retry-load="$emit('retry-load-playlists')"
        @add-to-playlist="(pId, sId, close) => $emit('add-to-playlist', pId, sId, close)"
      />

      <button
        v-if="isPodcastEpisode"
        type="button"
        class="player-fav-btn"
        title="收藏单集"
        data-hint="收藏单集"
        @click="$emit('add-podcast-bookmark', currentSong?.source_id)"
      >
        <PIcon name="heart" size="md" />
      </button>

      <button
        v-if="isPodcastEpisode"
        type="button"
        class="player-add-btn"
        title="稍后听"
        data-hint="稍后听"
        @click="$emit('add-podcast-listen-later', currentSong?.source_id)"
      >
        <PIcon name="clock" size="md" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PIcon from '@/components/ui/PIcon.vue'
import AudioPlayerPlaylistPopover from '@/components/music/AudioPlayerPlaylistPopover.vue'
import type { MusicPlaylistSummary } from '@/api/musicV1'
import type { Song } from '@/entities/music'

interface Props {
  currentSong: Song
  isPodcast?: boolean
  isPodcastEpisode?: boolean
  isMetaCollapsed?: boolean
  coverFallback?: string
  artistText?: string
  favoriteSongIds?: Set<string>
  playlists?: MusicPlaylistSummary[]
  playlistLoadError?: string
}

const props = withDefaults(defineProps<Props>(), {
  isPodcast: false,
  isPodcastEpisode: false,
  isMetaCollapsed: false,
  coverFallback: '',
  artistText: '',
  favoriteSongIds: () => new Set<string>(),
  playlists: () => [],
  playlistLoadError: '',
})

defineEmits<{
  (e: 'toggle-lyrics'): void
  (e: 'open-artist', artistId: string): void
  (e: 'open-album', albumId: string): void
  (e: 'toggle-favorite', songId: string): void
  (e: 'guard-playlist-menu', event: MouseEvent): void
  (e: 'retry-load-playlists'): void
  (e: 'add-to-playlist', playlistId: string, songId: string, close?: () => void): void
  (e: 'add-podcast-bookmark', episodeId: string | undefined): void
  (e: 'add-podcast-listen-later', episodeId: string | undefined): void
}>()

const isFavorite = computed(() => {
  if (!props.currentSong?.id) return false
  return props.favoriteSongIds.has(String(props.currentSong.id))
})

const resolvedArtistText = computed(() => {
  if (props.artistText) return props.artistText
  if (!props.currentSong) return '未知艺术家'
  if (props.currentSong.artists?.length) {
    return props.currentSong.artists.map((artist) => artist.name).join(', ')
  }
  return props.currentSong.artist || '未知艺术家'
})

const resolvedCoverFallback = computed(() => {
  if (props.coverFallback) return props.coverFallback
  const text =
    props.currentSong?.album ||
    props.currentSong?.artist ||
    props.currentSong?.title ||
    'P'
  const firstChar = text.trim().charAt(0)
  return firstChar || 'P'
})
</script>

<style scoped>
.player-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  transition:
    flex-basis var(--a-motion-state) var(--a-motion-ease-enter),
    width var(--a-motion-state) var(--a-motion-ease-enter),
    gap var(--a-motion-state) var(--a-motion-ease-enter);
}

.player-info--collapsed {
  min-width: 52px;
  gap: 0;
}

.cover-wrap {
  position: relative;
  align-self: center;
  width: 3.25rem;
  height: 3.25rem;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  padding: 0;
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: none;
}

.player-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--a-color-text);
  background: var(--a-color-surface-muted);
  text-transform: uppercase;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--a-color-text) 40%, transparent);
  color: var(--a-color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--a-motion-state) ease;
  font-size: 20px;
  font-weight: 600;
}

.cover-wrap:hover .cover-overlay {
  opacity: 1;
}

.player-meta {
  min-width: 0;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow: visible;
  transition:
    max-width var(--a-motion-state) var(--a-motion-ease-enter),
    opacity var(--a-motion-state) var(--a-motion-ease-enter),
    transform var(--a-motion-state) var(--a-motion-ease-enter),
    margin var(--a-motion-state) var(--a-motion-ease-enter);
}

.player-meta--collapsed {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transform: translateX(-6px);
}

.player-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 4px;
  padding-left: 2px;
  transition:
    opacity var(--a-motion-state) var(--a-motion-ease-enter),
    transform var(--a-motion-state) var(--a-motion-ease-enter);
}

.player-actions--collapsed {
  display: none;
}

.player-tooltip-wrap {
  position: relative;
  min-width: 0;
}

.player-title {
  display: block;
  font-family: var(--a-font-sans);
  font-weight: 500;
  font-size: 13px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  color: inherit;
  text-decoration: none;
}

.player-artist {
  font-family: monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
  color: var(--a-color-muted);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-title:hover,
.player-artist button:hover {
  text-decoration: underline;
}

.player-artist button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
}

.player-tooltip {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  max-width: min(36rem, 80vw);
  padding: 0.5rem 0.7rem;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.04em;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0.18s ease;
  transition-delay: 0s;
  z-index: 1000;
  box-shadow: none;
  border-radius: var(--a-radius-control, 4px);
}

.player-tooltip::after {
  content: "";
  position: absolute;
  left: 18px;
  top: 100%;
  border: 6px solid transparent;
  border-top-color: var(--a-color-text);
}

.player-tooltip-wrap:hover .player-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition-delay: 1.2s;
}

.player-tooltip--subtle {
  font-size: 0.66rem;
  letter-spacing: 0.12em;
}

.player-fav-btn,
.player-add-btn {
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
  box-shadow: none;
}

.player-fav-btn:hover,
.player-fav-btn:focus-visible,
.player-add-btn:hover,
.player-add-btn:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.player-fav-btn.is-active {
  color: var(--a-color-danger, #ef4444);
}

[data-hint] {
  position: relative;
}

[data-hint]::before {
  content: attr(data-hint);
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 4px 8px;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  border-radius: var(--a-radius-control, 4px);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  box-shadow: none;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0.18s ease;
  transition-delay: 0s;
  z-index: 999;
}

[data-hint]:hover::before {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
  transition-delay: 1.2s;
}

@media (hover: none) {
  [data-hint]::before {
    display: none !important;
  }
}
</style>
