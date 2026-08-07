<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
		createMusicArtist,
  getMusicAlbum,
  getMusicArtist,
	getMusicSongDetail,
	submitAlbumRevision,
		submitArtistRevision,
		submitSongRevision,
		queueMusicSongAudioReplacement,
  uploadMusicAsset,
  type MusicAlbumListItem,
  type MusicAlbumTrackEditInput,
  type MusicArtistInput,
  type MusicArtistUpdateInput,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { AlbumEditorShell, MusicArtistForm } from '@/components/music'
import MusicCreationContributorPicker from '@/components/music/MusicCreationContributorPicker.vue'
import type {
  MusicAlbumMetaDraft,
  MusicCoverDraft,
  MusicReviewNotesDraft,
  MusicSourceDraft,
  MusicTrackDraft,
} from '@/components/music/types'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { MusicSheetLayer } from './musicSheetTypes'
import type { MusicCreationAlbumContributorDraft } from './musicCreationTypes'
import {
	albumArtistCreditsFromContributors,
	albumContributorsFromResponse,
	hasValidAlbumContributors,
	songContributorsFromCredits,
} from '@/utils/musicAlbumCredits'

type EditorLayer = Extract<MusicSheetLayer, { kind: 'editor' }>
const props = withDefaults(defineProps<{ layer?: EditorLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })

const router = useRouter()
const {
  state,
  closeMusicEditor,
  refreshAlbum,
  refreshArtist,
  refreshSong,
  closeMusicCreationFlow,
  isLayerShifted,
  isTopLayer,
  returnToLayer,
} = useMusicDrawers()

const editor = computed(() => props.layer?.payload ?? state.value.musicEditor)
const isOpen = computed(() => props.layer !== undefined || editor.value !== null)
const isArtistEditor = computed(() => editor.value?.entity === 'artist')
const isAlbumEditor = computed(() => editor.value?.entity === 'album')
const isSongEditor = computed(() => editor.value?.entity === 'song')
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
const songLoading = ref(false)
const songSubmitting = ref(false)
const songErrorMessage = ref('')
const songDraft = reactive({
	title: '',
	trackNumber: '1',
	discNumber: '1',
	lyrics: '',
	coverUrl: '',
	coverFile: null as File | null,
	audioFile: null as File | null,
	contributors: [] as MusicCreationAlbumContributorDraft[],
})
let songCoverObjectURL = ''

let meta = reactive<MusicAlbumMetaDraft>({
	contributors: [],
  album: '',
  releaseDate: '',
  albumType: 'album',
  description: '',
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
  if (isSongEditor.value && isEditMode.value) return '编辑歌曲'
  return '编辑'
})

watch(editor, async (value) => {
  artistErrorMessage.value = ''
  albumErrorMessage.value = ''
  songErrorMessage.value = ''

  if (!value) {
    resetArtistState()
    resetAlbumState()
    resetSongState()
    return
  }

  if (value.entity === 'artist') {
    resetArtistState()
    resetAlbumState()
    resetSongState()
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
    return
  }

  if (value.entity === 'song') {
		closeMusicCreationFlow()
		resetSongState()
		if (value.id) await loadSong(value.id)
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
    description: '',
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

function resetSongState() {
	songLoading.value = false
	songSubmitting.value = false
	songErrorMessage.value = ''
	songDraft.title = ''
	songDraft.trackNumber = '1'
	songDraft.discNumber = '1'
	songDraft.lyrics = ''
	songDraft.coverUrl = ''
	songDraft.coverFile = null
	songDraft.audioFile = null
	songDraft.contributors = []
	revokeSongCoverPreview()
}

function revokeSongCoverPreview() {
	if (!songCoverObjectURL) return
	URL.revokeObjectURL(songCoverObjectURL)
	songCoverObjectURL = ''
}

onBeforeUnmount(revokeSongCoverPreview)

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
		await submitArtistRevision(current.id, {
			...value,
			reason: '编辑艺术家',
			sources: [],
		})
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

async function loadSong(songId: string) {
	songLoading.value = true
	songErrorMessage.value = ''
	try {
		const detail = await getMusicSongDetail(songId)
		songDraft.title = detail.song.title
		songDraft.trackNumber = String(detail.song.track_number ?? 1)
		songDraft.discNumber = String(detail.song.disc_number ?? 1)
		songDraft.lyrics = detail.song.lyrics ?? ''
		songDraft.coverUrl = detail.song.cover_url ?? detail.song.album?.cover_url ?? ''
		const contributors = new Map<string, MusicCreationAlbumContributorDraft>()
		for (const credit of detail.artists) {
			const current = contributors.get(credit.id) ?? {
				id: `song-contributor-${credit.id}`,
				artistId: credit.id,
				name: credit.name,
				avatarUrl: '',
				kind: 'person' as const,
				locked: false,
				roles: [],
			}
			current.roles.push({
				id: `song-role-${credit.id}-${credit.role}-${credit.custom_role ?? ''}`,
				role: credit.role,
				label: credit.custom_role ?? '',
			})
			contributors.set(credit.id, current)
		}
		songDraft.contributors = [...contributors.values()]
	} catch (error) {
		reportError(error, 'Failed to load song:')
		songErrorMessage.value = '加载歌曲失败'
	} finally {
		songLoading.value = false
	}
}

function selectSongCover(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0] ?? null
	songDraft.coverFile = file
	revokeSongCoverPreview()
	if (file) {
		songCoverObjectURL = URL.createObjectURL(file)
		songDraft.coverUrl = songCoverObjectURL
	}
}

function selectSongAudio(event: Event) {
	songDraft.audioFile = (event.target as HTMLInputElement).files?.[0] ?? null
}

function hasValidSongContributors() {
	return songDraft.contributors.every(contributor => (
		contributor.name.trim()
		&& contributor.roles.length > 0
		&& contributor.roles.every(role => role.role !== 'custom' || role.label.trim())
	))
}

async function handleSongEditSubmit() {
	const current = editor.value
	if (!current || current.entity !== 'song' || current.mode !== 'edit' || !current.id) return
	if (!songDraft.title.trim()) {
		songErrorMessage.value = '歌曲名不能为空'
		return
	}
	if (!hasValidSongContributors()) {
		songErrorMessage.value = '请补全创作者身份'
		return
	}
	songSubmitting.value = true
	songErrorMessage.value = ''
	try {
		const coverAsset = songDraft.coverFile
			? await uploadMusicAsset(songDraft.coverFile, 'music.cover')
			: null
		const audioAsset = songDraft.audioFile
			? await uploadMusicAsset(songDraft.audioFile, 'music.audio')
			: null
		await submitSongRevision(current.id, {
			title: songDraft.title.trim(),
			track_number: Number.parseInt(songDraft.trackNumber, 10) || 1,
			disc_number: Number.parseInt(songDraft.discNumber, 10) || 1,
			lyrics: songDraft.lyrics,
			...(coverAsset ? { cover: coverAsset } : {}),
			artist_credits: albumArtistCreditsFromContributors(songDraft.contributors),
			reason: '编辑歌曲',
		})
		if (audioAsset) {
			try {
				await queueMusicSongAudioReplacement(current.id, {
					audio_url: audioAsset.url,
					source_key: audioAsset.key,
				})
			} catch (error) {
				reportError(error, 'Failed to queue song audio replacement:')
				songErrorMessage.value = '歌曲资料已保存，但音频替换提交失败，请重试'
				refreshSong()
				return
			}
		}
		refreshSong()
		closeCurrentEditor()
	} catch (error) {
		reportError(error, 'Failed to save song:')
		songErrorMessage.value = '保存失败，请稍后重试'
	} finally {
		songSubmitting.value = false
	}
}

function hydrateAlbumDraft(result: MusicAlbumListItem) {
  meta = reactive({
	contributors: albumContributorsFromResponse(result),
    album: result.title ?? '',
    releaseDate: result.release_date?.slice(0, 10) ?? '',
    albumType: normalizeAlbumType(result.album_type),
    description: result.description ?? '',
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
		discNumber: String(song.disc_number ?? 1),
      lyrics: song.lyrics ?? '',
      audioUrl: song.audio_url ?? '',
      audioAsset: song.audio_url
        ? { url: song.audio_url, key: '', content_type: '', size: 0 }
        : null,
		pendingAudioAsset: null,
      file: null,
		coverUrl: song.cover_url ?? '',
		coverFile: null,
		contributors: songContributorsFromCredits(song.artist_credits ?? []),
      isExisting: true,
      removed: false,
    }))
}

function normalizeAlbumType(value?: string): string {
	return value?.trim() || 'album'
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

		await submitAlbumRevision(current.id, {
      title: meta.album.trim(),
		artist_credits: albumArtistCreditsFromContributors(meta.contributors),
      release_date: meta.releaseDate || undefined,
      cover: coverAsset,
      album_type: meta.albumType,
      description: meta.description.trim(),
      tracks: trackPayload,
      reason: notes.editNote.trim() || '编辑专辑与曲目',
      sources: sources.value
        .filter((source) => source.url.trim())
        .map((source) => ({ type: 'url', title: source.title.trim(), url: source.url.trim() })),
			})
		const pendingAudioTracks = uploadedTracks
			.filter((track) => track.isExisting && track.songId && track.pendingAudioAsset)
		const audioResults = await Promise.allSettled(pendingAudioTracks.map((track) => (
			queueMusicSongAudioReplacement(track.songId as string, {
				audio_url: track.pendingAudioAsset!.url,
				source_key: track.pendingAudioAsset!.key,
			})
		)))
		audioResults.forEach((result, index) => {
			if (result.status !== 'fulfilled') return
			const savedTrack = tracks.value.find((track) => track.songId === pendingAudioTracks[index]?.songId)
			if (savedTrack) savedTrack.file = null
		})

    refreshAlbum()
		if (audioResults.some((result) => result.status === 'rejected')) {
			albumErrorMessage.value = '专辑资料已保存，但部分音频替换提交失败，请重试'
			return
		}
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
	const uploadedAudio = track.file ? await uploadMusicAsset(track.file, 'music.audio') : null
	const coverAsset = track.coverFile ? await uploadMusicAsset(track.coverFile, 'music.cover') : null
  return {
    ...track,
		audioUrl: track.isExisting ? track.audioUrl : (uploadedAudio?.url ?? track.audioUrl),
		audioAsset: track.isExisting ? track.audioAsset : (uploadedAudio ?? track.audioAsset),
		pendingAudioAsset: track.isExisting ? uploadedAudio : null,
		coverUrl: coverAsset?.url ?? track.coverUrl,
  }
}

function toTrackPayload(track: MusicTrackDraft, index: number): MusicAlbumTrackEditInput {
  return {
    ...(track.songId ? { id: track.songId } : {}),
    title: track.title.trim(),
    track_number: Number.parseInt(track.trackNumber, 10) || index + 1,
		disc_number: Number.parseInt(track.discNumber, 10) || 1,
    lyrics: track.lyrics?.trim() || '',
    audio_url: track.audioUrl || track.audioAsset?.url || '',
		cover_url: track.coverUrl || '',
		artist_credits: albumArtistCreditsFromContributors(track.contributors),
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

		<div v-else-if="isSongEditor && isEditMode" class="entity-editor__body">
			<p v-if="songErrorMessage" class="entity-editor__error">{{ songErrorMessage }}</p>
			<p v-else-if="songLoading" class="entity-editor__state">正在加载歌曲资料...</p>
			<template v-else>
				<div class="song-editor__grid">
					<PInput v-model="songDraft.title" label="歌曲名" />
					<PInput v-model="songDraft.discNumber" type="number" min="1" label="碟号" />
					<PInput v-model="songDraft.trackNumber" type="number" min="1" label="曲序" />
				</div>
				<PTextarea v-model="songDraft.lyrics" :rows="12" label="歌词" />
				<MusicCreationContributorPicker v-model="songDraft.contributors" />
				<div class="song-editor__media">
					<div>
						<img v-if="songDraft.coverUrl" :src="songDraft.coverUrl" alt="歌曲封面" class="song-editor__cover" />
						<label class="song-editor__file">封面<input type="file" accept="image/*" @change="selectSongCover" /></label>
					</div>
					<label class="song-editor__file">替换音频<input type="file" accept="audio/*" @change="selectSongAudio" /><span>{{ songDraft.audioFile?.name || '未选择文件' }}</span></label>
				</div>
				<div class="entity-editor__actions">
					<PButton variant="secondary" :disabled="songSubmitting" @click="closeCurrentEditor">取消</PButton>
					<PButton variant="warning" :loading="songSubmitting" loading-text="正在保存..." @click="handleSongEditSubmit">保存歌曲</PButton>
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

.song-editor__grid { display: grid; grid-template-columns: minmax(0, 1fr) 8rem 8rem; gap: 0.75rem; }
.song-editor__media { display: grid; grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr); gap: 1rem; align-items: end; }
.song-editor__cover { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; margin-bottom: 0.5rem; }
.song-editor__file { display: grid; gap: 0.4rem; color: var(--a-color-muted); font-size: 0.85rem; }
.song-editor__file input { color: var(--a-color-text); }
@media (max-width: 640px) { .song-editor__grid, .song-editor__media { grid-template-columns: 1fr; } }

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
