<script setup lang="ts">
import { computed, watch } from 'vue'
import * as musicApi from '@/api/musicV1'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import MusicCreationArtistStep from './MusicCreationArtistStep.vue'
import MusicCreationAlbumSeedStep from './MusicCreationAlbumSeedStep.vue'
import MusicCreationAlbumDetailsStep from './MusicCreationAlbumDetailsStep.vue'

const { state, closeMusicCreationFlow, setMusicCreationStep, refreshArtist } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const isOpen = computed(() => creationFlow.value !== null)
const sheetIndex = computed(() => state.value.artistId !== null ? 1 : 0)

type CreationStepKey = 'artist' | 'albumImport' | 'albumDetails'

function hasCreationDraft(flow: NonNullable<typeof creationFlow.value>) {
  const { artist, albumImport, albumDetails, tracks } = flow.draft

  return (
    flow.dirty ||
    !!artist.avatarUrl.trim() ||
    !!artist.legalName.trim() ||
    artist.stageNames.some((stageName) => !!stageName.name.trim()) ||
    !!artist.nationality.trim() ||
    !!artist.birthPlace.trim() ||
    !!artist.birthDate.trim() ||
    !!artist.bio.trim() ||
    !!artist.source.trim() ||
    !!albumImport.archiveName.trim() ||
    albumImport.uploadProgress > 0 ||
    !!albumImport.derivedAlbumTitle.trim() ||
    albumImport.derivedTracks.length > 0 ||
    !!albumDetails.coverUrl.trim() ||
    !!albumDetails.title.trim() ||
    !!albumDetails.releaseDate.trim() ||
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
const showFooterActions = computed(() => true)
const finishButtonLabel = computed(() => (creationFlow.value?.submitting ? '提交中…' : activeStep.value.cta))
const canSubmitAlbumImport = computed(() => (
  !isAlbumDetailsStep.value || creationFlow.value?.draft.albumImport.status === 'ready'
))
const commitMusicAlbumImport = (musicApi as typeof musicApi & {
  commitMusicAlbumImport?: (importId: string, input: musicApi.MusicAlbumImportCommitInput) => Promise<unknown>
}).commitMusicAlbumImport

function buildCommitInput(flow: NonNullable<typeof creationFlow.value>): musicApi.MusicAlbumImportCommitInput {
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

function syncReadyImportToDraft() {
  const flow = creationFlow.value
  if (!flow) return

  const { albumImport, albumDetails } = flow.draft
  if (albumImport.status !== 'ready') return

  if (albumImport.derivedAlbumTitle.trim()) {
    albumDetails.title = albumImport.derivedAlbumTitle
  }

  const nextCover = albumImport.coverUrl.trim() || albumImport.derivedCover.trim()
  if (nextCover) {
    albumDetails.coverUrl = nextCover
  }

  flow.draft.tracks = albumImport.derivedTracks.map((track, index) => ({
    id: `import-track-${index + 1}`,
    sequence: index + 1,
    title: track.title,
    audioKey: track.audioKey,
    origin: track.origin,
  }))
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
  closeMusicCreationFlow()
}

function handlePrimaryAction() {
  if (!creationFlow.value) return
  if (creationFlow.value.step === 'artist') {
    if (!creationFlow.value.draft.artist.legalName.trim()) return
    setMusicCreationStep('albumDetails')
  } else if (creationFlow.value.step === 'albumImport') {
    setMusicCreationStep('albumImport')
  }
}

function goBackStep() {
  if (!creationFlow.value) return
  if (creationFlow.value.step === 'albumDetails') {
    setMusicCreationStep('artist')
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
    closeMusicCreationFlow()
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
  <PSheet :show="isOpen" @close="requestClose" width="560px" :index="sheetIndex">
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
            :data-testid="isAlbumDetailsStep ? 'music-creation-finish-button' : 'artist-next-button'"
            type="button"
            class="paper-submit"
            :disabled="creationFlow.submitting || !canSubmitAlbumImport"
            @click="isAlbumDetailsStep ? completeCreation() : handlePrimaryAction()"
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
