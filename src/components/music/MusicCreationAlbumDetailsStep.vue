<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  uploadMusicAsset,
  createMusicAlbumImport,
  type MusicAlbumImport,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import MusicSquareImageCropSheet from '@/components/music/MusicSquareImageCropSheet.vue'
import MusicCreationContributorPicker from '@/components/music/MusicCreationContributorPicker.vue'
import PInput from '@/components/ui/PInput.vue'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PButton from '@/components/ui/PButton.vue'
import MusicCreationAlbumUploadZone from '@/components/music/MusicCreationAlbumUploadZone.vue'

const { state, closeMusicCreationFlow, setMusicCreationStep } = useMusicDrawers()
const coverInputRef = ref<HTMLInputElement | null>(null)

const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')
const creationFlow = computed(() => state.value.creationFlow)
const albumDetailsDraft = computed(() => creationFlow.value?.draft.albumDetails ?? null)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])
const coverUploading = ref(false)
const coverErrorMessage = ref('')
const draggedTrackId = ref<string | null>(null)
const pendingCoverCrop = ref<{
  kind: 'manual' | 'imported'
  sourceFile?: File | null
  sourceUrl?: string
} | null>(null)
const handledImportedCoverUrl = ref('')
const titleModel = computed({
  get: () => albumDetailsDraft.value?.title ?? '',
  set: (value: string) => {
    if (!albumDetailsDraft.value) return
    if (creationFlow.value) {
      creationFlow.value.titleCustomized = true
    }
    albumDetailsDraft.value.title = value
  },
})
const unresolvedImportedCoverUrl = computed(() => {
  const coverUrl = albumImportDraft.value?.coverUrl?.trim() || ''
  const derivedCover = albumImportDraft.value?.derivedCover?.trim() || ''
  const nextCoverUrl = coverUrl || derivedCover
  if (!nextCoverUrl) return ''
  if (handledImportedCoverUrl.value === nextCoverUrl) return ''
  return nextCoverUrl
})

function requiredLabel(label: string) {
  return `${label}*`
}

function createEmptyDateParts() {
  return {
    year: '',
    month: '',
    day: '',
  }
}

function hasDatePartsValue(parts?: { year: string; month: string; day: string }) {
  if (!parts) return false
  return !!parts.year.trim() || !!parts.month.trim() || !!parts.day.trim()
}

function normalizeDatePart(value: string, length: number) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.padStart(length, '0')
}

function parseDateToParts(value: string) {
  const [year = '', month = '', day = ''] = value.trim().split('-')
  return { year, month, day }
}

function formatDateParts(parts?: { year: string; month: string; day: string }) {
  if (!parts) return ''

  const year = parts.year.trim()
  const month = normalizeDatePart(parts.month, 2)
  const day = normalizeDatePart(parts.day, 2)

  if (!year || !month || !day) return ''
  return `${year}-${month}-${day}`
}

watch(
  albumDetailsDraft,
  (draft) => {
    if (!draft) return

    if (!draft.releaseDateParts) {
      draft.releaseDateParts = createEmptyDateParts()
    }

    if (!draft.contributors) {
      draft.contributors = []
    }

    if (!hasDatePartsValue(draft.releaseDateParts) && draft.releaseDate.trim()) {
      draft.releaseDateParts = parseDateToParts(draft.releaseDate)
    } else if (!hasDatePartsValue(draft.releaseDateParts) && draft.releaseYear.trim()) {
      draft.releaseDateParts = {
        year: draft.releaseYear.trim(),
        month: '',
        day: '',
      }
    }
  },
  { immediate: true },
)

watch(
  () => albumDetailsDraft.value?.releaseDateParts,
  (parts) => {
    if (!albumDetailsDraft.value) return
    albumDetailsDraft.value.releaseDate = formatDateParts(parts)
    albumDetailsDraft.value.releaseYear = parts?.year.trim() ?? ''
  },
  { deep: true, immediate: true },
)



function addTrack() {
  if (!creationFlow.value) return
  creationFlow.value.tracksCustomized = true
  creationFlow.value.draft.tracks = [
    ...creationFlow.value.draft.tracks,
    {
      id: `manual-track-${Date.now()}`,
      sequence: creationFlow.value.draft.tracks.length + 1,
      title: '',
      origin: 'manual',
    },
  ]
}

function syncLockedNewArtistContributor() {
  if (!creationFlow.value || !albumDetailsDraft.value) return

  const isNewArtistFlow = !creationFlow.value.draft.artist.id
  const lockedContributorId = 'contributor-new-artist'

  if (!isNewArtistFlow) {
    albumDetailsDraft.value.contributors = albumDetailsDraft.value.contributors.filter((item) => item.id !== lockedContributorId)
    return
  }

  const artistName = creationFlow.value.draft.artist.stageNames[0]?.name.trim()
    || creationFlow.value.draft.artist.legalName.trim()
  if (!artistName) return

  const nextContributor = {
    id: lockedContributorId,
    artistId: null,
    name: artistName,
    avatarUrl: creationFlow.value.draft.artist.avatarUrl,
    kind: creationFlow.value.draft.artist.kind,
    locked: true,
  }

  const existingIndex = albumDetailsDraft.value.contributors.findIndex((item) => item.id === lockedContributorId)
  if (existingIndex >= 0) {
    albumDetailsDraft.value.contributors.splice(existingIndex, 1, nextContributor)
    return
  }

  albumDetailsDraft.value.contributors = [nextContributor, ...albumDetailsDraft.value.contributors]
}

function updateTrackTitle(trackId: string, title: string) {
  if (!creationFlow.value) return
  creationFlow.value.tracksCustomized = true
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.map((track) => (
    track.id === trackId
      ? { ...track, title }
      : track
  ))
}

const orderedTracks = computed(() => tracksDraft.value)

function formatSequence(index: number) {
  return String(index).padStart(2, '0')
}

function renumberTracks() {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.map((track, index) => ({
    ...track,
    sequence: index + 1,
  }))
}

function moveTrack(index: number, direction: -1 | 1) {
  if (!creationFlow.value) return
  const target = index + direction
  if (target < 0 || target >= creationFlow.value.draft.tracks.length) return

  const next = [...creationFlow.value.draft.tracks]
  const [track] = next.splice(index, 1)
  next.splice(target, 0, track)
  creationFlow.value.tracksCustomized = true
  creationFlow.value.draft.tracks = next
  renumberTracks()
}

function handleTrackDragStart(trackId: string, event: DragEvent) {
  draggedTrackId.value = trackId
  event.dataTransfer?.setData('text/plain', trackId)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleTrackDrop(targetTrackId: string, event: DragEvent) {
  event.preventDefault()
  if (!creationFlow.value) return

  const sourceTrackId = event.dataTransfer?.getData('text/plain') || draggedTrackId.value
  draggedTrackId.value = null
  if (!sourceTrackId || sourceTrackId === targetTrackId) return

  const nextTracks = [...creationFlow.value.draft.tracks]
  const sourceIndex = nextTracks.findIndex((track) => track.id === sourceTrackId)
  const targetIndex = nextTracks.findIndex((track) => track.id === targetTrackId)
  if (sourceIndex < 0 || targetIndex < 0) return

  const [sourceTrack] = nextTracks.splice(sourceIndex, 1)
  const insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  nextTracks.splice(insertionIndex, 0, sourceTrack)
  creationFlow.value.tracksCustomized = true
  creationFlow.value.draft.tracks = nextTracks
  renumberTracks()
}

function removeTrack(trackId: string) {
  if (!creationFlow.value) return
  creationFlow.value.tracksCustomized = true
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.filter((track) => track.id !== trackId)
  renumberTracks()
}

function queueManualCoverCrop(file: File) {
  pendingCoverCrop.value = {
    kind: 'manual',
    sourceFile: file,
  }
}

function queueImportedCoverCrop(sourceUrl: string) {
  if (!creationFlow.value || !sourceUrl.trim()) return

  if (creationFlow.value.draft.albumDetails.coverUrl === sourceUrl) {
    creationFlow.value.draft.albumDetails.coverUrl = ''
    creationFlow.value.draft.albumDetails.coverAsset = null
  }

  pendingCoverCrop.value = {
    kind: 'imported',
    sourceUrl,
  }
}

function reopenImportedCoverCrop() {
  if (!unresolvedImportedCoverUrl.value) return
  queueImportedCoverCrop(unresolvedImportedCoverUrl.value)
}

function clearPendingCoverCrop() {
  pendingCoverCrop.value = null
}

async function confirmCoverCrop(file: File) {
  if (!creationFlow.value || !albumDetailsDraft.value) return

  const importedSourceUrl = pendingCoverCrop.value?.kind === 'imported'
    ? pendingCoverCrop.value.sourceUrl?.trim() || ''
    : ''

  coverUploading.value = true
  coverErrorMessage.value = ''

  try {
    const asset = await uploadMusicAsset(file, 'music.cover')
    albumDetailsDraft.value.coverAsset = asset
    albumDetailsDraft.value.coverUrl = asset.url
    if (importedSourceUrl) {
      handledImportedCoverUrl.value = importedSourceUrl
    }
    pendingCoverCrop.value = null
  } catch (error) {
    coverErrorMessage.value = error instanceof Error ? error.message : '封面上传失败'
  } finally {
    coverUploading.value = false
  }
}

async function onCoverChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  queueManualCoverCrop(file)
  input.value = ''
}

function goBack() {
  setMusicCreationStep('albumImport')
}

watch(
  () => unresolvedImportedCoverUrl.value,
  (nextCoverUrl) => {
    if (!creationFlow.value || !nextCoverUrl) return
    if (pendingCoverCrop.value?.kind === 'manual') return
    if (handledImportedCoverUrl.value === nextCoverUrl) return

    if (
      pendingCoverCrop.value?.kind === 'imported'
      && pendingCoverCrop.value.sourceUrl?.trim() === nextCoverUrl
    ) {
      return
    }

    queueImportedCoverCrop(nextCoverUrl)
  },
  { immediate: true },
)

watch(
  () => [
    creationFlow.value?.draft.artist.id ?? '',
    creationFlow.value?.draft.artist.kind ?? 'person',
    creationFlow.value?.draft.artist.avatarUrl ?? '',
    creationFlow.value?.draft.artist.legalName ?? '',
    creationFlow.value?.draft.artist.stageNames[0]?.name ?? '',
  ],
  () => {
    syncLockedNewArtistContributor()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="albumDetailsDraft" class="album-details-step" data-testid="album-details-step">
    <MusicSquareImageCropSheet
      :show="!!pendingCoverCrop"
      :source-file="pendingCoverCrop?.sourceFile || null"
      :source-url="pendingCoverCrop?.sourceUrl || ''"
      title="裁剪封面"
      @cancel="clearPendingCoverCrop"
      @confirm="confirmCoverCrop"
    />

    <section class="progress-card">
      <div class="progress-copy">
        <p class="progress-label" data-testid="album-details-progress-label">
          {{ isTest ? '第 3 步 / 完善专辑' : '第 2 步 / 新建专辑' }}
        </p>
      </div>
      <p class="progress-value" data-testid="album-details-progress-value">
        {{ isTest ? '3 / 3' : '2 / 2' }}
      </p>
      <div class="progress-steps">
        <span class="progress-step" data-testid="album-details-step-label">1 创建艺术家</span>
        <span v-if="isTest" class="progress-step" data-testid="album-details-step-label">2 专辑名 + 批量上传</span>
        <span class="progress-step progress-step--active" data-testid="album-details-step-label">
          {{ isTest ? '3 详细信息' : '2 新建专辑' }}
        </span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar" />
      </div>
    </section>

    <section class="album-card album-card--primary album-import-status-card" data-testid="album-import-status">
      <div class="card-header">
        <div>
          <p class="card-kicker">导入进度</p>
          <p class="card-copy">你可以继续上传并自动识别封面与曲目，或者同时填写下方信息。</p>
        </div>
      </div>
      <MusicCreationAlbumUploadZone />
    </section>

    <div class="field-stack">
      <div class="field-group" data-testid="album-details-field" data-field="cover">
        <input
          ref="coverInputRef"
          data-testid="album-details-cover-input"
          type="file"
          accept="image/*"
          :disabled="coverUploading"
          style="display: none"
          @change="onCoverChange"
        />
        <div class="p-field">
          <label class="p-field-label">
            <span class="p-field-dot" aria-hidden="true" />
            {{ requiredLabel('封面') }}
          </label>
          <div 
            class="custom-file-picker" 
            :class="{ 'is-disabled': coverUploading }"
            @click="coverInputRef?.click()"
          >
            <div class="file-picker-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div class="file-picker-text">
              <span class="file-picker-title">
                {{ albumDetailsDraft?.coverUrl ? '已选择封面图片' : '点击或拖拽上传专辑封面' }}
              </span>
              <span class="file-picker-subtitle">支持 JPG, PNG 格式</span>
            </div>
            <PButton 
              type="button" 
              variant="secondary" 
              :disabled="coverUploading"
              @click.stop="coverInputRef?.click()"
            >
              {{ albumDetailsDraft?.coverUrl ? '重新选择' : '浏览文件' }}
            </PButton>
          </div>
        </div>
        <p v-if="coverErrorMessage" class="state-line state-line--error">{{ coverErrorMessage }}</p>
        <p v-else-if="coverUploading" class="state-line">正在上传封面...</p>
        <div
          v-if="unresolvedImportedCoverUrl"
          class="imported-cover-callout"
          data-testid="album-details-imported-cover-callout"
        >
          <p class="imported-cover-callout__copy">已识别到封面，确认裁剪后才会作为最终封面。</p>
          <PButton
            type="button"
            variant="secondary"
            data-testid="album-details-imported-cover-action"
            @click="reopenImportedCoverCrop"
          >
            继续裁剪识别封面
          </PButton>
        </div>
        <div v-else-if="albumDetailsDraft.coverUrl" class="cover-preview">
          <img :src="albumDetailsDraft.coverUrl" alt="封面预览" class="cover-preview__image" />
          <div class="cover-preview__meta">
            <p class="cover-preview__title">已选择封面</p>
          </div>
        </div>
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="name">
        <PInput
          v-model="titleModel"
          data-testid="album-details-title-input"
          type="text"
          placeholder="例如 Late Registration"
          :label="requiredLabel('名字')"
        />
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="contributors">
        <MusicCreationContributorPicker v-model="albumDetailsDraft.contributors" />
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="date">
        <span class="field-label">{{ requiredLabel('日期') }}</span>
        <div class="date-parts-grid">
          <PInput
            v-model="albumDetailsDraft.releaseDateParts.year"
            data-testid="album-details-date-year-input"
            type="text"
            inputmode="numeric"
            placeholder="年"
            label="年份"
          />
          <PInput
            v-model="albumDetailsDraft.releaseDateParts.month"
            data-testid="album-details-date-month-input"
            type="text"
            inputmode="numeric"
            placeholder="月"
            label="月份"
          />
          <PInput
            v-model="albumDetailsDraft.releaseDateParts.day"
            data-testid="album-details-date-day-input"
            type="text"
            inputmode="numeric"
            placeholder="日"
            label="日期"
          />
        </div>
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="type">
        <PSelect
          v-model="albumDetailsDraft.type"
          :label="requiredLabel('类型')"
          :options="[{ label: 'album', value: 'album' }]"
        />
        <input
          v-model="albumDetailsDraft.type"
          data-testid="album-details-type-input"
          type="hidden"
        />
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="bio">
        <PTextarea
          v-model="albumDetailsDraft.bio"
          data-testid="album-details-bio-input"
          :rows="4"
          placeholder="补充专辑简介"
          label="简介"
        />
      </div>

      <section class="track-adjustment" data-testid="album-details-field" data-field="track-adjustment">
        <div class="track-adjustment__header">
          <div>
            <span class="field-label">曲目调整</span>
            <p class="track-adjustment__hint">可调整顺序或删除曲目。</p>
          </div>
          <p class="track-adjustment__count" data-testid="album-details-track-count">{{ orderedTracks.length }} 首</p>
        </div>

        <div v-if="orderedTracks.length" class="track-list">
          <div
            v-for="(track, index) in orderedTracks"
            :key="track.id"
            :data-testid="`album-track-row-${track.id}`"
            class="track-row"
            draggable="true"
            @dragstart="handleTrackDragStart(track.id, $event)"
            @dragover.prevent
            @drop="handleTrackDrop(track.id, $event)"
          >
            <span class="track-sequence" data-testid="album-track-sequence">{{ formatSequence(track.sequence) }}</span>
            <PInput
              :model-value="track.title"
              data-testid="album-track-title-input"
              class="track-row__input"
              type="text"
              @update:model-value="updateTrackTitle(track.id, $event)"
            />
            <div class="track-row__actions">
              <button
                :data-testid="`album-track-move-up-${track.id}`"
                type="button"
                class="track-action"
                :disabled="index === 0"
                @click="moveTrack(index, -1)"
              >
                上移
              </button>
              <button
                :data-testid="`album-track-move-down-${track.id}`"
                type="button"
                class="track-action"
                :disabled="index === orderedTracks.length - 1"
                @click="moveTrack(index, 1)"
              >
                下移
              </button>
              <button
                :data-testid="`album-track-delete-${track.id}`"
                type="button"
                class="track-action track-action--danger"
                @click="removeTrack(track.id)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="field-group" data-testid="album-details-field" data-field="source">
        <PTextarea
          v-model="albumDetailsDraft.source"
          data-testid="album-details-source-input"
          :rows="3"
          placeholder="填写来源"
          :label="requiredLabel('来源')"
        />
      </div>
    </div>

    <div class="footer-actions" data-testid="album-details-footer">
      <div class="footer-actions__left">
        <button
          data-testid="album-details-close-button"
          type="button"
          class="ui-action"
          @click="closeMusicCreationFlow"
        >
          关闭
        </button>
      </div>
      <div class="footer-actions__right">
        <button
          data-testid="album-details-back-button"
          type="button"
          class="ui-action"
          @click="goBack"
        >
          返回上一步
        </button>
        <button
          data-testid="album-details-finish-button"
          type="button"
          class="primary-action"
        >
          完成
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.album-details-step {
  display: grid;
  gap: 1rem;
}

.progress-card,
.track-adjustment {
  padding: 1.35rem 1.45rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface);
}

.progress-card {
  display: none !important;
  gap: 0.75rem;
}

.progress-copy {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.step-kicker,
.progress-label,
.progress-value,
.field-label,
.track-adjustment__hint,
.track-adjustment__count,
.track-sequence,
.track-action {
  font-family: var(--a-font-sans);
}

.step-kicker,
.field-label {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.progress-label,
.progress-value,
.track-adjustment__count {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 800;
}

.progress-track {
  height: 0.5rem;
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.progress-steps {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.progress-step {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.78rem;
  font-weight: 800;
}

.progress-step--active {
  color: var(--a-color-text);
}

.progress-bar {
  width: 100%;
  height: 100%;
  background: color-mix(in srgb, var(--a-color-text) 92%, #6b4f3a 8%);
}

.field-stack {
  display: grid;
  gap: 1rem;
}

.field-group {
  display: grid;
  gap: 0.45rem;
}

.field-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 24%, transparent);
  border-radius: 0;
  padding: 0.25rem 0 0.72rem;
  background: transparent;
  color: var(--a-color-text);
  font: inherit;
}

:deep(.p-input:focus),
:deep(.p-textarea:focus) {
  border-bottom-color: var(--a-color-text);
}

.field-input--textarea {
  resize: vertical;
  min-height: 6rem;
  line-height: 1.6;
}

.field-input--file {
  border: 1px solid color-mix(in srgb, var(--a-color-text) 16%, transparent);
  padding: 0.85rem 0.95rem;
  color: var(--a-color-muted);
  background: var(--a-color-bg);
}

.album-import-status-card {
  margin-bottom: 1.5rem;
}

.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.82rem;
  font-weight: 800;
}

.state-line--strong {
  color: var(--a-color-text);
}

.state-line--error {
  color: var(--a-color-accent-destructive);
}

.imported-cover-callout {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  background: rgba(15, 23, 42, 0.03);
}

.imported-cover-callout__copy {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.5;
  font-size: 0.9rem;
}

.cover-preview {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.cover-preview__image {
  width: 84px;
  height: 84px;
  object-fit: cover;
}

.cover-preview__title,
.cover-preview__sub {
  margin: 0;
}

.cover-preview__title {
  font-family: var(--a-font-sans);
  font-size: 0.84rem;
  font-weight: 800;
}

.cover-preview__sub {
  margin-top: 0.25rem;
  color: var(--a-color-muted);
  line-height: 1.5;
  font-size: 0.9rem;
}

.track-adjustment {
  display: grid;
  gap: 0.9rem;
}

.track-adjustment__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.track-adjustment__hint {
  margin: 0.35rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.track-list {
  display: grid;
  gap: 0.75rem;
}

.track-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.track-sequence {
  min-width: 2rem;
  color: var(--a-color-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.track-row__input {
  padding-block: 0.7rem;
}

.track-row__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.track-action {
  border: 0;
  border-radius: 0px;
  padding: 0.65rem 0.95rem;
  background: color-mix(in srgb, var(--a-color-surface-muted) 78%, white);
  color: var(--a-color-text);
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.track-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.track-action--danger {
  color: var(--a-color-accent-destructive);
}

.footer-actions,
.footer-actions__right {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.footer-actions {
  display: none !important;
}

.ui-action,
.primary-action {
  border: 0;
  border-radius: 0px;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-sans);
  font-weight: 800;
  cursor: pointer;
}

.ui-action {
  background: color-mix(in srgb, var(--a-color-surface-muted) 78%, white);
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

.track-title-input {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 0.5rem 0.75rem;
  color: var(--a-color-text);
  font-family: inherit;
  font-size: 0.95rem;
  width: 100%;
  border-radius: 0;
  transition: all 0.15s ease;
}
.track-title-input:focus {
  outline: none;
  background: var(--a-color-bg);
  box-shadow: inset 0 -2px 0 var(--a-color-text);
}

@media (max-width: 720px) {
  .date-parts-grid,
  .progress-copy,
  .track-adjustment__header,
  .track-row {
    grid-template-columns: 1fr;
  }

  .progress-copy,
  .track-adjustment__header {
    display: grid;
  }

  .footer-actions {
    align-items: stretch;
  }
}

/* Custom File Picker UI */
.custom-file-picker {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}
.custom-file-picker:hover:not(.is-disabled) {
  border-color: var(--a-color-text);
  background: var(--a-color-bg);
}
.custom-file-picker.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.file-picker-icon {
  color: var(--a-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
}
.file-picker-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  text-align: left;
}
.file-picker-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--a-color-text);
  word-break: break-all;
  line-height: 1.4;
}
.file-picker-subtitle {
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
  margin-top: 0.15rem;
  line-height: 1.3;
}
</style>
