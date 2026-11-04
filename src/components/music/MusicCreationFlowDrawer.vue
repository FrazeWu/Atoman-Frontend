<script setup lang="ts">
import { computed, defineAsyncComponent, onUnmounted, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as musicApi from '@/api/musicV1'
import PSheet from '@/components/ui/PSheet.vue'
import PToast from '@/components/ui/PToast.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
const MusicCreationArtistStep = defineAsyncComponent(() => import('./MusicCreationArtistStep.vue'))
const MusicCreationAlbumSeedStep = defineAsyncComponent(() => import('./MusicCreationAlbumSeedStep.vue'))
const MusicCreationAlbumDetailsStep = defineAsyncComponent(() => import('./MusicCreationAlbumDetailsStep.vue'))
const MusicCreationAlbumPreviewStep = defineAsyncComponent(() => import('./MusicCreationAlbumPreviewStep.vue'))
import MusicCreationProgressNav from "./MusicCreationProgressNav.vue"
import {
  hasDatePartsValue,
  formatDateFromParts,
  deriveYearFromParts,
  formatArtistDate,
  formatStoredArtistDate,
  parseStageNames,
  contributorsFromSongDetail,
  buildArtistMembers,
  buildArtistMembersFromDraft,
  buildSource,
  buildNormalizedContributors,
  primaryContributor,
  primaryArtistDraft,
  resolvedArtistSource,
  requiresArtistSource,
  hasRequiredArtistSource,
  resolvedAlbumCoverUrl,
  buildContributorPayload,
  trackNumberWithinDisc,
  hasTrackAudio,
  buildCommitInput,
  hasCreationDraft,
} from "./musicCreationFlowBuilders"

import type { MusicCreationAlbumContributorDraft } from './musicCreationTypes'
import { activeArtistRequiresFullProfile, activeMusicArtistDraft } from './musicCreationTypes'
import type { MusicSheetLayer } from './musicSheetTypes'
import { musicCreationFlowKey } from './musicCreationFlowContext'
import { albumArtistCreditsFromContributors, albumContributorsFromResponse, hasValidAlbumContributors, primaryAlbumRole, songContributorsFromCredits } from '@/utils/musicAlbumCredits'
import { formatStoredPartialDate, parsePartialDateParts, serializePartialDate } from '@/components/music/birthDateMask'
import { parseMusicLyricDraft } from '@/utils/musicLyricsDraft'
import { hasMusicBrainzSource, normalizeMusicImportSource } from '@/utils/musicImportSource'
import { mergeImportedTracksIntoDraft } from '@/utils/musicImportTrackMerge'
import { localizedMusicCountry } from '@/utils/musicImportMetadata'
import { musicCreationProgress } from '@/utils/musicCreationProgress'

type CreationLayer = Extract<MusicSheetLayer, { kind: 'creation' }>
const props = withDefaults(defineProps<{ layer?: CreationLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })

const {
  state,
  closeMusicCreationFlow,
  returnToLayer,
  setMusicCreationStep,
  refreshArtist,
  refreshAlbum,
  refreshSong,
  openNestedAction,
  openMusicCreationFlow,
  completeMusicContributorFlow,
  isLayerActive,
  isLayerShifted,
  isTopLayer,
} = useMusicDrawers()
const router = useRouter()

const toastVisible = ref(false)
const toastMessage = ref('')
const draftSaveMessage = ref('')
let importAutosaveTimer: ReturnType<typeof setTimeout> | null = null
let pendingImportAutosave: { importId: string; input: musicApi.MusicAlbumImportCommitInput; generation: number } | null = null
let importAutosaveDrain: Promise<void> | null = null
let importAutosaveGeneration = 0

const creationFlow = computed(() => props.layer
  ? state.value.creationFlows?.[props.layer.key] ?? null
  : state.value.creationFlow)
provide(musicCreationFlowKey, creationFlow)
const isEditFlow = computed(() => creationFlow.value?.mode === 'edit')
const isOpen = computed(() => props.layer ? isLayerActive(props.layer.key) : creationFlow.value !== null)
const creationEntityLabel = computed(() => {
  const flow = creationFlow.value
  if (!flow) return '内容'
  if (flow.step === 'artist' || flow.entity === 'artist') return '艺术家'
  return ['single', 'leak'].includes(flow.draft.albumDetails.type ?? '') ? '歌曲' : '专辑'
})
const creationEntityName = computed(() => {
  const flow = creationFlow.value
  if (!flow) return ''
  if (creationEntityLabel.value === '艺术家') {
    const artist = activeMusicArtistDraft(flow)
    return artist.stageNames.find((item) => item.isPrimary && item.name.trim())?.name.trim()
      || artist.stageNames.find((item) => item.name.trim())?.name.trim()
      || artist.legalName.trim()
  }
  return flow.draft.albumDetails.title.trim()
})
const sheetTitle = computed(() => {
  const action = isEditFlow.value ? '编辑' : '创建'
  return `${action}-${creationEntityName.value || creationEntityLabel.value}`
})
const sheetIndex = computed(() => props.layer ? props.layerIndex : state.value.artistId !== null ? 1 : 0)
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
function invalidateImportAutosave() {
  importAutosaveGeneration += 1
  if (importAutosaveTimer) {
    clearTimeout(importAutosaveTimer)
    importAutosaveTimer = null
  }
  pendingImportAutosave = null
}

const closeCurrentCreationFlow = () => {
  invalidateImportAutosave()
  closeMusicCreationFlow(props.layer?.key)
}
const loadedEditKey = ref('')
const editDraftBaseline = ref('')
const closePending = ref(false)
onUnmounted(invalidateImportAutosave)

function snapshotDraft(flow: NonNullable<typeof creationFlow.value>) {
  return JSON.stringify(flow.draft)
}

function captureEditDraftBaseline(flow: NonNullable<typeof creationFlow.value>) {
  if (flow.mode !== 'edit') return
  editDraftBaseline.value = snapshotDraft(flow)
  flow.dirty = false
}

function syncEditDraftDirty(flow: NonNullable<typeof creationFlow.value> | null) {
  if (!flow || flow.mode !== 'edit' || !editDraftBaseline.value) return
  flow.dirty = snapshotDraft(flow) !== editDraftBaseline.value
}

async function loadEditDraft() {
  const flow = creationFlow.value
  const targetId = flow?.targetId?.trim()
  if (!flow || flow.mode !== 'edit' || !flow.entity || !targetId) return
  const key = `${flow.entity}:${targetId}`
  if (loadedEditKey.value === key) return
  loadedEditKey.value = key
  flow.loading = true
  flow.errorMessage = ''
  try {
    if (flow.entity === 'artist') {
      const artist = await musicApi.getMusicArtist(targetId, { force: true })
      const members = [...(artist.member_groups?.current ?? []), ...(artist.member_groups?.former ?? [])]
      flow.draft.artist = {
        id: artist.id,
        disambiguation: artist.disambiguation ?? '',
        avatarUrl: artist.image_url ?? '',
        avatarAsset: null,
        kind: artist.artist_form === 'group' ? 'group' : 'person',
        legalName: artist.legal_name ?? '',
        stageNames: parseStageNames(artist.stage_names_json, artist.name ?? ''),
        members: members.map((member, index) => ({
          id: `member-${member.artist_id}-${index}`,
          artistId: member.artist_id,
          name: member.name,
          joinDateParts: parsePartialDateParts(formatStoredPartialDate(member.join_date, member.join_date_precision)),
          leaveDateParts: parsePartialDateParts(formatStoredPartialDate(member.leave_date, member.leave_date_precision)),
        })),
        nationality: artist.nationality ?? '',
        birthPlace: artist.birth_place ?? '',
        birthDateParts: parsePartialDateParts(formatStoredArtistDate(artist.birth_date, artist.birth_date_precision, artist.birth_year)),
        activeStartDateParts: parsePartialDateParts(formatStoredPartialDate(artist.active_start_date, artist.active_start_date_precision)),
        activeEndDateParts: parsePartialDateParts(formatStoredPartialDate(artist.active_end_date, artist.active_end_date_precision)),
        birthDate: formatStoredArtistDate(artist.birth_date, artist.birth_date_precision, artist.birth_year),
        bio: artist.bio ?? '',
        source: '',
        existingSources: artist.sources ?? [],
      }
      captureEditDraftBaseline(flow)
      return
    }

    if (flow.entity === 'song') {
      const detail = await musicApi.getMusicSongDetail(targetId)
      const song = detail.song
      if (song.album?.id || (song.release_type !== 'single' && song.release_type !== 'leak' && song.release_type !== 'leak_song')) {
        throw new Error('专辑曲目请使用歌曲编辑入口')
      }
      const contributors = contributorsFromSongDetail(detail)
      const primary = detail.artists.find((credit) => credit.role === 'primary') ?? detail.artists[0]
      flow.draft.artist.id = primary?.id ?? null
      if (primary) flow.draft.artist.stageNames[0].name = primary.name
      flow.draft.albumDetails = {
        coverUrl: song.cover_url ?? '',
        coverAsset: null,
        title: song.title,
        contributors,
        releaseDateParts: parsePartialDateParts(formatStoredPartialDate(song.release_date, song.release_date_precision)),
        releaseDate: formatStoredPartialDate(song.release_date, song.release_date_precision),
        type: song.release_type === 'leak_song' ? 'leak' : song.release_type,
        releaseYear: song.release_date?.slice(0, 4) || '',
        bio: song.description ?? '',
        tags: [],
        source: '',
        existingSources: song.sources ?? [],
        musicBrainzMatched: ['matched', 'manual'].includes(String(song.match_status ?? '').toLowerCase()) || ['matched', 'manual'].includes(String(song.album?.match_status ?? '').toLowerCase()) || song.album?.musicbrainz_matched === true || hasMusicBrainzSource(song.sources) || hasMusicBrainzSource(song.album?.sources),
      }
      flow.draft.tracks = [{
        id: `edit-track-${song.id}`,
        songId: song.id,
        sequence: 1,
        discNumber: 1,
        title: song.title,
        audioUrl: song.audio_url ?? '',
        coverUrl: song.cover_url ?? '',
        contributors,
        origin: 'existing',
      }]
      flow.tracksCustomized = true
      flow.titleCustomized = true
      captureEditDraftBaseline(flow)
      return
    }

    const album = await musicApi.getMusicAlbum(targetId)
    flow.draft.albumDetails = {
      coverUrl: album.cover_url ?? '',
      coverAsset: null,
      title: album.title ?? '',
      contributors: albumContributorsFromResponse(album),
      releaseDateParts: parsePartialDateParts(formatStoredPartialDate(album.release_date, album.release_date_precision)),
      releaseDate: formatStoredPartialDate(album.release_date, album.release_date_precision),
      type: album.album_type?.trim() || 'album',
      releaseYear: album.release_date?.slice(0, 4) || '',
      bio: album.description ?? '',
      tags: [],
      source: '',
      existingSources: album.sources ?? [],
      musicBrainzMatched: ['matched', 'manual'].includes(String(album.match_status ?? '').toLowerCase()) || album.musicbrainz_matched === true || hasMusicBrainzSource(album.sources),
    }
    flow.draft.tracks = (album.songs ?? [])
      .filter((song) => song.status !== 'closed')
      .sort((left, right) => {
        const discDifference = (left.disc_number ?? 1) - (right.disc_number ?? 1)
        return discDifference || (left.track_number ?? 0) - (right.track_number ?? 0)
      })
      .map((song, index) => ({
        id: `edit-track-${song.id}`,
        songId: song.id,
        sequence: song.track_number ?? index + 1,
        discNumber: song.disc_number ?? 1,
        title: song.title,
        lyrics: song.lyrics ?? '',
        audioUrl: song.audio_url ?? '',
        coverUrl: song.cover_url ?? '',
        contributors: songContributorsFromCredits(song.artist_credits ?? []),
        origin: 'existing',
      }))
    flow.tracksCustomized = true
    flow.titleCustomized = true
    captureEditDraftBaseline(flow)
  } catch (error) {
    loadedEditKey.value = ''
    flow.errorMessage = error instanceof Error ? error.message : '加载资料失败'
  } finally {
    flow.loading = false
  }
}

watch(() => [creationFlow.value?.mode, creationFlow.value?.entity, creationFlow.value?.targetId], () => {
  const flow = creationFlow.value
  if (!flow?.mode || !flow.entity || !flow.targetId?.trim()) {
    loadedEditKey.value = ''
    editDraftBaseline.value = ''
    return
  }
  if (loadedEditKey.value !== `${flow.entity}:${flow.targetId.trim()}`) {
    editDraftBaseline.value = ''
  }
  void loadEditDraft()
}, { immediate: true })

watch(
  () => creationFlow.value?.draft,
  () => syncEditDraftDirty(creationFlow.value),
  { deep: true },
)

type CreationStepKey = 'artist' | 'albumImport' | 'albumDetails' | 'preview'

const stepCopy: Record<CreationStepKey, { cta: string }> = {
  artist: {
    cta: '创建专辑/歌曲',
  },
  albumImport: {
    cta: '下一步',
  },
  albumDetails: {
    cta: '继续',
  },
  preview: {
    cta: '提交',
  },
}

const activeStep = computed(() => {
  const step = creationFlow.value?.step ?? 'artist'
  return stepCopy[step]
})
const contentMaxWidth = computed(() => {
  switch (creationFlow.value?.step) {
    case 'albumDetails':
      return '72rem'
    case 'preview':
      return '48rem'
    default:
      return '60rem'
  }
})
const shouldShowFinishButton = computed(() => {
  const flow = creationFlow.value
  if (!flow) return false
  return flow.mode === 'edit' || flow.step === 'preview'
})
const showFooterActions = computed(() => true)
const showFullAlbumCreationProgress = computed(() => {
  const flow = creationFlow.value
  return Boolean(
    flow
    && flow.mode !== 'edit'
    && !flow.editingContributorId
    && flow.entity !== 'artist'
  )
})
const creationProgress = computed(() => musicCreationProgress(creationFlow.value))
const fullAlbumCreationProgressSteps = computed(() => creationProgress.value.steps)
const fullAlbumCreationProgressIndex = computed(() => creationProgress.value.index)
function metadataMatchFinished(draft: NonNullable<typeof creationFlow.value>['draft']['albumImport']) {
  return draft.metadataMatched === true
    || ['matched', 'unmatched', 'ambiguous', 'manual'].includes(draft.metadataMatchStatus ?? '')
}
const albumImportMatching = computed(() => {
  const flow = creationFlow.value
  if (!flow || flow.step !== 'albumImport') return false
  const draft = flow.draft.albumImport
  if (metadataMatchFinished(draft)) return false
  return draft.metadataMatchStatus === 'matching'
    || draft.metadataMatchingStarted === true
})
const finishButtonLabel = computed(() => {
  const flow = creationFlow.value
  if (!flow) return ''
  const step = flow.step
  if (flow.mode === 'edit') return flow.submitting ? '保存中…' : '保存'
  if (step === 'albumImport' && !metadataMatchFinished(flow.draft.albumImport) && (
    flow.draft.albumImport.metadataMatchStatus === 'matching'
    || flow.draft.albumImport.metadataMatchingStarted
  )) return '匹配中…'
  if (flow.contributorLayer) return '完成创作者'
  if (flow.entity === 'artist' && flow.step === 'artist') {
    return flow.submitting ? '创建中…' : '创建艺术家'
  }
  if (step === 'albumImport') {
    if (albumImportMatching.value || flow.submitting) return '匹配中…'
    if (['matched', 'unmatched', 'ambiguous', 'manual'].includes(flow.draft.albumImport.metadataMatchStatus ?? '')) return '填写信息'
    if (['uploaded', 'queued', 'extracting', 'analyzing', 'transcoding'].includes(flow.draft.albumImport.status)) return '处理中…'
    if (['ready', 'needs_attention', 'failed'].includes(flow.draft.albumImport.status)) return '下一步'
    return activeStep.value.cta
  }
  if (flow.step === 'artist' && flow.editingContributorId) return '完成创作者'
  if (flow.submitting && flow.step === 'preview') return '提交中…'
  if (flow.assetUploading) return '图片上传中…'
  if (flow.step === 'preview') return ['single', 'leak'].includes(flow.draft.albumDetails.type) ? '创建歌曲' : '创建专辑'
  return activeStep.value.cta
})
const forwardBlockReason = computed(() => {
  const flow = creationFlow.value
  if (!flow) return ''
  if (flow.assetUploading) return '图片上传完成后即可继续'
  if (flow.step === 'artist') {
    const artist = activeMusicArtistDraft(flow)
    if (!activeArtistRequiresFullProfile(flow)) {
      if (!artist.stageNames[0]?.name.trim()) return '请填写创作者名称'
      return ''
    }
    if (artist.kind === 'group') {
      const namedMembers = artist.members.filter((member) => member.name.trim())
      if (!artist.stageNames[0]?.name.trim()) return '请填写组合名称'
      if (!artist.activeStartDateParts?.year.trim()) return '请填写成立年份'
      if (namedMembers.length < 2) return '请至少添加两位成员'
      if (namedMembers.some((member) => !member.artistId)) return '请选择已有艺术家或创建成员草稿'
      if (namedMembers.some((member) => !member.joinDateParts.year.trim())) return '请填写成员加入年份'
      if (!artist.source.trim()) return '请填写资料来源'
      return ''
    }
    if (!artist.avatarUrl.trim()) return '请上传头像'
    if (!artist.legalName.trim()) return '请填写本名'
    if (!artist.stageNames[0]?.name.trim()) return '请填写艺名'
    if (!artist.nationality.trim()) return '请选择国籍'
    if (!formatDateFromParts(artist.birthDateParts)) return '请填写出生日期'
    if (!artist.source.trim()) return '请填写资料来源'
    return ''
  }
  if (flow.step === 'albumImport') {
    if (!flow.draft.albumImport.importId) return '请先选择专辑文件'
    if (flow.draft.albumImport.status === 'failed') return flow.draft.albumImport.errorMessage || '上传或处理失败，请重试对应文件'
    return ''
  }
	if (!['albumDetails', 'preview'].includes(flow.step)) return ''
	if (flow.step==='preview' && flow.draft.albumImport.metadataMatchStatus==='ambiguous' && !flow.metadataConfirmed) return '请核对候选发行版本和曲目，并勾选确认'
	if (['queued', 'extracting', 'analyzing', 'transcoding'].includes(flow.draft.albumImport.status) && !flow.draft.tracks.length) return '正在识别音轨，请稍候'
	if (!flow.draft.albumDetails.title.trim()) return ['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) ? '请填写歌曲名' : '请填写专辑名'
	const coverUrl = resolvedAlbumCoverUrl(flow)
	const isCreation = flow.mode !== 'edit'
	if (coverUrl && /^(blob:|data:)/i.test(coverUrl)) return flow.assetUploading ? '正在自动上传识别封面，请稍候' : '识别封面尚未上传成功，请在封面处重试'
	if (!isCreation && !coverUrl) return ['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) ? '请上传歌曲封面' : '请上传专辑封面'
	if (!isCreation && !formatDateFromParts(flow.draft.albumDetails.releaseDateParts)) return '请填写发行日期'
	if (!isCreation && !flow.draft.albumDetails.source.trim()) return '请填写信息来源或修改原因'
	if (!flow.draft.tracks.length || flow.draft.tracks.some((track) => !track.title.trim())) return '请至少添加一首完整音轨'
	if (['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) && flow.draft.tracks.length !== 1) return '单曲和泄曲只能包含一首歌曲，请先移除其他曲目或修改类型'
	if (flow.draft.tracks.some((track) => !hasTrackAudio(track))) return '请为每首曲目添加有效音频'
	if (!flow.draft.albumDetails.contributors?.length) {
		return '请添加创作者'
	}
  if (!hasValidAlbumContributors(flow.draft.albumDetails.contributors)) {
    return '请设置创作者身份并保留主艺术家'
  }
  if (!hasRequiredArtistSource(flow)) return '请填写艺术家资料来源'
  return ''
})
const canGoForward = computed(() => {
  const flow = creationFlow.value
  if (!flow) return false
  if (flow.assetUploading) return false
  if (flow.step === 'artist') {
    const artist = activeMusicArtistDraft(flow)
    if (!activeArtistRequiresFullProfile(flow)) {
      return !!artist.stageNames[0]?.name.trim()
    }
    if (artist.kind === 'group') {
      const namedMembers = artist.members.filter((member) => member.name.trim())
      const hasMissingJoinDate = namedMembers.some((member) => !member.joinDateParts.year.trim())
      return !!artist.stageNames[0]?.name.trim()
        && !!artist.activeStartDateParts?.year.trim()
        && namedMembers.length >= 2
        && namedMembers.every((member) => !!member.artistId)
        && !hasMissingJoinDate
        && !!artist.source.trim()
    }

    return !!artist.avatarUrl.trim()
      && !!artist.legalName.trim()
      && !!artist.stageNames[0]?.name.trim()
      && !!artist.nationality.trim()
      && !!formatDateFromParts(artist.birthDateParts)
      && !!artist.source.trim()
  }
		if (flow.step === 'albumImport') {
			return !!flow.draft.albumImport.importId && metadataMatchFinished(flow.draft.albumImport)
	}
		if (flow.step === 'albumDetails') {
			const coverUrl = resolvedAlbumCoverUrl(flow)
			const isCreation = flow.mode !== 'edit'
			return (flow.mode === 'edit' || !!flow.draft.albumImport.importId)
				&& !!flow.draft.albumDetails.title.trim()
					&& (isCreation || !!coverUrl)
					&& (!coverUrl || !/^(blob:|data:)/i.test(coverUrl))
			&& (isCreation || !!formatDateFromParts(flow.draft.albumDetails.releaseDateParts))
			&& (isCreation || !!flow.draft.albumDetails.source.trim())
			&& flow.draft.tracks.length > 0
			&& (!['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) || flow.draft.tracks.length === 1)
			&& flow.draft.tracks.every((track) => !!track.title.trim())
			&& flow.draft.tracks.every((track) => hasTrackAudio(track))
			&& hasValidAlbumContributors(flow.draft.albumDetails.contributors ?? [])
			&& hasRequiredArtistSource(flow)
	}
		const isCreation = flow.mode !== 'edit'
		return (flow.mode === 'edit' || !!flow.draft.albumImport.importId)
			&& (flow.draft.albumImport.metadataMatchStatus !== 'ambiguous' || !!flow.metadataConfirmed)
			&& !!flow.draft.albumDetails.title.trim()
				&& (isCreation || !!resolvedAlbumCoverUrl(flow))
				&& (!resolvedAlbumCoverUrl(flow) || !/^(blob:|data:)/i.test(resolvedAlbumCoverUrl(flow)))
		&& (isCreation || !!formatDateFromParts(flow.draft.albumDetails.releaseDateParts))
		&& (isCreation || !!flow.draft.albumDetails.source.trim())
		&& flow.draft.tracks.length > 0
		&& (!['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) || flow.draft.tracks.length === 1)
		&& flow.draft.tracks.every((track) => !!track.title.trim())
		&& flow.draft.tracks.every((track) => hasTrackAudio(track))
		&& hasValidAlbumContributors(flow.draft.albumDetails.contributors ?? [])
		&& hasRequiredArtistSource(flow)
})
const commitMusicAlbumImport = (musicApi as typeof musicApi & {
  commitMusicAlbumImport?: (importId: string, input: musicApi.MusicAlbumImportCommitInput) => Promise<musicApi.MusicAlbumImport>
}).commitMusicAlbumImport

function canAutosaveImportDetails(flow: NonNullable<typeof creationFlow.value>) {
  return flow.mode !== 'edit' && !!flow.draft.albumImport.importId && !['committed', 'canceled'].includes(flow.draft.albumImport.status)
}

function flushImportAutosave() {
  if (importAutosaveDrain) return importAutosaveDrain
  importAutosaveDrain = (async () => {
    while (pendingImportAutosave) {
      const pending = pendingImportAutosave
      pendingImportAutosave = null
      const pendingGeneration = pending.generation
      if (pendingGeneration !== importAutosaveGeneration) continue
      try {
        await musicApi.saveMusicAlbumImportDraft(pending.importId, pending.input)
        const flow = creationFlow.value
        if (pendingGeneration !== importAutosaveGeneration) continue
        if (flow && flow.draft.albumImport.importId === pending.importId) {
          draftSaveMessage.value = '草稿已保存'
        }
      } catch {
        draftSaveMessage.value = '草稿保存失败，请保持页面打开并重试'
      }
    }
  })().finally(() => {
    importAutosaveDrain = null
    if (pendingImportAutosave) void flushImportAutosave()
  })
  return importAutosaveDrain
}

function scheduleImportAutosave() {
  if (importAutosaveTimer) clearTimeout(importAutosaveTimer)
  const flow = creationFlow.value
  if (!flow || flow.submitting || !canAutosaveImportDetails(flow)) return
  draftSaveMessage.value = '正在保存草稿…'

  importAutosaveTimer = setTimeout(() => {
    const currentFlow = creationFlow.value
    const importId = currentFlow?.draft.albumImport.importId?.trim()
    if (!currentFlow || !importId || currentFlow.submitting || !canAutosaveImportDetails(currentFlow)) return
    pendingImportAutosave = { importId, input: buildCommitInput(currentFlow), generation: importAutosaveGeneration }
    void flushImportAutosave()
  }, 600)
}

function syncReadyImportToDraft() {
  const flow = creationFlow.value
  if (!flow) return

  const { albumImport, albumDetails } = flow.draft
  if (albumImport.status !== 'ready') return
  const derivedTracks = albumImport.derivedTracks ?? []

  if (albumImport.derivedAlbumTitle.trim()) {
    if (!flow.titleCustomized) {
      albumDetails.title = albumImport.derivedAlbumTitle
    }
  }

  if (albumImport.derivedReleaseDate?.trim() && !flow.releaseDateCustomized) {
    albumDetails.releaseDateParts = parsePartialDateParts(albumImport.derivedReleaseDate)
  }
  if (albumImport.derivedCover.trim() && !flow.coverCustomized) {
    albumDetails.coverUrl = albumImport.derivedCover.trim()
  }
  if (albumImport.derivedAlbumType?.trim() && albumDetails.type === 'album' && !flow.typeCustomized) {
    albumDetails.type = albumImport.derivedAlbumType.trim()
  }

  if (derivedTracks.length > 0) mergeImportedTracksIntoDraft(flow, derivedTracks)
}


watch(
  () => creationFlow.value?.draft.albumImport.status,
  () => {
    syncReadyImportToDraft()
  },
  { immediate: true },
)

// Track the actual persisted payload, not the entire draft. Worker polling and
// upload progress must not enqueue redundant /commit requests, while edits to
// metadata confirmation, credits and imported-track exclusions still autosave.
watch(
  () => {
    const flow = creationFlow.value
    return flow && canAutosaveImportDetails(flow)
      ? JSON.stringify(buildCommitInput(flow))
      : null
  },
  () => scheduleImportAutosave(),
)

watch(
  () => [
    creationFlow.value?.draft.albumImport.derivedAlbumTitle ?? '',
    creationFlow.value?.draft.albumImport.coverUrl ?? '',
    creationFlow.value?.draft.albumImport.derivedCover ?? '',
    creationFlow.value?.draft.albumImport.derivedTracks ?? [],
  ],
  () => {
    syncReadyImportToDraft()
  },
  { deep: true },
)

async function requestClose() {
  const flow = creationFlow.value
  if (!flow) return
  if (flow.contributorLayer) {
    closeCurrentCreationFlow()
    return
  }

  if (flow.draft.albumImport.importId && canAutosaveImportDetails(flow)) {
    if (importAutosaveTimer) clearTimeout(importAutosaveTimer)
    pendingImportAutosave = { importId: flow.draft.albumImport.importId, input: buildCommitInput(flow), generation: importAutosaveGeneration }
    await flushImportAutosave()
    if (creationFlow.value !== flow) return
  }

  const hasDraft = hasCreationDraft(flow)

  if (hasDraft) {
    closePending.value = true
    return
  }
  closeCurrentCreationFlow()
}

const closeConfirmMessage = computed(() => {
  const flow = creationFlow.value
  if (flow?.mode === 'edit' || !flow?.draft.albumImport.importId) return '确认关闭？未保存的内容将丢失。'
  const saved = draftSaveMessage.value === '草稿已保存'
  const uploadPending = flow.draft.albumImport.files.some((file) => file.uploadStatus !== 'uploaded')
  return `${saved ? '草稿已保存，可从导入中心继续。' : '草稿尚未保存成功，关闭会丢失本次填写。'}${uploadPending ? '关闭面板不会取消上传，但请保持当前浏览器页面打开。' : '文件已上传，关闭面板不会取消音频处理。'}`
})

function confirmClose() {
  closePending.value = false
  closeCurrentCreationFlow()
}

function ensurePrimaryArtistContributor(flow: NonNullable<typeof creationFlow.value>) {
  const artist = flow.draft.artist
  const primaryName = artist.stageNames.find((item) => item.isPrimary && item.name.trim())?.name.trim()
    || artist.stageNames.find((item) => item.name.trim())?.name.trim()
    || artist.legalName.trim()
  if (!primaryName) return

  const existing = flow.draft.albumDetails.contributors.find((contributor) => (
    artist.id
      ? contributor.artistId === artist.id
      : !contributor.artistId && (contributor.id === 'contributor-new-artist' || contributor.name.trim() === primaryName)
  ))
  if (existing) {
    existing.name = primaryName
    existing.avatarUrl = artist.avatarUrl
    existing.kind = artist.kind
    existing.locked = !!artist.id
    if (!existing.roles.some((role) => role.role === 'primary')) {
      existing.roles.unshift(primaryAlbumRole(`role-${artist.id || 'new-artist'}-primary`))
    }
    return
  }

  flow.draft.albumDetails.contributors = [
    {
      id: `contributor-${artist.id || 'new-artist'}`,
      artistId: artist.id,
      name: primaryName,
      avatarUrl: artist.avatarUrl,
      kind: artist.kind,
      locked: !!artist.id,
      roles: [primaryAlbumRole(`role-${artist.id || 'new-artist'}-primary`)],
    },
    ...flow.draft.albumDetails.contributors,
  ]
}

function compactArtistName(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}

async function attachKnownImportedArtists(flow: NonNullable<typeof creationFlow.value>, names: string[]) {
  const current = flow.draft.albumDetails.contributors
  const known = new Set(current.map((item) => compactArtistName(item.name)))
  for (const name of names) {
    const result = await musicApi.listMusicArtists({ q: name, page: 1, page_size: 10 })
    const matches = result.data.filter((artist) => (
      compactArtistName(artist.name) === compactArtistName(name)
      || compactArtistName(artist.display_name ?? '') === compactArtistName(name)
    ))
    if (matches.length !== 1 || known.has(compactArtistName(name))) continue
    const artist = matches[0]
    const hasPrimary = current.some((item) => item.roles.some((role) => role.role === 'primary'))
    current.push({
      id: `contributor-${artist.id}`,
      artistId: artist.id,
      name: artist.display_name || artist.name,
      avatarUrl: artist.image_url || '',
      source: artist.sources?.find((source) => source.url || source.title)?.url || '',
      entryStatus: artist.entry_status,
      kind: artist.artist_form === 'group' ? 'group' : 'person',
      locked: true,
      roles: [hasPrimary
        ? { id: `role-${artist.id}-featured`, role: 'featured', label: '' }
        : primaryAlbumRole(`role-${artist.id}-primary`)],
    })
    known.add(compactArtistName(name))
  }
}


async function handlePrimaryAction(artistNextAction: 'create_album' | 'link_album' = 'create_album') {
  const flow = creationFlow.value
  if (!flow) return
  if (!canGoForward.value) {
    flow.errorMessage = forwardBlockReason.value || '请完成必填信息'
    return
  }
  flow.errorMessage = ''
  if (flow.step === 'artist') {
    flow.submitting = true
    try {
      if (flow.editingContributorId) {
        const contributor = flow.draft.albumDetails.contributors.find((item) => item.id === flow.editingContributorId)
        if (!contributor) throw new Error('创作者草稿不存在')
        const artist = activeMusicArtistDraft(flow)
        contributor.name = artist.stageNames.find((item) => item.isPrimary && item.name.trim())?.name.trim()
          || artist.stageNames.find((item) => item.name.trim())?.name.trim()
          || artist.legalName.trim()
        contributor.avatarUrl = artist.avatarUrl
        contributor.kind = artist.kind
        contributor.source = artist.source.trim()
        if (flow.contributorLayer) {
          completeMusicContributorFlow(flow)
          return
        }
        flow.editingContributorId = null
        setMusicCreationStep(flow.contributorReturnStep ?? 'albumDetails')
        return
      }
      if (flow.entity === 'artist') {
        const artist = await musicApi.createMusicArtist(buildCreateArtistInput(flow))
        if (!artist.id?.trim()) throw new Error('创建艺术家失败')
        flow.draft.artist.id = artist.id
        refreshArtist()
        closeMusicCreationFlow(flow.parentKey ?? props.layer?.key)
        await router.push(`/music/artist/${artist.id}`)
        return
      }
      if (artistNextAction === 'link_album' && !flow.draft.artist.id) {
        const artist = await musicApi.createMusicArtist(buildCreateArtistInput(flow))
        if (!artist.id?.trim()) throw new Error('创建艺术家草稿失败')
        flow.draft.artist.id = artist.id
        flow.draft.albumDetails.contributors = [{
          id: `contributor-${artist.id}`,
          artistId: artist.id,
          name: artist.display_name || artist.name,
          avatarUrl: artist.image_url || flow.draft.artist.avatarUrl,
          kind: flow.draft.artist.kind,
          locked: true,
          roles: [{ id: `role-${artist.id}-primary`, role: 'primary', label: '主艺术家' }],
        }]
        refreshArtist()
      }
      if (artistNextAction === 'link_album') {
        const artistId = flow.draft.artist.id
        if (!artistId) throw new Error('缺少艺术家，无法关联专辑')
        openNestedAction('link_album', {
          artistId,
          artistName: flow.draft.albumDetails.contributors[0]?.name || flow.draft.artist.legalName,
          completeCreationFlow: true,
        })
        return
      }
      if (artistNextAction === 'create_album' && props.layer) {
        const primaryName = flow.draft.artist.stageNames.find((item) => item.isPrimary && item.name.trim())?.name.trim()
          || flow.draft.artist.stageNames.find((item) => item.name.trim())?.name.trim()
          || flow.draft.artist.legalName.trim()
        const childFlow = openMusicCreationFlow({
          artistId: flow.draft.artist.id,
          artistName: primaryName,
          artistLegalName: flow.draft.artist.legalName,
          artistSource: flow.draft.artist.source,
          artistFirstFlow: flow.artistFirstFlow,
          startStep: 'albumImport',
          parentKey: props.layer.key,
        }, { artistDraft: flow.draft.artist })
        ensurePrimaryArtistContributor(childFlow)
        return
      }
      ensurePrimaryArtistContributor(flow)
      setMusicCreationStep('albumImport')
    } catch (error) {
      flow.errorMessage = error instanceof Error ? error.message : '创建艺术家草稿失败'
    } finally {
      flow.submitting = false
    }
	} else if (flow.step === "albumImport") {
		if (metadataMatchFinished(flow.draft.albumImport)) {
			flow.returnedToImport = false
			setMusicCreationStep("albumDetails")
		}

  } else if (flow.step === 'albumDetails') {
    setMusicCreationStep('preview')
  }
}

function buildCreateArtistInput(flow: NonNullable<typeof creationFlow.value>): musicApi.MusicArtistInput {
  const artist = flow.draft.artist
  const primaryStageName = artist.stageNames.find((item) => item.isPrimary && item.name.trim())
    ?? artist.stageNames.find((item) => item.name.trim())

  return {
    name: primaryStageName?.name.trim() || artist.legalName.trim(),
    disambiguation: artist.disambiguation?.trim() || undefined,
    legal_name: artist.legalName.trim(),
    stage_names: artist.stageNames
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        is_primary: item.isPrimary,
        start_date_text: item.startDateText.trim(),
        end_date_text: item.endDateText.trim(),
      })),
    bio: artist.bio.trim(),
    image_url: artist.avatarUrl.trim(),
    nationality: artist.nationality.trim(),
    birth_place: artist.birthPlace.trim(),
    birth_date: formatDateFromParts(artist.birthDateParts),
    artist_form: artist.kind,
    active_start_date: formatArtistDate(artist.activeStartDateParts),
    active_end_date: formatArtistDate(artist.activeEndDateParts),
    members: buildArtistMembers(flow),
    sources: [buildSource(artist.source)],
  }
}

function goBackStep() {
  if (!creationFlow.value) return
  if (creationFlow.value.step === 'artist' && creationFlow.value.editingContributorId) {
    if (creationFlow.value.contributorLayer) {
      closeCurrentCreationFlow()
      return
    }
    creationFlow.value.editingContributorId = null
    setMusicCreationStep(creationFlow.value.contributorReturnStep ?? 'albumDetails')
  } else if (creationFlow.value.step === 'preview') {
    setMusicCreationStep('albumDetails')
  } else if (creationFlow.value.step === 'albumDetails') {
    creationFlow.value.returnedToImport = true
    setMusicCreationStep('albumImport')
  } else if (creationFlow.value.step === 'albumImport' && creationFlow.value.artistFirstFlow) {
    if (creationFlow.value.parentKey) returnToLayer(creationFlow.value.parentKey)
    else setMusicCreationStep('artist')
  }
}

async function completeCreation() {
  const flow = creationFlow.value
  if (!flow || flow.submitting) return
  if (flow.assetUploading) {
    flow.errorMessage = '图片上传完成后即可继续'
    return
  }
  if (!canGoForward.value) {
    flow.errorMessage = forwardBlockReason.value || '请完成必填信息'
    return
  }

  flow.submitting = true
  flow.errorMessage = ''

  try {
    if (flow.mode === 'edit' && flow.entity === 'artist' && flow.targetId) {
      const artist = flow.draft.artist
      await musicApi.submitArtistRevision(flow.targetId, {
        name: artist.stageNames.find((item) => item.isPrimary)?.name.trim() || artist.stageNames[0]?.name.trim() || artist.legalName.trim(),
        disambiguation: artist.disambiguation.trim(),
        legal_name: artist.legalName.trim(),
        stage_names_json: JSON.stringify(artist.stageNames.filter((item) => item.name.trim()).map((item) => ({
          name: item.name.trim(),
          is_primary: item.isPrimary,
          start_date_text: item.startDateText.trim(),
          end_date_text: item.endDateText.trim(),
        }))),
        bio: artist.bio.trim(),
        image_url: artist.avatarUrl.trim(),
        nationality: artist.nationality.trim(),
        birth_place: artist.birthPlace.trim(),
        birth_date: formatDateFromParts(artist.birthDateParts),
        artist_form: artist.kind,
        active_start_date: formatArtistDate(artist.activeStartDateParts),
        active_end_date: formatArtistDate(artist.activeEndDateParts),
        members: buildArtistMembers(flow),
        reason: artist.source.trim(),
        sources: artist.existingSources ?? [],
      })
      refreshArtist()
      closeCurrentCreationFlow()
      await router.replace(`/music/artist/${flow.targetId}`)
      return
    }

    if (flow.mode === 'edit' && flow.entity === 'song' && flow.targetId) {
      const details = flow.draft.albumDetails
      const track = flow.draft.tracks[0]
      if (!track?.songId) throw new Error('歌曲资料不完整，请重新打开编辑器')
      const releaseType = details.type.trim().toLowerCase()
      const artistCredits = albumArtistCreditsFromContributors(details.contributors)
      const revisionSources = details.existingSources ?? []
      const releaseDate = formatDateFromParts(details.releaseDateParts)
      const coverURL = details.coverAsset?.url ?? details.coverUrl.trim()

      if (releaseType === 'single' || releaseType === 'leak') {
        await musicApi.submitSongRevision(flow.targetId, {
          title: details.title.trim(),
          description: details.bio.trim(),
          release_type: releaseType,
          release_date: releaseDate,
          ...(details.coverAsset ? { cover: details.coverAsset } : {}),
          artist_credits: artistCredits,
          sources: revisionSources,
          reason: details.source.trim(),
        })
        if (track.audioAssetId) {
          await musicApi.queueMusicSongAudioReplacement(track.songId, { asset_id: track.audioAssetId })
        }
        refreshArtist()
        refreshSong()
        closeCurrentCreationFlow()
        await router.replace(`/music/song/${flow.targetId}`)
        return
      }

      const converted = await musicApi.convertMusicSongToAlbum(flow.targetId, {
        title: details.title.trim(),
        description: details.bio.trim(),
        release_date: releaseDate,
        release_type: releaseType,
        cover_url: coverURL,
        artist_credits: artistCredits,
        sources: revisionSources,
        reason: details.source.trim(),
      })
      if (track.audioAssetId) {
        await musicApi.queueMusicSongAudioReplacement(track.songId, { asset_id: track.audioAssetId })
      }
      refreshArtist()
      refreshAlbum()
      refreshSong()
      closeCurrentCreationFlow()
      await router.replace(`/music/album/${converted.id}`)
      return
    }

    if (flow.mode === 'edit' && flow.entity === 'album' && flow.targetId) {
      const details = flow.draft.albumDetails
      const tracks = flow.draft.tracks
      if (tracks.some((track) => track.audioFileName && !track.audioAssetId && track.origin === 'manual')) {
        throw new Error('音频上传资产无效，请重新选择文件')
      }
      const standaloneType = ['single', 'leak'].includes(details.type.trim().toLowerCase())
      if (standaloneType) {
        if (tracks.length !== 1 || !tracks[0]?.songId) {
          throw new Error('单曲和泄曲只能包含一首已有歌曲，请先修改曲目')
        }
        const converted = await musicApi.convertMusicAlbumToSong(flow.targetId, {
          title: details.title.trim(),
          description: details.bio.trim(),
          release_date: formatDateFromParts(details.releaseDateParts),
          release_type: details.type.trim().toLowerCase(),
          cover_url: details.coverAsset?.url ?? details.coverUrl.trim(),
          artist_credits: albumArtistCreditsFromContributors(details.contributors),
          sources: details.existingSources ?? [],
          reason: details.source.trim(),
        })
        if (tracks[0].audioAssetId) {
          await musicApi.queueMusicSongAudioReplacement(tracks[0].songId, { asset_id: tracks[0].audioAssetId })
        }
        refreshArtist()
        refreshAlbum()
        refreshSong()
        closeCurrentCreationFlow()
        await router.replace(`/music/song/${converted.id}`)
        return
      }
      await musicApi.submitAlbumRevision(flow.targetId, {
        title: details.title.trim(),
        artist_credits: albumArtistCreditsFromContributors(details.contributors),
        release_date: formatDateFromParts(details.releaseDateParts) || undefined,
        cover: details.coverAsset ?? undefined,
        description: details.bio.trim(),
        album_type: details.type.trim() || 'album',
		tracks: tracks.map((track, index) => ({
			...(track.songId ? { id: track.songId } : {}),
			...(!track.songId && track.audioAssetId ? { audio_asset_id: track.audioAssetId } : {}),
			title: track.title.trim(),
			track_number: trackNumberWithinDisc(flow.draft.tracks, index),
			disc_number: track.discNumber ?? 1,
          cover_url: track.coverUrl ?? '',
          artist_credits: albumArtistCreditsFromContributors(track.contributors ?? details.contributors),
          removed: false,
        })),
        reason: details.source.trim(),
        sources: details.existingSources ?? [],
      })
      for (const track of tracks) {
        if (track.songId && track.audioAssetId) {
          await musicApi.queueMusicSongAudioReplacement(track.songId, { asset_id: track.audioAssetId })
        }
      }
      refreshAlbum()
      closeCurrentCreationFlow()
      await router.replace(`/music/album/${flow.targetId}`)
      return
    }

    const importId = flow.draft.albumImport.importId?.trim()
    if (!importId) {
      throw new Error('缺少 importId，无法提交专辑导入')
    }

    if (!commitMusicAlbumImport) {
      throw new Error('commitMusicAlbumImport is unavailable')
    }

    if (importAutosaveTimer) clearTimeout(importAutosaveTimer)
    await flushImportAutosave()
    let committedImport = await commitMusicAlbumImport(importId, buildCommitInput(flow))
    const uploadsComplete = committedImport.status === 'uploading'
      && committedImport.files.length > 0
      && committedImport.files.every((file) => file.uploadStatus === 'uploaded')
    if (uploadsComplete) {
      committedImport = await musicApi.completeMusicAlbumImportSession(importId)
    }
    toastMessage.value = committedImport.status === 'committed' ? '创建成功' : '已提交，可在导入中心查看处理进度；上传未完成时请保持页面打开'
    toastVisible.value = true
    const artistId = committedImport.artistId?.trim() || flow.draft.artist.id?.trim()
    refreshArtist()
    refreshAlbum()
    refreshSong()
    invalidateImportAutosave()
    closeMusicCreationFlow(flow.parentKey ?? props.layer?.key)
    await router.push(committedImport.status === 'committed' && artistId ? `/music/artist/${artistId}` : '/music/imports')
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
  <PToast v-model="toastVisible" :message="toastMessage" />
  <PSheet
    :show="isOpen"
    :title="sheetTitle"
    mode="full"
    :index="sheetIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    :content-max-width="contentMaxWidth"
    panel-class="creation-flow-drawer"
    @close="requestClose"
    @activate="props.layer && returnToLayer(props.layer.key)"
  >
    <div v-if="creationFlow" class="creation-flow">
      <MusicCreationProgressNav
        v-if="showFullAlbumCreationProgress"
        :steps="fullAlbumCreationProgressSteps"
        :active-index="fullAlbumCreationProgressIndex"
      />
      <div class="drawer-body">
        <p
          v-if="creationFlow.errorMessage"
          data-testid="music-creation-error"
          class="error-message"
        >
          {{ creationFlow.errorMessage }}
        </p>
        <p v-if="creationFlow.loading" class="error-message">正在加载资料...</p>
        <MusicCreationArtistStep v-else-if="creationFlow.step === 'artist'" />

        <MusicCreationAlbumSeedStep v-else-if="creationFlow.step === 'albumImport'" />

        <MusicCreationAlbumDetailsStep v-else-if="creationFlow.step === 'albumDetails'" />

        <MusicCreationAlbumPreviewStep v-else-if="creationFlow.step === 'preview'" />

      </div>
    </div>
    <template #footer>
        <div v-if="creationFlow && showFooterActions" class="footer-actions" data-testid="creation-flow-footer" :style="{ maxWidth: contentMaxWidth }">
          <p v-if="draftSaveMessage && !isEditFlow" role="status">{{ draftSaveMessage }}</p>
          <p
            v-if="forwardBlockReason"
            class="forward-block-reason"
            data-testid="creation-flow-block-reason"
          >
            {{ forwardBlockReason }}
          </p>
          <button
            data-testid="music-creation-close-button"
            type="button"
            class="ui-action"
            @click="requestClose"
          >
            关闭
          </button>
          <button
            v-if="creationFlow.mode !== 'edit' && creationFlow.step !== 'artist' && (creationFlow.step !== 'albumImport' || creationFlow.artistFirstFlow)"
            data-testid="album-details-back-button"
            type="button"
            class="ui-action"
            @click="goBackStep"
          >
            返回上一步
          </button>
          <button
            v-if="creationFlow.mode !== 'edit' && creationFlow.step === 'artist' && creationFlow.editingContributorId"
            data-testid="artist-contributor-back-button"
            type="button"
            class="ui-action"
            @click="goBackStep"
          >
            返回专辑
          </button>
          <button
            v-if="creationFlow.mode !== 'edit' && creationFlow.entity !== 'artist' && creationFlow.step === 'artist' && !creationFlow.editingContributorId"
            data-testid="artist-link-album-button"
            type="button"
            class="ui-action"
            :disabled="creationFlow.submitting"
            @click="handlePrimaryAction('link_album')"
          >
            关联现有专辑
          </button>
          <button
            :data-testid="shouldShowFinishButton ? 'music-creation-finish-button' : 'artist-next-button'"
            type="button"
            class="primary-action"
            :disabled="creationFlow.submitting || albumImportMatching || (creationFlow.step === 'albumImport' && !canGoForward)"
            @click="shouldShowFinishButton ? completeCreation() : handlePrimaryAction('create_album')"
          >
            {{ finishButtonLabel }}
          </button>
        </div>
    </template>
  </PSheet>

  <PConfirm
    above-player
    :show="closePending"
    title="关闭创建流程"
    :message="closeConfirmMessage"
    confirm-text="关闭"
    danger
    @confirm="confirmClose"
    @cancel="closePending = false"
  />
</template>

<style scoped>
@import "./musicCreationFlowDrawer.css";

:global(.creation-flow-drawer) {
  background: var(--a-color-bg) !important;
}
</style>
