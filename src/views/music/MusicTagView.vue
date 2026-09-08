<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { IconInfoCircle as Info, IconPlayerPlay as Play } from '@tabler/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getMusicTag,
  listMusicAlbums,
  listMusicSongs,
  type MusicAlbumListItem,
  type MusicSongListItem,
  type MusicTagOption,
} from '@/api/musicV1'
import { MusicAlbumCard } from '@/components/music'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

type TagView = 'songs' | 'albums'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const tag = ref<MusicTagOption | null>(null)
const selectedView = ref<TagView>('songs')
const songs = ref<MusicSongListItem[]>([])
const albums = ref<MusicAlbumListItem[]>([])
const loading = ref(false)
const error = ref('')
const meta = ref({ page: 1, page_size: 20, total: 0, has_more: false })
let requestID = 0

const viewOptions = [
  { label: '歌曲', value: 'songs' as const, testid: 'tag-view-songs' },
  { label: '专辑', value: 'albums' as const, testid: 'tag-view-albums' },
]

const tagID = computed(() => typeof route.params.tagId === 'string' ? route.params.tagId : '')
const kindLabel = computed(() => {
  if (tag.value?.kind === 'type') return '类型标签'
  if (tag.value?.kind === 'mood') return '情绪标签'
  return '音乐标签'
})
const currentLabel = computed(() => selectedView.value === 'albums' ? '专辑' : '歌曲')
const hasResults = computed(() => selectedView.value === 'albums' ? albums.value.length > 0 : songs.value.length > 0)

function routeView(value: unknown): TagView {
  return value === 'albums' ? 'albums' : 'songs'
}

function clearResults() {
  songs.value = []
  albums.value = []
  meta.value = { page: 1, page_size: 20, total: 0, has_more: false }
}

async function loadPage(targetPage = 1) {
  const id = tagID.value
  if (!id) {
    clearResults()
    error.value = '标签不存在'
    return
  }

  const current = ++requestID
  loading.value = true
  error.value = ''
  try {
    if (!tag.value || tag.value.id !== id) {
      tag.value = await getMusicTag(id)
    }
    if (current !== requestID) return

    const filters = { tag_id: id, page: targetPage, page_size: 20, sort: '-release_date' as const }
    if (selectedView.value === 'albums') {
      const result = await listMusicAlbums(filters)
      if (current !== requestID) return
      songs.value = []
      albums.value = result.data
      meta.value = result.meta
      return
    }

    const result = await listMusicSongs(filters)
    if (current !== requestID) return
    albums.value = []
    songs.value = result.data
    meta.value = result.meta
  } catch {
    if (current === requestID) {
      clearResults()
      error.value = '标签内容加载失败，请重试'
    }
  } finally {
    if (current === requestID) loading.value = false
  }
}

function changeView(value: TagView) {
  if (value === selectedView.value) return
  selectedView.value = value
  void router.replace({
    path: route.path,
    query: { ...route.query, view: value },
  })
}

function playSong(song: MusicSongListItem) {
  if (!song.audio_url) return
  player.playSong({
    id: song.id,
    title: song.title,
    artist: song.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家',
    album: song.album?.title || '',
    album_id: song.album?.id || '',
    year: song.album?.year || 0,
    release_date: song.album?.release_date || '',
    lyrics: song.lyrics || '',
    audio_url: song.audio_url,
    cover_url: song.cover_url || song.album?.cover_url || '',
    status: 'approved',
    track_number: song.track_number,
  } satisfies Song)
}

function openAlbum(albumID: string) {
  void router.push(`/music/album/${encodeURIComponent(albumID)}`)
}

function openArtist(artistID: string) {
  void router.push(`/music/artist/${encodeURIComponent(artistID)}`)
}

watch(
  () => [route.params.tagId, route.query.view] as const,
  ([nextTagID, nextView]) => {
    selectedView.value = routeView(nextView)
    if (typeof nextTagID === 'string' && tag.value?.id !== nextTagID) tag.value = null
    void loadPage(1)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  requestID += 1
})
</script>

<template>
  <main class="music-tag-view" data-testid="music-tag-view">
    <PPageHeader
      :kicker="kindLabel"
      :title="tag?.name || '标签'"
      mb="0"
    >
      <template #action>
        <PSegmentedControl
          :model-value="selectedView"
          :options="viewOptions"
          @update:model-value="changeView"
        />
      </template>
    </PPageHeader>

    <PContentProgress :loading="loading" :error="error" :retry="() => loadPage(1)">
      <template #skeleton>
        <div v-if="selectedView === 'songs'" class="tag-song-list">
          <div v-for="index in 6" :key="index" class="tag-song-row tag-song-row--skeleton">
            <PSkeleton width="2.75rem" height="2.75rem" />
            <span class="tag-song-copy">
              <PSkeleton width="45%" height="1rem" />
              <PSkeleton width="30%" height="0.8rem" />
            </span>
          </div>
        </div>
        <div v-else class="tag-album-grid">
          <div v-for="index in 6" :key="index" class="tag-album-skeleton">
            <div class="tag-album-skeleton__cover"><PSkeleton height="100%" /></div>
            <PSkeleton width="70%" height="1rem" />
            <PSkeleton width="45%" height="0.8rem" />
          </div>
        </div>
      </template>

      <PEmpty
        v-if="!hasResults"
        :title="`暂无${currentLabel}`"
        :description="`还没有内容使用“${tag?.name || '此标签'}”`"
      />

      <section v-else class="music-tag-results" :aria-label="`${currentLabel}列表`">
        <header class="music-tag-results__header">
          <h2>{{ currentLabel }}</h2>
          <span>{{ meta.total }} 项</span>
        </header>

        <div v-if="selectedView === 'songs'" class="tag-song-list">
          <article v-for="song in songs" :key="song.id" class="tag-song-row" :data-testid="`tag-song-${song.id}`">
            <button
              type="button"
              class="tag-song-play"
              :disabled="!song.audio_url"
              :aria-label="`播放 ${song.title}`"
              :title="`播放 ${song.title}`"
              @click="playSong(song)"
            >
              <Play :size="16" aria-hidden="true" />
            </button>
            <div class="tag-song-copy">
              <RouterLink :to="`/music/song/${song.id}`" class="tag-song-title">{{ song.title }}</RouterLink>
              <div class="tag-song-meta">
                <template v-if="song.artists?.length">
                  <template v-for="(artist, index) in song.artists" :key="artist.id">
                    <span v-if="index" aria-hidden="true"> / </span>
                    <RouterLink v-if="artist.id" :to="`/music/artist/${artist.id}`" @click="openArtist(artist.id)">{{ artist.name }}</RouterLink>
                    <span v-else>{{ artist.name }}</span>
                  </template>
                </template>
                <span v-else>未知艺术家</span>
                <template v-if="song.album?.id">
                  <span aria-hidden="true"> · </span>
                  <RouterLink :to="`/music/album/${song.album.id}`">{{ song.album.title }}</RouterLink>
                </template>
              </div>
            </div>
            <RouterLink
              :to="`/music/song/${song.id}`"
              class="tag-song-info"
              :aria-label="`查看 ${song.title}`"
              :title="`查看 ${song.title}`"
            >
              <Info :size="16" aria-hidden="true" />
            </RouterLink>
          </article>
        </div>

        <div v-else class="tag-album-grid">
          <MusicAlbumCard
            v-for="album in albums"
            :key="album.id"
            :album="album"
            :show-bookmark="false"
            @click="openAlbum(album.id)"
            @click-artist="openArtist"
          />
        </div>

        <PaginationBar
          v-if="meta.total > 0"
          :meta="meta"
          :loading="loading"
          @change="loadPage"
        />
      </section>
    </PContentProgress>
  </main>
</template>

<style scoped>
.music-tag-view {
  display: grid;
  gap: 1.25rem;
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 0 3rem;
}

.music-tag-results {
  display: grid;
  gap: 0.75rem;
}

.music-tag-results__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.music-tag-results__header h2,
.music-tag-results__header span {
  margin: 0;
}

.music-tag-results__header h2 {
  color: var(--a-color-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.music-tag-results__header span {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.tag-song-list {
  display: grid;
  border-top: 2px solid var(--a-color-border);
  border-bottom: 2px solid var(--a-color-border);
}

.tag-song-row {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) 2.5rem;
  min-height: 3.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.tag-song-row:last-child {
  border-bottom: 0;
}

.tag-song-row--skeleton {
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.tag-song-copy {
  display: grid;
  align-content: center;
  min-width: 0;
  gap: 0.2rem;
}

.tag-song-play,
.tag-song-info {
  display: grid;
  min-height: 3.25rem;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
}

.tag-song-play {
  cursor: pointer;
}

.tag-song-play:hover:not(:disabled),
.tag-song-info:hover {
  color: var(--a-color-text);
  background: var(--a-color-surface-muted);
}

.tag-song-play:disabled {
  cursor: default;
  opacity: 0.45;
}

.tag-song-title,
.tag-song-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-song-title {
  justify-self: start;
  color: var(--a-color-text);
  font-size: 0.92rem;
  font-weight: 600;
  text-decoration: none;
}

.tag-song-meta {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.tag-song-meta a {
  color: inherit;
  text-decoration: none;
}

.tag-song-title:hover,
.tag-song-meta a:hover {
  text-decoration: underline;
}

.tag-album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 1.25rem;
}

.tag-album-skeleton {
  display: grid;
  gap: 0.75rem;
}

.tag-album-skeleton__cover {
  aspect-ratio: 1;
}

.tag-song-title:focus-visible,
.tag-song-meta a:focus-visible,
.tag-song-play:focus-visible,
.tag-song-info:focus-visible {
  outline: 2px solid var(--a-color-focus, var(--a-color-text));
  outline-offset: 2px;
}

@media (max-width: 720px) {
  .music-tag-view {
    padding-inline: 1rem;
  }

  .tag-album-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
}
</style>
