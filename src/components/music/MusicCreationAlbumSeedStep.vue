<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import {
  uploadMusicAsset,
  createMusicAlbumImport,
  type MusicAlbumImport,
  type MusicAlbumImportInputMode,
  uploadMusicAlbumArchiveMultipart,
  validateMusicAlbumArchiveFile,
  registerMusicAlbumImportFiles,
  createMusicAlbumImportFilePartUpload,
  completeMusicAlbumImportFilePart,
  completeMusicAlbumImportFile,
  completeMusicAlbumImportSession,
  getMusicAlbumImport,
  retryMusicAlbumImportFile,
  deleteMusicAlbumImportFile,
  SUPPORTED_ARCHIVE_ACCEPT,
  SUPPORTED_AUDIO_ACCEPT,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import PInput from '@/components/ui/PInput.vue'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'

const { state, setMusicCreationStep } = useMusicDrawers()
const archiveInputRef = ref<HTMLInputElement | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)

const creationFlow = computed(() => state.value.creationFlow)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const albumDetailsDraft = computed(() => creationFlow.value?.draft.albumDetails ?? null)
const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? [])
const uploading = ref(false)
const errorMessage = ref('')
const coverUploading = ref(false)
const coverErrorMessage = ref('')
const resolvedCoverUrl = computed(() => albumImportDraft.value?.coverUrl || albumImportDraft.value?.derivedCover || '')

// Upload mode
const selectedMode = ref<MusicAlbumImportInputMode>('archive')
const filesInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)

// Per-file progress tracking: fileId -> progress%
const fileProgress = ref<Map<string, number>>(new Map())

let pollTimer: ReturnType<typeof setTimeout> | null = null

const uploadModes: Array<{ key: MusicAlbumImportInputMode; label: string }> = [
  { key: 'archive', label: '压缩包' },
  { key: 'files', label: '多选文件' },
  { key: 'folder', label: '文件夹' },
]

const stageLabelMap: Record<string, string> = {
  queued: '等待处理',
  extracting: '解压中',
  analyzing: '分析中',
  transcoding: '转码中',
  ready: '已就绪',
  needs_attention: '部分文件需确认',
  failed: '处理失败',
}

const isBackendProcessing = computed(() => {
  const status = albumImportDraft.value?.status
  return (
    status === 'queued' ||
    status === 'extracting' ||
    status === 'analyzing' ||
    status === 'transcoding'
  )
})

const multiFileTotalProgress = computed(() => {
  const draft = albumImportDraft.value
  if (!draft || draft.totalBytesTotal === 0) return 0
  return Math.round((draft.totalBytesLoaded / draft.totalBytesTotal) * 100)
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
  creationFlow.value.draft.albumImport.inputMode = snapshot.inputMode ?? 'auto'
  creationFlow.value.draft.albumImport.stage = snapshot.stage ?? 'upload'
  creationFlow.value.draft.albumImport.files = snapshot.files ?? []
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

async function onCoverChange(event: Event) {
  if (!albumDetailsDraft.value) return

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

    const snapshot = await uploadMusicAlbumArchiveMultipart(session.importId, file, {
      onProgress(progress) {
        if (!albumImportDraft.value) return
        albumImportDraft.value.status = 'uploading'
        albumImportDraft.value.uploadProgress = progress.total > 0
          ? Math.round((progress.loaded / progress.total) * 100)
          : 0
        albumImportDraft.value.uploadSpeed = progress.bytesPerSecond
        setMusicCreationStep('albumDetails')
      },
    })

    albumImportDraft.value.status = 'extracting'
    albumImportDraft.value.inputMode = 'archive'
    applyImportSnapshot(snapshot)
    if (['queued', 'extracting', 'analyzing', 'transcoding'].includes(snapshot.status)) {
      startPolling(session.importId)
    }
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

const FILE_PART_SIZE = 10 * 1024 * 1024 // 10MB

async function uploadSingleFileMultipart(
  importId: string,
  file: File,
  fileId: string,
): Promise<void> {
  const totalParts = Math.ceil(file.size / FILE_PART_SIZE)
  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const start = (partNumber - 1) * FILE_PART_SIZE
    const end = Math.min(start + FILE_PART_SIZE, file.size)
    const chunk = file.slice(start, end)
    const partSize = end - start

    const upload = await createMusicAlbumImportFilePartUpload(importId, fileId, partNumber, partSize)

    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      body: chunk,
    })
    if (!response.ok) throw new Error(`分片 ${partNumber} 上传失败`)

    const etag = response.headers.get('ETag') ?? ''
    await completeMusicAlbumImportFilePart(importId, fileId, partNumber, etag, partSize)

    // Track per-file progress
    fileProgress.value = new Map(fileProgress.value).set(
      fileId,
      Math.round((end / file.size) * 100),
    )
    // Track overall byte progress
    if (albumImportDraft.value) {
      albumImportDraft.value.totalBytesLoaded += partSize
    }
  }
  await completeMusicAlbumImportFile(importId, fileId)
  fileProgress.value = new Map(fileProgress.value).set(fileId, 100)
}

async function handleFilesUpload(fileList: FileList) {
  if (!creationFlow.value || !albumImportDraft.value) return
  const files = Array.from(fileList)
  if (files.length === 0) return

  uploading.value = true
  errorMessage.value = ''
  fileProgress.value = new Map()

  const draft = albumImportDraft.value
  draft.status = 'uploading'
  draft.inputMode = selectedMode.value
  draft.totalBytesLoaded = 0
  draft.totalBytesTotal = files.reduce((sum, f) => sum + f.size, 0)

  try {
    const session = await createMusicAlbumImport({
      artistId: creationFlow.value.draft.artist.id,
      inputMode: selectedMode.value,
    })
    draft.importId = session.importId
    setMusicCreationStep('albumDetails')

    const fileInputs = files.map((f) => ({
      relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      fileName: f.name,
      fileSize: f.size,
      contentType: f.type || 'application/octet-stream',
    }))

    const registered = await registerMusicAlbumImportFiles(session.importId, { files: fileInputs })
    draft.files = registered.files ?? []

    // Build a map: relativePath -> File (with fallback to fileName)
    const fileMap = new Map<string, File>()
    for (const f of files) {
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
      fileMap.set(relPath, f)
      fileMap.set(f.name, f)
    }

    // Upload audio/cover/cue files in batches of 3 (skip archive role from registered)
    const uploadTasks = (registered.files ?? [])
      .filter((rf) => rf.role !== 'archive') // archives are handled by the other path
      .map((registeredFile) => async () => {
        const file =
          fileMap.get(registeredFile.relativePath) ?? fileMap.get(registeredFile.fileName)
        if (!file) return
        await uploadSingleFileMultipart(session.importId, file, registeredFile.fileId)
      })

    // Concurrency limit: 3 at a time
    for (let i = 0; i < uploadTasks.length; i += 3) {
      await Promise.all(uploadTasks.slice(i, i + 3).map((fn) => fn()))
    }

    await completeMusicAlbumImportSession(session.importId)
    draft.status = 'queued'
    startPolling(session.importId)
  } catch (error) {
    draft.status = 'failed'
    draft.errorMessage = error instanceof Error ? error.message : '上传失败'
    errorMessage.value = draft.errorMessage
  } finally {
    uploading.value = false
  }
}

function startPolling(importId: string) {
  if (pollTimer) clearTimeout(pollTimer)
  const poll = async () => {
    if (!albumImportDraft.value || albumImportDraft.value.importId !== importId) return
    try {
      const snapshot = await getMusicAlbumImport(importId)
      applyImportSnapshot(snapshot)
      const done = ['ready', 'needs_attention', 'failed', 'canceled', 'committed'].includes(
        snapshot.status,
      )
      if (!done) pollTimer = setTimeout(poll, 3000)
    } catch {
      pollTimer = setTimeout(poll, 5000)
    }
  }
  pollTimer = setTimeout(poll, 2000)
}

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
})

async function handleRetryFile(fileId: string) {
  const draft = albumImportDraft.value
  if (!draft?.importId) return
  try {
    const snapshot = await retryMusicAlbumImportFile(draft.importId, fileId)
    draft.files = snapshot.files ?? draft.files
    startPolling(draft.importId)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '重试失败'
  }
}

async function handleDeleteFile(fileId: string) {
  const draft = albumImportDraft.value
  if (!draft?.importId) return
  try {
    const snapshot = await deleteMusicAlbumImportFile(draft.importId, fileId)
    draft.files = snapshot.files ?? draft.files.filter((f) => f.fileId !== fileId)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '移除失败'
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
          </div>
        </div>

        <!-- Mode tabs -->
        <div class="upload-mode-tabs" role="tablist" aria-label="上传方式">
          <button
            v-for="mode in uploadModes"
            :key="mode.key"
            role="tab"
            class="upload-mode-tab"
            :class="{ 'is-active': selectedMode === mode.key }"
            :disabled="uploading"
            :aria-selected="selectedMode === mode.key"
            @click="selectedMode = mode.key"
          >
            {{ mode.label }}
          </button>
        </div>

        <div class="field-group">
          <!-- Archive mode -->
          <template v-if="selectedMode === 'archive'">
            <input
              ref="archiveInputRef"
              data-testid="album-import-archive-input"
              type="file"
              :accept="SUPPORTED_ARCHIVE_ACCEPT"
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
                    {{ albumImportDraft?.archiveName || '点击上传专辑压缩包' }}
                  </span>
                  <span class="file-picker-subtitle">支持 ZIP、RAR、7Z、TAR 格式</span>
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
          </template>

          <!-- Multi-select files mode -->
          <template v-else-if="selectedMode === 'files'">
            <input
              ref="filesInputRef"
              data-testid="album-import-files-input"
              type="file"
              :accept="SUPPORTED_AUDIO_ACCEPT + ',.cue,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.tiff,.tif,.bmp'"
              multiple
              :disabled="uploading"
              style="display: none"
              @change="(e) => handleFilesUpload((e.target as HTMLInputElement).files!)"
            />
            <div class="p-field">
              <label class="p-field-label">
                <span class="p-field-dot" aria-hidden="true" />
                音频文件
              </label>
              <div
                class="custom-file-picker"
                :class="{ 'is-disabled': uploading }"
                @click="filesInputRef?.click()"
              >
                <div class="file-picker-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div class="file-picker-text">
                  <span class="file-picker-title">
                    {{ albumImportDraft && albumImportDraft.files.length > 0 ? `已选择 ${albumImportDraft.files.length} 个文件` : '点击选择音频文件' }}
                  </span>
                  <span class="file-picker-subtitle">支持 MP3、FLAC、WAV、M4A、APE 等格式，可多选</span>
                </div>
                <PButton
                  type="button"
                  variant="secondary"
                  :disabled="uploading"
                  @click.stop="filesInputRef?.click()"
                >
                  选择文件
                </PButton>
              </div>
            </div>
          </template>

          <!-- Folder mode -->
          <template v-else-if="selectedMode === 'folder'">
            <input
              ref="folderInputRef"
              data-testid="album-import-folder-input"
              type="file"
              webkitdirectory
              :disabled="uploading"
              style="display: none"
              @change="(e) => handleFilesUpload((e.target as HTMLInputElement).files!)"
            />
            <div class="p-field">
              <label class="p-field-label">
                <span class="p-field-dot" aria-hidden="true" />
                专辑文件夹
              </label>
              <div
                class="custom-file-picker"
                :class="{ 'is-disabled': uploading }"
                @click="folderInputRef?.click()"
              >
                <div class="file-picker-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div class="file-picker-text">
                  <span class="file-picker-title">点击选择专辑文件夹</span>
                  <span class="file-picker-subtitle">选择包含音频和封面的整个文件夹</span>
                </div>
                <PButton
                  type="button"
                  variant="secondary"
                  :disabled="uploading"
                  @click.stop="folderInputRef?.click()"
                >
                  选择文件夹
                </PButton>
              </div>
            </div>
          </template>
        </div>

        <!-- File list (multi-file / folder mode) -->
        <ul
          v-if="albumImportDraft.files.length > 0"
          class="import-file-list"
          data-testid="album-import-file-list"
        >
          <li
            v-for="f in albumImportDraft.files"
            :key="f.fileId"
            class="import-file-item"
            :class="`import-file-item--${f.uploadStatus}`"
          >
            <span class="import-file-name">{{ f.fileName }}</span>
            <span class="import-file-format">{{ f.detectedFormat }}</span>
            <span class="import-file-progress">
              <template v-if="f.uploadStatus === 'uploaded' || f.uploadStatus === 'completing'">✓</template>
              <template v-else-if="f.uploadStatus === 'failed'">
                <span class="import-file-error">{{ f.errorMessage || '上传失败' }}</span>
                <button
                  type="button"
                  class="import-file-action"
                  :disabled="uploading"
                  @click="handleRetryFile(f.fileId)"
                >
                  重试
                </button>
                <button
                  type="button"
                  class="import-file-action import-file-action--danger"
                  :disabled="uploading"
                  @click="handleDeleteFile(f.fileId)"
                >
                  移除
                </button>
              </template>
              <template v-else-if="fileProgress.get(f.fileId) !== undefined">
                {{ fileProgress.get(f.fileId) }}%
              </template>
            </span>
          </li>
        </ul>

        <!-- Error -->
        <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>

        <!-- Archive mode progress -->
        <div v-else-if="selectedMode === 'archive'" class="progress-panel">
          <p v-if="albumImportDraft.uploadProgress > 0" class="state-line">
            上传进度 {{ albumImportDraft.uploadProgress }}%
          </p>
          <p v-else class="state-line">上传后会自动识别封面和曲目信息。</p>
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

        <!-- Multi-file mode progress -->
        <div v-else-if="albumImportDraft.totalBytesTotal > 0" class="progress-panel">
          <p class="state-line">上传进度 {{ multiFileTotalProgress }}%</p>
        </div>

        <!-- Backend processing stage banner -->
        <div v-if="isBackendProcessing" class="stage-banner">
          <span class="stage-label">{{ stageLabelMap[albumImportDraft.stage] ?? '处理中' }}</span>
          <span class="stage-hint">处理完成后将自动更新</span>
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

      <section v-if="albumDetailsDraft" class="album-card album-card--soft">
        <div class="card-header">
          <div>
            <p class="card-kicker">专辑信息</p>
            <p class="card-copy">在这一步直接完成封面、标题、日期和简介。</p>
          </div>
        </div>

        <div class="field-stack">
          <div class="field-group">
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
                    {{ albumDetailsDraft.coverUrl ? '已选择封面图片' : '点击或拖拽上传专辑封面' }}
                  </span>
                  <span class="file-picker-subtitle">支持 JPG, PNG 格式</span>
                </div>
                <PButton
                  type="button"
                  variant="secondary"
                  :disabled="coverUploading"
                  @click.stop="coverInputRef?.click()"
                >
                  {{ albumDetailsDraft.coverUrl ? '重新选择' : '浏览文件' }}
                </PButton>
              </div>
            </div>
            <p v-if="coverErrorMessage" class="state-line state-line--error">{{ coverErrorMessage }}</p>
            <p v-else-if="coverUploading" class="state-line">正在上传封面...</p>
          </div>

          <div class="field-group">
            <PInput
              v-model="albumDetailsDraft.title"
              data-testid="album-details-title-input"
              type="text"
              label="专辑名"
              placeholder="输入专辑名"
            />
          </div>

          <div class="field-grid field-grid--duo">
            <div class="field-group">
              <PInput
                v-model="albumDetailsDraft.releaseDate"
                data-testid="album-details-date-input"
                type="date"
                label="发行日期"
              />
            </div>

            <div class="field-group">
              <PSelect
                v-model="albumDetailsDraft.type"
                data-testid="album-details-type-input"
                label="类型"
                :options="[
                  { label: '专辑', value: 'album' },
                  { label: 'EP', value: 'ep' },
                  { label: '单曲', value: 'single' },
                ]"
              />
            </div>
          </div>

          <div class="field-group">
            <PTextarea
              v-model="albumDetailsDraft.bio"
              data-testid="album-details-bio-input"
              :rows="4"
              label="简介"
              placeholder="补充专辑简介"
            />
          </div>

          <div class="field-group">
            <PInput
              v-model="albumDetailsDraft.source"
              data-testid="album-details-source-input"
              type="text"
              label="来源"
              placeholder="填写专辑信息来源"
            />
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
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-2);
}

.album-hero {
  display: none !important;
  gap: 0.7rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
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
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.album-hero h4 {
  margin: 0;
  font-family: var(--a-font-sans);
  font-size: 2rem;
  line-height: 1.05;
}

.hero-copy,
.card-copy {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.7;
}

.album-card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.album-card--primary {
  background: color-mix(in srgb, var(--a-color-bg) 82%, var(--a-color-surface));
}

.album-card--soft {
  background: var(--a-color-surface);
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
  border-bottom-color: var(--a-color-text);
}

.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.82rem;
  font-weight: 800;
}

.state-line--error { color: var(--a-color-accent-destructive); }

.import-summary {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.summary-value {
  color: var(--a-color-text);
  font-size: 0.92rem;
  font-weight: 800;
}

.track-list {
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.track-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--a-font-sans);
  padding-bottom: 0.45rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 12%, transparent);
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
  color: var(--a-color-muted);
  font-size: 0.76rem;
  font-weight: 800;
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

.track-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.track-action-button,
.track-add-button {
  border: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
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
  border: 1px solid var(--a-color-border-soft);
  background: color-mix(in srgb, var(--a-color-surface-muted) 84%, var(--a-color-bg));
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

.upload-mode-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 12px;
  background: var(--color-surface-secondary, rgba(0,0,0,0.06));
  border-radius: 8px;
  padding: 2px;
}

.upload-mode-tab {
  flex: 1;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary, #888);
  transition: background 0.15s, color 0.15s;
}

.upload-mode-tab.is-active {
  background: var(--color-surface, #fff);
  color: var(--color-text, #111);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.upload-mode-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-file-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
}

.import-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 2px;
  font-size: 12px;
  border-bottom: 1px solid var(--color-border-subtle, rgba(0,0,0,0.06));
}

.import-file-item--failed .import-file-name {
  color: var(--color-error, #c00);
}

.import-file-item--uploaded .import-file-name {
  opacity: 0.6;
}

.import-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.import-file-format {
  font-family: monospace;
  color: var(--color-text-secondary, #888);
  font-size: 11px;
  flex-shrink: 0;
}



.stage-banner {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--color-surface-secondary, rgba(0,0,0,0.04));
  border-radius: 6px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.stage-label {
  font-weight: 500;
}

.stage-hint {
  color: var(--color-text-secondary, #888);
}

.import-file-progress {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.import-file-error {
  color: var(--color-error, #c00);
  font-size: 11px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-file-action {
  padding: 1px 6px;
  font-size: 11px;
  border: 1px solid var(--color-border, rgba(0,0,0,0.15));
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--color-text, #333);
  white-space: nowrap;
  transition: background 0.12s;
}

.import-file-action:hover:not(:disabled) {
  background: var(--color-surface-secondary, rgba(0,0,0,0.06));
}

.import-file-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.import-file-action--danger {
  color: var(--color-error, #c00);
  border-color: var(--color-error, #c00);
}

.import-file-action--danger:hover:not(:disabled) {
  background: rgba(204,0,0,0.06);
}
</style>
