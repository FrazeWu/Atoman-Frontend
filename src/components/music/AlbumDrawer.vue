<!-- web/src/components/music/AlbumDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { modulePathUrl } from '@/router/siteUrls'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  createAlbumBookmark,
  deleteAlbumBookmark,
  getMusicAlbum,
  listAlbumBookmarks,
  type MusicAlbumListItem,
} from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import { buildPlayableSongsFromAlbum, resolveAlbumCoverUrl } from '@/utils/musicMedia'

const { state, closeAlbum, isAlbumShifted, openNestedAction, openArtist } = useMusicDrawers()
const player = usePlayerStore()
const isOpen = computed(() => state.value.albumId !== null)
const sheetIndex = computed(() => state.value.artistId !== null ? 1 : 0)
const album = ref<MusicAlbumListItem | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const isCoverBroken = ref(false)
const isBookmarked = ref(false)
const bookmarkLoading = ref(false)

const artistNames = computed(() => album.value?.artists?.map((artist) => artist.name).join(' / ') || 'Unknown Artist')
const releaseYear = computed(() => {
  const year = album.value?.release_date?.slice(0, 4)
  if (!year || year === '0001' || year === '0000' || year === '----') return ''
  return year
})
const tracks = computed(() => [...(album.value?.songs || [])].sort((a, b) => (a.track_number || 0) - (b.track_number || 0)))
const coverUrl = computed(() => album.value ? resolveAlbumCoverUrl(album.value) : '')
const playableSongs = computed(() => album.value ? buildPlayableSongsFromAlbum(album.value) : [])
const playableSongIdSet = computed(() => new Set(playableSongs.value.map((song) => String(song.id))))
const editAlbumHref = computed(() => {
  if (!album.value?.id) return modulePathUrl('music', '/')
  return modulePathUrl('music', `/album/${album.value.id}/edit`)
})
const discussionCount = computed(() => {
  const currentAlbum = album.value as (MusicAlbumListItem & {
    discussion_count?: number
    open_discussion_count?: number
  }) | null

  if (!currentAlbum) return undefined
  return currentAlbum.discussion_count ?? currentAlbum.open_discussion_count
})

function formatDuration(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const minutes = Math.floor(value / 60)
    const seconds = Math.floor(value % 60)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  if (typeof value === 'string' && value.trim()) return value
  return ''
}

function getTrackDurationLabel(track: MusicAlbumListItem['songs'][number] | Record<string, unknown>): string {
  return formatDuration((track as { duration_sec?: unknown }).duration_sec ?? (track as { duration?: unknown }).duration)
}

function playAlbum() {
  if (!playableSongs.value.length) return
  player.playAlbum(playableSongs.value)
}

function canPlayTrack(track: MusicAlbumListItem['songs'][number]) {
  return playableSongIdSet.value.has(String(track.id))
}

function playTrack(track: MusicAlbumListItem['songs'][number]) {
  if (!canPlayTrack(track)) return
  const startIndex = playableSongs.value.findIndex((song) => String(song.id) === String(track.id))
  if (startIndex < 0) return
  player.playAlbum(playableSongs.value, startIndex)
}

function handleCoverError() {
  isCoverBroken.value = true
}

async function loadAlbum(albumId: string | null) {
  if (!albumId) {
    album.value = null
    isBookmarked.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const [albumResponse, bookmarksResponse] = await Promise.all([
      getMusicAlbum(albumId),
      listAlbumBookmarks(),
    ])
    album.value = albumResponse
    isBookmarked.value = bookmarksResponse.data.some((bookmark) => String(bookmark.album_id) === String(albumId))
    isCoverBroken.value = false
  } catch (error) {
    console.error('Failed to fetch album:', error)
    errorMessage.value = '专辑信息加载失败'
  } finally {
    loading.value = false
  }
}

async function toggleAlbumBookmark() {
  const albumId = album.value?.id
  if (!albumId || bookmarkLoading.value) return

  bookmarkLoading.value = true
  try {
    if (isBookmarked.value) {
      await deleteAlbumBookmark(albumId)
      isBookmarked.value = false
      return
    }

    await createAlbumBookmark(albumId)
    isBookmarked.value = true
  } catch (error) {
    console.error('Failed to toggle album bookmark:', error)
  } finally {
    bookmarkLoading.value = false
  }
}

watch(() => state.value.albumId, loadAlbum, { immediate: true })
watch(
  () => state.value.albumRefreshToken,
  () => {
    if (state.value.albumId) void loadAlbum(state.value.albumId)
  },
)
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closeAlbum"
    width="700px"
    :is-shifted="isAlbumShifted"
    :index="sheetIndex"
  >
    <div class="drawer-header">
      <div>
        <div class="kicker">Album Notes</div>
      </div>
    </div>

    <div class="drawer-body">
      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载专辑...</p>

      <div v-else class="album-meta-row">
        <div class="album-cover">
          <img v-if="coverUrl && !isCoverBroken" :src="coverUrl" alt="" class="album-cover-img" @error="handleCoverError" />
          <span v-else>COVER</span>
        </div>
        <div class="album-info">
          <div class="album-type">{{ album?.album_type || 'Album' }}</div>
          <h2 class="album-title">{{ album?.title || `Album ${state.albumId}` }}</h2>
          <div class="meta-tags">
            <span class="artist-name">
              <template v-for="(artist, index) in album?.artists" :key="artist.id">
                <span v-if="index > 0" class="artist-separator"> / </span>
                <button
                  class="artist-link"
                  type="button"
                  @click="openArtist(String(artist.id))"
                >
                  {{ artist.name }}
                </button>
              </template>
              <template v-if="!album?.artists?.length">Unknown Artist</template>
            </span>
            <span v-if="releaseYear" class="release-year">{{ releaseYear }}</span>
          </div>
          <p class="summary">{{ album?.description || '暂无专辑简介。' }}</p>
        </div>
      </div>

      <div class="action-bar">
        <PButton
          variant="primary"
          :disabled="!playableSongs.length"
          dot
          @click="playAlbum"
        >
          播放全专
        </PButton>
        <PButton
          variant="secondary"
          :disabled="bookmarkLoading"
          dot
          data-testid="album-bookmark-toggle"
          @click="toggleAlbumBookmark"
        >
          {{ isBookmarked ? '已订阅' : '订阅' }}
        </PButton>
        <div class="spacer"></div>
        <PButton
          variant="secondary"
          :href="editAlbumHref"
          dot
        >
          编辑
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="openNestedAction('revise')"
        >
          修订
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="openNestedAction('history')"
        >
          历史
        </PButton>
      </div>

      <div class="content-section">
        <div class="section-title">Tracklist</div>
        <div v-if="!tracks.length" class="track-empty">暂无曲目。</div>
        <div v-for="(track, index) in tracks" :key="track.id" class="track">
          <div class="track-main">
            <button
              class="track-play-btn"
              type="button"
              :disabled="!canPlayTrack(track)"
              :data-testid="`track-play-${track.id}`"
              @click="playTrack(track)"
              aria-label="播放"
            >
              <span class="track-num">{{ String(track.track_number || index + 1).padStart(2, '0') }}</span>
              <svg class="track-play-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            <div class="track-title">{{ track.title }}</div>
          </div>
          <div class="track-meta">
            <span v-if="!canPlayTrack(track)" class="track-unavailable">无音频</span>
            <div v-if="getTrackDurationLabel(track)" class="track-time">{{ getTrackDurationLabel(track) }}</div>
          </div>
        </div>
      </div>
    </div>
    <PDiscussionFAB v-if="isOpen" @click="openNestedAction('discussion')" :count="discussionCount" />
  </PSheet>
</template>

<style scoped>
.drawer-header {
  margin: -2.5rem -2.5rem 0;
  padding: 1.5rem 2.5rem 1.25rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: var(--a-color-paper-soft);
}
.kicker {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
}
.drawer-body { margin: 0 -2.5rem; padding: 2rem 2.5rem; }

.album-meta-row {
  display: flex;
  gap: 2.25rem;
  margin-bottom: 2.25rem;
  align-items: flex-start;
}
.album-cover {
  width: 180px;
  height: 180px;
  background: var(--a-color-paper-wash);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--a-color-muted-soft);
  overflow: hidden;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.03);
}
.album-cover-img { width: 100%; height: 100%; object-fit: cover; }
.album-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-self: stretch;
  justify-content: center;
}
.album-type {
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--a-color-muted);
  margin-bottom: 0.25rem;
}
.album-title {
  font-family: var(--a-font-serif);
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 0 0 0.5rem;
  color: var(--a-color-ink);
}
.meta-tags {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--a-color-ink-soft);
}
.artist-name {
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
}
.artist-link {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  font-weight: 700;
  transition: color 0.15s ease;
}
.artist-link:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}
.artist-separator {
  color: var(--a-color-line-soft);
  margin: 0 0.15rem;
}
.release-year::before {
  content: "•";
  margin-right: 0.75rem;
  color: var(--a-color-line-soft);
}
.summary { color: var(--a-color-ink-soft); font-size: 0.875rem; line-height: 1.6; margin: 0; white-space: pre-wrap; }

.action-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
}
.spacer { flex: 1; }
.paper-action {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 99px;
  padding: 0.55rem 1.1rem;
  font-weight: 800;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: all 0.15s ease;
}
.paper-action--static {
  cursor: default;
}
.paper-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.paper-action:disabled:hover {
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  border-color: var(--a-color-line-soft);
}
.paper-action--static:hover {
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  border-color: var(--a-color-line-soft);
}
.paper-action:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}
.paper-action--primary {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}
.paper-action--primary:hover {
  background: var(--a-color-ink-muted);
  border-color: var(--a-color-ink-muted);
}
.paper-action-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.6;
}

.content-section {
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line-soft);
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
}
.section-title {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px solid var(--a-color-line-soft);
  padding-bottom: 0.5rem;
  margin-bottom: 1.25rem;
  color: var(--a-color-ink-soft);
  font-weight: 800;
}
.track {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 8%, transparent);
  font-size: 0.9rem;
}
.track:last-child { border-bottom: none; }
.track-main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}
.track-play-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: var(--a-color-ink);
  flex-shrink: 0;
}
.track-play-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.track-play-icon {
  position: absolute;
  opacity: 0;
  transition: opacity 0.1s ease;
}
.track-num {
  position: absolute;
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  color: var(--a-color-muted-soft);
  transition: opacity 0.1s ease;
}
.track:hover .track-play-btn:not(:disabled) .track-play-icon {
  opacity: 1;
}
.track:hover .track-play-btn:not(:disabled) .track-num {
  opacity: 0;
}
.track-title {
  color: var(--a-color-ink);
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.track-unavailable {
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  color: var(--a-color-muted);
  text-transform: uppercase;
}
.track-empty { color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-size: 0.875rem; }
.track-time { font-family: var(--a-font-meta); color: var(--a-color-ink-soft); font-size: 0.8rem; }
.state-line { margin: 0 0 1.5rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-weight: 800; }
.state-line--error { color: var(--a-color-accent-destructive); }
</style>
