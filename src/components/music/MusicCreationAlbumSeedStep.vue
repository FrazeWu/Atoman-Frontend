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
    <div class="album-page">
      <header class="album-hero">
        <div class="album-hero__meta">
          <p class="hero-kicker">音乐档案提交</p>
          <p class="hero-step">第 2 步 / 专辑资料</p>
        </div>
        <h4>导入专辑压缩包</h4>
        <p class="hero-copy">选择专辑 zip 压缩包后，系统会先创建导入会话，再把识别到的专辑名、封面和曲目信息回填到稿件里。</p>
      </header>

      <section class="album-card album-card--primary">
        <div class="card-header">
          <div>
            <p class="card-kicker">导入文件</p>
            <p class="card-copy">建议使用专辑名命名压缩包，并把封面和音频一起打进包内。</p>
          </div>
        </div>

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
        <div v-else class="progress-panel">
          <p v-if="albumImportDraft.uploadProgress > 0" class="state-line">
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
        </div>
      </section>

      <section class="album-card album-card--soft">
        <div class="card-header">
          <div>
            <p class="card-kicker">曲目整理</p>
            <p class="card-copy">默认只展示序号和曲名，操作在 hover 或聚焦时显露，保持页面像表单而不是工具台。</p>
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

        <p v-else class="state-line">导入后识别到的曲目会显示在这里，也可以手动补充。</p>
      </section>

      <section class="album-card">
        <div class="card-header">
          <div>
            <p class="card-kicker">导入结果</p>
            <p class="card-copy">这里先汇总系统识别结果，后续再作为正式专辑资料提交。</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-chip">
            <span class="summary-label">识别到的专辑名</span>
            <strong>{{ albumImportDraft.derivedAlbumTitle || '等待导入结果' }}</strong>
          </div>
          <div class="info-chip">
            <span class="summary-label">封面结果</span>
            <strong>{{ albumImportDraft.coverUrl || albumImportDraft.derivedCover || '等待导入结果' }}</strong>
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

.album-hero {
  display: grid;
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
</style>
