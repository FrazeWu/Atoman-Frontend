<!-- web/src/components/music/PlaylistDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Play, Disc, Music, AlertCircle } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { ApiErrorResponseError } from '@/api/client'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  createPlaylistBookmark,
  deletePlaylistBookmark,
  deleteMusicPlaylist,
  getMusicPlaylist,
  listPlaylistBookmarks,
  removeMusicPlaylistSong,
  reorderMusicPlaylistSongs,
  updateMusicPlaylist,
  uploadMusicAsset,
  type MusicPlaylistDetail,
  type MusicSongListItem,
} from '@/api/musicV1'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import type { MusicSheetLayer } from './musicSheetTypes'

type PlaylistLayer = Extract<MusicSheetLayer, { kind: 'playlist' }>
const props = withDefaults(defineProps<{ layer?: PlaylistLayer; layerIndex?: number }>(), { layerIndex: 0 })
const { state, closePlaylist, refreshPlaylists, isLayerShifted, isTopLayer } = useMusicDrawers()
const player = usePlayerStore()
const authStore = useAuthStore()

const playlistId = computed(() => props.layer?.payload.playlistId ?? state.value.playlistId)
const isOpen = computed(() => props.layer !== undefined || playlistId.value !== null)
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const editSheetIndex = computed(() => props.layerIndex + 1)
const closeCurrentPlaylist = () => closePlaylist(props.layer?.key)
const playlist = ref<MusicPlaylistDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const editing = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editName = ref('')
const editDescription = ref('')
const editIsPublic = ref(false)
const editCoverUrl = ref('')
const coverUploading = ref(false)
const coverInput = ref<HTMLInputElement | null>(null)
const isBookmarked = ref(false)
const bookmarkLoading = ref(false)
const removingSongIds = ref<Set<string>>(new Set())
const reordering = ref(false)

async function loadBookmarkState(playlistId: string) {
  if (!authStore.isAuthenticated) {
    isBookmarked.value = false
    return
  }

  try {
    const response = await listPlaylistBookmarks()
    isBookmarked.value = response.data.some((bookmark) => String(bookmark.playlist_id) === playlistId)
  } catch (error) {
    if (error instanceof ApiErrorResponseError && error.status === 401) {
      isBookmarked.value = false
      return
    }
    console.error('Failed to fetch playlist bookmark state:', error)
  }
}

async function loadPlaylist(playlistId: string | null) {
  if (!playlistId) {
    playlist.value = null
    editing.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    await authStore.restoreSession()
    const detail = await getMusicPlaylist(playlistId)
    playlist.value = detail
    await loadBookmarkState(String(detail.id))
  } catch (error) {
    console.error('Failed to fetch playlist details:', error)
    errorMessage.value = '歌单信息加载失败'
  } finally {
    loading.value = false
  }
}

function syncEditForm(detail: MusicPlaylistDetail | null) {
  editName.value = detail?.name || ''
  editDescription.value = detail?.description || ''
  editIsPublic.value = Boolean(detail?.is_public)
  editCoverUrl.value = detail?.cover_url || ''
}

function startEditPlaylist() {
  syncEditForm(playlist.value)
  editing.value = true
}

function cancelEditPlaylist() {
  syncEditForm(playlist.value)
  editing.value = false
}

function openCoverPicker() {
  coverInput.value?.click()
}

async function handleCoverChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  coverUploading.value = true
  try {
    const asset = await uploadMusicAsset(file, 'music.cover')
    editCoverUrl.value = asset.url
  } catch (error) {
    console.error('Failed to upload playlist cover:', error)
    errorMessage.value = '歌单封面上传失败'
  } finally {
    coverUploading.value = false
    input.value = ''
  }
}

async function savePlaylist() {
  if (!playlist.value) return
  await authStore.restoreSession()
  if (!authStore.isAuthenticated) {
    errorMessage.value = '请先登录'
    return
  }

  if (!editName.value.trim()) {
    errorMessage.value = '请输入歌单名称'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    const payload = {
      name: editName.value.trim(),
      description: editDescription.value.trim(),
      is_public: editIsPublic.value,
      ...(editCoverUrl.value.trim() ? { cover_url: editCoverUrl.value.trim() } : {}),
    }
    const updated = await updateMusicPlaylist(playlist.value.id, payload)
    playlist.value = {
      ...updated,
      songs: playlist.value.songs,
      song_count: playlist.value.song_count,
    }
    syncEditForm(playlist.value)
    editing.value = false
  } catch (error) {
    console.error('Failed to update playlist:', error)
    errorMessage.value = error instanceof ApiErrorResponseError
      ? error.message
      : error instanceof Error
        ? error.message
        : '歌单保存失败'
  } finally {
    saving.value = false
  }
}

async function deletePlaylist() {
  if (!playlist.value || deleting.value) return
  if (!window.confirm('删除后无法恢复，确定删除这张歌单吗？')) return

  await authStore.restoreSession()
  if (!authStore.isAuthenticated) {
    errorMessage.value = '请先登录'
    return
  }

  deleting.value = true
  errorMessage.value = ''
  try {
    await deleteMusicPlaylist(playlist.value.id)
    refreshPlaylists()
    editing.value = false
    closePlaylist()
  } catch (error) {
    console.error('Failed to delete playlist:', error)
    errorMessage.value = error instanceof ApiErrorResponseError
      ? error.message
      : error instanceof Error
        ? error.message
        : '歌单删除失败'
  } finally {
    deleting.value = false
  }
}

async function removePlaylistSong(songId: string) {
  if (!playlist.value || removingSongIds.value.has(songId)) return

  removingSongIds.value = new Set([...removingSongIds.value, songId])
  errorMessage.value = ''
  try {
    await removeMusicPlaylistSong(playlist.value.id, songId)
    playlist.value = {
      ...playlist.value,
      songs: playlist.value.songs.filter((song) => String(song.id) !== songId),
      song_count: Math.max(0, (playlist.value.song_count ?? 0) - 1),
    }
    refreshPlaylists()
  } catch (error) {
    console.error('Failed to remove playlist song:', error)
    errorMessage.value = '歌曲移除失败'
  } finally {
    const next = new Set(removingSongIds.value)
    next.delete(songId)
    removingSongIds.value = next
  }
}

async function movePlaylistSong(index: number, direction: -1 | 1) {
  if (!playlist.value || reordering.value) return
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= playlist.value.songs.length) return

  const nextSongs = [...playlist.value.songs]
  const [song] = nextSongs.splice(index, 1)
  if (!song) return
  nextSongs.splice(nextIndex, 0, song)

  reordering.value = true
  errorMessage.value = ''
  try {
    await reorderMusicPlaylistSongs(playlist.value.id, nextSongs.map((item) => String(item.id)))
    playlist.value = {
      ...playlist.value,
      songs: nextSongs,
    }
    refreshPlaylists()
  } catch (error) {
    console.error('Failed to reorder playlist songs:', error)
    errorMessage.value = '歌曲排序失败'
  } finally {
    reordering.value = false
  }
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
  return songs[0]?.cover_url || songs[0]?.album?.cover_url || null
})

const displayCover = computed(() => playlist.value?.cover_url || firstSongCover.value || null)
const editCoverPreview = computed(() => editCoverUrl.value || firstSongCover.value || '')
const playlistOwnerName = computed(() => playlist.value?.owner_username?.trim() || 'Atoman Studio')
const canEditPlaylist = computed(() => {
  if (!authStore.isAuthenticated) return false
  if (!playlist.value?.user_id) return false
  return authStore.user?.uuid === playlist.value.user_id
})
const canBookmarkPlaylist = computed(() => {
  if (!authStore.isAuthenticated) return false
  if (!playlist.value?.is_public) return false
  if (!playlist.value?.user_id) return true
  return authStore.user?.uuid !== playlist.value.user_id
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

async function toggleBookmark() {
  if (!playlist.value || bookmarkLoading.value) return
  await authStore.restoreSession()
  if (!authStore.isAuthenticated) {
    errorMessage.value = '请先登录'
    return
  }

  const playlistId = String(playlist.value.id)
  bookmarkLoading.value = true
  errorMessage.value = ''
  try {
    if (isBookmarked.value) {
      await deletePlaylistBookmark(playlistId)
      isBookmarked.value = false
      playlist.value = {
        ...playlist.value,
        bookmark_count: Math.max(0, (playlist.value.bookmark_count ?? 0) - 1),
      }
      refreshPlaylists()
      return
    }

    await createPlaylistBookmark(playlistId)
    isBookmarked.value = true
    playlist.value = {
      ...playlist.value,
      bookmark_count: (playlist.value.bookmark_count ?? 0) + 1,
    }
    refreshPlaylists()
  } catch (error) {
    console.error('Failed to toggle playlist bookmark:', error)
    errorMessage.value = '操作失败'
  } finally {
    bookmarkLoading.value = false
  }
}

watch(playlistId, loadPlaylist, { immediate: true })
watch(playlist, syncEditForm, { immediate: true })
</script>

<template>
  <PSheet
    :show="isOpen"
    :title="layer?.title ?? '歌单详情'"
    @close="closeCurrentPlaylist"
    width="680px"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    :layer-index="layerIndex"
    :index="layerIndex"
  >
    <template #header>
      <div class="playlist-header-container">
        <!-- Spotify-style Cover Collage / Art Block -->
        <div class="playlist-cover-wrapper">
          <div v-if="displayCover" class="cover-single">
            <img :src="displayCover" class="single-img" alt="歌单封面" />
          </div>
          <div v-else class="cover-placeholder">
            <Disc class="placeholder-icon" :size="36" />
          </div>
        </div>

        <div class="playlist-meta-info">
          <span class="playlist-eyebrow">歌单 / PLAYLIST</span>
          <h2 class="playlist-title">{{ playlist?.name || '歌单详情' }}</h2>
          <p v-if="playlist?.description" class="playlist-description">{{ playlist.description }}</p>
          <div class="playlist-stats">
            <span class="stat-author">{{ playlistOwnerName }}</span>
            <span class="stat-dot">•</span>
            <span class="stat-count">{{ playlist?.song_count || 0 }} 首单曲</span>
            <span class="stat-dot">•</span>
            <span class="stat-count">{{ playlist?.is_public ? '公开' : '私有' }}</span>
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
          dot
          @click="playPlaylist"
        >
          播放全部
        </PButton>
        <PButton
          v-if="canEditPlaylist && !editing"
          variant="secondary"
          data-testid="playlist-edit-button"
          @click="startEditPlaylist"
        >
          编辑
        </PButton>
        <PButton
          v-if="canBookmarkPlaylist"
          variant="secondary"
          :loading="bookmarkLoading"
          data-testid="playlist-bookmark-button"
          @click="toggleBookmark"
        >
          {{ isBookmarked ? '取消收藏' : '收藏歌单' }}
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
        
        <div
          v-else
          v-for="(track, index) in playlist.songs"
          :key="track.id"
          class="track-row"
          :class="{ 'is-disabled': !track.audio_url }"
        >
          <div class="col-index">
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
            <span v-if="canEditPlaylist" class="track-order-actions">
              <button
                type="button"
                class="track-order-btn"
                :disabled="index === 0 || reordering"
                :data-testid="`playlist-move-song-up-${track.id}`"
                aria-label="上移歌曲"
                @click="movePlaylistSong(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="track-order-btn"
                :disabled="index === playlist.songs.length - 1 || reordering"
                :data-testid="`playlist-move-song-down-${track.id}`"
                aria-label="下移歌曲"
                @click="movePlaylistSong(index, 1)"
              >
                ↓
              </button>
            </span>
            <button
              v-if="canEditPlaylist"
              type="button"
              class="track-remove-btn"
              :disabled="removingSongIds.has(String(track.id))"
              :data-testid="`playlist-remove-song-${track.id}`"
              @click="removePlaylistSong(String(track.id))"
            >
              移除
            </button>
          </div>
        </div>
      </div>
    </div>
  </PSheet>

  <PSheet
    :show="editing"
    @close="cancelEditPlaylist"
    width="540px"
    :index="editSheetIndex"
    close-type="header"
    :show-backdrop="false"
  >
    <div class="playlist-edit-sheet">
      <PPageHeader
        title="编辑歌单"
        sub="修改名称、可见性、简介和封面。"
        accent
        mb="0"
      />

      <div class="playlist-edit-panel">
        <PInput
          data-testid="playlist-name-input"
          :model-value="editName"
          placeholder="歌单名称"
          @update:model-value="(value) => editName = value"
        />

        <div class="playlist-edit-row">
          <label class="playlist-edit-toggle">
            <input
              data-testid="playlist-public-toggle"
              type="checkbox"
              :checked="editIsPublic"
              @change="editIsPublic = ($event.target as HTMLInputElement).checked"
            />
            <span>设为公开</span>
          </label>
        </div>

        <div class="playlist-cover-editor">
          <input
            ref="coverInput"
            data-testid="playlist-cover-input"
            class="playlist-cover-input"
            type="file"
            accept="image/*"
            @change="handleCoverChange"
          />
          <button
            type="button"
            class="playlist-cover-preview playlist-cover-preview--button"
            :disabled="coverUploading"
            @click="openCoverPicker"
          >
            <img v-if="editCoverPreview" :src="editCoverPreview" alt="歌单封面预览" class="playlist-cover-preview__image" />
            <div v-else class="playlist-cover-preview__empty">点击上传</div>
            <span v-if="coverUploading" class="playlist-cover-preview__badge">上传中...</span>
          </button>
        </div>

        <PTextarea
          data-testid="playlist-description-input"
          :model-value="editDescription"
          :rows="4"
          placeholder="一句话介绍这张歌单"
          @update:model-value="(value) => editDescription = value"
        />

        <div class="playlist-edit-actions">
          <PButton
            data-testid="playlist-delete-button"
            variant="danger"
            :loading="deleting"
            :disabled="saving"
            @click="deletePlaylist"
          >
            删除
          </PButton>
          <PButton
            variant="secondary"
            :disabled="saving || deleting"
            @click="cancelEditPlaylist"
          >
            取消
          </PButton>
          <PButton
            data-testid="playlist-save-button"
            :loading="saving"
            :disabled="deleting"
            @click="savePlaylist"
          >
            保存
          </PButton>
        </div>
      </div>
    </div>
  </PSheet>
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
  box-shadow: none;
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
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-ink-soft);
}

.playlist-title {
  font-family: var(--a-font-serif);
  font-size: 2rem;
  font-weight: 500;
  line-height: 1.1;
  margin: 0.1rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  font-weight: 500;
  color: var(--a-color-ink-soft);
}

.playlist-edit-sheet {
  display: grid;
  gap: 1.5rem;
}

.playlist-edit-panel {
  display: grid;
  gap: 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
  padding: 1rem;
}

.playlist-edit-row {
  display: flex;
  justify-content: flex-start;
}

.playlist-edit-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.92rem;
  color: var(--a-color-fg);
}

.playlist-cover-editor {
  display: grid;
  gap: 0.75rem;
}

.playlist-cover-input {
  display: none;
}

.playlist-cover-preview {
  width: 120px;
  height: 120px;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  overflow: hidden;
  position: relative;
}

.playlist-cover-preview--button {
  padding: 0;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.playlist-cover-preview--button:hover {
  border-color: var(--a-color-ink);
}

.playlist-cover-preview--button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.playlist-cover-preview__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.playlist-cover-preview__empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  font-size: 0.86rem;
}

.playlist-cover-preview__badge {
  position: absolute;
  right: 0.5rem;
  bottom: 0.5rem;
  padding: 0.2rem 0.4rem;
  background: rgba(0, 0, 0, 0.68);
  color: #fff;
  font-size: 0.7rem;
  border-radius: 4px;
}

.playlist-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
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
  gap: 0.85rem;
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
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
}

.col-index {
  width: 2.5rem;
  flex-shrink: 0;
  text-align: center;
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
  width: 7.5rem;
  flex-shrink: 0;
  text-align: right;
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
  font-weight: 500;
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
  font-weight: 500;
  letter-spacing: 0;
  padding: 0.15rem 0.35rem;
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink-soft);
  border: 1px solid var(--a-color-line-soft);
}

.track-remove-btn {
  border: 0;
  background: transparent;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.2rem 0;
}

.track-remove-btn:hover {
  color: var(--a-color-accent-destructive);
}

.track-remove-btn:disabled {
  cursor: default;
  opacity: 0.45;
}

.track-order-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin-right: 0.35rem;
}

.track-order-btn {
  border: 0;
  background: transparent;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.1rem 0.15rem;
}

.track-order-btn:hover {
  color: var(--a-color-ink);
}

.track-order-btn:disabled {
  cursor: default;
  opacity: 0.35;
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
  font-weight: 500;
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
  font-weight: 500;
}
</style>
