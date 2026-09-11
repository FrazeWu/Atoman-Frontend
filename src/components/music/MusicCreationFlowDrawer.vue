<script setup lang="ts">
import { computed, onUnmounted, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as musicApi from '@/api/musicV1'
import PSheet from '@/components/ui/PSheet.vue'
import PToast from '@/components/ui/PToast.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import MusicCreationArtistStep from './MusicCreationArtistStep.vue'
import MusicCreationAlbumSeedStep from './MusicCreationAlbumSeedStep.vue'
import MusicCreationAlbumDetailsStep from './MusicCreationAlbumDetailsStep.vue'
import MusicCreationAlbumPreviewStep from './MusicCreationAlbumPreviewStep.vue'
import type { MusicCreationAlbumContributorDraft } from './musicCreationTypes'
import { activeArtistRequiresFullProfile, activeMusicArtistDraft } from './musicCreationTypes'
import type { MusicSheetLayer } from './musicSheetTypes'
import { musicCreationFlowKey } from './musicCreationFlowContext'
import { albumArtistCreditsFromContributors, albumContributorsFromResponse, hasValidAlbumContributors, primaryAlbumRole, songContributorsFromCredits } from '@/utils/musicAlbumCredits'
import { formatStoredPartialDate, parsePartialDateParts, serializePartialDate } from '@/components/music/birthDateMask'
import { parseMusicLyricDraft } from '@/utils/musicLyricsDraft'
import { hasMusicBrainzSource, normalizeMusicImportSource } from '@/utils/musicImportSource'
import { mergeImportedTracksIntoDraft } from '@/utils/musicImportTrackMerge'

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
  isLayerActive,
  isLayerShifted,
  isTopLayer,
} = useMusicDrawers()
const router = useRouter()

const toastVisible = ref(false)
const toastMessage = ref('')
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
    return flow.draft.artist.stageNames.find((item) => item.isPrimary && item.name.trim())?.name.trim()
      || flow.draft.artist.stageNames.find((item) => item.name.trim())?.name.trim()
      || flow.draft.artist.legalName.trim()
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

function parseStageNames(raw: string | undefined, fallbackName: string) {
  try {
    const parsed = JSON.parse(raw || '[]') as musicApi.MusicAlbumImportCommitStageName[]
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((item, index) => ({
        id: `stage-name-${index}`,
        name: item.name || '',
        isPrimary: item.is_primary || index === 0,
        startDateParts: { year: '', month: '', day: '' },
        endDateParts: { year: '', month: '', day: '' },
        startDateText: item.start_date_text || '',
        endDateText: item.end_date_text || '',
      }))
    }
  } catch {
    // Use the canonical name when legacy stage-name data is unavailable.
  }
  return [{
    id: 'stage-name-primary',
    name: fallbackName,
    isPrimary: true,
    startDateParts: { year: '', month: '', day: '' },
    endDateParts: { year: '', month: '', day: '' },
    startDateText: '',
    endDateText: '',
  }]
}

function formatStoredArtistDate(value?: string, precision?: string, fallbackYear?: number) {
  const formatted = formatStoredPartialDate(value, precision)
  if (formatted) return formatted
  return fallbackYear && fallbackYear > 0 ? `${fallbackYear}/--/--` : ''
}

function contributorsFromSongDetail(detail: musicApi.MusicSongDetail) {
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
  return [...contributors.values()]
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
      if (song.album?.id || (song.release_type !== 'single' && song.release_type !== 'leak')) {
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
        type: song.release_type,
        releaseYear: song.release_date?.slice(0, 4) || '',
        bio: song.description ?? '',
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

function hasDatePartsValue(parts?: { year: string; month: string; day: string }) {
  if (!parts) return false
  return !!parts.year.trim() || !!parts.month.trim() || !!parts.day.trim()
}

function formatDateFromParts(parts?: { year: string; month: string; day: string }) {
	return serializePartialDate(parts)
}

function deriveYearFromParts(parts?: { year: string; month: string; day: string }) {
  if (!parts) return 0
  return Number.parseInt(parts.year.trim(), 10) || 0
}

function hasCreationDraft(flow: NonNullable<typeof creationFlow.value>) {
  if (flow.mode === 'edit') return flow.dirty

  const { artist, albumImport, albumDetails, tracks } = flow.draft

  return (
    flow.dirty ||
    !!artist.avatarUrl.trim() ||
    !!artist.legalName.trim() ||
    !!artist.disambiguation?.trim() ||
    artist.stageNames.some((stageName) => !!stageName.name.trim()) ||
    artist.members.some((member) => !!member.name.trim()) ||
    !!artist.nationality.trim() ||
    !!artist.birthPlace.trim() ||
    hasDatePartsValue(artist.birthDateParts) ||
    hasDatePartsValue(artist.activeStartDateParts) ||
    hasDatePartsValue(artist.activeEndDateParts) ||
    !!artist.bio.trim() ||
    !!artist.source.trim() ||
    !!albumImport.archiveName.trim() ||
    albumImport.uploadProgress > 0 ||
    !!albumImport.derivedAlbumTitle.trim() ||
    albumImport.derivedTracks.length > 0 ||
    !!albumDetails.coverUrl.trim() ||
    !!albumDetails.title.trim() ||
    (albumDetails.contributors?.length ?? 0) > 0 ||
    hasDatePartsValue(albumDetails.releaseDateParts) ||
    !!albumDetails.bio.trim() ||
    !!albumDetails.source.trim() ||
    tracks.length > 0
  )
}

const stepCopy: Record<CreationStepKey, { cta: string }> = {
  artist: {
    cta: '创建专辑/歌曲',
  },
  albumImport: {
    cta: '开始匹配',
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
    && flow.artistFirstFlow,
  )
})
const fullAlbumCreationProgressSteps = [
  { key: 'artist', label: '创建艺术家' },
  { key: 'upload', label: '上传专辑' },
  { key: 'match', label: '匹配' },
  { key: 'details', label: '完善信息' },
  { key: 'submit', label: '提交' },
] as const
const fullAlbumCreationProgressIndex = computed(() => {
  const flow = creationFlow.value
  if (!flow) return -1
  if (flow.step === 'artist') return 0
  if (flow.step === 'albumImport') {
    return flow.draft.albumImport.metadataMatched
      || flow.draft.albumImport.metadataMatchStatus === 'matched'
      ? 2
      : 1
  }
  if (flow.step === 'albumDetails') return 3
  return 4
})
const finishButtonLabel = computed(() => {
  if (creationFlow.value?.mode === 'edit') return creationFlow.value.submitting ? '保存中…' : '保存'
  if (creationFlow.value?.step === 'artist' && creationFlow.value.artistBeforeMatch) {
    return creationFlow.value.submitting ? '匹配中…' : '开始匹配'
  }
  if (creationFlow.value?.step === 'artist' && creationFlow.value.editingContributorId) return '完成创作者'
  if (creationFlow.value?.submitting && creationFlow.value.step === 'preview') return '提交中…'
  if (creationFlow.value?.assetUploading) return '图片上传中…'
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
      if (flow.artistBeforeMatch && !albumImportUploadFinished(flow)) return '等待文件上传完成'
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
      if (flow.artistBeforeMatch && !albumImportUploadFinished(flow)) return '等待文件上传完成'
      return ''
    }
    if (!artist.avatarUrl.trim()) return '请上传头像'
    if (!artist.legalName.trim()) return '请填写本名'
    if (!artist.stageNames[0]?.name.trim()) return '请填写艺名'
    if (!artist.nationality.trim()) return '请选择国籍'
    if (!formatDateFromParts(artist.birthDateParts)) return '请填写出生日期'
    if (!artist.source.trim()) return '请填写资料来源'
    if (flow.artistBeforeMatch && !albumImportUploadFinished(flow)) return '等待文件上传完成'
    return ''
  }
  if (!['albumDetails', 'preview'].includes(flow.step)) return ''
  if (['queued', 'extracting', 'analyzing', 'transcoding'].includes(flow.draft.albumImport.status) && !flow.draft.tracks.length) return '正在识别音轨，请稍候'
  if (!flow.draft.albumDetails.title.trim()) return ['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) ? '请填写歌曲名' : '请填写专辑名'
	if (!flow.draft.albumDetails.coverUrl.trim()) return ['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) ? '请上传歌曲封面' : '请上传专辑封面'
	if (!formatDateFromParts(flow.draft.albumDetails.releaseDateParts)) return '请填写发行日期'
	if (!flow.draft.albumDetails.source.trim()) return '请填写信息来源或修改原因'
	if (!flow.draft.tracks.length || flow.draft.tracks.some((track) => !track.title.trim())) return '请至少添加一首完整音轨'
	if (['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) && flow.draft.tracks.length !== 1) return '单曲和泄曲只能包含一首歌曲，请先移除其他曲目或修改类型'
	if (flow.draft.tracks.some((track) => track.origin === 'manual' && !hasTrackAudio(track))) return '请为新增曲目上传音频'
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
        && (!flow.artistBeforeMatch || albumImportUploadFinished(flow))
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
        && (!flow.artistBeforeMatch || albumImportUploadFinished(flow))
    }

    return !!artist.avatarUrl.trim()
      && !!artist.legalName.trim()
      && !!artist.stageNames[0]?.name.trim()
      && !!artist.nationality.trim()
      && !!formatDateFromParts(artist.birthDateParts)
      && !!artist.source.trim()
      && (!flow.artistBeforeMatch || albumImportUploadFinished(flow))
  }
	if (flow.step === 'albumImport') {
		return !!flow.draft.albumImport.importId
	}
	if (flow.step === 'albumDetails') {
		return (flow.mode === 'edit' || !!flow.draft.albumImport.importId)
			&& !!flow.draft.albumDetails.title.trim()
			&& !!flow.draft.albumDetails.coverUrl.trim()
			&& !!formatDateFromParts(flow.draft.albumDetails.releaseDateParts)
			&& !!flow.draft.albumDetails.source.trim()
			&& flow.draft.tracks.length > 0
			&& (!['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) || flow.draft.tracks.length === 1)
			&& flow.draft.tracks.every((track) => !!track.title.trim())
			&& flow.draft.tracks.every((track) => track.origin !== 'manual' || hasTrackAudio(track))
			&& hasValidAlbumContributors(flow.draft.albumDetails.contributors ?? [])
			&& hasRequiredArtistSource(flow)
	}
	return (flow.mode === 'edit' || !!flow.draft.albumImport.importId)
		&& !!flow.draft.albumDetails.title.trim()
		&& !!flow.draft.albumDetails.coverUrl.trim()
		&& !!formatDateFromParts(flow.draft.albumDetails.releaseDateParts)
		&& !!flow.draft.albumDetails.source.trim()
		&& flow.draft.tracks.length > 0
		&& (!['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase()) || flow.draft.tracks.length === 1)
		&& flow.draft.tracks.every((track) => !!track.title.trim())
		&& flow.draft.tracks.every((track) => track.origin !== 'manual' || hasTrackAudio(track))
		&& hasValidAlbumContributors(flow.draft.albumDetails.contributors ?? [])
		&& hasRequiredArtistSource(flow)
})
const commitMusicAlbumImport = (musicApi as typeof musicApi & {
  commitMusicAlbumImport?: (importId: string, input: musicApi.MusicAlbumImportCommitInput) => Promise<musicApi.MusicAlbumImport>
}).commitMusicAlbumImport

function formatArtistDate(parts?: { year: string; month: string; day: string }) {
	return serializePartialDate(parts)
}

function buildArtistMembers(flow: NonNullable<typeof creationFlow.value>) {
  return buildArtistMembersFromDraft(flow.draft.artist)
}

function buildArtistMembersFromDraft(artist: ReturnType<typeof activeMusicArtistDraft>) {
  return artist.members
    .filter((member) => member.name.trim())
    .map((member) => ({
      artist_id: member.artistId || '',
		name: member.name.trim(),
      join_date: formatArtistDate(member.joinDateParts),
      leave_date: formatArtistDate(member.leaveDateParts),
    }))
}

function buildSource(value: string): musicApi.MusicSource {
  const normalized = value.trim()
  return /^https?:\/\//i.test(normalized)
    ? { type: 'url', url: normalized }
    : { type: 'text', title: normalized }
}

function buildNormalizedContributors(flow: NonNullable<typeof creationFlow.value>) {
  const contributors = [...(flow.draft.albumDetails.contributors ?? [])]
  if (
    flow.draft.artist.id
    && contributors.length === 1
    && !contributors[0].locked
    && !contributors[0].artistId
  ) {
    contributors[0] = {
      ...contributors[0],
      id: `contributor-${flow.draft.artist.id}`,
      artistId: flow.draft.artist.id,
    }
  }
  return contributors
}

function primaryContributor(flow: NonNullable<typeof creationFlow.value>) {
  return buildNormalizedContributors(flow).find((contributor) =>
    contributor.roles.some((role) => role.role === 'primary'),
  )
}

function primaryArtistDraft(flow: NonNullable<typeof creationFlow.value>) {
  return primaryContributor(flow)?.newArtistDraft ?? flow.draft.artist
}

function resolvedArtistSource(flow: NonNullable<typeof creationFlow.value>) {
  const primary = primaryContributor(flow)
  const primarySource = normalizeMusicImportSource(primary?.source || primary?.newArtistDraft?.source)
  const primaryDiffersFromFlowArtist = !!primary?.artistId && primary.artistId !== flow.draft.artist.id
  return primaryDiffersFromFlowArtist
    ? primarySource
    : normalizeMusicImportSource(flow.draft.artist.source) || primarySource
}

function requiresArtistSource(flow: NonNullable<typeof creationFlow.value>) {
  const primary = primaryContributor(flow)
  return !primary?.artistId || !primary.entryStatus || primary.entryStatus === 'draft'
}

function hasRequiredArtistSource(flow: NonNullable<typeof creationFlow.value>) {
  if (flow.mode === 'edit' && (flow.entity === 'album' || flow.entity === 'song')) return true
  return !requiresArtistSource(flow) || !!resolvedArtistSource(flow)
}

function buildContributorPayload(flow: NonNullable<typeof creationFlow.value>): NonNullable<musicApi.MusicAlbumImportCommitInput['artists']> {
  return buildNormalizedContributors(flow).map((contributor) => {
    if (!contributor.artistId) {
      const artist = contributor.newArtistDraft ?? flow.draft.artist
      const activeStartDate = formatArtistDate(artist.activeStartDateParts)
      const activeEndDate = formatArtistDate(artist.activeEndDateParts)
      const artistStageNames = artist.stageNames
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          is_primary: item.isPrimary,
          start_date_text: item.startDateText.trim(),
          end_date_text: item.endDateText.trim(),
        }))
      return {
        artist_id: '',
		roles: contributor.roles.map((role) => ({
			role: role.role,
			...(role.role === 'custom' ? { label: role.label.trim() } : {}),
		})),
        name: contributor.name.trim(),
        disambiguation: artist.disambiguation?.trim() || '',
        legal_name: artist.legalName.trim(),
        bio: artist.bio.trim(),
        ...(contributor.avatarUrl.trim() ? { image_url: contributor.avatarUrl.trim() } : {}),
        nationality: artist.nationality.trim(),
        birth_date: formatDateFromParts(artist.birthDateParts),
        stage_names: artistStageNames,
        birth_place: artist.birthPlace.trim(),
        artist_form: artist.kind,
        active_start_date: activeStartDate,
        active_end_date: activeEndDate,
        members: buildArtistMembersFromDraft(artist),
      }
    }

    return {
      artist_id: contributor.artistId,
		roles: contributor.roles.map((role) => ({
			role: role.role,
			...(role.role === 'custom' ? { label: role.label.trim() } : {}),
		})),
      name: contributor.name.trim(),
      disambiguation: '',
      legal_name: '',
      bio: '',
      stage_names: [],
      birth_place: '',
      nationality: '',
      birth_date: '',
      artist_form: contributor.kind,
      active_start_date: '',
      active_end_date: '',
        members: [],
      }
  })
}

function trackNumberWithinDisc(tracks: Array<{ discNumber?: number }>, index: number) {
  const discNumber = tracks[index]?.discNumber ?? 1
  return tracks.slice(0, index + 1).filter((track) => (track.discNumber ?? 1) === discNumber).length
}

function hasTrackAudio(track: { audioUrl?: string; audioKey?: string; audioAssetId?: string }) {
  return !!track.audioUrl?.trim() || !!track.audioKey?.trim() || !!track.audioAssetId?.trim()
}

function buildCommitInput(flow: NonNullable<typeof creationFlow.value>): musicApi.MusicAlbumImportCommitInput {
  const primaryContributorDraft = primaryArtistDraft(flow)
  const primary = primaryContributor(flow)
  const primaryStageName = primaryContributorDraft.stageNames.find((item) => item.isPrimary && item.name.trim())
    ?? primaryContributorDraft.stageNames.find((item) => item.name.trim())
  const releaseDate = formatDateFromParts(flow.draft.albumDetails.releaseDateParts)
  const derivedReleaseYear = deriveYearFromParts(flow.draft.albumDetails.releaseDateParts)
  const artists = buildContributorPayload(flow)
  const primaryArtistID = primaryContributor(flow)?.artistId || flow.draft.artist.id
  const artistSource = resolvedArtistSource(flow)
  const albumSource = normalizeMusicImportSource(flow.draft.albumDetails.source)
  const isStandaloneSong = ['single', 'leak'].includes(flow.draft.albumDetails.type.trim().toLowerCase())
  const deletedImportTrackKeys = flow.deletedImportTrackKeys ?? []

  return {
    ...(primaryArtistID ? { artist_id: primaryArtistID } : {}),
    artist: {
      name: primary?.newArtistDraft
        ? primary.name.trim()
        : primaryStageName?.name.trim() || primaryContributorDraft.legalName.trim(),
      legal_name: primaryContributorDraft.legalName.trim(),
      bio: primaryContributorDraft.bio.trim(),
      ...(primaryContributorDraft.avatarUrl.trim() ? { image_url: primaryContributorDraft.avatarUrl.trim() } : {}),
      nationality: primaryContributorDraft.nationality.trim(),
      birth_date: formatDateFromParts(primaryContributorDraft.birthDateParts),
      stage_names: primaryContributorDraft.stageNames
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          is_primary: item.isPrimary,
          start_date_text: item.startDateText.trim(),
          end_date_text: item.endDateText.trim(),
        })),
      birth_place: primaryContributorDraft.birthPlace.trim(),
    },
    artists,
    artist_source: artistSource,
    ...(artistSource ? { artist_sources: [buildSource(artistSource)] } : {}),
    album: {
      title: flow.draft.albumDetails.title.trim(),
      description: flow.draft.albumDetails.bio.trim(),
      album_type: flow.draft.albumDetails.type.trim() || 'album',
      ...(flow.draft.albumDetails.coverUrl.trim() ? { cover_url: flow.draft.albumDetails.coverUrl.trim() } : {}),
      ...(releaseDate ? { release_date: releaseDate } : {}),
      release_year: derivedReleaseYear || 0,
      tracks: flow.draft.tracks.map((track, index) => ({
        ...(track.songId ? { song_id: track.songId } : {}),
        ...(track.importFileId ? { file_id: track.importFileId } : {}),
        ...(track.audioAssetId ? { audio_asset_id: track.audioAssetId } : {}),
        ...(track.audioKey ? { audio_key: track.audioKey } : {}),
        title: isStandaloneSong ? flow.draft.albumDetails.title.trim() : track.title.trim(),
        disc_number: track.discNumber ?? 1,
        track_number: trackNumberWithinDisc(flow.draft.tracks, index),
        ...(track.originalTitle ? { original_title: track.originalTitle } : {}),
        ...(track.originalDiscNumber ? { original_disc_number: track.originalDiscNumber } : {}),
        ...(track.originalTrackNumber ? { original_track_number: track.originalTrackNumber } : {}),
        ...(track.matchStatus ? { match_status: track.matchStatus } : {}),
        ...(track.matchProvider ? { match_provider: track.matchProvider } : {}),
        ...(track.matchExternalId ? { match_external_id: track.matchExternalId } : {}),
        ...(track.matchSourceUrl ? { match_source_url: track.matchSourceUrl } : {}),
        ...(track.matchConfidence !== undefined ? { match_confidence: track.matchConfidence } : {}),
        ...(track.titleCustomized ? { title_customized: true } : {}),
        ...(track.sequenceCustomized ? { sequence_customized: true } : {}),
        ...(track.lyricsDraft ? {
          lyrics: {
            content: track.lyricsDraft.content,
            translation: track.lyricsDraft.translation,
            format: track.lyricsDraft.format,
            language: track.lyricsDraft.language,
            edit_summary: track.lyricsDraft.editSummary,
          },
        } : {}),
        ...(track.lyricsSource ? { lyrics_source: track.lyricsSource } : {}),
      })),
    },
    ...(deletedImportTrackKeys.length > 0
      ? { deleted_import_track_keys: [...deletedImportTrackKeys] }
      : {}),
    album_source: albumSource,
    ...(albumSource ? { album_sources: [buildSource(albumSource)] } : {}),
  }
}

function canAutosaveImportDetails(flow: NonNullable<typeof creationFlow.value>) {
  if (flow.editingContributorId) return false
  const details = flow.draft.albumDetails
  const tracks = flow.draft.tracks
  const hasRequiredDetails = !!details.title.trim()
    && !!details.coverUrl.trim()
    && !!formatDateFromParts(details.releaseDateParts)
    && !!details.source.trim()
    && tracks.length > 0
    && tracks.every((track) => !!track.title.trim())
    && tracks.every((track) => track.origin !== 'manual' || hasTrackAudio(track))
    && hasValidAlbumContributors(details.contributors ?? [])
    && hasRequiredArtistSource(flow)
  const status = flow.draft.albumImport.status
  const canSubmitAtCurrentStep = ['pending_upload', 'uploading', 'uploaded', 'queued', 'extracting', 'analyzing', 'transcoding'].includes(status)
    || (status === 'ready' && flow.step === 'albumDetails')

  return !!flow.draft.albumImport.importId && hasRequiredDetails && canSubmitAtCurrentStep
}

async function finishAutomaticallyCommittedImport(
  flow: NonNullable<typeof creationFlow.value>,
  committed: Awaited<ReturnType<typeof musicApi.commitMusicAlbumImport>>,
) {
  if (committed.status !== 'committed' || flow.submitting) return
  const artistId = committed.artistId?.trim() || flow.draft.artist.id?.trim()
  refreshArtist()
  refreshAlbum()
  refreshSong()
  invalidateImportAutosave()
  closeMusicCreationFlow(flow.parentKey ?? props.layer?.key)
  await router.push(artistId ? `/music/artist/${artistId}` : '/music/imports')
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
        const committed = await musicApi.commitMusicAlbumImport(pending.importId, pending.input)
        const flow = creationFlow.value
        if (pendingGeneration !== importAutosaveGeneration) continue
        if (flow && flow.draft.albumImport.importId === pending.importId) {
          flow.draft.albumImport.status = committed.status
          flow.draft.albumImport.errorMessage = committed.errorMessage ?? ''
          await finishAutomaticallyCommittedImport(flow, committed)
        }
      } catch {
        // 最终提交会再次保存并显示错误，避免打断资料填写。
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

  if (derivedTracks.length > 0) mergeImportedTracksIntoDraft(flow, derivedTracks)
}

watch(
  () => creationFlow.value?.draft.albumImport.status,
  () => {
    syncReadyImportToDraft()
  },
  { immediate: true },
)

watch(
  () => creationFlow.value?.draft,
  () => scheduleImportAutosave(),
  { deep: true },
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

function requestClose() {
  const flow = creationFlow.value
  if (!flow) return

  const hasDraft = hasCreationDraft(flow)

  if (hasDraft) {
    closePending.value = true
    return
  }
  closeCurrentCreationFlow()
}

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
      : !contributor.artistId && contributor.name.trim() === primaryName
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

function albumImportUploadFinished(flow: NonNullable<typeof creationFlow.value>) {
  return ['uploaded', 'ready', 'needs_attention'].includes(flow.draft.albumImport.status)
}

function matchingAlbumTitle(flow: NonNullable<typeof creationFlow.value>) {
  const derivedTitle = flow.draft.albumImport.derivedAlbumTitle.trim()
  if (derivedTitle) return derivedTitle
  const archiveName = flow.draft.albumImport.archiveName.trim()
  if (archiveName) return archiveName.replace(/\.(?:zip|rar|7z|tar|gz|bz2|xz)$/i, '')
  return '未命名专辑'
}

async function startAlbumImportMatching(flow: NonNullable<typeof creationFlow.value>) {
  const importId = flow.draft.albumImport.importId?.trim()
  if (!importId) throw new Error('文件上传尚未完成，请稍候')
  const input = buildCommitInput(flow)
  input.album = {
    ...input.album,
    title: input.album.title.trim() || matchingAlbumTitle(flow),
    tracks: [],
  }
  const matched = await musicApi.commitMusicAlbumImport(importId, input)
  flow.draft.albumImport.status = matched.status
  flow.draft.albumImport.stage = matched.stage
  flow.draft.albumImport.errorMessage = matched.errorMessage ?? ''
  flow.draft.albumImport.files = matched.files ?? flow.draft.albumImport.files
  flow.artistBeforeMatch = false
  setMusicCreationStep('albumImport')
}

async function previewAlbumImportMetadata(flow: NonNullable<typeof creationFlow.value>) {
  const albumImport = flow.draft.albumImport
  const trackTitles = (albumImport.derivedTracks.length
    ? albumImport.derivedTracks
    : flow.draft.tracks
  ).map((track) => track.title.trim()).filter(Boolean)
  if (!trackTitles.length) throw new Error('请先选择包含音频文件的专辑')

  const artist = flow.draft.artist.stageNames.find((item) => item.isPrimary && item.name.trim())?.name.trim()
    || flow.draft.artist.stageNames.find((item) => item.name.trim())?.name.trim()
    || flow.draft.artist.legalName.trim()
  const albumTitle = albumImport.derivedAlbumTitle.trim()
    || albumImport.archiveName.replace(/\.(?:zip|rar|7z|tar|gz|bz2|xz)$/i, '').trim()
  albumImport.metadataMatchStatus = 'matching'
  albumImport.metadataError = ''
  const preview = await musicApi.previewMusicAlbumImportMetadata({ albumTitle, artist, trackTitles })

  albumImport.metadataMatched = preview.matched
	albumImport.derivedAlbumTitle = preview.albumTitle?.trim() || albumImport.derivedAlbumTitle
	albumImport.derivedReleaseDate = preview.releaseDate?.trim() || albumImport.derivedReleaseDate
	albumImport.derivedAlbumType = preview.albumType?.trim() || albumImport.derivedAlbumType
	albumImport.derivedCover = preview.coverUrl?.trim() || albumImport.derivedCover
  albumImport.metadataSourceUrl = preview.sourceUrl || undefined
  albumImport.metadataSource = preview.metadataSource
  albumImport.metadataExternalId = preview.externalId
  albumImport.metadataMatchStatus = preview.matchStatus || 'unmatched'
  albumImport.metadataMatchConfidence = preview.matchConfidence ?? 0
	albumImport.metadataError = preview.metadataError || ''
	albumImport.metadataSources = preview.sources ?? []
	if (preview.albumTitle?.trim() && !flow.titleCustomized) {
		flow.draft.albumDetails.title = preview.albumTitle.trim()
	}
	if (preview.releaseDate?.trim() && !hasDatePartsValue(flow.draft.albumDetails.releaseDateParts)) {
		flow.draft.albumDetails.releaseDateParts = parsePartialDateParts(preview.releaseDate)
	}
	if (preview.coverUrl?.trim() && !flow.draft.albumDetails.coverUrl.trim()) {
		flow.draft.albumDetails.coverUrl = preview.coverUrl.trim()
	}
	if (preview.albumType?.trim() && flow.draft.albumDetails.type === 'album') {
		flow.draft.albumDetails.type = preview.albumType.trim()
	}
	if (preview.sourceUrl && !flow.draft.albumDetails.source.trim()) {
		flow.draft.albumDetails.source = normalizeMusicImportSource(preview.sourceUrl)
	}
  if (preview.tracks.length) {
    albumImport.derivedTracks = preview.tracks
    mergeImportedTracksIntoDraft(flow, preview.tracks)
  }
  setMusicCreationStep('albumDetails')
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
        flow.editingContributorId = null
        setMusicCreationStep('albumDetails')
        return
      }
      if (flow.artistBeforeMatch) {
        ensurePrimaryArtistContributor(flow)
        await startAlbumImportMatching(flow)
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
  } else if (flow.step === 'albumImport') {
    flow.submitting = true
    try {
      await previewAlbumImportMetadata(flow)
    } catch (error) {
      flow.errorMessage = error instanceof Error ? error.message : '元信息匹配失败，请重试'
    } finally {
      flow.submitting = false
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
    creationFlow.value.editingContributorId = null
    setMusicCreationStep('albumDetails')
  } else if (creationFlow.value.step === 'preview') {
    setMusicCreationStep('albumDetails')
  } else if (creationFlow.value.step === 'albumDetails') {
    if (creationFlow.value.parentKey) {
      closeCurrentCreationFlow()
    } else {
      setMusicCreationStep('artist')
    }
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
    toastMessage.value = '已提交至导入中心，后台将继续处理'
    toastVisible.value = true
    const artistId = committedImport.artistId?.trim() || flow.draft.artist.id?.trim()
    refreshArtist()
    refreshAlbum()
    refreshSong()
    invalidateImportAutosave()
    closeMusicCreationFlow(flow.parentKey ?? props.layer?.key)
    await router.push(
      committedImport.status === 'committed' && artistId
        ? `/music/artist/${artistId}`
        : '/music/imports',
    )
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
      <nav
        v-if="showFullAlbumCreationProgress"
        class="creation-progress"
        aria-label="创建专辑流程"
        data-testid="creation-flow-progress"
      >
        <ol class="creation-progress__list">
          <li
            v-for="(progressStep, index) in fullAlbumCreationProgressSteps"
            :key="progressStep.key"
            :class="{
              'is-active': fullAlbumCreationProgressIndex === index,
              'is-done': fullAlbumCreationProgressIndex > index,
            }"
            :data-testid="`creation-flow-progress-step-${progressStep.key}`"
            :data-state="fullAlbumCreationProgressIndex > index ? 'done' : fullAlbumCreationProgressIndex === index ? 'active' : 'upcoming'"
          >
            <span class="creation-progress__index">{{ index + 1 }}</span>
            <span>{{ progressStep.label }}</span>
          </li>
        </ol>
      </nav>
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

        <div v-if="showFooterActions" class="footer-actions" data-testid="creation-flow-footer">
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
            v-if="creationFlow.mode !== 'edit' && creationFlow.step !== 'artist'"
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
            v-if="creationFlow.mode !== 'edit' && creationFlow.step === 'artist' && !creationFlow.editingContributorId"
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
            :disabled="creationFlow.submitting"
            @click="shouldShowFinishButton ? completeCreation() : handlePrimaryAction('create_album')"
          >
            {{ finishButtonLabel }}
          </button>
        </div>
      </div>
    </div>
  </PSheet>

  <PConfirm
    above-player
    :show="closePending"
    title="关闭创建流程"
    message="确认关闭？未保存的内容将丢失。"
    confirm-text="关闭"
    danger
    @confirm="confirmClose"
    @cancel="closePending = false"
  />
</template>

<style scoped>
.creation-flow { display: flex; flex-direction: column; min-height: 100%; }
.creation-progress {
  width: 100%;
  padding: 1rem 0 0;
}
.creation-progress__list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.creation-progress__list li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}
.creation-progress__list li::after {
  content: '';
  height: 1px;
  flex: 1;
  min-width: 0.5rem;
  background: var(--a-color-border-soft);
}
.creation-progress__list li:last-child::after { display: none; }
.creation-progress__list li.is-active,
.creation-progress__list li.is-done { color: var(--a-color-text); }
.creation-progress__index {
  display: grid;
  flex: 0 0 1.45rem;
  place-items: center;
  width: 1.45rem;
  height: 1.45rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 50%;
  font-size: 0.68rem;
}
.creation-progress__list li.is-active .creation-progress__index {
  border-color: var(--a-color-text);
  background: var(--a-color-text);
  color: var(--a-color-bg);
}
.creation-progress__list li.is-done .creation-progress__index {
  border-color: var(--a-color-text);
}
.drawer-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  padding: 1.5rem 0 0;
}
.error-message {
  margin: 0;
  color: var(--a-color-accent-destructive);
  font-family: var(--a-font-sans);
  font-size: 0.82rem;
  font-weight: 800;
}
.footer-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 1rem; margin-top: auto; }
.forward-block-reason {
  margin: 0 auto 0 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.82rem;
}
[data-testid="music-creation-close-button"] { display: none !important; }
.ui-action,
.primary-action {
  border: 0;
  border-radius: 4px;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-sans);
  font-weight: 800;
  cursor: pointer;
}
.ui-action {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
}
.primary-action {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  transition: background-color 0.15s ease;
}
.primary-action:hover {
  background: color-mix(in srgb, var(--a-color-text) 86%, black);
}

.drawer-body :deep(.album-details-step .footer-actions) {
  display: none;
}

:global(.creation-flow-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}
@media (max-width: 48rem) {
  .creation-progress__list { grid-template-columns: 1fr; gap: 0.55rem; }
  .creation-progress__list li::after { display: none; }
}
</style>
