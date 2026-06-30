<script setup lang="ts">
import { computed, watch } from 'vue'
import * as musicApi from '@/api/musicV1'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import MusicCreationArtistStep from './MusicCreationArtistStep.vue'
import MusicCreationAlbumSeedStep from './MusicCreationAlbumSeedStep.vue'
import MusicCreationAlbumDetailsStep from './MusicCreationAlbumDetailsStep.vue'

const { state, closeMusicCreationFlow, setMusicCreationStep } = useMusicDrawers()

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
    subtitle: '先建立艺术家与首张专辑的草稿外壳。',
    cta: '下一步',
  },
  albumImport: {
    index: 2,
    title: '导入专辑',
    subtitle: '上传专辑压缩包，解析封面与曲目信息。',
    cta: '继续',
  },
  albumDetails: {
    index: 3,
    title: '完善专辑',
    subtitle: '最终补充专辑信息与曲目整理。',
    cta: '完成',
  },
}

const activeStep = computed(() => {
  const step = creationFlow.value?.step ?? 'artist'
  return stepCopy[step]
})
const isAlbumDetailsStep = computed(() => creationFlow.value?.step === 'albumDetails')
const showFooterActions = computed(() => creationFlow.value?.step === 'artist' || isAlbumDetailsStep.value)
const finishButtonLabel = computed(() => (creationFlow.value?.submitting ? '提交中…' : activeStep.value.cta))
const commitMusicAlbumImport = (musicApi as typeof musicApi & {
  commitMusicAlbumImport?: (importId: string, input: musicApi.MusicAlbumImportCommitInput) => Promise<unknown>
}).commitMusicAlbumImport

function buildCommitInput(flow: NonNullable<typeof creationFlow.value>): musicApi.MusicAlbumImportCommitInput {
  const primaryStageName = flow.draft.artist.stageNames.find((item) => item.isPrimary && item.name.trim())
    ?? flow.draft.artist.stageNames.find((item) => item.name.trim())

  return {
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

  if (hasDraft && !window.confirm('确认关闭？未完成的艺术家/专辑创建不会保存。')) return
  closeMusicCreationFlow()
}

function handlePrimaryAction() {
  if (!creationFlow.value) return
  if (creationFlow.value.step === 'artist') {
    if (!creationFlow.value.draft.artist.legalName.trim()) return
    setMusicCreationStep('albumImport')
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

    if (!commitMusicAlbumImport) {
      throw new Error('commitMusicAlbumImport is unavailable')
    }

    await commitMusicAlbumImport(importId, buildCommitInput(flow))
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
        <p class="eyebrow">Music Creation Flow</p>
        <p class="step-label">第 {{ activeStep.index }} 步</p>
        <h3 class="title">{{ activeStep.title }}</h3>
        <p class="subtitle">{{ activeStep.subtitle }}</p>
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
            v-if="isAlbumDetailsStep"
            data-testid="album-details-back-button"
            type="button"
            class="paper-action"
            @click="setMusicCreationStep('albumImport')"
          >
            返回上一步
          </button>
          <button
            :data-testid="isAlbumDetailsStep ? 'music-creation-finish-button' : 'artist-next-button'"
            type="button"
            class="paper-submit"
            :disabled="creationFlow.submitting"
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
  padding: 1.75rem 2rem 1.25rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-soft);
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
.title { margin: 0.45rem 0 0; font-family: var(--a-font-serif); font-size: 1.9rem; }
.subtitle { margin: 0.6rem 0 0; color: var(--a-color-ink-soft); line-height: 1.6; }
.drawer-body { display: flex; flex: 1; flex-direction: column; gap: 1rem; padding: 0 2rem 2rem; }
.error-message {
  margin: 0;
  color: var(--a-color-accent-destructive);
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 800;
}
.footer-actions { display: flex; justify-content: space-between; gap: 1rem; margin-top: auto; }
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
  background: color-mix(in srgb, var(--a-color-paper-wash) 78%, var(--a-color-paper));
  color: var(--a-color-ink);
}
.paper-submit {
  background: var(--a-color-accent-confirm);
  color: var(--a-color-paper);
  transition: background-color 0.15s ease;
}
.paper-submit:hover {
  background: var(--a-color-accent-confirm-hover);
}

.drawer-body :deep(.album-details-step .footer-actions) {
  display: none;
}
</style>
