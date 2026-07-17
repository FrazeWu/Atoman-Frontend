<!-- web/src/components/music/PlaylistDrawer.vue -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import { Play, Disc, Music, AlertCircle, Pencil, Trash2, X, ChevronUp, ChevronDown, GripVertical } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  deleteMusicPlaylist,
  getMusicPlaylist,
  removeMusicPlaylistSong,
  reorderMusicPlaylistSongs,
  updateMusicPlaylist,
  type MusicPlaylistDetail,
  type MusicSongListItem,
} from '@/api/musicV1'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'

const { state, closePlaylist, refreshPlaylist } = useMusicDrawers()
const player = usePlayerStore()

const isOpen = computed(() => state.value.playlistId !== null)
const playlist = ref<MusicPlaylistDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const isEditingName = ref(false)
const playlistNameDraft = ref('')
const playlistNameInput = ref<HTMLInputElement | null>(null)
const savingName = ref(false)
const deleteConfirmOpen = ref(false)
const deletingPlaylist = ref(false)
const removingSongId = ref<string | null>(null)
const savingOrder = ref(false)
const tracksListRef = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null
let pendingSongOrder: MusicSongListItem[] | null = null

function initializeSortable() {
  sortable?.destroy()
  sortable = null
  if (!tracksListRef.value || !playlist.value?.songs?.length) return
  sortable = Sortable.create(tracksListRef.value, {
    animation: 150,
    handle: '.track-drag-handle',
    ghostClass: 'track-row--ghost',
    onEnd: (event) => {
      if (event.oldIndex === undefined || event.newIndex === undefined || event.oldIndex === event.newIndex) return
      const next = [...(playlist.value?.songs || [])]
      const [moved] = next.splice(event.oldIndex, 1)
      if (!moved) return
      next.splice(event.newIndex, 0, moved)
      void persistSongOrder(next)
    },
  })
}

async function loadPlaylist(playlistId: string | null) {
  if (!playlistId) {
    playlist.value = null
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const detail = await getMusicPlaylist(playlistId)
    playlist.value = detail
		await nextTick()
		initializeSortable()
  } catch (error) {
    console.error('Failed to fetch playlist details:', error)
    errorMessage.value = '歌单信息加载失败'
  } finally {
    loading.value = false
  }
}

async function persistSongOrder(nextSongs: MusicSongListItem[]) {
	const current = playlist.value
	if (!current) return
	playlist.value = { ...current, songs: nextSongs }
	pendingSongOrder = nextSongs
	if (savingOrder.value) return

	savingOrder.value = true
	errorMessage.value = ''
	try {
		while (pendingSongOrder) {
			const orderToPersist = pendingSongOrder
			pendingSongOrder = null
			try {
				await reorderMusicPlaylistSongs(current.id, orderToPersist.map((song) => String(song.id)))
				refreshPlaylist()
				errorMessage.value = ''
			} catch (error) {
				console.error('Failed to reorder playlist songs:', error)
				errorMessage.value = '歌单顺序保存失败'
			}
		}
	} finally {
		savingOrder.value = false
		await nextTick()
		initializeSortable()
	}
}

function moveTrack(index: number, offset: -1 | 1) {
	const songs = playlist.value?.songs
	if (!songs) return
	const target = index + offset
	if (target < 0 || target >= songs.length) return
	const next = [...songs]
	const [moved] = next.splice(index, 1)
	if (!moved) return
	next.splice(target, 0, moved)
	void persistSongOrder(next)
}

const playableSongs = computed<Song[]>(() => {
  if (!playlist.value?.songs) return []
  const playlistName = playlist.value.name
  const playlistId = playlist.value.id
  return playlist.value.songs
    .filter((song): song is MusicSongListItem & { audio_url: string } => typeof song.audio_url === 'string' && song.audio_url.trim().length > 0)
    .map((song) => {
      const albumTitle = song.album?.title || playlistName
      const albumId = song.album?.id || playlistId
      const artistText = song.artists?.map((a) => a.name).join(' / ') || '未知艺术家'
      return {
        id: song.id,
        title: song.title,
        artist: artistText,
        album: albumTitle,
        album_id: albumId,
        year: 0,
        release_date: '',
        lyrics: song.lyrics || '',
        audio_url: song.audio_url,
        cover_url: song.cover_url || '',
        track_number: song.track_number,
        status: (song.status as Song['status']) || 'approved',
        artists: song.artists?.map((artist) => ({
          id: artist.id,
          name: artist.name,
          username: '',
          email: '',
        })),
      }
    })
})

const firstSongCover = computed(() => {
  const songs = playlist.value?.songs
  if (!songs || songs.length === 0) return null
  return songs[0]?.cover_url || null
})

function playPlaylist() {
  if (!playableSongs.value.length) return
  player.playAlbum(playableSongs.value)
}

function playTrack(track: MusicSongListItem) {
  if (!track.audio_url) return
  const index = playableSongs.value.findIndex((song) => song.id === track.id)
  player.playAlbum(playableSongs.value, index >= 0 ? index : 0)
}

function startRename() {
  if (!playlist.value || playlist.value.is_favorite) return
  playlistNameDraft.value = playlist.value.name
  isEditingName.value = true
  void nextTick(() => playlistNameInput.value?.focus())
}

function cancelRename() {
  isEditingName.value = false
  playlistNameDraft.value = playlist.value?.name || ''
}

async function saveRename() {
  const current = playlist.value
  const name = playlistNameDraft.value.trim()
  if (!current || current.is_favorite || savingName.value) return
  if (!name) {
    errorMessage.value = '请输入歌单名称'
    return
  }
  if (name === current.name) {
    cancelRename()
    return
  }

  savingName.value = true
  errorMessage.value = ''
  try {
    const updated = await updateMusicPlaylist(current.id, { name })
    playlist.value = {
      ...current,
      ...updated,
      song_count: current.song_count,
      songs: current.songs,
    }
    isEditingName.value = false
    refreshPlaylist()
  } catch (error) {
    console.error('Failed to rename playlist:', error)
    errorMessage.value = '歌单名称保存失败'
  } finally {
    savingName.value = false
  }
}

async function removeTrack(trackId: string) {
  const current = playlist.value
  if (!current || removingSongId.value) return

  removingSongId.value = trackId
  errorMessage.value = ''
  try {
    await removeMusicPlaylistSong(current.id, trackId)
    await loadPlaylist(current.id)
    refreshPlaylist()
  } catch (error) {
    console.error('Failed to remove playlist song:', error)
    errorMessage.value = '移除歌曲失败'
  } finally {
    removingSongId.value = null
  }
}

async function confirmDeletePlaylist() {
  const current = playlist.value
  if (!current || current.is_favorite || deletingPlaylist.value) return

  deletingPlaylist.value = true
  errorMessage.value = ''
  try {
    await deleteMusicPlaylist(current.id)
    deleteConfirmOpen.value = false
    closePlaylist()
    refreshPlaylist()
  } catch (error) {
    console.error('Failed to delete playlist:', error)
    errorMessage.value = '删除歌单失败'
  } finally {
    deletingPlaylist.value = false
  }
}

watch(() => state.value.playlistId, loadPlaylist, { immediate: true })
onBeforeUnmount(() => sortable?.destroy())
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closePlaylist"
    width="680px"
    :index="0"
  >
    <template #header>
      <div class="playlist-header-container">
        <!-- Spotify-style Cover Collage / Art Block -->
        <div class="playlist-cover-wrapper">
          <div v-if="firstSongCover" class="cover-single">
            <img :src="firstSongCover" class="single-img" alt="歌单封面" />
          </div>
          <div v-else class="cover-placeholder">
            <Disc class="placeholder-icon" :size="36" />
          </div>
        </div>

        <div class="playlist-meta-info">
          <span class="playlist-eyebrow">歌单 / PLAYLIST</span>
          <input
            v-if="isEditingName"
            ref="playlistNameInput"
            v-model="playlistNameDraft"
            class="playlist-title-input"
            data-testid="playlist-name-input"
            :disabled="savingName"
            @keydown.enter.prevent="saveRename"
            @keydown.esc.prevent="cancelRename"
          />
          <div v-else class="playlist-title-row">
            <h2 class="playlist-title">{{ playlist?.name || '歌单详情' }}</h2>
            <div v-if="playlist && !playlist.is_favorite" class="playlist-manage-actions">
              <button
                type="button"
                class="playlist-icon-button"
                data-testid="playlist-edit"
                title="重命名歌单"
                aria-label="重命名歌单"
                @click="startRename"
              >
                <Pencil :size="16" />
              </button>
              <button
                type="button"
                class="playlist-icon-button playlist-icon-button--danger"
                data-testid="playlist-delete"
                title="删除歌单"
                aria-label="删除歌单"
                @click="deleteConfirmOpen = true"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
          <p v-if="playlist?.description" class="playlist-description">{{ playlist.description }}</p>
          <div class="playlist-stats">
            <span class="stat-author">Atoman Studio</span>
            <span class="stat-dot">•</span>
            <span class="stat-count">{{ playlist?.song_count || 0 }} 首单曲</span>
          </div>
        </div>
      </div>
    </template>

    <div class="playlist-body">
      <!-- Action Bar -->
      <div class="playlist-actions-bar">
        <PButton
          variant="primary"
          :disabled="!playableSongs.length"
          @click="playPlaylist"
        >
          播放歌单
        </PButton>
      </div>

      <!-- Tracks Table -->
      <div class="tracks-container">
        <div class="tracks-header">
          <div class="col-index">#</div>
          <div class="col-title">标题</div>
          <div class="col-album">专辑</div>
          <div class="col-status"></div>
        </div>

        <p v-if="errorMessage" class="state-line error">
          <AlertCircle :size="16" /> {{ errorMessage }}
        </p>
        <p v-else-if="loading" class="state-line loading">正在加载歌单内容...</p>
        <div v-else-if="!playlist?.songs?.length" class="track-empty">
          <Music :size="28" />
          <p>此歌单暂无曲目</p>
        </div>
        
        <div v-else ref="tracksListRef" class="tracks-list">
        <div
          v-for="(track, index) in playlist.songs"
          :key="track.id"
          class="track-row"
          :class="{ 'is-disabled': !track.audio_url }"
          :data-song-id="track.id"
        >
          <div class="col-index">
            <button class="track-drag-handle" type="button" title="拖动排序" aria-label="拖动排序">
              <GripVertical :size="15" />
            </button>
            <button
              class="row-play-btn"
              type="button"
              :disabled="!track.audio_url"
              @click="playTrack(track)"
              aria-label="播放单曲"
            >
              <span class="row-num">{{ index + 1 }}</span>
              <Play class="row-play-icon" :size="14" fill="currentColor" />
            </button>
          </div>

          <div class="col-title">
            <div class="track-meta">
              <span class="track-name">{{ track.title }}</span>
              <span class="track-artists-text">
                {{ track.artists?.map(a => a.name).join(' / ') || '未知艺术家' }}
              </span>
            </div>
          </div>

          <div class="col-album">
            <span class="album-name">{{ track.album?.title || '未归属专辑' }}</span>
          </div>

          <div class="col-status">
            <span v-if="!track.audio_url" class="badge-no-audio">无音频</span>
            <button
              type="button"
              class="track-order-button"
              :data-testid="`playlist-move-${track.id}-up`"
              :disabled="index === 0 || savingOrder"
              title="上移"
              aria-label="上移"
              @click="moveTrack(index, -1)"
            >
              <ChevronUp :size="15" />
            </button>
            <button
              type="button"
              class="track-order-button"
              :data-testid="`playlist-move-${track.id}-down`"
              :disabled="index === playlist.songs.length - 1 || savingOrder"
              title="下移"
              aria-label="下移"
              @click="moveTrack(index, 1)"
            >
              <ChevronDown :size="15" />
            </button>
            <button
              type="button"
              class="track-remove-button"
              :data-testid="`playlist-remove-${track.id}`"
              :disabled="removingSongId === String(track.id)"
              title="移出歌单"
              aria-label="移出歌单"
              @click="removeTrack(String(track.id))"
            >
              <X :size="15" />
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  </PSheet>
  <PConfirm
    :show="deleteConfirmOpen"
    title="删除歌单"
    :message="`确定删除歌单「${playlist?.name || ''}」吗？`"
    confirm-text="删除"
    cancel-text="取消"
    danger
    @confirm="confirmDeletePlaylist"
    @cancel="deleteConfirmOpen = false"
  />
</template>

<style scoped>
/* Spotify-style Header */
.playlist-header-container {
  display: flex;
  align-items: flex-end;
  gap: 1.5rem;
  padding: 0.5rem 0 1rem;
}

.playlist-cover-wrapper {
  width: 120px;
  height: 120px;
  background: var(--a-color-paper-wash);
  border: 1px solid var(--a-color-line-soft);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: var(--a-shadow-dropdown);
}

.cover-collage {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  width: 100%;
  height: 100%;
}

.collage-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-single {
  width: 100%;
  height: 100%;
}

.single-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  color: var(--a-color-ink-soft);
  opacity: 0.6;
}

.playlist-meta-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}

.playlist-eyebrow {
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--a-color-ink-soft);
}

.playlist-title {
  font-family: var(--a-font-serif);
  font-size: 2rem;
  font-weight: 900;
  line-height: 1.1;
  margin: 0.1rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.playlist-title-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.playlist-title-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--a-color-ink);
  background: transparent;
  color: var(--a-color-fg);
  padding: 0.1rem 0;
  font-family: var(--a-font-serif);
  font-size: 2rem;
  font-weight: 900;
  line-height: 1.1;
  outline: none;
  min-width: 0;
}

.playlist-manage-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.playlist-icon-button,
.track-remove-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  background: transparent;
  color: var(--a-color-ink-soft);
  cursor: pointer;
}

.playlist-icon-button:hover,
.track-remove-button:hover {
  background: var(--a-color-paper-wash);
  color: var(--a-color-fg);
}

.playlist-icon-button--danger:hover {
  color: var(--a-color-accent-destructive);
}

.playlist-description {
  margin: 0.25rem 0 0.5rem;
  font-size: 0.85rem;
  color: var(--a-color-ink-soft);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.playlist-stats {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--a-color-ink-soft);
}

.stat-author {
  color: var(--a-color-fg);
}

.stat-dot {
  opacity: 0.5;
}

/* Play Action Bar */
.playlist-actions-bar {
  display: flex;
  align-items: center;
  padding: 1.25rem 0;
}



/* Table layout */
.tracks-container {
  display: flex;
  flex-direction: column;
  margin-bottom: 2rem;
}

.tracks-header {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
}

.col-index {
  width: 4.5rem;
  flex-shrink: 0;
  text-align: center;
  display: flex;
  align-items: center;
}

.col-title {
  flex: 1.5;
  min-width: 0;
}

.col-album {
  flex: 1;
  min-width: 0;
  padding-left: 1rem;
}

.col-status {
  width: 6.5rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
}

.track-remove-button:disabled,
.track-order-button:disabled {
  cursor: wait;
  opacity: 0.45;
}

.track-drag-handle,
.track-order-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 30px;
  border: 0;
  background: transparent;
  color: var(--a-color-ink-soft);
}

.track-drag-handle {
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
}

.track-drag-handle:active {
  cursor: grabbing;
}

.track-order-button {
  cursor: pointer;
}

.track-order-button:hover:not(:disabled),
.track-drag-handle:hover {
  background: var(--a-color-paper-wash);
  color: var(--a-color-fg);
}

.track-row--ghost {
  opacity: 0.45;
}

/* Track Row */
.track-row {
  display: flex;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 5%, transparent);
  transition: background-color 0.15s ease;
}

.track-row:hover {
  background-color: var(--a-color-paper-wash);
}

.track-row:last-child {
  border-bottom: none;
}

.row-play-btn {
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  cursor: pointer;
  color: var(--a-color-ink-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-play-icon {
  display: none;
}

.track-row:hover:not(.is-disabled) .row-num {
  display: none;
}

.track-row:hover:not(.is-disabled) .row-play-icon {
  display: block;
  color: var(--a-color-ink);
}

.track-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.track-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artists-text {
  font-size: 0.75rem;
  color: var(--a-color-ink-soft);
  margin-top: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-name {
  font-size: 0.82rem;
  color: var(--a-color-ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-no-audio {
  font-family: var(--a-font-meta);
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.35rem;
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink-soft);
  border: 1px solid var(--a-color-line-soft);
}

.is-disabled {
  opacity: 0.65;
}

/* State lines */
.state-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 1.5rem 0.75rem;
  color: var(--a-color-ink-soft);
}

.state-line.error {
  color: var(--a-color-accent-destructive);
}

.track-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 0;
  color: var(--a-color-ink-soft);
  opacity: 0.6;
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 700;
}
</style>
