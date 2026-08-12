<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Clock3, Heart, History, ListPlus, Pencil, Play, Plus, StepForward } from 'lucide-vue-next'
import { addMusicSongToLater, getMusicSongDetail, type MusicSongDetail, type MusicSongListItem, type MusicSongLyrics } from '@/api/musicV1'
import MusicLyricsLine from '@/components/music/MusicLyricsLine.vue'
import MusicSongLyricsEditorDrawer from '@/components/music/MusicSongLyricsEditorDrawer.vue'
import PButton from '@/components/ui/PButton.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PToast from '@/components/ui/PToast.vue'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import { useRoute } from 'vue-router'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import { useMusicLyrics } from '@/composables/useMusicLyrics'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { reportError } from '@/utils/logger'
import { getActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const player = usePlayerStore()
const { state, openAlbum, openArtist, openMusicEditor, openNestedAction } = useMusicDrawers()
const { requireLogin } = useLoginRedirect()
const authStore = getActivePinia() ? useAuthStore() : { isAuthenticated: false }
const { favoriteSongIds, playlists, loadFavoriteSongs, loadPlaylists, toggleFavoriteSong, addSongToPlaylist } = useMusicFavoritePlaylist()
const detail = ref<MusicSongDetail | null>(null)
const loading = ref(false)
const error = ref('')
const actionBusy = ref('')
const toastVisible = ref(false)
const toastMessage = ref('')
const detailRequests = useRequestGeneration()
const {
  lyrics,
  loading: lyricsLoading,
  errorMessage: lyricsError,
  load: loadLyrics,
  currentLine: currentLyricLine,
} = useMusicLyrics()
const lyricsEditorOpen = ref(false)
const lyricsDisplayMode = ref<'original' | 'translation'>('original')
const lyricsDisplayOptions = [
  { label: '原文', value: 'original' },
  { label: '翻译', value: 'translation' },
]

function playable(song: MusicSongListItem): Song {
  return {
    id: song.id,
    title: song.title,
    artist: song.artists?.map(artist => artist.name).join(' / ') || '未知艺术家',
    album: song.album?.title || '',
    album_id: song.album?.id || '',
    year: 0,
    release_date: '',
    lyrics: song.lyrics || '',
    audio_url: song.audio_url || '',
    waveform_peaks: song.waveform_peaks,
    cover_url: song.cover_url || song.album?.cover_url || '',
    status: 'approved',
  }
}

const roleGroups = computed(() => {
  const groups = new Map<string, Array<{ id: string; name: string }>>()
  for (const artist of detail.value?.artists ?? []) {
    const role = artist.role === 'custom'
      ? artist.custom_role?.trim() || '自定义'
      : artist.role || 'primary'
    groups.set(role, [...(groups.get(role) ?? []), artist])
  }
  return [...groups.entries()]
})
const roleLabels: Record<string, string> = {
  primary: '主艺术家', featured: '合作艺术家', vocals: '演唱', backing_vocals: '和声',
  writer: '作词', composer: '作曲', arranger: '编曲', producer: '制作人', vocal_producer: '人声制作',
  recording_engineer: '录音', mixing_engineer: '混音', mastering_engineer: '母带', remixer: '重混',
}
const hasTranslation = computed(() => Boolean(lyrics.value?.translation.trim()))
const activeLyricLineId = computed(() => {
  if (!detail.value || String(player.currentSong?.id ?? '') !== String(detail.value.song.id)) return ''
  const line = currentLyricLine(player.currentTime ?? 0)
  return line?.line_key ?? line?.id ?? ''
})

function showToast(message: string) {
  toastMessage.value = message
  toastVisible.value = true
}

function queueSong(playNext: boolean) {
  if (!detail.value?.playable) return
  player.addToQueue(playable(detail.value.song), playNext)
  showToast(playNext ? '已设为下一首' : '已加入队列')
}

async function toggleFavorite() {
  if (!detail.value || !requireLogin()) return
  actionBusy.value = 'favorite'
  try {
    const result = await toggleFavoriteSong(String(detail.value.song.id))
    showToast(result.message)
  } catch (cause) {
    reportError(cause, '更新最爱歌单失败')
    showToast('操作失败')
  } finally {
    actionBusy.value = ''
  }
}

async function addToPlaylist(playlistId: string) {
  if (!detail.value || !requireLogin()) return
  actionBusy.value = 'playlist'
  try {
    await addSongToPlaylist(playlistId, String(detail.value.song.id))
    showToast('已添加到歌单')
  } catch (cause) {
    reportError(cause, '添加歌曲到歌单失败')
    showToast('添加失败')
  } finally {
    actionBusy.value = ''
  }
}

function preparePlaylistMenu(event: MouseEvent) {
  if (!requireLogin()) {
    event.stopPropagation()
    return
  }
  if (!playlists.value.length) void loadPlaylists()
}

async function addToLater() {
  if (!detail.value || !requireLogin()) return
  actionBusy.value = 'later'
  try {
    await addMusicSongToLater(String(detail.value.song.id))
    showToast('已加入稍后播放')
  } catch (cause) {
    reportError(cause, '加入稍后播放失败')
    showToast('操作失败')
  } finally {
    actionBusy.value = ''
  }
}

function editSong() {
  if (!detail.value || !requireLogin()) return
  openMusicEditor({ entity: 'song', mode: 'edit', id: String(detail.value.song.id) })
}

function openSongHistory() {
  if (!detail.value || !requireLogin()) return
  openNestedAction('song_history', { songId: String(detail.value.song.id) })
}

function openLyricsEditor() {
  if (!detail.value || !requireLogin()) return
  lyricsEditorOpen.value = true
}

function handleLyricsSaved(updated: MusicSongLyrics) {
  if (!detail.value || String(updated.song_id) !== String(detail.value.song.id)) return
  lyrics.value = updated
  detail.value.song.lyrics = updated.content
  lyricsEditorOpen.value = false
}

async function loadDetail(songId: unknown) {
  if (typeof songId !== 'string' || !songId) return
  const request = detailRequests.beginRequest()
  loading.value = true
  error.value = ''
  try {
    const response = await getMusicSongDetail(songId)
    if (!request.isCurrent()) return
    detail.value = response
    try {
      if (!authStore.isAuthenticated) {
        favoriteSongIds.value = new Set()
        return
      }
      await loadFavoriteSongs([String(detail.value.song.id)])
    } catch (cause) {
      reportError(cause, '加载最爱状态失败')
      favoriteSongIds.value = new Set()
    }
  } catch {
    if (!request.isCurrent()) return
    detail.value = null
    error.value = '歌曲无法加载'
  } finally {
    if (request.isCurrent()) loading.value = false
  }
}

function reloadLyrics() {
  const songId = route.params.songId
  if (typeof songId === 'string' && songId) {
    void loadLyrics(songId)
  }
}

watch(
  [() => route.params.songId, () => state.value.songRefreshToken],
  ([songId]) => {
    lyricsEditorOpen.value = false
    lyricsDisplayMode.value = 'original'
    void loadDetail(songId)
    if (typeof songId === 'string' && songId) void loadLyrics(songId)
  },
  { immediate: true },
)
</script>

<template>
  <main class="song-detail">
    <p v-if="loading" class="song-detail__state">正在加载</p>
    <p v-else-if="error" class="song-detail__state song-detail__state--error">{{ error }}</p>
    <section v-else-if="detail" class="song-detail__content">
      <MusicSongLyricsEditorDrawer
        :show="lyricsEditorOpen"
        :song-id="String(detail.song.id)"
        :song-title="detail.song.title"
        @close="lyricsEditorOpen = false"
        @saved="handleLyricsSaved"
      />
      <img v-if="detail.song.cover_url || detail.song.album?.cover_url" :src="detail.song.cover_url || detail.song.album?.cover_url" :alt="`${detail.song.title} 封面`" class="song-detail__cover">
      <div class="song-detail__main">
        <button v-if="detail.song.album?.id" type="button" class="song-detail__album song-detail__entity-link" @click="openAlbum(String(detail.song.album.id))">{{ detail.song.album.title }}</button>
        <p v-else class="song-detail__album">单曲</p>
        <h1>{{ detail.song.title }}</h1>
        <div v-for="[role, artists] in roleGroups" :key="role" class="song-detail__artists">
          <span>{{ roleLabels[role] || role }}</span>
          <button v-for="artist in artists" :key="artist.id" type="button" class="song-detail__entity-link" @click="openArtist(String(artist.id))">{{ artist.name }}</button>
        </div>
        <div class="song-detail__actions">
          <PButton :disabled="!detail.playable" @click="player.playSong(playable(detail.song))"><Play :size="16" aria-hidden="true" />播放</PButton>
          <PButton variant="secondary" :loading="actionBusy === 'favorite'" @click="toggleFavorite"><Heart :size="16" :fill="favoriteSongIds.has(String(detail.song.id)) ? 'currentColor' : 'none'" aria-hidden="true" />{{ favoriteSongIds.has(String(detail.song.id)) ? '移出最爱' : '加入最爱' }}</PButton>
          <PDropdown position="right">
            <template #trigger>
              <PButton variant="secondary" @click="preparePlaylistMenu"><Plus :size="16" aria-hidden="true" />添加到歌单</PButton>
            </template>
            <div class="song-detail__playlist-menu">
              <p v-if="!playlists.length">暂无歌单</p>
              <button v-for="playlist in playlists" :key="playlist.id" type="button" @click="addToPlaylist(String(playlist.id))">{{ playlist.name }}</button>
            </div>
          </PDropdown>
          <PButton variant="secondary" :disabled="!detail.playable" @click="queueSong(true)"><StepForward :size="16" aria-hidden="true" />下一首</PButton>
          <PButton variant="secondary" :disabled="!detail.playable" @click="queueSong(false)"><ListPlus :size="16" aria-hidden="true" />加入队列</PButton>
          <PButton variant="secondary" :loading="actionBusy === 'later'" @click="addToLater"><Clock3 :size="16" aria-hidden="true" />稍后播放</PButton>
          <PButton variant="secondary" @click="editSong"><Pencil :size="16" aria-hidden="true" />编辑</PButton>
          <PButton variant="secondary" @click="openSongHistory"><History :size="16" aria-hidden="true" />版本记录</PButton>
        </div>
      </div>
      <section class="song-detail__lyrics">
        <header class="song-detail__lyrics-header">
          <h2>歌词</h2>
          <div class="song-detail__lyrics-actions">
            <PButton
              v-if="hasTranslation"
              size="sm"
              :variant="lyricsDisplayMode === 'original' ? 'primary' : 'secondary'"
              @click="lyricsDisplayMode = 'original'"
            >
              原文
            </PButton>
            <PButton
              v-if="hasTranslation"
              size="sm"
              :variant="lyricsDisplayMode === 'translation' ? 'primary' : 'secondary'"
              @click="lyricsDisplayMode = 'translation'"
            >
              翻译
            </PButton>
            <PButton
              data-testid="song-detail-edit-lyrics"
              size="sm"
              variant="warning"
              @click="openLyricsEditor"
            >
              编辑
            </PButton>
          </div>
        </header>
        <PContentProgress
          :loading="lyricsLoading"
          :error="lyricsError"
          :retry="reloadLyrics"
        >
          <template #skeleton>
            <div style="padding: 1.5rem 0; display: flex; flex-direction: column; gap: 0.75rem;">
              <PSkeleton width="50%" height="18px" />
              <PSkeleton width="70%" height="18px" />
              <PSkeleton width="40%" height="18px" />
              <PSkeleton width="60%" height="18px" />
            </div>
          </template>

          <p v-if="!lyrics?.lines.length" class="song-detail__state">暂无歌词</p>
          <div v-else class="song-detail__lyric-lines">
            <MusicLyricsLine
              v-for="line in lyrics.lines"
              :key="line.line_key ?? line.id ?? `${line.line_index}-${line.text}`"
              :line="line"
              :active="activeLyricLineId === (line.line_key ?? line.id ?? '')"
              :bilingual="lyricsDisplayMode === 'translation'"
              :can-select="false"
            />
          </div>
        </PContentProgress>
      </section>
      <nav class="song-detail__navigation" aria-label="相邻曲目">
        <RouterLink v-if="detail.previous" :to="`/music/song/${detail.previous.id}`"><ChevronLeft :size="16" aria-hidden="true" />{{ detail.previous.title }}</RouterLink>
        <RouterLink v-if="detail.next" :to="`/music/song/${detail.next.id}`">{{ detail.next.title }}<ChevronRight :size="16" aria-hidden="true" /></RouterLink>
      </nav>
    </section>
    <PToast v-model="toastVisible" :message="toastMessage" type="success" />
  </main>
</template>

<style scoped>
.song-detail { max-width: 56rem; margin: 0 auto; padding: 1.5rem; }
.song-detail__content { display: grid; grid-template-columns: minmax(10rem, 16rem) minmax(0, 1fr); gap: 1.5rem; }
.song-detail__cover { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: var(--a-color-bg-subtle); }
.song-detail__main { display: grid; align-content: center; justify-items: start; gap: 0.75rem; }
.song-detail__main h1, .song-detail__album { margin: 0; }
.song-detail__album, .song-detail__artists span, .song-detail__state { color: var(--a-color-muted); }
.song-detail__artists { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.song-detail__artists a { color: inherit; }
.song-detail__entity-link { border: 0; padding: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; text-decoration: underline; }
.song-detail__navigation { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--a-color-border-soft); padding-top: 1rem; }
.song-detail__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.song-detail__playlist-menu { display: grid; min-width: 12rem; padding: 0.35rem; }
.song-detail__playlist-menu p { margin: 0; padding: 0.65rem; color: var(--a-color-muted); }
.song-detail__playlist-menu button { border: 0; border-radius: var(--a-radius-control); padding: 0.6rem 0.7rem; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.song-detail__playlist-menu button:hover { background: var(--a-color-surface-muted); }
.song-detail__lyrics { grid-column: 1 / -1; border-top: 1px solid var(--a-color-border-soft); padding-top: 1rem; }
.song-detail__lyrics-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
.song-detail__lyrics h2 { margin: 0; font-size: 1rem; }
.song-detail__lyrics-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.5rem; }
.song-detail__lyric-lines { display: grid; gap: 0.15rem; max-height: 32rem; overflow-y: auto; overflow-x: hidden; }
.song-detail__lyric-lines :deep(.music-lyrics-line) { opacity: 1; }
.song-detail__lyric-lines :deep(.music-lyrics-line__text) { font-size: 1rem; line-height: 1.65; }
.song-detail__navigation a { display: inline-flex; gap: 0.25rem; align-items: center; color: inherit; min-width: 0; }
.song-detail__state--error { color: var(--a-color-accent-destructive); }
@media (max-width: 640px) { .song-detail { padding: 1rem; } .song-detail__content { grid-template-columns: 1fr; } .song-detail__cover { max-width: 18rem; } .song-detail__lyrics-header { align-items: flex-start; flex-direction: column; } .song-detail__lyrics-actions { justify-content: flex-start; } }
</style>
