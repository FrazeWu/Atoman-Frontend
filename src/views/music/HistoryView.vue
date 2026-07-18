<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Clock3, Play } from 'lucide-vue-next'
import {
  listMusicListeningHistory,
  type MusicListeningHistory,
} from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

const pageSize = 20
const player = usePlayerStore()
const historyItems = ref<MusicListeningHistory[]>([])
const currentPage = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const errorMessage = ref('')

const playableSongs = computed<Song[]>(() => historyItems.value
  .filter((item) => Boolean(item.song.audio_url))
  .map((item) => ({
    id: item.song.id,
    title: item.song.title,
    artist: item.song.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家',
    album: item.song.album?.title || '',
    album_id: item.song.album?.id || '',
    year: 0,
    release_date: '',
    lyrics: item.song.lyrics || '',
    audio_url: item.song.audio_url || '',
    cover_url: item.song.cover_url || item.song.album?.cover_url || '',
    track_number: item.song.track_number,
    status: (item.song.status as Song['status']) || 'approved',
    artists: item.song.artists?.map((artist) => ({
      id: artist.id,
      name: artist.name,
      username: '',
      email: '',
    })),
  })))

async function loadPage(page: number) {
  if (loading.value || loadingMore.value) return
  const isFirstPage = page === 1
  if (isFirstPage) loading.value = true
  else loadingMore.value = true
  errorMessage.value = ''

  try {
    const response = await listMusicListeningHistory({ page, page_size: pageSize })
    historyItems.value = isFirstPage
      ? response.data
      : [...historyItems.value, ...response.data]
    currentPage.value = response.meta.page
    hasMore.value = response.meta.has_more
  } catch (error) {
    console.error('Failed to load music listening history:', error)
    errorMessage.value = '播放历史加载失败'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function playHistorySong(songId: string) {
  const index = playableSongs.value.findIndex((song) => String(song.id) === songId)
  if (index >= 0) player.playAlbum(playableSongs.value, index)
}

function formatPlayedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

onMounted(() => loadPage(1))
</script>

<template>
  <div class="music-history-view">
    <PPageHeader title="播放历史" mb="0" />

    <p v-if="loading" class="history-state">正在加载...</p>
    <p v-else-if="errorMessage && !historyItems.length" class="history-state history-state--error">
      {{ errorMessage }}
    </p>
    <div v-else-if="!historyItems.length" class="history-empty" role="status">
      <Clock3 :size="28" aria-hidden="true" />
      <h2>暂无播放记录</h2>
    </div>

    <template v-else>
      <ol class="history-list" aria-label="播放历史列表">
        <li
          v-for="item in historyItems"
          :key="item.id"
          class="history-row"
          data-testid="history-row"
        >
          <button
            type="button"
            class="history-song"
            :data-testid="`history-play-${item.song.id}`"
            :disabled="!item.song.audio_url"
            :aria-label="`播放 ${item.song.title}`"
            @click="playHistorySong(String(item.song.id))"
          >
            <span class="history-cover">
              <img
                v-if="item.song.cover_url || item.song.album?.cover_url"
                :src="item.song.cover_url || item.song.album?.cover_url"
                :alt="item.song.title"
              />
              <span v-else class="history-cover__empty" aria-hidden="true" />
              <span v-if="item.song.audio_url" class="history-play-icon" aria-hidden="true">
                <Play :size="15" fill="currentColor" />
              </span>
            </span>
            <span class="history-copy">
              <strong>{{ item.song.title }}</strong>
              <span>{{ item.song.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家' }}</span>
            </span>
          </button>

          <span class="history-album">{{ item.song.album?.title || '未知专辑' }}</span>
          <span class="history-count">播放 {{ item.play_count }} 次</span>
          <time class="history-time" :datetime="item.last_played_at">
            {{ formatPlayedAt(item.last_played_at) }}
          </time>
        </li>
      </ol>

      <p v-if="errorMessage" class="history-state history-state--error">{{ errorMessage }}</p>
      <div v-if="hasMore" class="history-more">
        <PButton
          outline
          :loading="loadingMore"
          loading-text="正在加载..."
          data-testid="history-load-more"
          @click="loadPage(currentPage + 1)"
        >
          加载更多
        </PButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
.music-history-view {
  display: grid;
  gap: 1.5rem;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--a-color-border-soft);
}

.history-row {
  display: grid;
  grid-template-columns: minmax(15rem, 1.8fr) minmax(10rem, 1fr) 7rem 10rem;
  gap: 1rem;
  align-items: center;
  min-height: 72px;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.history-song {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.history-song:disabled {
  cursor: default;
}

.history-cover {
  position: relative;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.history-cover img,
.history-cover__empty {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.history-play-icon {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--a-color-text) 56%, transparent);
  color: var(--a-color-bg);
  opacity: 0;
  transition: opacity 0.16s ease;
}

.history-song:hover .history-play-icon,
.history-song:focus-visible .history-play-icon {
  opacity: 1;
}

.history-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.history-copy strong,
.history-copy span,
.history-album {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-copy strong {
  font-size: 0.95rem;
}

.history-copy span,
.history-album,
.history-count,
.history-time {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.history-count,
.history-time {
  white-space: nowrap;
}

.history-time {
  text-align: right;
}

.history-more {
  display: flex;
  justify-content: center;
}

.history-state {
  margin: 0;
  color: var(--a-color-muted);
}

.history-state--error {
  color: var(--a-color-accent-destructive);
}

.history-empty {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 4rem 1rem;
  border-top: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
}

.history-empty h2 {
  margin: 0;
  font-size: 1rem;
}

@media (max-width: 900px) {
  .history-row {
    grid-template-columns: minmax(12rem, 1fr) auto;
  }

  .history-album {
    display: none;
  }

  .history-count {
    text-align: right;
  }

  .history-time {
    grid-column: 2;
    font-size: 0.72rem;
  }
}

@media (max-width: 600px) {
  .music-history-view {
    padding-bottom: calc(6rem + env(safe-area-inset-bottom));
  }

  .history-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem 0.75rem;
  }

  .history-count {
    align-self: start;
  }

  .history-time {
    grid-column: 1 / -1;
    text-align: left;
    padding-left: calc(48px + 0.85rem);
  }
}
</style>
