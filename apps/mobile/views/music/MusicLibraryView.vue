<template>
  <div class="mobile-music-library">
    <!-- Header -->
    <header class="mobile-music-library__header">
      <h1 class="mobile-music-library__title">曲库</h1>
    </header>

    <!-- Search Input -->
    <div class="mobile-music-library__search">
      <MInput
        v-model="searchQuery"
        placeholder="搜索歌曲或专辑..."
        clearable
      />
    </div>

    <!-- Track List -->
    <section class="mobile-music-library__section" aria-label="歌曲列表">
      <div v-if="loading" class="mobile-music-library__empty" role="status">正在加载歌曲…</div>
      <div v-else-if="loadError" class="mobile-music-library__empty" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" class="mobile-music-library__retry" @click="loadTracks">重新加载</button>
      </div>
      <div v-else-if="filteredTracks.length > 0" class="mobile-music-library__tracks">
        <div
          v-for="(track, index) in filteredTracks"
          :key="track.id || index"
          class="mobile-music-library__track-item"
          data-testid="library-track-item"
          @click="playTrack(track)"
        >
          <span class="mobile-music-library__track-index">{{ String(index + 1).padStart(2, '0') }}</span>

          <div class="mobile-music-library__track-cover">
            <img
              v-if="track.cover_url"
              :src="track.cover_url"
              :alt="track.title"
              class="mobile-music-library__track-img"
            />
            <div v-else class="mobile-music-library__track-art">
              <MIcon name="note" size="sm" />
            </div>
          </div>

          <div class="mobile-music-library__track-meta">
            <span class="mobile-music-library__track-title">{{ track.title }}</span>
            <span class="mobile-music-library__track-sub">
              {{ track.artist || '未知艺术家' }} · {{ track.album || '未归类专辑' }}
            </span>
          </div>

          <div class="mobile-music-library__track-end">
            <span v-if="formatDuration(track.duration)" class="mobile-music-library__track-duration">{{ formatDuration(track.duration) }}</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="mobile-music-library__empty">
        <MIcon name="note" size="lg" class="mobile-music-library__empty-icon" />
        <p class="mobile-music-library__empty-text">
          {{ searchQuery ? '未找到相关歌曲' : '曲库暂无歌曲' }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listMusicSongs } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'

const player = useAudioPlayerStore()
const searchQuery = ref('')
const tracks = ref<Song[]>([])
const loading = ref(true)
const loadError = ref('')

function toPlayerSong(item: any): Song {
  return {
    id: item.id,
    title: item.title,
    artist: typeof item.artist === 'string'
      ? item.artist
      : item.artists?.map((a: any) => a.name).join(' / ') || '未知艺术家',
    album: typeof item.album === 'string'
      ? item.album
      : item.album?.title || '',
    duration: typeof item.duration === 'number' && item.duration > 0
      ? item.duration
      : (item.duration_sec ?? item.duration_seconds ?? item.durationSeconds ?? 0),
    audio_url: item.audio_url || '',
    cover_url: item.cover_url || item.album?.cover_url || '',
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const filteredTracks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return tracks.value
  return tracks.value.filter((track) => {
    const titleMatch = track.title?.toLowerCase().includes(query)
    const artistMatch = track.artist?.toLowerCase().includes(query)
    const albumMatch = track.album?.toLowerCase().includes(query)
    return Boolean(titleMatch || artistMatch || albumMatch)
  })
})

async function loadTracks() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listMusicSongs({ page: 1, page_size: 50 })
    if (!Array.isArray(res?.data)) throw new Error('Invalid songs response')
    tracks.value = res.data.map(toPlayerSong)
  } catch {
    tracks.value = []
    loadError.value = '歌曲加载失败，请检查网络后重试。'
  } finally {
    loading.value = false
  }
}

function playTrack(track: Song) {
  player.playSong(track)
}

onMounted(() => {
  void loadTracks()
})
</script>

<style scoped>
.mobile-music-library {
  padding: 1rem 1rem 5rem;
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
}

.mobile-music-library__header {
  margin-bottom: 1rem;
}

.mobile-music-library__title {
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0;
}

.mobile-music-library__search {
  margin-bottom: 1.25rem;
}

.mobile-music-library__section {
  display: flex;
  flex-direction: column;
}

.mobile-music-library__tracks {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  background: #ffffff;
  overflow: hidden;
}

.mobile-music-library__track-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 0.875rem;
  gap: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.1s ease;
}

.mobile-music-library__track-item:last-child {
  border-bottom: none;
}

.mobile-music-library__track-item:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.mobile-music-library__track-index {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--a-color-muted, #94a3b8);
  width: 1.5rem;
  flex-shrink: 0;
}

.mobile-music-library__track-cover {
  width: 38px;
  height: 38px;
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  background: var(--a-color-surface-muted, #f1f5f9);
  flex-shrink: 0;
}

.mobile-music-library__track-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-library__track-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted, #94a3b8);
}

.mobile-music-library__track-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 0.125rem;
}

.mobile-music-library__track-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-music-library__track-sub {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-music-library__track-end {
  flex-shrink: 0;
}

.mobile-music-library__track-duration {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--a-color-muted, #94a3b8);
}

.mobile-music-library__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--a-color-muted, #94a3b8);
  border: 1px dashed var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  margin-top: 0.5rem;
}

.mobile-music-library__empty-icon {
  margin-bottom: 0.5rem;
  opacity: 0.6;
}

.mobile-music-library__empty-text {
  font-size: 0.875rem;
  margin: 0;
}
</style>
