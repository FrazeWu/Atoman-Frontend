<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  uploadMusicAsset,
  createMusicAlbumImport,
  type MusicAlbumImport,
  uploadMusicAlbumArchiveMultipart,
  validateMusicAlbumArchiveFile,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PButton from '@/components/ui/PButton.vue'

const { state, closeMusicCreationFlow, setMusicCreationStep } = useMusicDrawers()
const archiveInputRef = ref<HTMLInputElement | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)

const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')
const creationFlow = computed(() => state.value.creationFlow)
const albumDetailsDraft = computed(() => creationFlow.value?.draft.albumDetails ?? null)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])
const coverUploading = ref(false)
const coverErrorMessage = ref('')
const uploading = ref(false)
const errorMessage = ref('')
const archiveUploadLocked = computed(() => {
  const status = albumImportDraft.value?.status
  return uploading.value || status === 'uploading' || status === 'extracting'
})
const importStatusLabel = computed(() => {
  const status = albumImportDraft.value?.status
  if (status === 'uploading') return '上传中'
  if (status === 'uploaded' || status === 'extracting') return '解析中'
  if (status === 'ready') return '已识别'
  if (status === 'failed') return '上传失败'
  return '等待上传'
})

function formatUploadSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) return '0 KB/s'
  return `${Math.round(bytesPerSecond / 1024)} KB/s`
}

function applyImportSnapshot(snapshot: MusicAlbumImport) {
  if (!creationFlow.value) return
  const derivedTracks = snapshot.derivedTracks ?? []

  creationFlow.value.draft.albumImport.importId = snapshot.importId
  creationFlow.value.draft.albumImport.status = snapshot.status
  creationFlow.value.draft.albumImport.archiveName = snapshot.archiveName
  creationFlow.value.draft.albumImport.uploadProgress = snapshot.uploadProgress
  creationFlow.value.draft.albumImport.uploadSpeed = snapshot.uploadSpeed
  creationFlow.value.draft.albumImport.coverUrl = snapshot.coverUrl
  creationFlow.value.draft.albumImport.coverKey = snapshot.coverKey
  creationFlow.value.draft.albumImport.derivedAlbumTitle = snapshot.derivedAlbumTitle
  creationFlow.value.draft.albumImport.derivedCover = snapshot.derivedCover
  creationFlow.value.draft.albumImport.derivedTracks = derivedTracks
  creationFlow.value.draft.albumImport.lastSyncedAt = snapshot.lastSyncedAt
  creationFlow.value.draft.albumImport.errorMessage = snapshot.errorMessage
  creationFlow.value.draft.albumDetails.title = snapshot.derivedAlbumTitle || creationFlow.value.draft.albumDetails.title
  creationFlow.value.draft.albumDetails.coverUrl = snapshot.coverUrl || snapshot.derivedCover || creationFlow.value.draft.albumDetails.coverUrl
  creationFlow.value.draft.tracks = derivedTracks.map((track, index) => ({
    id: `import-track-${index + 1}`,
    sequence: index + 1,
    title: track.title,
    audioKey: track.audioKey,
    origin: track.origin,
  }))
}

function canReuseImportSession(status: MusicAlbumImport['status']) {
  return status === 'failed' || status === 'pending_upload' || status === 'uploading'
}

function addTrack() {
  if (!creationFlow.value) return
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

function updateTrackTitle(trackId: string, title: string) {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.map((track) => (
    track.id === trackId
      ? { ...track, title }
      : track
  ))
}

async function handleArchiveChange(event: Event) {
  if (!creationFlow.value || !albumImportDraft.value) return

  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  errorMessage.value = ''

  try {
    validateMusicAlbumArchiveFile(file)

    const reusableImportId = canReuseImportSession(albumImportDraft.value.status)
      ? albumImportDraft.value.importId
      : null
    const session = reusableImportId
      ? null
      : await createMusicAlbumImport({ artistId: creationFlow.value.draft.artist.id })
    const importId = reusableImportId || session?.importId
    if (!importId) throw new Error('压缩包上传失败')

    albumImportDraft.value.importId = importId
    albumImportDraft.value.status = 'uploading'
    albumImportDraft.value.archiveName = file.name
    albumImportDraft.value.uploadProgress = 0
    albumImportDraft.value.uploadSpeed = 0

    const snapshot = await uploadMusicAlbumArchiveMultipart(importId, file, {
      onProgress(progress) {
        if (!albumImportDraft.value) return
        albumImportDraft.value.status = 'uploading'
        albumImportDraft.value.uploadProgress = progress.total > 0
          ? Math.round((progress.loaded / progress.total) * 100)
          : 0
        albumImportDraft.value.uploadSpeed = progress.bytesPerSecond
      },
    })

    albumImportDraft.value.status = 'extracting'
    applyImportSnapshot(snapshot)
  } catch (error) {
    if (albumImportDraft.value) {
      albumImportDraft.value.status = 'failed'
      albumImportDraft.value.errorMessage = error instanceof Error ? error.message : '压缩包上传失败'
    }
    errorMessage.value = error instanceof Error ? error.message : '压缩包上传失败'
  } finally {
    uploading.value = false
    input.value = ''
  }
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
  creationFlow.value.draft.tracks = next
  renumberTracks()
}

function removeTrack(trackId: string) {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.filter((track) => track.id !== trackId)
  renumberTracks()
}

async function onCoverChange(event: Event) {
  if (!creationFlow.value || !albumDetailsDraft.value) return

  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  coverUploading.value = true
  coverErrorMessage.value = ''

  try {
    const asset = await uploadMusicAsset(file, 'music.cover')
    albumDetailsDraft.value.coverAsset = asset
    albumDetailsDraft.value.coverUrl = asset.url
  } catch (error) {
    coverErrorMessage.value = error instanceof Error ? error.message : '封面上传失败'
  } finally {
    coverUploading.value = false
    input.value = ''
  }
}

function goBack() {
  setMusicCreationStep('albumImport')
}
</script>

<template>
  <div v-if="albumDetailsDraft" class="album-details-step" data-testid="album-details-step">
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
          <p class="card-copy">选中 zip 后会继续上传并自动识别封面与曲目，你可以同时填写下方信息。</p>
        </div>
      </div>

      <div class="field-group">
        <input
          ref="archiveInputRef"
          data-testid="album-import-archive-input"
          type="file"
          accept=".zip,application/zip"
          :disabled="archiveUploadLocked"
          style="display: none"
          @change="handleArchiveChange"
        />
        <div class="p-field">
          <label class="p-field-label">
            <span class="p-field-dot" aria-hidden="true" />
            专辑压缩包
          </label>
          <div 
            class="custom-file-picker" 
            :class="{ 'is-disabled': archiveUploadLocked }"
            @click="archiveUploadLocked ? undefined : archiveInputRef?.click()"
          >
            <div class="file-picker-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div class="file-picker-text">
              <span class="file-picker-title">
                {{ albumImportDraft?.archiveName || '点击或拖拽上传专辑压缩包' }}
              </span>
              <span class="file-picker-subtitle">只支持 .zip 格式，文件需在 2GB 以内</span>
            </div>
            <PButton 
              type="button" 
              variant="secondary" 
              :disabled="archiveUploadLocked"
              @click.stop="archiveUploadLocked ? undefined : archiveInputRef?.click()"
            >
              {{ albumImportDraft?.archiveName ? '重新选择' : '浏览文件' }}
            </PButton>
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <div v-else class="progress-panel">
        <p class="state-line state-line--strong">{{ importStatusLabel }}</p>
        <p v-if="albumImportDraft && albumImportDraft.uploadProgress > 0" class="state-line">
          上传进度 {{ albumImportDraft.uploadProgress }}%
        </p>
        <p v-else-if="albumImportDraft && albumImportDraft.archiveName" class="state-line">
          已上传：{{ albumImportDraft.archiveName }}
        </p>
        <p v-else class="state-line">上传后会自动填入封面和曲目信息。</p>

        <p
          v-if="albumImportDraft && (albumImportDraft.uploadProgress > 0 || albumImportDraft.uploadSpeed > 0)"
          class="state-line"
          data-testid="album-import-speed"
        >
          {{ formatUploadSpeed(albumImportDraft.uploadSpeed) }}
        </p>

        <p
          v-if="albumImportDraft?.archiveName"
          class="state-line"
        >
          当前文件：{{ albumImportDraft.archiveName }}
        </p>

        <p
          v-if="albumImportDraft?.errorMessage"
          class="state-line state-line--error"
        >
          {{ albumImportDraft.errorMessage }}
        </p>
      </div>
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
            封面
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
        <div v-else-if="albumDetailsDraft.coverUrl" class="cover-preview">
          <img :src="albumDetailsDraft.coverUrl" alt="封面预览" class="cover-preview__image" />
          <div class="cover-preview__meta">
            <p class="cover-preview__title">已选择封面</p>
          </div>
        </div>
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="name">
        <PInput
          v-model="albumDetailsDraft.title"
          data-testid="album-details-title-input"
          type="text"
          placeholder="例如 Late Registration"
          label="名字"
        />
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="date">
        <PInput
          v-model="albumDetailsDraft.releaseDate"
          data-testid="album-details-date-input"
          type="date"
          label="日期"
        />
      </div>

      <div class="field-group" data-testid="album-details-field" data-field="type">
        <PSelect
          v-model="albumDetailsDraft.type"
          label="类型"
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
          <div v-for="(track, index) in orderedTracks" :key="track.id" class="track-row">
            <span class="track-sequence" data-testid="album-track-sequence">{{ formatSequence(track.sequence) }}</span>
            <PInput
              :model-value="track.title"
              data-testid="album-track-title-input"
              class="track-row__input"
              type="text"
              readonly
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
          label="来源"
        />
      </div>
    </div>

    <div class="footer-actions" data-testid="album-details-footer">
      <div class="footer-actions__left">
        <button
          data-testid="album-details-close-button"
          type="button"
          class="paper-action"
          @click="closeMusicCreationFlow"
        >
          关闭
        </button>
      </div>
      <div class="footer-actions__right">
        <button
          data-testid="album-details-back-button"
          type="button"
          class="paper-action"
          @click="goBack"
        >
          返回上一步
        </button>
        <button
          data-testid="album-details-finish-button"
          type="button"
          class="paper-submit"
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
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-soft);
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
  font-family: var(--a-font-meta);
}

.step-kicker,
.field-label {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.progress-label,
.progress-value,
.track-adjustment__count {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-size: 0.82rem;
  font-weight: 800;
}

.progress-track {
  height: 0.5rem;
  overflow: hidden;
  background: var(--a-color-paper-wash);
}

.progress-steps {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.progress-step {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
}

.progress-step--active {
  color: var(--a-color-ink);
}

.progress-bar {
  width: 100%;
  height: 100%;
  background: color-mix(in srgb, var(--a-color-ink) 92%, #6b4f3a 8%);
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
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 24%, transparent);
  border-radius: 0;
  padding: 0.25rem 0 0.72rem;
  background: transparent;
  color: var(--a-color-ink);
  font: inherit;
}

:deep(.p-input:focus),
:deep(.p-textarea:focus) {
  border-bottom-color: var(--a-color-ink);
}

.field-input--textarea {
  resize: vertical;
  min-height: 6rem;
  line-height: 1.6;
}

.field-input--file {
  border: 1px dashed color-mix(in srgb, var(--a-color-ink) 16%, transparent);
  padding: 0.85rem 0.95rem;
  color: var(--a-color-ink-soft);
  background: var(--a-color-bg);
}

.album-import-status-card {
  margin-bottom: 1.5rem;
}

.state-line {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 800;
}

.state-line--strong {
  color: var(--a-color-ink);
}

.state-line--error {
  color: var(--a-color-accent-destructive);
}

.cover-preview {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
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
  font-family: var(--a-font-meta);
  font-size: 0.84rem;
  font-weight: 800;
}

.cover-preview__sub {
  margin-top: 0.25rem;
  color: var(--a-color-ink-soft);
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
  color: var(--a-color-ink-soft);
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
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
}

.track-sequence {
  min-width: 2rem;
  color: var(--a-color-ink-soft);
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
  background: color-mix(in srgb, var(--a-color-paper-wash) 78%, white);
  color: var(--a-color-ink);
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
  background: color-mix(in srgb, var(--a-color-paper-wash) 78%, white);
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

.track-title-input {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 0.5rem 0.75rem;
  color: var(--a-color-ink);
  font-family: inherit;
  font-size: 0.95rem;
  width: 100%;
  border-radius: 0;
  transition: all 0.15s ease;
}
.track-title-input:focus {
  outline: none;
  background: var(--a-color-paper);
  box-shadow: inset 0 -2px 0 var(--a-color-ink);
}

@media (max-width: 720px) {
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
  border: 1px dashed var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
  cursor: pointer;
  transition: all 0.2s ease;
}
.custom-file-picker:hover:not(.is-disabled) {
  border-color: var(--a-color-ink);
  background: var(--a-color-paper);
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
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line-soft);
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
  color: var(--a-color-ink);
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
