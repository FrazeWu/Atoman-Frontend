<script setup lang="ts">
import { computed, watch } from 'vue'
import * as musicApi from '@/api/musicV1'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import MusicCreationArtistStep from './MusicCreationArtistStep.vue'
import MusicCreationAlbumSeedStep from './MusicCreationAlbumSeedStep.vue'
import MusicCreationAlbumDetailsStep from './MusicCreationAlbumDetailsStep.vue'
import type { MusicSheetLayer } from './musicSheetTypes'

type CreationLayer = Extract<MusicSheetLayer, { kind: 'creation' }>
const props = withDefaults(defineProps<{ layer?: CreationLayer; layerIndex?: number; stackSize?: number }>(), { layerIndex: 0, stackSize: 1 })

const { state, closeMusicCreationFlow, setMusicCreationStep, refreshArtist, isLayerShifted, isTopLayer } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const isOpen = computed(() => props.layer !== undefined || creationFlow.value !== null)
const sheetIndex = computed(() => props.layer ? props.layerIndex : state.value.artistId !== null ? 1 : 0)
const shifted = computed(() => props.layer ? isLayerShifted(props.layer.key) : false)
const topLayer = computed(() => props.layer ? isTopLayer(props.layer.key) : true)
const closeCurrentCreationFlow = () => closeMusicCreationFlow(props.layer?.key)

type CreationStepKey = 'artist' | 'albumImport' | 'albumDetails'

function hasDatePartsValue(parts?: { year: string; month: string; day: string }) {
  if (!parts) return false
  return !!parts.year.trim() || !!parts.month.trim() || !!parts.day.trim()
}

function normalizeDatePart(value: string, length: number) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.padStart(length, '0')
}

function formatDateFromParts(parts?: { year: string; month: string; day: string }) {
  if (!parts) return ''

  const year = parts.year.trim()
  const month = normalizeDatePart(parts.month, 2)
  const day = normalizeDatePart(parts.day, 2)

  if (!year || !month || !day) return ''
  return `${year}-${month}-${day}`
}

function deriveYearFromParts(parts?: { year: string; month: string; day: string }) {
  if (!parts) return 0
  return Number.parseInt(parts.year.trim(), 10) || 0
}

function hasCreationDraft(flow: NonNullable<typeof creationFlow.value>) {
  const { artist, albumImport, albumDetails, tracks } = flow.draft

  return (
    flow.dirty ||
    !!artist.avatarUrl.trim() ||
    !!artist.legalName.trim() ||
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

const stepCopy: Record<CreationStepKey, { index: number; title: string; subtitle: string; cta: string }> = {
  artist: {
    index: 1,
    title: '创建艺术家',
    subtitle: '',
    cta: '下一步',
  },
  albumImport: {
    index: 2,
    title: '上传专辑',
    subtitle: '',
    cta: '继续',
  },
  albumDetails: {
    index: 3,
    title: '完善专辑',
    subtitle: '',
    cta: '完成',
  },
}

const activeStep = computed(() => {
  const step = creationFlow.value?.step ?? 'artist'
  return stepCopy[step]
})
const isAlbumDetailsStep = computed(() => creationFlow.value?.step === 'albumDetails')
const shouldShowFinishButton = computed(() => {
  const flow = creationFlow.value
  if (!flow) return false
  return flow.step === 'albumDetails' || (flow.step === 'albumImport' && flow.draft.albumImport.status === 'ready')
})
const showFooterActions = computed(() => true)
const finishButtonLabel = computed(() => {
  if (creationFlow.value?.submitting) return '提交中…'
  return shouldShowFinishButton.value ? '完成' : activeStep.value.cta
})
const canGoForward = computed(() => {
  const flow = creationFlow.value
  if (!flow) return false
  if (flow.step === 'artist') {
    if (flow.draft.artist.kind === 'group') {
      const namedMembers = flow.draft.artist.members.filter((member) => member.name.trim())
      const hasMissingJoinDate = namedMembers.some((member) => !member.joinDateParts.year.trim())
      return !!flow.draft.artist.stageNames[0]?.name.trim()
        && !!flow.draft.artist.activeStartDateParts?.year.trim()
        && namedMembers.length >= 2
        && !hasMissingJoinDate
        && !!flow.draft.artist.source.trim()
    }

    return !!flow.draft.artist.avatarUrl.trim()
      && !!flow.draft.artist.legalName.trim()
      && !!flow.draft.artist.stageNames[0]?.name.trim()
      && !!flow.draft.artist.nationality.trim()
      && !!formatDateFromParts(flow.draft.artist.birthDateParts)
      && !!flow.draft.artist.source.trim()
  }
  if (flow.step === 'albumImport') return flow.draft.albumImport.status === 'ready'
  return flow.draft.albumImport.status === 'ready'
})
const commitMusicAlbumImport = (musicApi as typeof musicApi & {
  commitMusicAlbumImport?: (importId: string, input: musicApi.MusicAlbumImportCommitInput) => Promise<unknown>
}).commitMusicAlbumImport

function formatArtistDate(parts?: { year: string; month: string; day: string }) {
  if (!parts) return ''
  const year = parts.year.trim()
  if (!year) return ''

  const month = normalizeDatePart(parts.month, 2)
  const day = normalizeDatePart(parts.day, 2)
  if (!month || !day) return year
  return `${year}-${month}-${day}`
}

function buildArtistMembers(flow: NonNullable<typeof creationFlow.value>) {
  return flow.draft.artist.members
    .filter((member) => member.name.trim())
    .map((member) => ({
      artist_id: '',
      join_date: formatArtistDate(member.joinDateParts),
      leave_date: formatArtistDate(member.leaveDateParts),
    }))
}

function buildNormalizedContributors(flow: NonNullable<typeof creationFlow.value>) {
  const contributors = [...(flow.draft.albumDetails.contributors ?? [])]
  if (
    flow.draft.artist.id
    && contributors.length === 1
    && !contributors[0].locked
    && contributors[0].artistId !== flow.draft.artist.id
  ) {
    contributors[0] = {
      ...contributors[0],
      id: `contributor-${flow.draft.artist.id}`,
      artistId: flow.draft.artist.id,
    }
  }
  return contributors
}

function buildContributorPayload(flow: NonNullable<typeof creationFlow.value>): NonNullable<musicApi.MusicAlbumImportCommitInput['artists']> {
  const activeStartDate = formatArtistDate(flow.draft.artist.activeStartDateParts)
  const activeEndDate = formatArtistDate(flow.draft.artist.activeEndDateParts)
  const artistStageNames = flow.draft.artist.stageNames
    .filter((item) => item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      isPrimary: item.isPrimary,
      startDateText: item.startDateText.trim(),
      endDateText: item.endDateText.trim(),
    }))

  return buildNormalizedContributors(flow).map((contributor) => {
    if (!contributor.artistId) {
      return {
        artist_id: '',
        name: contributor.name.trim(),
        legal_name: flow.draft.artist.legalName.trim(),
        stage_names: artistStageNames,
        birth_place: flow.draft.artist.birthPlace.trim(),
        artist_form: flow.draft.artist.kind,
        active_start_date: activeStartDate,
        active_end_date: activeEndDate,
        members: buildArtistMembers(flow),
      }
    }

    return {
      artist_id: contributor.artistId,
      name: contributor.name.trim(),
      legal_name: '',
      stage_names: [],
      birth_place: '',
      artist_form: contributor.kind,
      active_start_date: '',
      active_end_date: '',
        members: [],
      }
  })
}

function buildCommitInput(flow: NonNullable<typeof creationFlow.value>): musicApi.MusicAlbumImportCommitInput {
  const primaryStageName = flow.draft.artist.stageNames.find((item) => item.isPrimary && item.name.trim())
    ?? flow.draft.artist.stageNames.find((item) => item.name.trim())
  const releaseDate = formatDateFromParts(flow.draft.albumDetails.releaseDateParts)
  const derivedReleaseYear = deriveYearFromParts(flow.draft.albumDetails.releaseDateParts)
  const artists = buildContributorPayload(flow)

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
    artists,
    album: {
      title: flow.draft.albumDetails.title.trim(),
      ...(releaseDate ? { release_date: releaseDate } : {}),
      release_year: derivedReleaseYear || 0,
      tracks: flow.draft.tracks.map((track, index) => ({
        title: track.title.trim(),
        trackNumber: index + 1,
      })),
    },
  }
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

  if (!flow.tracksCustomized && (derivedTracks.length > 0 || flow.draft.tracks.length === 0)) {
    flow.draft.tracks = derivedTracks.map((track, index) => ({
      id: `import-track-${index + 1}`,
      sequence: index + 1,
      title: track.title,
      audioKey: track.audioKey,
      origin: track.origin,
    }))
  }
}

watch(
  () => creationFlow.value?.draft.albumImport.status,
  () => {
    syncReadyImportToDraft()
  },
  { immediate: true },
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

  if (hasDraft && !window.confirm('确认关闭？未保存的内容将丢失。')) return
  closeCurrentCreationFlow()
}

function handlePrimaryAction() {
  if (!creationFlow.value) return
  if (creationFlow.value.step === 'artist') {
    if (!canGoForward.value) return
    setMusicCreationStep('albumImport')
  } else if (creationFlow.value.step === 'albumImport' && creationFlow.value.draft.albumImport.status === 'ready') {
    setMusicCreationStep('albumDetails')
  }
}

function goBackStep() {
  if (!creationFlow.value) return
  if (creationFlow.value.step === 'albumDetails') {
    setMusicCreationStep('albumImport')
  } else if (creationFlow.value.step === 'albumImport') {
    setMusicCreationStep('artist')
  }
}

async function completeCreation() {
  const flow = creationFlow.value
  if (!flow || flow.submitting) return

  flow.submitting = true
  flow.errorMessage = ''

  try {
    const importId = flow.draft.albumImport.importId?.trim()
    if (!importId) {
      throw new Error('缺少 importId，无法提交专辑导入')
    }

    if (flow.draft.albumImport.status !== 'ready') {
      throw new Error('请等待压缩包处理完成')
    }

    if (!commitMusicAlbumImport) {
      throw new Error('commitMusicAlbumImport is unavailable')
    }

    await commitMusicAlbumImport(importId, buildCommitInput(flow))
    if (flow.draft.artist.id) {
      refreshArtist()
    }
    closeCurrentCreationFlow()
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
  <PSheet
    :show="isOpen"
    :title="layer?.title ?? '创建音乐条目'"
    width="560px"
    :index="sheetIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    @close="requestClose"
  >
    <div v-if="creationFlow" class="creation-flow">
      <div class="drawer-header">
        <div class="header-meta">
          <p class="step-label">第 {{ activeStep.index }} 步</p>
        </div>
        <h3 class="title">{{ activeStep.title }}</h3>
        <p v-if="activeStep.subtitle" class="subtitle">{{ activeStep.subtitle }}</p>
      </div>

      <div class="drawer-body">
        <p
          v-if="creationFlow.errorMessage"
          data-testid="music-creation-error"
          class="error-message"
        >
          {{ creationFlow.errorMessage }}
        </p>
        <MusicCreationArtistStep v-if="creationFlow.step === 'artist'" />

        <MusicCreationAlbumSeedStep v-else-if="creationFlow.step === 'albumImport'" />

        <MusicCreationAlbumDetailsStep v-else-if="creationFlow.step === 'albumDetails'" />

        <div v-if="showFooterActions" class="footer-actions" data-testid="creation-flow-footer">
          <button
            data-testid="music-creation-close-button"
            type="button"
            class="paper-action"
            @click="requestClose"
          >
            关闭
          </button>
          <button
            v-if="creationFlow.step !== 'artist'"
            data-testid="album-details-back-button"
            type="button"
            class="paper-action"
            @click="goBackStep"
          >
            返回上一步
          </button>
          <button
            :data-testid="shouldShowFinishButton ? 'music-creation-finish-button' : 'artist-next-button'"
            type="button"
            class="paper-submit"
            :disabled="creationFlow.submitting || !canGoForward"
            @click="shouldShowFinishButton ? completeCreation() : handlePrimaryAction()"
          >
            {{ finishButtonLabel }}
          </button>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.creation-flow { display: flex; flex-direction: column; min-height: 100%; }
.drawer-header {
  margin: -2.5rem -2.5rem 0;
  padding: 1.5rem 2rem 1.1rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  background: color-mix(in srgb, var(--a-color-paper-soft) 86%, var(--a-color-paper));
}
.header-meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: baseline;
  flex-wrap: wrap;
}
.eyebrow {
  margin: 0 0 0.45rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.step-label {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 800;
}
.title {
  margin: 0.2rem 0 0;
  font-family: var(--a-font-serif);
  font-size: 2.05rem;
  line-height: 1.05;
}
.subtitle {
  margin: 0.55rem 0 0;
  color: var(--a-color-ink-soft);
  line-height: 1.7;
  max-width: 34rem;
}
.drawer-body { display: flex; flex: 1; flex-direction: column; gap: 1.5rem; padding: 1.5rem 0 0; }
.error-message {
  margin: 0;
  color: var(--a-color-accent-destructive);
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 800;
}
.footer-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: auto; }
[data-testid="music-creation-close-button"] { display: none !important; }
.paper-action,
.paper-submit {
  border: 0;
  border-radius: 0px;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-meta);
  font-weight: 800;
  cursor: pointer;
}
.paper-action {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  color: var(--a-color-ink);
}
.paper-submit {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  transition: background-color 0.15s ease;
}
.paper-submit:hover {
  background: color-mix(in srgb, var(--a-color-ink) 86%, black);
}

.drawer-body :deep(.album-details-step .footer-actions) {
  display: none;
}
</style>
