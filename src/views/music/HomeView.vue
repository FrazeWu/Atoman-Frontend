<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getActivePinia } from 'pinia'
import { useRoute } from 'vue-router'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'
import ExploreView from '@/views/music/ExploreView.vue'
import PButton from '@/components/ui/PButton.vue'
import { MusicAlbumCard } from '@/components/music'
import { useAuthStore } from '@/stores/auth'
import { usePendingMusicLyricsAnnotations } from '@/composables/usePendingMusicLyricsAnnotations'
import { getMusicHome, type MusicHome, type MusicSongListItem } from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import { reportError } from '@/utils/logger'

const route = useRoute()
const authStore = getActivePinia() ? useAuthStore() : null
const player = usePlayerStore()
const musicHome = ref<MusicHome | null>(null)
const musicHomeLoading = ref(false)
const { pendingMusicLyricsAnnotations: pendingRebindNotifications, loadPendingMusicLyricsAnnotations } = usePendingMusicLyricsAnnotations()
const pendingRebindCount = computed(() => pendingRebindNotifications.value.length)
const pendingRebindUserId = computed(() => {
  const user = authStore?.user
  if (!user) return ''
  return user.uuid ?? (user.id === undefined ? '' : String(user.id))
})
const {
  isMainShifted,
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  openMusicEditor,
  closeMusicEditor,
} = useMusicDrawers()
const { applyRouteSelection } = useMusicRouteSelection({
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  openMusicEditor,
  closeMusicEditor,
})

async function loadPendingRebindNotifications() {
  await loadPendingMusicLyricsAnnotations(
    Boolean(authStore?.isAuthenticated),
    authStore?.token ?? null,
    pendingRebindUserId.value,
  )
}

async function loadMusicHome() {
  musicHome.value = null
  musicHomeLoading.value = true
  try {
    musicHome.value = await getMusicHome()
  } catch (error) {
    reportError(error, '加载音乐首页失败')
  } finally {
    musicHomeLoading.value = false
  }
}

function toPlayableSong(song: MusicSongListItem): Song | null {
  if (!song.audio_url) return null
  return {
    id: song.id,
    title: song.title,
    artist: song.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家',
    album: song.album?.title || '',
    album_id: song.album?.id || '',
    year: 0,
    release_date: '',
    lyrics: song.lyrics || '',
    audio_url: song.audio_url,
    cover_url: song.cover_url || song.album?.cover_url || '',
    track_number: song.track_number || 0,
    status: (song.status as Song['status']) || 'approved',
    artists: song.artists?.map((artist) => ({
      id: artist.id,
      name: artist.name,
      username: '',
      email: '',
    })),
  }
}

function playRecentSong(song: MusicSongListItem) {
  const playable = toPlayableSong(song)
  if (playable) player.playSong(playable)
}

async function openFirstPendingRebind() {
  const notification = pendingRebindNotifications.value[0]
  if (!notification) return
  const router = (await import('@/router')).default
  await router.push({
    path: `/music/album/${notification.album_id}`,
    query: { song_id: notification.song_id, annotation_id: notification.annotation_id, rebind: '1' },
  })
}

watch(
  () => [authStore?.isAuthenticated, authStore?.token, pendingRebindUserId.value],
  () => {
    void loadPendingRebindNotifications()
    void loadMusicHome()
  },
  { immediate: true },
)

watch(
  () => [route.query.artist, route.query.album, route.query.editor, route.query.name],
  () => applyRouteSelection(route.query),
  { immediate: true },
)
</script>

<template>
  <div class="music-base-view">
    <div v-if="pendingRebindCount" class="music-pending-rebind">
      <PButton variant="secondary" data-testid="music-pending-rebind" @click="openFirstPendingRebind">
        待重新绑定 {{ pendingRebindCount }}
      </PButton>
    </div>
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <div v-if="musicHomeLoading" class="music-home-state">正在加载...</div>
      <template v-else-if="musicHome?.personalized">
        <section v-if="musicHome.recently_played.length" class="music-home-section" aria-labelledby="recently-played-title">
          <header class="music-home-section__header">
            <h2 id="recently-played-title">最近播放</h2>
          </header>
          <div class="recently-played-list">
            <button
              v-for="item in musicHome.recently_played"
              :key="item.id"
              type="button"
              class="recently-played-item"
              :disabled="!item.song.audio_url"
              @click="playRecentSong(item.song)"
            >
              <img v-if="item.song.cover_url || item.song.album?.cover_url" :src="item.song.cover_url || item.song.album?.cover_url" :alt="item.song.title" />
              <span v-else class="recently-played-item__cover" aria-hidden="true" />
              <span class="recently-played-item__copy">
                <strong>{{ item.song.title }}</strong>
                <span>{{ item.song.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家' }}<template v-if="item.song.album?.title"> · {{ item.song.album.title }}</template></span>
              </span>
            </button>
          </div>
        </section>

        <section v-if="musicHome.for_you.length" class="music-home-section" aria-labelledby="for-you-title">
          <header class="music-home-section__header">
            <h2 id="for-you-title">为你发现</h2>
          </header>
          <div class="music-home-albums">
            <button
              v-for="album in musicHome.for_you"
              :key="album.id"
              type="button"
              class="music-home-album-button"
              :aria-label="`打开专辑 ${album.title}`"
              @click="openAlbum(album.id)"
            >
              <MusicAlbumCard :album="album" :show-bookmark="false" />
            </button>
          </div>
          <p v-if="musicHome.for_you_reason" class="music-home-section__reason">{{ musicHome.for_you_reason }}</p>
        </section>
      </template>
      <section v-for="section in musicHome?.sections ?? []" :key="section.key" class="music-home-section" :aria-labelledby="`home-${section.key}`">
        <header class="music-home-section__header"><h2 :id="`home-${section.key}`">{{ section.title }}</h2></header>
        <div class="music-home-albums">
          <button v-for="album in section.albums" :key="album.id" type="button" class="music-home-album-button" :aria-label="`打开专辑 ${album.title}`" @click="openAlbum(album.id)"><MusicAlbumCard :album="album" :show-bookmark="false" /></button>
        </div>
      </section>
      <ExploreView page-title="专辑" content-mode="albums" />
    </div>
  </div>
</template>

<style scoped>
.music-base-view {
  position: relative;
}

.music-pending-rebind {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.main-level-1 {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}

.main-level-1.is-shifted {
  pointer-events: none;
}

.music-home-state,
.music-home-section {
  margin-bottom: 2rem;
}

.music-home-section {
  display: grid;
  gap: 0.85rem;
}

.music-home-section__header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.music-home-section__reason { margin: 0; color: var(--a-color-muted); font-size: 0.875rem; }

.recently-played-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.recently-played-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.55rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.recently-played-item:hover,
.recently-played-item:focus-visible {
  border-color: var(--a-color-muted-soft);
}

.recently-played-item:disabled {
  cursor: default;
  opacity: 0.6;
}

.recently-played-item img,
.recently-played-item__cover {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 4px;
  object-fit: cover;
  background: var(--a-color-surface-muted);
}

.recently-played-item__copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.recently-played-item__copy strong,
.recently-played-item__copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recently-played-item__copy strong {
  font-size: 0.86rem;
}

.recently-played-item__copy span {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.music-home-albums {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.music-home-album-button {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.music-home-album-button:focus-visible {
  outline: 2px solid var(--a-color-focus, var(--a-color-text));
  outline-offset: 3px;
}

@media (max-width: 900px) {
  .recently-played-list,
  .music-home-albums {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
