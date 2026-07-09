<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  buildUpdateAlbumEdit,
  commitMusicAlbumImport,
  createMusicArtist,
  getMusicAlbum,
  getMusicArtist,
  submitMusicEdit,
  updateMusicArtist,
  uploadMusicAsset,
  type MusicAlbumImportCommitInput,
  type MusicAlbumListItem,
  type MusicAlbumTrackEditInput,
  type MusicArtistInput,
  type MusicArtistUpdateInput,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { AlbumEditorShell, MusicArtistForm } from '@/components/music'
import MusicCreationArtistStep from '@/components/music/MusicCreationArtistStep.vue'
import MusicCreationAlbumSeedStep from '@/components/music/MusicCreationAlbumSeedStep.vue'
import MusicCreationAlbumDetailsStep from '@/components/music/MusicCreationAlbumDetailsStep.vue'
import type {
  MusicAlbumMetaDraft,
  MusicCoverDraft,
  MusicReviewNotesDraft,
  MusicSourceDraft,
  MusicTrackDraft,
} from '@/components/music/types'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSheet from '@/components/ui/PSheet.vue'
import type { Artist } from '@/types'

const router = useRouter()
const {
  state,
  closeMusicEditor,
  refreshAlbum,
  refreshArtist,
  openMusicCreationFlow,
  closeMusicCreationFlow,
  setMusicCreationStep,
} = useMusicDrawers()

const editor = computed(() => state.value.musicEditor)
const creationFlow = computed(() => state.value.creationFlow)
const isOpen = computed(() => editor.value !== null)
const isArtistEditor = computed(() => editor.value?.entity === 'artist')
const isAlbumEditor = computed(() => editor.value?.entity === 'album')
const isCreateMode = computed(() => editor.value?.mode === 'create')
const isEditMode = computed(() => editor.value?.mode === 'edit')
const isCreateFlowActive = computed(() => isCreateMode.value && creationFlow.value !== null)
const sheetIndex = computed(() => {
  let count = 0
  if (state.value.artistId !== null) count += 1
  if (state.value.albumId !== null) count += 1
  return count
})

const artistSubmitting = ref(false)
const artistInitialValue = ref<MusicArtistUpdateInput>({})
const artistErrorMessage = ref('')

const albumLoading = ref(false)
const albumSubmitting = ref(false)
const albumErrorMessage = ref('')

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

const sheetTitle = computed(() => {
  if (isCreateFlowActive.value) {
    return albumCreateStep.value === 'artist' ? '新建艺术家' : '新建专辑'
  }
  if (isArtistEditor.value) {
    return isCreateMode.value ? '新建艺术家' : '编辑艺术家'
  }
  if (isAlbumEditor.value) {
    return isCreateMode.value ? '新建专辑' : '编辑专辑'
  }
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
    if (value.mode === 'create') {
      resetAlbumState()
      const seed = value.seed as {
        artistId?: string | null
        artistName?: string
        artistLegalName?: string
      } | undefined
      openMusicCreationFlow({
        artistId: seed?.artistId ?? null,
        artistName: seed?.artistName ?? '',
        artistLegalName: seed?.artistLegalName ?? '',
        startStep: seed?.artistId ? 'albumImport' : 'artist',
      })
      return
    }

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
    artist: [],
    album: '',
    releaseDate: '',
    albumType: 'album',
  })
  cover = reactive({
    file: null,
    previewUrl: '',
    asset: null,
  })
  tracks.value = []
  notes = reactive({
    editNote: '',
    reviewNote: '',
  })
  sources.value = []
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
    console.error('Failed to load artist:', error)
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
    if (current.id) {
      await updateMusicArtist(current.id, value)
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
      await createMusicArtist(payload)
    }
    refreshArtist()
    closeMusicEditor()
  } catch (error) {
    console.error('Failed to submit artist:', error)
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
    console.error('Failed to load album:', error)
    albumErrorMessage.value = '加载专辑失败'
  } finally {
    albumLoading.value = false
  }
}

function hydrateAlbumDraft(result: MusicAlbumListItem) {
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

async function handleAlbumEditSubmit() {
  const current = editor.value
  if (!current || current.entity !== 'album' || current.mode !== 'edit') return
  if (!current.id || !meta.album.trim()) {
    albumErrorMessage.value = '专辑名不能为空'
    return
  }

  albumSubmitting.value = true
  albumErrorMessage.value = ''
  try {
    const uploadedTracks = await Promise.all(tracks.value.map(uploadTrackIfNeeded))
    const trackPayload = uploadedTracks
      .filter((track) => track.removed || track.title.trim())
      .map((track, index) => toTrackPayload(track, index))

    let coverAsset = cover.asset
    if (cover.file) {
      coverAsset = await uploadMusicAsset(cover.file, 'music.cover')
    }

    await submitMusicEdit(buildUpdateAlbumEdit(current.id, {
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

    refreshAlbum()
    closeMusicEditor()
    await router.replace(`/music/album/${current.id}`)
  } catch (error) {
    console.error('Failed to save album edit:', error)
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

function buildCommitInput(): MusicAlbumImportCommitInput {
  const flow = creationFlow.value
  if (!flow) throw new Error('缺少创建流程')

  const primaryStageName = flow.draft.artist.stageNames.find((item) => item.isPrimary && item.name.trim())
    ?? flow.draft.artist.stageNames.find((item) => item.name.trim())

  return {
    ...(flow.draft.artist.id ? { artist_id: flow.draft.artist.id } : {}),
    artist: {
      name: primaryStageName?.name.trim() || flow.draft.artist.legalName.trim(),
      legal_name: flow.draft.artist.legalName.trim(),
      stage_names: flow.draft.artist.stageNames
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          isPrimary: item.isPrimary,
          startDateText: item.startDateText.trim(),
          endDateText: item.endDateText.trim(),
        })),
      birth_place: flow.draft.artist.birthPlace.trim(),
    },
    album: {
      title: flow.draft.albumDetails.title.trim(),
      release_year: Number.parseInt(flow.draft.albumDetails.releaseYear.trim(), 10) || 0,
      tracks: flow.draft.tracks.map((track, index) => ({
        title: track.title.trim(),
        trackNumber: index + 1,
      })),
    },
  }
}

const albumCreateStep = computed(() => creationFlow.value?.step ?? 'artist')
const canGoNext = computed(() => {
  const flow = creationFlow.value
  if (!flow) return false
  if (flow.step === 'artist') return !!flow.draft.artist.legalName.trim()
  if (flow.step === 'albumImport') return flow.draft.albumImport.status === 'ready'
  return flow.draft.albumImport.status === 'ready' && !!flow.draft.albumDetails.title.trim()
})

function goAlbumCreateNext() {
  const flow = creationFlow.value
  if (!flow) return
  if (flow.step === 'artist') {
    setMusicCreationStep('albumImport')
    return
  }
  if (flow.step === 'albumImport') {
    setMusicCreationStep('albumDetails')
  }
}

function goAlbumCreateBack() {
  const flow = creationFlow.value
  if (!flow) return
  if (flow.step === 'albumDetails') {
    setMusicCreationStep('albumImport')
    return
  }
  if (flow.step === 'albumImport') {
    setMusicCreationStep('artist')
  }
}

async function finishAlbumCreate() {
  const flow = creationFlow.value
  if (!flow || flow.submitting) return

  const importId = flow.draft.albumImport.importId?.trim()
  if (!importId) {
    flow.errorMessage = '缺少 importId，无法提交专辑导入'
    return
  }

  if (flow.draft.albumImport.status !== 'ready') {
    flow.errorMessage = '请等待压缩包处理完成'
    return
  }

  flow.submitting = true
  flow.errorMessage = ''
  try {
    const result = await commitMusicAlbumImport(importId, buildCommitInput())
    refreshArtist()
    closeMusicCreationFlow()
    closeMusicEditor()
    if (result.importId) {
      await router.replace('/music')
    }
  } catch (error) {
    flow.errorMessage = error instanceof Error ? error.message : '提交失败，请稍后重试'
  } finally {
    if (creationFlow.value) {
      creationFlow.value.submitting = false
    }
  }
}
</script>

<template>
  <PSheet :show="isOpen" @close="closeMusicEditor" width="560px" :index="sheetIndex" close-type="header">
    <div class="entity-editor">
      <div class="entity-editor__header">
        <PPageHeader :title="sheetTitle" accent mb="0" />
      </div>

      <div v-if="isCreateFlowActive && creationFlow" class="entity-editor__body">
        <p v-if="creationFlow.errorMessage" class="entity-editor__error">{{ creationFlow.errorMessage }}</p>
        <MusicCreationArtistStep v-if="albumCreateStep === 'artist'" />
        <MusicCreationAlbumSeedStep v-else-if="albumCreateStep === 'albumImport'" />
        <MusicCreationAlbumDetailsStep v-else />

        <div class="entity-editor__actions">
          <PButton variant="secondary" @click="closeMusicEditor">关闭</PButton>
          <PButton
            v-if="albumCreateStep !== 'artist'"
            variant="secondary"
            @click="goAlbumCreateBack"
          >
            返回上一步
          </PButton>
          <PButton
            v-if="albumCreateStep !== 'albumDetails'"
            :disabled="!canGoNext"
            @click="goAlbumCreateNext"
          >
            下一步
          </PButton>
          <PButton
            v-else
            :loading="creationFlow.submitting"
            loading-text="提交中..."
            :disabled="!canGoNext"
            @click="finishAlbumCreate"
          >
            完成
          </PButton>
        </div>
      </div>

      <div v-else-if="isArtistEditor" class="entity-editor__body">
        <p v-if="artistErrorMessage" class="entity-editor__error">{{ artistErrorMessage }}</p>
        <MusicArtistForm
          :initial-value="artistInitialValue"
          :submitting="artistSubmitting"
          :submit-label="isCreateMode ? '创建艺术家' : '保存艺术家'"
          :submitting-label="isCreateMode ? '正在创建...' : '正在保存...'"
          @submit="handleArtistSubmit"
        />
      </div>

      <div v-else-if="isAlbumEditor" class="entity-editor__body">
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
            @update:cover="(value) => (cover = value)"
            @update:tracks="(value) => (tracks = value)"
            @update:notes="(value) => (notes = value)"
            @update:sources="(value) => (sources = value)"
          />

          <div class="entity-editor__actions">
            <PButton variant="secondary" :disabled="albumSubmitting" @click="closeMusicEditor">取消</PButton>
            <PButton :loading="albumSubmitting" loading-text="正在保存..." @click="handleAlbumEditSubmit">保存全部</PButton>
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

.entity-editor__header {
  margin-bottom: 1rem;
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
  color: var(--a-color-ink-soft);
  font-size: 0.95rem;
}
</style>
