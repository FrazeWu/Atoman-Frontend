<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  createMusicAlbumImport,
  type MusicAlbumImport,
  uploadMusicAlbumArchiveMultipart,
  validateMusicAlbumArchiveFile,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'

const { state, setMusicCreationStep } = useMusicDrawers()
const archiveInputRef = ref<HTMLInputElement | null>(null)

const creationFlow = computed(() => state.value.creationFlow)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])
const uploading = ref(false)
const errorMessage = ref('')
const resolvedCoverUrl = computed(() => albumImportDraft.value?.coverUrl || albumImportDraft.value?.derivedCover || '')

function formatUploadSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) return '0 KB/s'
  return `${Math.round(bytesPerSecond / 1024)} KB/s`
}

function applyImportSnapshot(snapshot: MusicAlbumImport) {
  if (!creationFlow.value) return

  creationFlow.value.draft.albumImport.importId = snapshot.importId
  creationFlow.value.draft.albumImport.status = snapshot.status
  creationFlow.value.draft.albumImport.archiveName = snapshot.archiveName
  creationFlow.value.draft.albumImport.uploadProgress = snapshot.uploadProgress
  creationFlow.value.draft.albumImport.uploadSpeed = snapshot.uploadSpeed
  creationFlow.value.draft.albumImport.coverUrl = snapshot.coverUrl
  creationFlow.value.draft.albumImport.coverKey = snapshot.coverKey
  creationFlow.value.draft.albumImport.derivedAlbumTitle = snapshot.derivedAlbumTitle
  creationFlow.value.draft.albumImport.derivedCover = snapshot.derivedCover
  creationFlow.value.draft.albumImport.derivedTracks = snapshot.derivedTracks
  creationFlow.value.draft.albumImport.lastSyncedAt = snapshot.lastSyncedAt
  creationFlow.value.draft.albumImport.errorMessage = snapshot.errorMessage
  creationFlow.value.draft.albumDetails.title = snapshot.derivedAlbumTitle || creationFlow.value.draft.albumDetails.title
  creationFlow.value.draft.albumDetails.coverUrl = snapshot.coverUrl || snapshot.derivedCover || creationFlow.value.draft.albumDetails.coverUrl
  creationFlow.value.draft.tracks = snapshot.derivedTracks.map((track, index) => ({
    id: `import-track-${index + 1}`,
    sequence: index + 1,
    title: track.title,
    audioKey: track.audioKey,
    origin: track.origin,
  }))
}

function renumberTracks() {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.map((track, index) => ({
    ...track,
    sequence: index + 1,
  }))
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

function removeTrack(trackId: string) {
  if (!creationFlow.value) return
  creationFlow.value.draft.tracks = creationFlow.value.draft.tracks.filter((track) => track.id !== trackId)
  renumberTracks()
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

    const session = await createMusicAlbumImport({ artistId: creationFlow.value.draft.artist.id })
    albumImportDraft.value.importId = session.importId
    albumImportDraft.value.status = 'uploading'
    albumImportDraft.value.archiveName = file.name
    albumImportDraft.value.uploadProgress = 0
    albumImportDraft.value.uploadSpeed = 0
    setMusicCreationStep('albumDetails')

    const snapshot = await uploadMusicAlbumArchiveMultipart(session.importId, file, {
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
</script>

<template>
  <div v-if="albumImportDraft" class="album-seed-step" data-testid="album-seed-step">
    <div class="album-page">
      <header class="album-hero">
        <div class="album-hero__meta">
          <p class="hero-step">第 2 步 / 上传专辑</p>
        </div>
        <h4>上传专辑</h4>
      </header>

      <section class="album-card album-card--primary">
        <div class="card-header">
          <div>
            <p class="card-kicker">上传文件</p>
            <p class="card-copy">只支持 zip 压缩包，建议包含专辑封面和音频文件。</p>
          </div>
        </div>

        <div class="field-group">
          <input
            ref="archiveInputRef"
            data-testid="album-import-archive-input"
            type="file"
            accept=".zip,application/zip"
            :disabled="uploading"
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
              :class="{ 'is-disabled': uploading }"
              @click="archiveInputRef?.click()"
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
                :disabled="uploading"
                @click.stop="archiveInputRef?.click()"
              >
                {{ albumImportDraft?.archiveName ? '重新选择' : '浏览文件' }}
              </PButton>
            </div>
          </div>
        </div>

        <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
        <div v-else class="progress-panel">
          <p v-if="albumImportDraft.uploadProgress > 0" class="state-line">
            上传进度 {{ albumImportDraft.uploadProgress }}%
          </p>
          <p v-else class="state-line">上传后会自动填入封面和曲目信息。</p>

          <p
            v-if="albumImportDraft.uploadProgress > 0 || albumImportDraft.uploadSpeed > 0"
            class="state-line"
            data-testid="album-import-speed"
          >
            {{ formatUploadSpeed(albumImportDraft.uploadSpeed) }}
          </p>

          <div v-if="albumImportDraft.archiveName" class="import-summary">
            <span class="summary-label">当前文件</span>
            <span class="summary-value">{{ albumImportDraft.archiveName }}</span>
          </div>
        </div>
      </section>

      <section class="album-card album-card--soft">
        <div class="card-header">
          <div>
            <p class="card-kicker">曲目整理</p>
          </div>
          <button
            data-testid="album-import-add-track-button"
            type="button"
            class="track-add-button"
            @click="addTrack"
          >
            新增曲目
          </button>
        </div>

        <div v-if="tracksDraft.length" class="track-list" data-testid="album-import-track-list">
          <div
            v-for="track in tracksDraft"
            :key="track.id"
            class="track-row track-row--interactive"
            data-testid="album-import-track-row"
          >
            <span class="track-seq">{{ String(track.sequence).padStart(2, '0') }}</span>
            <input
              :value="track.title"
              data-testid="album-import-track-title-input"
              class="track-title-input"
              type="text"
              placeholder="输入曲目名"
              @input="e => updateTrackTitle(track.id, (e.target as HTMLInputElement).value)"
            />
            <div class="track-row-actions" data-testid="album-import-track-actions">
              <button
                :data-testid="`album-import-track-delete-${track.id}`"
                type="button"
                class="track-action-button"
                @click="removeTrack(track.id)"
              >
                删除
              </button>
            </div>
          </div>
        </div>

        <p v-else class="state-line">上传后识别到的曲目会显示在这里，也可以手动添加。</p>
      </section>

      <section class="album-card">
        <div class="card-header">
          <div>
            <p class="card-kicker">已识别内容</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-chip">
            <span class="summary-label">专辑名</span>
            <strong>{{ albumImportDraft.derivedAlbumTitle || '等待上传' }}</strong>
          </div>
          <div class="info-chip">
            <span class="summary-label">封面</span>
            <div v-if="resolvedCoverUrl" class="cover-summary">
              <img
                :src="resolvedCoverUrl"
                alt="已识别专辑封面"
                class="cover-summary__image"
                data-testid="album-import-cover-preview"
              />
            </div>
            <strong v-else>等待上传</strong>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.album-seed-step {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
}

.album-page {
  display: grid;
  gap: 1rem;
}

.cover-summary {
  display: flex;
  align-items: center;
}

.cover-summary__image {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: cover;
  border-radius: 0.9rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-surface-2);
}

.album-hero {
  display: none !important;
  gap: 0.7rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.album-hero__meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-kicker,
.hero-step,
.card-kicker,
.summary-label {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.album-hero h4 {
  margin: 0;
  font-family: var(--a-font-serif);
  font-size: 2rem;
  line-height: 1.05;
}

.hero-copy,
.card-copy {
  margin: 0;
  color: var(--a-color-ink-soft);
  line-height: 1.7;
}

.album-card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
}

.album-card--primary {
  background: color-mix(in srgb, var(--a-color-paper) 82%, var(--a-color-paper-soft));
}

.album-card--soft {
  background: var(--a-color-paper-soft);
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.field-stack { display: grid; gap: 1rem; }
.field-group { display: grid; gap: 0.45rem; }
.progress-panel { display: grid; gap: 0.7rem; }

:deep(.p-input:focus) {
  border-bottom-color: var(--a-color-ink);
}

.state-line {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.82rem;
  font-weight: 800;
}

.state-line--error { color: var(--a-color-accent-destructive); }

.import-summary {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
}

.summary-value {
  color: var(--a-color-ink);
  font-size: 0.92rem;
  font-weight: 800;
}

.track-list {
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
}

.track-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--a-font-meta);
  padding-bottom: 0.45rem;
  border-bottom: 1px dashed color-mix(in srgb, var(--a-color-ink) 12%, transparent);
}

.track-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.track-row--interactive .track-row-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.track-row--interactive:hover .track-row-actions,
.track-row--interactive:focus-within .track-row-actions {
  opacity: 1;
  pointer-events: auto;
}

.track-seq {
  min-width: 2rem;
  color: var(--a-color-ink-soft);
  font-size: 0.76rem;
  font-weight: 800;
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

.track-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.track-action-button,
.track-add-button {
  border: 1px solid var(--a-color-line-soft);
  border-radius: 0;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
  padding: 0.45rem 0.7rem;
}

.info-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.info-chip {
  display: grid;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: color-mix(in srgb, var(--a-color-paper-wash) 84%, var(--a-color-paper));
}

@media (max-width: 720px) {
  .info-grid {
    grid-template-columns: 1fr;
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
