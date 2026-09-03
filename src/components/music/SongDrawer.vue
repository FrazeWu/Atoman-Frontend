<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconClock as Clock3, IconHeart as Heart, IconHistory as History, IconPlaylistAdd as ListPlus, IconPencil as Pencil, IconPlayerPlay as Play, IconPlus as Plus, IconPlayerTrackNext as StepForward } from '@tabler/icons-vue'
import { addMusicSongToLater, deleteMusicSongRating, getMusicSongDetail, setMusicSongRating, type MusicSongDetail, type MusicSongLyricsLine, type MusicSongListItem, type MusicSongLyrics } from '@/api/musicV1'
import MusicAnnotationEditor from '@/components/music/MusicAnnotationEditor.vue'
import MusicLyricsLine from '@/components/music/MusicLyricsLine.vue'
import MusicDescriptionPreview from '@/components/music/MusicDescriptionPreview.vue'
import MusicEntryStateControl from '@/components/music/MusicEntryStateControl.vue'
import MusicSongLyricsEditorDrawer from '@/components/music/MusicSongLyricsEditorDrawer.vue'
import AppleMusicPreview from '@/components/music/AppleMusicPreview.vue'
import SongRatingControl from '@/components/music/SongRatingControl.vue'
import PButton from '@/components/ui/PButton.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PToast from '@/components/ui/PToast.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import { useMusicLyrics } from '@/composables/useMusicLyrics'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { reportError } from '@/utils/logger'
import { formatAlbumTypeLabel } from '@/utils/musicMedia'
import { formatStoredPartialDate } from '@/components/music/birthDateMask'
import { getMountedPinia } from '@/utils/pinia'
import { useAuthStore } from '@/stores/auth'
import type { MusicSheetLayer } from './musicSheetTypes'

type SongLayer = Extract<MusicSheetLayer, { kind: 'song' }>
const props = withDefaults(defineProps<{ layer?: SongLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })
const player = usePlayerStore()
const {
  state,
  closeSong,
  returnToLayer,
  isLayerActive,
  isLayerShifted,
  isTopLayer,
  openAlbum,
  openArtist,
  openMusicCreationFlow,
  openMusicEditor,
  openNestedAction,
} = useMusicDrawers()
const { requireLogin } = useLoginRedirect()
const authStore = getMountedPinia() ? useAuthStore() : { isAuthenticated: false }
const { favoriteSongIds, playlists, loadFavoriteSongs, loadPlaylists, toggleFavoriteSong, addSongToPlaylist } = useMusicFavoritePlaylist()
const songId = computed(() => props.layer?.payload.songId ?? state.value.songId)
const isOpen = computed(() => props.layer ? isLayerActive(props.layer.key) : songId.value !== null)
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrentSong = () => closeSong(props.layer?.key)
const returnCurrentSong = () => props.layer && returnToLayer(props.layer.key)
const detail = ref<MusicSongDetail | null>(null)
const loading = ref(false)
const error = ref('')
const actionBusy = ref('')
const ratingLoading = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const detailRequests = useRequestGeneration()
const {
  lyrics,
  loading: lyricsLoading,
  errorMessage: lyricsError,
  load: loadLyrics,
  createAnnotation,
  currentLine: currentLyricLine,
} = useMusicLyrics()
const lyricsEditorOpen = ref(false)
const lyricsDisplayMode = ref<'original' | 'bilingual'>('original')
const selectedTextDraft = ref<{
  line: MusicSongLyricsLine
  selectedText: string
  startOffset: number
  endOffset: number
} | null>(null)

const sheetTitle = computed(() => detail.value?.song.title?.trim()
  ? `歌曲-${detail.value.song.title.trim()}`
  : '歌曲-加载中')

function playable(song: MusicSongListItem): Song {
  return {
    id: song.id,
    title: song.title,
    artist: song.artists?.map(artist => artist.name).join(' / ') || '未知艺术家',
    album: song.album?.title || '',
    album_id: song.album?.id || '',
    year: Number(song.release_date?.slice(0, 4)) || 0,
    release_date: song.release_date || '',
    lyrics: song.lyrics || '',
    audio_url: song.audio_url || '',
    waveform_peaks: song.waveform_peaks,
    cover_url: song.cover_url || song.album?.cover_url || '',
    status: 'open',
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

const standaloneReleaseLabel = computed(() => formatAlbumTypeLabel(detail.value?.song.release_type))
const formattedReleaseDate = computed(() => {
  const song = detail.value?.song
  if (!song?.release_date) return ''
  return formatStoredPartialDate(song.release_date, song.release_date_precision).replace(/-/g, '/')
})
const effectiveSources = computed(() => detail.value?.song.effective_sources ?? detail.value?.song.sources ?? [])
const appleMusicSource = computed(() => effectiveSources.value.find(source =>
  source.title === 'Apple Music' || source.url?.includes('music.apple.com'),
))

function showToast(message: string) {
  toastMessage.value = message
  toastVisible.value = true
}

function applyRating(summary: { rating_score: number; rating_count: number; viewer_rating?: number | null }) {
  if (!detail.value) return
  detail.value.song.rating_score = Number(summary.rating_score ?? 0)
  detail.value.song.rating_count = Number(summary.rating_count ?? 0)
  detail.value.song.viewer_rating = summary.viewer_rating ?? null
}

async function rateSong(score: number) {
  if (!detail.value || !requireLogin() || ratingLoading.value) return
  ratingLoading.value = true
  try {
    applyRating(await setMusicSongRating(String(detail.value.song.id), score))
  } catch (cause) {
    reportError(cause, '更新歌曲评分失败')
    showToast('评分失败')
  } finally {
    ratingLoading.value = false
  }
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

async function addToPlaylist(playlistId: string, close?: () => void) {
  if (!detail.value || !requireLogin()) return
  actionBusy.value = 'playlist'
  try {
    await addSongToPlaylist(playlistId, String(detail.value.song.id))
    close?.()
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
  const song = detail.value.song
  if (song.release_type === 'single' || song.release_type === 'leak') {
    openMusicCreationFlow({
      mode: 'edit',
      entity: 'song',
      songId: String(song.id),
      startStep: 'albumDetails',
    })
    return
  }
  openMusicEditor({ entity: 'song', mode: 'edit', id: String(song.id) })
}

function openSongHistory() {
  if (!detail.value || !requireLogin()) return
  openNestedAction('song_history', {
    songId: String(detail.value.song.id),
    title: detail.value.song.title,
  })
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

function handleSelectText(payload: {
  line: MusicSongLyricsLine
  selectedText: string
  startOffset: number
  endOffset: number
}) {
  if (!requireLogin()) return
  selectedTextDraft.value = payload
}

function cancelAnnotation() {
  selectedTextDraft.value = null
}

async function saveAnnotation(body: string) {
  if (!detail.value || !selectedTextDraft.value) return
  const lineKey = selectedTextDraft.value.line.line_key ?? selectedTextDraft.value.line.id
  if (!lineKey) return

  await createAnnotation(String(detail.value.song.id), {
    line_key: lineKey,
    selected_text: selectedTextDraft.value.selectedText,
    start_offset: selectedTextDraft.value.startOffset,
    end_offset: selectedTextDraft.value.endOffset,
    body,
  })
  selectedTextDraft.value = null
}

async function loadDetail(targetSongId: unknown) {
  if (typeof targetSongId !== 'string' || !targetSongId) return
  const request = detailRequests.beginRequest()
  loading.value = true
  error.value = ''
  try {
    const response = await getMusicSongDetail(targetSongId)
    if (!request.isCurrent()) return
    detail.value = response
    try {
      if (!authStore.isAuthenticated) {
        favoriteSongIds.value = new Set()
        return
      }
      await loadFavoriteSongs([String(detail.value.song.id)], request.isCurrent)
    } catch (cause) {
      if (!request.isCurrent()) return
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
  if (songId.value) void loadLyrics(songId.value)
}

watch(
  [songId, () => state.value.songRefreshToken],
  ([targetSongId]) => {
    lyricsEditorOpen.value = false
    lyricsDisplayMode.value = 'original'
    selectedTextDraft.value = null
    void loadDetail(targetSongId)
    if (typeof targetSongId === 'string' && targetSongId) void loadLyrics(targetSongId)
  },
  { immediate: true },
)
</script>

<template>
  <PSheet
    :show="isOpen"
    :title="sheetTitle"
    content-max-width="64rem"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :index="layerIndex"
    panel-class="song-drawer"
    @close="closeCurrentSong"
    @activate="returnCurrentSong"
  >
    <main class="song-detail">
      <p v-if="loading" class="song-detail__state">正在加载</p>
      <p v-else-if="error" class="song-detail__state song-detail__state--error">{{ error }}</p>
      <section v-else-if="detail" class="song-detail__content">
        <MusicSongLyricsEditorDrawer
          :show="lyricsEditorOpen"
          :song-id="String(detail.song.id)"
          :song-title="detail.song.title"
          :current-time-seconds="player.currentTime"
          @close="lyricsEditorOpen = false"
          @seek="player.seek"
          @saved="handleLyricsSaved"
        />
        <img v-if="detail.song.cover_url || detail.song.album?.cover_url" :src="detail.song.cover_url || detail.song.album?.cover_url" :alt="`${detail.song.title} 封面`" class="song-detail__cover">
        <div class="song-detail__main">
          <button v-if="detail.song.album?.id" type="button" class="song-detail__album song-detail__entity-link" @click="openAlbum(String(detail.song.album.id))">{{ detail.song.album.title }}</button>
          <p v-else class="song-detail__album">{{ standaloneReleaseLabel }}</p>
          <h1>{{ detail.song.title }}</h1>
          <p v-if="formattedReleaseDate" class="song-detail__release-date">{{ formattedReleaseDate }}</p>
          <SongRatingControl
            :song-title="detail.song.title"
            :rating-score="detail.song.rating_score"
            :rating-count="detail.song.rating_count"
            :viewer-rating="detail.song.viewer_rating"
            :disabled="!authStore.isAuthenticated"
            :loading="ratingLoading"
            @rate="rateSong"
          />
          <MusicEntryStateControl
            entity-type="song"
            :entity-id="String(detail.song.id)"
            :lifecycle-status="detail.song.lifecycle_status"
            :edit-status="detail.song.edit_status"
            @submitted="loadDetail(detail.song.id)"
          />
          <div v-for="[role, artists] in roleGroups" :key="role" class="song-detail__artists">
            <span>{{ roleLabels[role] || role }}</span>
            <button v-for="artist in artists" :key="artist.id" type="button" class="song-detail__entity-link" @click="openArtist(String(artist.id))">{{ artist.name }}</button>
          </div>
          <MusicDescriptionPreview
            v-if="detail.song.description"
            :description="detail.song.description"
            content-id="song-description"
            test-id="song-description-toggle"
            max-width="42rem"
          />
          <div v-if="effectiveSources.length" class="song-detail__sources">
            <span>来源</span>
            <template v-for="(source, index) in effectiveSources" :key="`${source.url || source.title}-${index}`">
              <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title || source.url }}</a>
              <span v-else>{{ source.title }}</span>
            </template>
          </div>
          <AppleMusicPreview
            v-if="appleMusicSource?.url && !detail.playable"
            :song-id="String(detail.song.id)"
            :store-url="appleMusicSource.url"
          />
          <div class="song-detail__actions">
            <PButton :disabled="!detail.playable" @click="player.playSong(playable(detail.song))"><Play :size="16" aria-hidden="true" />播放</PButton>
            <PButton variant="secondary" :loading="actionBusy === 'favorite'" :aria-label="favoriteSongIds.has(String(detail.song.id)) ? '移出最爱' : '加入最爱'" :title="favoriteSongIds.has(String(detail.song.id)) ? '移出最爱' : '加入最爱'" @click="toggleFavorite"><Heart :size="16" :fill="favoriteSongIds.has(String(detail.song.id)) ? 'currentColor' : 'none'" aria-hidden="true" /></PButton>
            <PDropdown position="right">
              <template #trigger>
                <PButton variant="secondary" aria-label="添加到歌单" title="添加到歌单" @click="preparePlaylistMenu"><Plus :size="16" aria-hidden="true" /></PButton>
              </template>
              <template #default="{ close }">
                <div class="song-detail__playlist-menu">
                  <p v-if="!playlists.length">暂无歌单</p>
                  <button v-for="playlist in playlists" :key="playlist.id" type="button" @click="addToPlaylist(String(playlist.id), close)">{{ playlist.name }}</button>
                </div>
              </template>
            </PDropdown>
            <PButton variant="secondary" :disabled="!detail.playable" aria-label="下一首" title="下一首" @click="queueSong(true)"><StepForward :size="16" aria-hidden="true" /></PButton>
            <PButton variant="secondary" :disabled="!detail.playable" aria-label="加入队列" title="加入队列" @click="queueSong(false)"><ListPlus :size="16" aria-hidden="true" /></PButton>
            <PButton variant="secondary" :loading="actionBusy === 'later'" aria-label="稍后播放" title="稍后播放" @click="addToLater"><Clock3 :size="16" aria-hidden="true" /></PButton>
            <PButton variant="secondary" :disabled="detail.song.edit_status !== undefined && (detail.song.edit_status !== 'development' || detail.song.album?.edit_status === 'closed')" aria-label="编辑歌曲" title="编辑歌曲" @click="editSong"><Pencil :size="16" aria-hidden="true" /></PButton>
            <PButton variant="secondary" aria-label="版本记录" title="版本记录" @click="openSongHistory"><History :size="16" aria-hidden="true" /></PButton>
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
                :variant="lyricsDisplayMode === 'bilingual' ? 'primary' : 'secondary'"
                @click="lyricsDisplayMode = 'bilingual'"
              >
                双语
              </PButton>
              <PButton
                data-testid="song-detail-edit-lyrics"
                size="sm"
                variant="warning"
                :disabled="detail.song.edit_status !== undefined && detail.song.edit_status !== 'development'"
                @click="openLyricsEditor"
              >
                编辑
              </PButton>
            </div>
          </header>
          <div
            class="song-detail__lyrics-layout"
            :class="{ 'has-annotation-editor': selectedTextDraft }"
          >
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
                  :bilingual="lyricsDisplayMode === 'bilingual'"
                  :can-select="authStore.isAuthenticated"
                  :can-annotate="authStore.isAuthenticated"
                  @select-text="handleSelectText"
                  @seek="player.seek"
                />
              </div>
            </PContentProgress>

            <MusicAnnotationEditor
              v-if="selectedTextDraft"
              show
              class="song-detail__annotation-editor"
              :selected-text="selectedTextDraft.selectedText"
              @save="saveAnnotation"
              @cancel="cancelAnnotation"
            />
          </div>
        </section>
        <nav class="song-detail__navigation" aria-label="相邻曲目">
          <RouterLink v-if="detail.previous" :to="`/music/song/${detail.previous.id}`"><ChevronLeft :size="16" aria-hidden="true" />{{ detail.previous.title }}</RouterLink>
          <RouterLink v-if="detail.next" :to="`/music/song/${detail.next.id}`">{{ detail.next.title }}<ChevronRight :size="16" aria-hidden="true" /></RouterLink>
        </nav>
      </section>
      <PToast v-model="toastVisible" :message="toastMessage" type="success" />
    </main>
  </PSheet>
</template>

<style scoped>
.song-detail { max-width: 56rem; margin: 0 auto; padding: 1.5rem; }
.song-detail__content { display: grid; grid-template-columns: minmax(10rem, 16rem) minmax(0, 1fr); gap: 1.5rem; }
.song-detail__cover { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: var(--a-color-bg-subtle); }
.song-detail__main { display: grid; align-content: center; justify-items: start; gap: 0.75rem; }
.song-detail__main h1, .song-detail__album, .song-detail__release-date { margin: 0; }
.song-detail__album, .song-detail__release-date, .song-detail__artists span, .song-detail__state { color: var(--a-color-muted); }
.song-detail__sources { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; color: var(--a-color-muted); font-size: 0.85rem; }
.song-detail__sources a { color: inherit; overflow-wrap: anywhere; }
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
.song-detail__lyrics-layout { min-width: 0; }
.song-detail__lyrics-layout.has-annotation-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem); gap: 0; }
.song-detail__lyric-lines { display: grid; gap: 0.15rem; max-height: 32rem; overflow-y: auto; overflow-x: hidden; }
.song-detail__lyric-lines :deep(.music-lyrics-line) { opacity: 1; }
.song-detail__lyric-lines :deep(.music-lyrics-line__text) { font-size: 1rem; line-height: 1.65; }
.song-detail__annotation-editor { align-self: start; border-radius: 0; border-width: 0 0 0 1px; }
.song-detail__navigation a { display: inline-flex; gap: 0.25rem; align-items: center; color: inherit; min-width: 0; }
.song-detail__state--error { color: var(--a-color-accent-destructive); }
@media (max-width: 640px) { .song-detail { padding: 1rem; } .song-detail__content { grid-template-columns: 1fr; } .song-detail__cover { max-width: 18rem; } .song-detail__lyrics-header { align-items: flex-start; flex-direction: column; } .song-detail__lyrics-actions { justify-content: flex-start; } .song-detail__lyrics-layout.has-annotation-editor { grid-template-columns: 1fr; } .song-detail__annotation-editor { border-width: 1px 0 0; } }
</style>
