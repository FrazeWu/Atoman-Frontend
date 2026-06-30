<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  createMusicAlbumImport,
  getMusicAlbumImport,
  uploadMusicAlbumArchive,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import PInput from '@/components/ui/PInput.vue'

const { state } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])
const uploading = ref(false)
const errorMessage = ref('')

function formatUploadSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) return '0 KB/s'
  return `${Math.round(bytesPerSecond / 1024)} KB/s`
}

function applyImportSnapshot(snapshot: Awaited<ReturnType<typeof getMusicAlbumImport>>) {
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
    const session = await createMusicAlbumImport({ artistId: creationFlow.value.draft.artist.id })
    albumImportDraft.value.importId = session.importId
    albumImportDraft.value.status = 'uploading'
    albumImportDraft.value.archiveName = file.name
    albumImportDraft.value.uploadProgress = 0
    albumImportDraft.value.uploadSpeed = 0

    await uploadMusicAlbumArchive(session.importId, file, {
      onProgress(progress) {
        if (!albumImportDraft.value) return
        albumImportDraft.value.status = 'uploading'
        albumImportDraft.value.uploadProgress = progress.total > 0
          ? Math.round((progress.loaded / progress.total) * 100)
          : 0
        albumImportDraft.value.uploadSpeed = progress.bytesPerSecond
      },
    })

    albumImportDraft.value.status = 'uploaded'
    const snapshot = await getMusicAlbumImport(session.importId)
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
    <div class="album-seed-card">
      <div class="section-heading">
        <span class="section-dot" aria-hidden="true" />
        <div>
          <p class="step-kicker">Album Import</p>
          <h4>导入专辑压缩包</h4>
          <p class="step-copy">选择 zip 压缩包后先创建导入会话，再上传并回填解析结果。</p>
        </div>
      </div>

      <div class="field-stack">
        <div class="field-group">
          <PInput
            data-testid="album-import-archive-input"
            type="file"
            accept=".zip,application/zip"
            :disabled="uploading"
            label="专辑 zip 压缩包"
            @change="handleArchiveChange"
          />
        </div>

        <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
        <p v-else-if="albumImportDraft.uploadProgress > 0" class="state-line">
          上传进度 {{ albumImportDraft.uploadProgress }}%
        </p>
        <p v-else class="state-line">上传压缩包后会自动解析封面与曲目信息。</p>

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

        <div v-if="tracksDraft.length" class="track-list" data-testid="album-import-track-list">
          <div
            v-for="track in tracksDraft"
            :key="track.id"
            class="track-row track-row--interactive"
            data-testid="album-import-track-row"
          >
            <span class="track-seq">{{ String(track.sequence).padStart(2, '0') }}</span>
            <PInput
              :model-value="track.title"
              data-testid="album-import-track-title-input"
              class="track-title-input"
              type="text"
              placeholder="输入曲目名"
              @update:model-value="updateTrackTitle(track.id, String($event ?? ''))"
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

        <div class="track-toolbar">
          <button
            data-testid="album-import-add-track-button"
            type="button"
            class="track-add-button"
            @click="addTrack"
          >
            新增曲目
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.album-seed-step { display: flex; flex: 1; flex-direction: column; gap: 1rem; }
.album-seed-card {
  display: grid;
  gap: 1.2rem;
  padding: 1.4rem 1.5rem 1.35rem;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 0;
  background: var(--a-color-paper-soft);
}
.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}
.section-dot {
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
  margin-top: 0.35rem;
  flex-shrink: 0;
}
.step-kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.album-seed-card h4 { margin: 0; font-family: var(--a-font-serif); font-size: 1.45rem; line-height: 1.1; }
.step-copy { margin: 0.4rem 0 0; color: var(--a-color-ink-soft); line-height: 1.6; max-width: 38rem; }
.field-stack { display: grid; gap: 1rem; }
.field-group { display: grid; gap: 0.45rem; }
:deep(.p-input:focus) {
  border-bottom-color: var(--a-color-accent-confirm);
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
.summary-label {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
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
.track-toolbar {
  display: flex;
  justify-content: flex-start;
}
</style>
