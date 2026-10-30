<template>
  <main class="mobile-song-view">
    <!-- Sticky Top Navigation Header -->
    <header class="mobile-song-view__topbar">
      <button
        type="button"
        class="mobile-song-view__back-btn"
        data-testid="song-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" :stroke-width="2" />
      </button>
      <span class="mobile-song-view__topbar-title">歌曲详情</span>
      <div class="mobile-song-view__topbar-space" />
    </header>

    <section v-if="loading" class="mobile-song-view__state" aria-live="polite">正在加载歌曲</section>
    <section v-else-if="error" class="mobile-song-view__state mobile-song-view__state--error" role="alert">
      <h1>歌曲无法加载</h1>
      <p>{{ error }}</p>
      <button type="button" @click="loadSong">重试</button>
    </section>
    <section v-else-if="detail" class="mobile-song-view__content">
      <div class="mobile-song-view__cover-wrap">
        <img
          v-if="song.cover_url || song.album?.cover_url"
          :src="song.cover_url || song.album?.cover_url"
          :alt="`${song.title} 封面`"
          class="mobile-song-view__cover"
        />
        <div v-else class="mobile-song-view__cover mobile-song-view__cover--fallback" aria-hidden="true">
          {{ song.title.slice(0, 1) }}
        </div>
      </div>

      <div class="mobile-song-view__identity">
        <h1>{{ song.title }}</h1>
        <p v-if="detail.artists.length" class="mobile-song-view__artists">
          <template v-for="(artist, index) in detail.artists" :key="artist.id">
            <span v-if="index" aria-hidden="true"> / </span>
            <RouterLink :to="`/music/artist/${artist.id}`">{{ artist.name }}</RouterLink>
          </template>
        </p>
        <p v-else>{{ artistText }}</p>
      </div>

      <div class="mobile-song-view__actions" aria-label="歌曲操作">
        <button
          type="button"
          class="mobile-song-view__play"
          :disabled="!detail.playable || !song.audio_url"
          @click="playSong"
        >
          <MIcon name="player-play" size="sm" />
          <span>{{ detail.playable && song.audio_url ? '播放歌曲' : '暂无音频' }}</span>
        </button>
        <button
          type="button"
          class="mobile-song-view__action"
          :class="{ 'is-active': isFavorite }"
          :disabled="actionBusy === 'favorite'"
          :aria-label="isFavorite ? '移出最爱' : '加入最爱'"
          :title="isFavorite ? '移出最爱' : '加入最爱'"
          @click="toggleFavorite"
        >
          <MIcon name="heart" size="sm" />
          <span>{{ isFavorite ? '已收藏' : '收藏' }}</span>
        </button>
        <button
          type="button"
          class="mobile-song-view__action"
          :disabled="!detail.playable || !song.audio_url"
          aria-label="加入播放队列"
          title="加入播放队列"
          @click="queueSong"
        >
          <MIcon name="queue" size="sm" />
          <span>加入队列</span>
        </button>
        <button
          type="button"
          class="mobile-song-view__action"
          :disabled="song.edit_status !== undefined && song.edit_status !== 'development'"
          aria-label="编辑歌曲"
          title="编辑歌曲"
          @click="editSong"
        >
          <MIcon name="edit" size="sm" />
          <span>编辑</span>
        </button>
      </div>
      <p v-if="feedback" class="mobile-song-view__feedback" role="status">{{ feedback }}</p>

      <dl class="mobile-song-view__metadata">
        <div v-if="song.album">
          <dt>专辑</dt>
          <dd>
            <RouterLink v-if="song.album.id" :to="`/music/album/${song.album.id}`">{{ song.album.title }}</RouterLink>
            <span v-else>{{ song.album.title }}</span>
          </dd>
        </div>
        <div v-if="song.release_date">
          <dt>发行日期</dt>
          <dd>{{ song.release_date }}</dd>
        </div>
        <div v-if="song.duration_sec">
          <dt>时长</dt>
          <dd>{{ formatDuration(song.duration_sec) }}</dd>
        </div>
      </dl>

      <MusicDescriptionPreview
        v-if="song.description"
        :description="song.description"
        content-id="mobile-song-description"
        test-id="mobile-song-description-toggle"
      />

      <section v-if="song.lyrics" class="mobile-song-view__lyrics" aria-labelledby="lyrics-heading">
        <h2 id="lyrics-heading">歌词</h2>
        <p>{{ song.lyrics }}</p>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { getMusicSongDetail, type MusicSongDetail, type MusicSongListItem } from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import MusicDescriptionPreview from '@/components/music/MusicDescriptionPreview.vue'
import type { Song } from '@/types'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const authStore = useAuthStore()
const { requireLogin } = useLoginRedirect()
const { favoriteSongIds, loadFavoriteSongs, toggleFavoriteSong } = useMusicFavoritePlaylist()
const { openMusicCreationFlow, openMusicEditor } = useMusicDrawers()
const detail = ref<MusicSongDetail | null>(null)
const loading = ref(false)
const error = ref('')
let loadGeneration = 0

const songId = computed(() => (route.params.songId || route.params.id) as string)
const song = computed(() => detail.value?.song as MusicSongListItem)
const artistText = computed(() => detail.value?.artists.map((artist) => artist.name).join(' / ') || song.value?.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家')
const isFavorite = computed(() => Boolean(song.value && favoriteSongIds.value.has(String(song.value.id))))
const actionBusy = ref('')
const feedback = ref('')

function handleBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/music')
  }
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function toPlayableSong(source: MusicSongListItem): Song {
  const status = source.status === 'closed' || source.status === 'pending' || source.status === 'approved' || source.status === 'rejected'
    ? source.status
    : 'open'
  return {
    id: source.id,
    title: source.title,
    artist: source.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家',
    album: source.album?.title || '',
    album_id: source.album_id || source.album?.id || '',
    year: source.album?.year || Number(source.release_date?.slice(0, 4)) || 0,
    release_date: source.release_date || '',
    lyrics: source.lyrics || '',
    audio_url: source.audio_url || '',
    waveform_peaks: source.waveform_peaks,
    duration: source.duration_sec || (source as any).duration || 0,
    cover_url: source.cover_url || source.album?.cover_url || '',
    track_number: source.track_number,
    disc_number: source.disc_number,
    status,
  }
}

async function loadSong() {
  const currentId = songId.value
  const generation = ++loadGeneration
  if (typeof currentId !== 'string' || !currentId) {
    detail.value = null
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const nextDetail = await getMusicSongDetail(currentId)
    if (generation !== loadGeneration || songId.value !== currentId) return
    detail.value = nextDetail
  } catch {
    if (generation !== loadGeneration || songId.value !== currentId) return
    detail.value = null
    error.value = '请稍后重试'
  } finally {
    if (generation === loadGeneration && songId.value === currentId) loading.value = false
  }
}

watch(
  [() => detail.value?.song.id, () => authStore.isAuthenticated],
  async ([currentId, authenticated]) => {
    if (!currentId || !authenticated) {
      favoriteSongIds.value = new Set()
      return
    }
    try {
      const requestedSongId = String(currentId)
      await loadFavoriteSongs([requestedSongId], () => (
        String(detail.value?.song.id || '') === requestedSongId &&
        String(songId.value || '') === requestedSongId
      ))
    } catch {
      favoriteSongIds.value = new Set()
    }
  },
  { immediate: true },
)

function showFeedback(message: string) {
  feedback.value = message
}

async function toggleFavorite() {
  if (!song.value || !requireLogin() || actionBusy.value) return
  actionBusy.value = 'favorite'
  try {
    const result = await toggleFavoriteSong(String(song.value.id))
    showFeedback(result.message)
  } catch {
    showFeedback('收藏操作失败，请重试')
  } finally {
    actionBusy.value = ''
  }
}

function queueSong() {
  if (!song.value?.audio_url || !detail.value?.playable) return
  player.addToQueue(toPlayableSong(song.value))
  showFeedback('已加入播放队列')
}

function editSong() {
  if (!song.value || !requireLogin()) return
  if (song.value.release_type === 'single' || song.value.release_type === 'leak' || song.value.release_type === 'leak_song') {
    openMusicCreationFlow({
      mode: 'edit',
      entity: 'song',
      songId: String(song.value.id),
      startStep: 'albumDetails',
    })
    return
  }
  openMusicEditor({ entity: 'song', mode: 'edit', id: String(song.value.id) })
}

function playSong() {
  if (!song.value?.audio_url || !detail.value?.playable) return
  player.playSong(toPlayableSong(song.value))
  void router.push('/music/player')
}

watch(songId, loadSong, { immediate: true })
</script>

<style scoped>
.mobile-song-view {
  min-width: 0;
  padding: 1.25rem 1rem calc(2rem + env(safe-area-inset-bottom, 24px));
}

.mobile-song-view__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  position: sticky;
  top: 0;
  z-index: 10;
  margin: -1.25rem -1rem 1rem -1rem;
}

.mobile-song-view__back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  padding: 0;
}

.mobile-song-view__topbar-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

.mobile-song-view__topbar-space {
  width: 36px;
}

.mobile-song-view__content {
  display: grid;
  gap: 1.25rem;
}

.mobile-song-view__cover-wrap {
  width: min(100%, 20rem);
  margin: 0 auto;
}

.mobile-song-view__cover {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  background: var(--a-color-surface-muted);
}

.mobile-song-view__cover--fallback {
  display: grid;
  place-items: center;
  color: var(--a-color-primary-contrast);
  background: var(--a-color-primary);
  font-size: 4rem;
}

.mobile-song-view__identity h1,
.mobile-song-view__identity p,
.mobile-song-view__lyrics h2,
.mobile-song-view__lyrics p,
.mobile-song-view__state h1,
.mobile-song-view__state p {
  margin: 0;
}

.mobile-song-view__identity h1 {
  font-size: 1.5rem;
  line-height: 1.25;
}

.mobile-song-view__identity a,
.mobile-song-view__metadata a {
  color: var(--a-color-primary);
  text-decoration: none;
}

.mobile-song-view__identity a:hover,
.mobile-song-view__identity a:focus-visible,
.mobile-song-view__metadata a:hover,
.mobile-song-view__metadata a:focus-visible {
  text-decoration: underline;
}

.mobile-song-view__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.mobile-song-view__actions .mobile-song-view__play {
  grid-column: 1 / -1;
}

.mobile-song-view__action {
  display: grid;
  min-height: 52px;
  place-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 8px;
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}

.mobile-song-view__action:hover,
.mobile-song-view__action:focus-visible,
.mobile-song-view__action.is-active {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.mobile-song-view__action:disabled {
  opacity: 0.45;
  cursor: default;
}

.mobile-song-view__play {
  display: inline-flex;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 1rem;
  border: 0;
  border-radius: 8px;
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.mobile-song-view__play:disabled {
  opacity: 0.45;
  cursor: default;
}

.mobile-song-view__feedback {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  background: var(--a-color-surface-muted);
  font-size: 0.8rem;
}

.mobile-song-view__metadata {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 1rem;
  border-radius: 8px;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
}

.mobile-song-view__metadata div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.mobile-song-view__metadata dt {
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.mobile-song-view__metadata dd {
  margin: 0;
  text-align: right;
  font-size: 0.85rem;
}

.mobile-song-view__lyrics {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
}

.mobile-song-view__lyrics h2 {
  font-size: 1rem;
}

.mobile-song-view__lyrics p {
  white-space: pre-wrap;
  line-height: 1.7;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.mobile-song-view__state {
  display: grid;
  place-content: center;
  min-height: 40dvh;
  gap: 0.75rem;
  text-align: center;
}

.mobile-song-view__state--error {
  color: var(--a-color-danger);
}

.mobile-song-view__state button {
  min-height: 38px;
  padding: 0 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 6px;
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  cursor: pointer;
}
</style>
