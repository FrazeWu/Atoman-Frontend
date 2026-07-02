<template>
  <div class="a-page music-edit-album">
    <PPageHeader
      title="编辑专辑"
      accent
    />

    <div v-if="loading" class="music-edit-album__state">正在加载专辑资料...</div>
    <div v-else-if="errorMessage" class="music-edit-album__state music-edit-album__state--error">{{ errorMessage }}</div>
    <div v-else class="music-edit-album__content">
      <AlbumEditorShell
        mode="edit"
        :meta="meta"
        :cover="cover"
        :tracks="tracks"
        :notes="notes"
        :sources="sources"
        @update:meta="(value) => (meta = value)"
        @update:cover="(value) => (cover = value)"
        @update:tracks="(value) => (tracks = value)"
        @update:notes="(value) => (notes = value)"
        @update:sources="(value) => (sources = value)"
      />

      <div class="music-edit-album__actions">
        <PButton variant="secondary" :disabled="submitting" @click="router.back()">返回</PButton>
        <PButton :loading="submitting" loading-text="正在保存..." @click="handleSubmit">保存全部</PButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  buildUpdateAlbumEdit,
  getMusicAlbum,
  submitMusicEdit,
  uploadMusicAsset,
  type MusicAlbumListItem,
  type MusicAlbumTrackEditInput,
} from '@/api/musicV1'
import { AlbumEditorShell } from '@/components/music'
import type {
  MusicAlbumMetaDraft,
  MusicCoverDraft,
  MusicReviewNotesDraft,
  MusicSourceDraft,
  MusicTrackDraft,
} from '@/components/music/types'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import type { Artist } from '@/types'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const album = ref<MusicAlbumListItem | null>(null)

let meta = reactive<MusicAlbumMetaDraft>({
  artist: [],
  album: '',
  releaseDate: '',
  albumType: 'album',
})

let cover = reactive<MusicCoverDraft>({
  file: null,
  previewUrl: '',
  asset: null,
})

let tracks = ref<MusicTrackDraft[]>([])

let notes = reactive<MusicReviewNotesDraft>({
  editNote: '',
  reviewNote: '',
})

let sources = ref<MusicSourceDraft[]>([])

onMounted(async () => {
  await loadAlbum()
})

async function loadAlbum() {
  const albumId = typeof route.params.albumId === 'string' ? route.params.albumId : ''
  if (!albumId) {
    errorMessage.value = '缺少专辑 ID'
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const result = await getMusicAlbum(albumId)
    album.value = result
    hydrateDraft(result)
  } catch (error) {
    console.error('Failed to load album:', error)
    errorMessage.value = '加载专辑失败'
  } finally {
    loading.value = false
  }
}

function hydrateDraft(result: MusicAlbumListItem) {
  meta = reactive({
    artist: (result.artists ?? []).map(toArtistDraft),
    album: result.title ?? '',
    releaseDate: result.release_date ?? '',
    albumType: normalizeAlbumType(result.album_type),
  })

  cover = reactive({
    file: null,
    previewUrl: result.cover_url ?? '',
    asset: result.cover_url
      ? { url: result.cover_url, key: '', content_type: '', size: 0 }
      : null,
  })

  tracks.value = [...(result.songs ?? [])]
    .filter((song) => song.status !== 'closed')
    .sort((a, b) => (a.track_number ?? 0) - (b.track_number ?? 0))
    .map((song, index) => ({
      id: song.id,
      songId: song.id,
      title: song.title,
      trackNumber: String(song.track_number ?? index + 1),
      lyrics: song.lyrics ?? '',
      audioUrl: song.audio_url ?? '',
      audioAsset: song.audio_url
        ? { url: song.audio_url, key: '', content_type: '', size: 0 }
        : null,
      file: null,
      isExisting: true,
      removed: false,
    }))

  notes = reactive({
    editNote: '',
    reviewNote: '',
  })
  sources.value = []
}

function toArtistDraft(artist: { id: string; name: string }): Artist {
  return {
    id: Number.parseInt(artist.id, 10),
    name: artist.name,
  }
}

function normalizeAlbumType(value?: string): 'single' | 'ep' | 'album' {
  if (value === 'single' || value === 'ep') return value
  return 'album'
}

async function handleSubmit() {
  const albumId = typeof route.params.albumId === 'string' ? route.params.albumId : ''
  if (!albumId || !meta.album.trim()) {
    errorMessage.value = '专辑名不能为空'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    const uploadedTracks = await Promise.all(tracks.value.map(uploadTrackIfNeeded))
    const trackPayload = uploadedTracks
      .filter((track) => track.removed || track.title.trim())
      .map((track, index) => toTrackPayload(track, index))

    let coverAsset = cover.asset
    if (cover.file) {
      coverAsset = await uploadMusicAsset(cover.file, 'music.cover')
    }

    await submitMusicEdit(buildUpdateAlbumEdit(albumId, {
      title: meta.album.trim(),
      artist_ids: meta.artist.map((artist) => String(artist.id)).filter(Boolean),
      release_date: meta.releaseDate || undefined,
      cover: coverAsset,
      album_type: meta.albumType,
      tracks: trackPayload,
      reason: notes.editNote.trim() || '编辑专辑与曲目',
      sources: sources.value
        .filter((source) => source.url.trim())
        .map((source) => ({ type: 'url', title: source.title.trim(), url: source.url.trim() })),
    }))

    await router.push(`/music/album/${albumId}`)
  } catch (error) {
    console.error('Failed to save album edit:', error)
    errorMessage.value = '保存失败，请检查填写内容后重试'
  } finally {
    submitting.value = false
  }
}

async function uploadTrackIfNeeded(track: MusicTrackDraft): Promise<MusicTrackDraft> {
  if (!track.file) return track
  const asset = await uploadMusicAsset(track.file, 'music.audio')
  return {
    ...track,
    audioUrl: asset.url,
    audioAsset: asset,
  }
}

function toTrackPayload(track: MusicTrackDraft, index: number): MusicAlbumTrackEditInput {
  return {
    ...(track.songId ? { id: track.songId } : {}),
    title: track.title.trim(),
    track_number: Number.parseInt(track.trackNumber, 10) || index + 1,
    lyrics: track.lyrics?.trim() || '',
    audio_url: track.audioUrl || track.audioAsset?.url || '',
    removed: track.removed ?? false,
  }
}
</script>

<style scoped>
.music-edit-album {
  display: grid;
  gap: 1.5rem;
}

.music-edit-album__state {
  color: var(--a-color-ink-soft);
  font-size: 0.95rem;
}

.music-edit-album__state--error {
  color: var(--a-color-accent-destructive);
}

.music-edit-album__content {
  display: grid;
  gap: 1.5rem;
}

.music-edit-album__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>
