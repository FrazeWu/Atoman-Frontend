<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  buildUpdateArtistEdit,
  buildUpdateAlbumEdit,
  createMusicArtist,
  getMusicAlbum,
  getMusicArtist,
  submitMusicEdit,
  uploadMusicAsset,
  type MusicAlbumListItem,
  type MusicAlbumTrackEditInput,
  type MusicArtistInput,
  type MusicArtistUpdateInput,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { AlbumEditorShell, MusicArtistForm } from '@/components/music'
import type {
  MusicAlbumMetaDraft,
  MusicCoverDraft,
  MusicReviewNotesDraft,
  MusicSourceDraft,
  MusicTrackDraft,
} from '@/components/music/types'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import type { MusicSheetLayer } from './musicSheetTypes'
import {
	albumArtistCreditsFromContributors,
	albumContributorsFromResponse,
	hasValidAlbumContributors,
} from '@/utils/musicAlbumCredits'

type EditorLayer = Extract<MusicSheetLayer, { kind: 'editor' }>
const props = withDefaults(defineProps<{ layer?: EditorLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })

const router = useRouter()
const {
  state,
  closeMusicEditor,
  refreshAlbum,
  refreshArtist,
  closeMusicCreationFlow,
  isLayerShifted,
  isTopLayer,
  returnToLayer,
} = useMusicDrawers()

const editor = computed(() => props.layer?.payload ?? state.value.musicEditor)
const isOpen = computed(() => props.layer !== undefined || editor.value !== null)
const isArtistEditor = computed(() => editor.value?.entity === 'artist')
const isAlbumEditor = computed(() => editor.value?.entity === 'album')
const isCreateMode = computed(() => editor.value?.mode === 'create')
const isEditMode = computed(() => editor.value?.mode === 'edit')
const sheetIndex = computed(() => {
  if (props.layer) return props.layerIndex
  let count = 0
  if (state.value.artistId !== null) count += 1
  if (state.value.albumId !== null) count += 1
  return count
})
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrentEditor = () => closeMusicEditor(props.layer?.key)

const artistSubmitting = ref(false)
const artistInitialValue = ref<MusicArtistUpdateInput>({})
const artistErrorMessage = ref('')

const albumLoading = ref(false)
const albumSubmitting = ref(false)
const albumErrorMessage = ref('')

let meta = reactive<MusicAlbumMetaDraft>({
	contributors: [],
  album: '',
  releaseDate: '',
  albumType: 'album',
})

const cover = ref<MusicCoverDraft>({
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

const sheetTitle = computed(() => {
  if (isArtistEditor.value) {
    return isCreateMode.value ? '新建艺术家' : '编辑艺术家'
  }
  if (isAlbumEditor.value && isEditMode.value) return '编辑专辑'
  return '编辑'
})

watch(editor, async (value) => {
  artistErrorMessage.value = ''
  albumErrorMessage.value = ''

  if (!value) {
    resetArtistState()
    resetAlbumState()
    return
  }

  if (value.entity === 'artist') {
    resetArtistState()
    resetAlbumState()
    if (value.mode === 'create') {
      const seed = value.seed as { name?: string } | undefined
      artistInitialValue.value = { name: seed?.name ?? '' }
      return
    }

    closeMusicCreationFlow()
    if (value.id) {
      await loadArtist(value.id)
    }
    return
  }

  if (value.entity === 'album') {
    closeMusicCreationFlow()
    resetAlbumState()
    if (value.id) {
      await loadAlbum(value.id)
    }
  }
}, { immediate: true })

function resetArtistState() {
  artistSubmitting.value = false
  artistInitialValue.value = {}
  artistErrorMessage.value = ''
}

function resetAlbumState() {
  albumLoading.value = false
  albumSubmitting.value = false
  albumErrorMessage.value = ''
  meta = reactive({
	contributors: [],
    album: '',
    releaseDate: '',
    albumType: 'album',
  })
  cover.value = {
    file: null,
    previewUrl: '',
    asset: null,
  }
  tracks.value = []
  notes = reactive({
    editNote: '',
    reviewNote: '',
  })
  sources.value = []
}

function updateCover(value: MusicCoverDraft) {
  cover.value = value
}

async function loadArtist(artistId: string) {
  artistSubmitting.value = true
  try {
    const artist = await getMusicArtist(artistId)
    artistInitialValue.value = {
      name: artist.name ?? '',
      bio: artist.bio ?? '',
      image_url: artist.image_url ?? '',
      nationality: artist.nationality ?? '',
      birth_date: artist.birth_date ?? '',
      birth_year: artist.birth_year,
      death_year: artist.death_year,
    }
  } catch (error) {
    reportError(error, 'Failed to load artist:')
    artistErrorMessage.value = '加载艺术家失败'
  } finally {
    artistSubmitting.value = false
  }
}

async function handleArtistSubmit(value: MusicArtistUpdateInput) {
  const current = editor.value
  if (!current || current.entity !== 'artist') return

  artistSubmitting.value = true
  artistErrorMessage.value = ''
  try {
		let createdArtistId = ''
    if (current.id) {
      await submitMusicEdit(buildUpdateArtistEdit(current.id, {
        ...value,
        reason: '编辑艺术家',
        sources: [],
      }))
    } else {
      const name = value.name?.trim()
      if (!name) throw new Error('请输入艺术家名称')
      const payload: MusicArtistInput = {
        name,
        bio: value.bio,
        image_url: value.image_url,
        nationality: value.nationality,
        birth_date: value.birth_date,
        birth_year: value.birth_year,
        death_year: value.death_year,
      }
		const artist = await createMusicArtist(payload)
		createdArtistId = artist.id
    }
    refreshArtist()
    closeCurrentEditor()
		if (createdArtistId) await router.replace(`/music/artist/${createdArtistId}`)
  } catch (error) {
    reportError(error, 'Failed to submit artist:')
    artistErrorMessage.value = '保存艺术家失败'
  } finally {
    artistSubmitting.value = false
  }
}

async function loadAlbum(albumId: string) {
  albumLoading.value = true
  albumErrorMessage.value = ''
  try {
    const result = await getMusicAlbum(albumId)
    hydrateAlbumDraft(result)
  } catch (error) {
    reportError(error, 'Failed to load album:')
    albumErrorMessage.value = '加载专辑失败'
  } finally {
    albumLoading.value = false
  }
}

function hydrateAlbumDraft(result: MusicAlbumListItem) {
  meta = reactive({
	contributors: albumContributorsFromResponse(result),
    album: result.title ?? '',
    releaseDate: result.release_date?.slice(0, 10) ?? '',
    albumType: normalizeAlbumType(result.album_type),
  })

  cover.value = {
    file: null,
    previewUrl: result.cover_url ?? '',
    asset: result.cover_url
      ? { url: result.cover_url, key: '', content_type: '', size: 0 }
      : null,
  }

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
}

function normalizeAlbumType(value?: string): 'single' | 'ep' | 'album' {
  if (value === 'single' || value === 'ep') return value
  return 'album'
}

async function handleAlbumEditSubmit() {
  const current = editor.value
  if (!current || current.entity !== 'album' || current.mode !== 'edit') return
  if (!current.id || !meta.album.trim()) {
    albumErrorMessage.value = '专辑名不能为空'
    return
  }
	if (!hasValidAlbumContributors(meta.contributors)) {
		albumErrorMessage.value = '请设置创作者身份并保留主艺术家'
		return
	}

  albumSubmitting.value = true
  albumErrorMessage.value = ''
  try {
    const uploadedTracks = await Promise.all(tracks.value.map(uploadTrackIfNeeded))
    const trackPayload = uploadedTracks
      .filter((track) => track.removed || track.title.trim())
      .map((track, index) => toTrackPayload(track, index))

    let coverAsset = cover.value.asset
    if (cover.value.file) {
      coverAsset = await uploadMusicAsset(cover.value.file, 'music.cover')
    }

    const edit = await submitMusicEdit(buildUpdateAlbumEdit(current.id, {
      title: meta.album.trim(),
		artist_credits: albumArtistCreditsFromContributors(meta.contributors),
      release_date: meta.releaseDate || undefined,
      cover: coverAsset,
      album_type: meta.albumType,
      tracks: trackPayload,
      reason: notes.editNote.trim() || '编辑专辑与曲目',
      sources: sources.value
        .filter((source) => source.url.trim())
        .map((source) => ({ type: 'url', title: source.title.trim(), url: source.url.trim() })),
    }))
    if (edit.status !== 'applied') {
      throw new Error(edit.status)
    }

    refreshAlbum()
    closeCurrentEditor()
    await router.replace(`/music/album/${current.id}`)
  } catch (error) {
    reportError(error, 'Failed to save album edit:')
    albumErrorMessage.value = '保存失败，请检查填写内容后重试'
  } finally {
    albumSubmitting.value = false
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

<template>
  <PSheet
    :show="isOpen"
    :title="sheetTitle"
    :index="sheetIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    close-type="header"
    panel-class="entity-editor-drawer"
    @close="closeCurrentEditor"
    @activate="props.layer && returnToLayer(props.layer.key)"
  >
    <div class="entity-editor">
      <div v-if="isArtistEditor" class="entity-editor__body">
        <p v-if="artistErrorMessage" class="entity-editor__error">{{ artistErrorMessage }}</p>
        <MusicArtistForm
          :initial-value="artistInitialValue"
          :submitting="artistSubmitting"
          :submit-label="isCreateMode ? '创建艺术家' : '保存艺术家'"
          :submitting-label="isCreateMode ? '正在创建...' : '正在保存...'"
          :submit-variant="isCreateMode ? 'primary' : 'warning'"
          @submit="handleArtistSubmit"
        />
      </div>

      <div v-else-if="isAlbumEditor && isEditMode" class="entity-editor__body">
        <p v-if="albumErrorMessage" class="entity-editor__error">{{ albumErrorMessage }}</p>
        <p v-else-if="albumLoading" class="entity-editor__state">正在加载专辑资料...</p>
        <template v-else>
          <AlbumEditorShell
            mode="edit"
            :meta="meta"
            :cover="cover"
            :tracks="tracks"
            :notes="notes"
            :sources="sources"
            @update:meta="(value) => (meta = value)"
            @update:cover="updateCover"
            @update:tracks="(value) => (tracks = value)"
            @update:notes="(value) => (notes = value)"
            @update:sources="(value) => (sources = value)"
          />

          <div class="entity-editor__actions">
            <PButton variant="secondary" :disabled="albumSubmitting" @click="closeCurrentEditor">取消</PButton>
            <PButton variant="warning" :loading="albumSubmitting" loading-text="正在保存..." @click="handleAlbumEditSubmit">保存全部</PButton>
          </div>
        </template>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.entity-editor {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.entity-editor__body {
  display: grid;
  gap: 1rem;
}

.entity-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.entity-editor__error {
  margin: 0;
  color: var(--a-color-accent-destructive);
  font-size: 0.92rem;
}

.entity-editor__state {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.95rem;
}

:global(.entity-editor-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}
:root.dark :global(.entity-editor-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-dark, #334155) !important;
}
</style>
