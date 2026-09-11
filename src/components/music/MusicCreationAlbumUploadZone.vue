<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { SUPPORTED_ARCHIVE_ACCEPT, SUPPORTED_AUDIO_ACCEPT, SUPPORTED_VIDEO_ACCEPT } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicCreationFlow } from './musicCreationFlowContext'
import { useAlbumImportUpload } from '@/composables/useAlbumImportUpload'
import PButton from '@/components/ui/PButton.vue'
import { IconExternalLink as ExternalLink } from '@tabler/icons-vue'

const { state } = useMusicDrawers()
const creationFlowFallback = computed(() => state.value.creationFlow)
const creationFlow = useMusicCreationFlow(creationFlowFallback)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport)
const metadataSourceLabel = computed(() => albumImportDraft.value?.metadataSource === 'discogs' ? 'Discogs' : 'MusicBrainz')

const {
  uploading,
  errorMessage,
  fileProgress,
  handleAutoFileChange,
  handleFilesUpload,
  handleRetryFile,
  handleReplaceFile,
  handleDeleteFile,
  cancelUpload,
  startPolling,
  stopPolling,
} = useAlbumImportUpload()

onMounted(() => {
  const draft = albumImportDraft.value
  if (draft?.importId && ['queued', 'extracting', 'analyzing', 'transcoding'].includes(draft.status)) {
    startPolling(draft.importId)
  }
})

onUnmounted(stopPolling)

const filesInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)
const replacementInputRef = ref<HTMLInputElement | null>(null)
const replacementFileId = ref('')

function handleDrop(event: DragEvent) {
  event.preventDefault()
  if (!event.dataTransfer?.files.length || uploading.value) return
  void handleFilesUpload(event.dataTransfer.files)
}

function chooseReplacement(fileId: string) {
  replacementFileId.value = fileId
  replacementInputRef.value?.click()
}

function handleReplacement(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file && replacementFileId.value) void handleReplaceFile(replacementFileId.value, file)
  ;(event.target as HTMLInputElement).value = ''
}

const isBackendProcessing = computed(() => {
  const status = albumImportDraft.value?.status
  return ['queued', 'extracting', 'analyzing', 'transcoding'].includes(status || '')
})
const processingRetryFile = computed(() => {
  const draft = albumImportDraft.value
  if (!draft || !['failed', 'needs_attention'].includes(draft.status) || draft.stage === 'ready') return null
  return draft.files.find((file) => file.uploadStatus === 'uploaded' && ['archive', 'audio'].includes(file.role)) ?? null
})
const stalledUploadFile = computed(() => {
  const draft = albumImportDraft.value
  if (uploading.value || !errorMessage.value || !draft) return null
  return draft.files.find((file) => file.uploadStatus === 'uploading') ?? null
})
const processingErrorMessage = computed(() => {
  if (errorMessage.value) return errorMessage.value
  const message = albumImportDraft.value?.errorMessage?.trim() || ''
  if (message === 'at least one source is required') return '请填写艺术家和专辑资料来源'
  if (['failed', 'needs_attention'].includes(albumImportDraft.value?.status || '') && albumImportDraft.value?.stage !== 'ready') {
    return '处理失败，请重试'
  }
  return message
})

const stageLabelMap: Record<string, string> = {
  queued: '等待处理',
  extracting: '解压中',
  analyzing: '分析中',
  transcoding: '转码中',
  ready: '已就绪',
}

const totalUploadProgress = computed(() => {
  const draft = albumImportDraft.value
  if (!draft) return 0
  if (
    draft.files.length > 0 &&
    draft.files.every((file) => file.uploadStatus === 'uploaded' || file.uploadStatus === 'completing')
  ) {
    return 100
  }
  if (draft.totalBytesTotal > 0) {
    return Math.max(0, Math.min(100, Math.round((draft.totalBytesLoaded / draft.totalBytesTotal) * 100)))
  }
  return Math.max(0, Math.min(100, draft.uploadProgress || 0))
})

const metadataMatchLabel = computed(() => {
	const draft = albumImportDraft.value
	if (!draft || (draft.status === 'pending_upload' && !draft.files.length)) return '等待上传'
	if (draft.metadataMatched === true || draft.metadataMatchStatus === 'matched') return '已匹配'
	if (draft.metadataMatchStatus === 'unmatched') return '未匹配，可人工核对'
	if (draft.metadataMatchStatus === 'matching') return '正在匹配'
	return '等待开始匹配'
})
const metadataMatchState = computed(() => {
  const draft = albumImportDraft.value
  if (!draft) return 'idle'
  if (draft.metadataMatched === true || draft.metadataMatchStatus === 'matched' || draft.metadataMatchStatus === 'unmatched') {
    return 'done'
  }
	if (draft.metadataMatchStatus === 'matching') {
		return 'active'
  }
  return 'idle'
})

function formatUploadSpeed(bytesPerSecond: number) {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (bytesPerSecond >= 1024) return `${Math.round(bytesPerSecond / 1024)}K`
  return `${Math.round(bytesPerSecond)}B`
}
</script>

<template>
  <div v-if="albumImportDraft" class="album-upload-zone">
    <div class="field-group">
      <!-- Hidden: unified file picker (archive + audio + covers, multiple) -->
      <input
        ref="filesInputRef"
        data-testid="album-import-files-input"
        type="file"
        :accept="SUPPORTED_ARCHIVE_ACCEPT + ',' + SUPPORTED_AUDIO_ACCEPT + ',' + SUPPORTED_VIDEO_ACCEPT + ',.cue,.lrc,.txt,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.tiff,.tif,.bmp'"
        multiple
        :disabled="uploading"
        style="display: none"
        @change="handleAutoFileChange"
      />
      <input ref="replacementInputRef" type="file" style="display: none" @change="handleReplacement" />
      <!-- Hidden: folder picker -->
      <input
        ref="folderInputRef"
        data-testid="album-import-folder-input"
        type="file"
        webkitdirectory
        :disabled="uploading"
        style="display: none"
        @change="(e) => { handleFilesUpload((e.target as HTMLInputElement).files!) }"
      />

      <div class="p-field">
        <label class="p-field-label">
          <span class="p-field-dot" aria-hidden="true" />
          上传专辑
        </label>
        <div
          class="custom-file-picker"
          :class="{ 'is-disabled': uploading }"
          @click="filesInputRef?.click()"
          @dragover.prevent
          @drop="handleDrop"
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
              <template v-if="albumImportDraft.archiveName">{{ albumImportDraft.archiveName }}</template>
              <template v-else-if="albumImportDraft.files.length > 0">已选择 {{ albumImportDraft.files.length }} 个文件</template>
              <template v-else>点击选择文件</template>
            </span>
            <span class="file-picker-subtitle">压缩包、音频或视频文件，也可以添加封面图片</span>
          </div>
          <PButton
            type="button"
            variant="secondary"
            :disabled="uploading"
            @click.stop="filesInputRef?.click()"
          >
            {{ albumImportDraft.archiveName || albumImportDraft.files.length > 0 ? '重新选择' : '选择文件' }}
          </PButton>
        </div>
      </div>

      <!-- Folder picker trigger -->
      <div class="folder-picker-row">
        <button
          type="button"
          class="folder-picker-btn"
          :disabled="uploading"
          @click="folderInputRef?.click()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          选择文件夹
        </button>
      </div>
      <p class="upload-hint">推荐上传 ZIP，识别更快更稳定。</p>
    </div>

    <p class="metadata-match-hint" data-testid="album-import-metadata-hint">
      <template v-if="albumImportDraft.metadataSourceUrl">
        已自动匹配专辑信息、曲序和歌词。
        <a
          :href="albumImportDraft.metadataSourceUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看 {{ metadataSourceLabel }} 来源
          <ExternalLink :size="14" aria-hidden="true" />
        </a>
      </template>
		<template v-else>上传会立即读取本地元信息；点击“开始匹配”后再核对专辑信息和曲序。</template>
    </p>
    <div class="parallel-progress" data-testid="album-import-parallel-progress">
      <div class="parallel-progress__lane">
        <div class="parallel-progress__heading">
          <span>上传文件</span>
          <strong>{{ totalUploadProgress }}%</strong>
        </div>
        <div class="parallel-progress__track" aria-hidden="true">
          <span :style="{ width: `${totalUploadProgress}%` }" />
        </div>
        <small>{{ albumImportDraft.files.length ? `${albumImportDraft.files.length} 个文件` : '等待选择文件' }}</small>
      </div>
      <div class="parallel-progress__lane parallel-progress__lane--matching">
        <div class="parallel-progress__heading">
          <span>元信息匹配</span>
          <strong>{{ metadataMatchLabel }}</strong>
        </div>
        <div class="parallel-progress__steps" aria-hidden="true">
          <span :class="{ 'is-done': metadataMatchState === 'active' || metadataMatchState === 'done' }" />
          <span :class="{ 'is-active': metadataMatchState === 'active', 'is-done': metadataMatchState === 'done' }" />
          <span :class="{ 'is-done': metadataMatchState === 'done' }" />
        </div>
		<small>{{ albumImportDraft.metadataMatchStatus === 'matching' ? '正在并行检索 Discogs 与 MusicBrainz' : '填写艺术家后开始匹配，可提高准确率' }}</small>
		</div>
	</div>
	<div v-if="albumImportDraft.metadataSources?.length" class="metadata-sources" data-testid="album-import-metadata-sources" role="status">
		<p v-for="source in albumImportDraft.metadataSources" :key="source.provider" class="metadata-source-row">
			<strong>{{ source.provider === 'discogs' ? 'Discogs' : 'MusicBrainz' }}</strong>
			<span v-if="source.candidateCount !== undefined">检索 {{ source.candidateCount }} 个候选</span>
			<span v-if="source.selected">已选中 {{ source.selectedTitle || '安全发行版' }}</span>
			<span v-else-if="source.status === 'matched'">发现 {{ source.selectedTitle || '安全发行版' }}，未采用</span>
			<span v-else>未找到可安全采用的发行版</span>
		</p>
	</div>
	<p v-if="albumImportDraft.metadataError" class="metadata-artist-hint" role="status">{{ albumImportDraft.metadataError }}</p>
    <p
      v-if="['ready', 'needs_attention'].includes(albumImportDraft.status)"
      class="metadata-artist-hint"
      data-testid="album-import-artist-metadata-hint"
      role="status"
    >
      音频标签中没有艺术家信息时不会自动识别，请在下方手动选择艺术家。
    </p>
    <p v-if="albumImportDraft.missingArtists?.length" class="metadata-artist-hint" role="status">
      该发行版还包括 {{ albumImportDraft.missingArtists.join('、') }}，请在专辑信息中补充艺术家。
    </p>

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
        <span class="import-file-format">{{ f.uploadStatus === 'uploading' ? '速度：' : f.detectedFormat }}</span>
        <span
          v-if="f.uploadStatus === 'uploading' && albumImportDraft.uploadSpeed > 0"
          class="import-file-speed"
          data-testid="album-import-speed"
        >
          {{ formatUploadSpeed(albumImportDraft.uploadSpeed) }}
        </span>
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
              class="import-file-action"
              :disabled="uploading"
              @click="chooseReplacement(f.fileId)"
            >
              替换
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
          <template v-else-if="stalledUploadFile?.fileId === f.fileId">
            <span class="import-file-error">{{ errorMessage }}</span>
            <button
              type="button"
              class="import-file-action"
              data-testid="album-import-upload-retry"
              :disabled="uploading"
              @click="handleRetryFile(f.fileId)"
            >
              继续上传
            </button>
          </template>
          <template v-else-if="fileProgress.get(f.fileId) !== undefined">
            {{ fileProgress.get(f.fileId) }}%
          </template>
        </span>
      </li>
    </ul>

    <!-- Error -->
    <p v-if="processingErrorMessage" class="state-line state-line--error">
      {{ processingErrorMessage }}
    </p>
    <button
      v-if="processingRetryFile"
      type="button"
      class="import-file-action"
      data-testid="album-import-processing-retry"
      @click="handleRetryFile(processingRetryFile.fileId)"
    >
      重试处理
    </button>
    <button
      v-if="uploading"
      type="button"
      class="import-file-action"
      @click="cancelUpload"
    >
      取消上传
    </button>

    <!-- Backend processing stage banner -->
    <div v-if="isBackendProcessing" class="stage-banner">
      <span class="stage-label">{{ stageLabelMap[albumImportDraft.stage] ?? '处理中' }}</span>
      <span class="stage-hint">处理完成后将自动更新</span>
    </div>
  </div>
</template>

<style scoped>
.album-upload-zone {
  display: grid;
  gap: 1rem;
}
.field-group { display: grid; gap: 0.45rem; }
.upload-hint { margin: 0; color: var(--a-color-muted); font-size: 0.78rem; }
.metadata-match-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}
	.metadata-artist-hint {
  margin: -0.25rem 0 0;
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
	}
	.metadata-sources {
		display: grid;
		gap: 0.35rem;
		padding: 0.8rem;
		border-left: 2px solid var(--a-color-text);
		background: var(--a-color-surface-muted);
	}
	.metadata-source-row { display: flex; gap: 0.45rem; margin: 0; color: var(--a-color-muted); font-size: 0.78rem; }
	.metadata-source-row strong { color: var(--a-color-text); }
.metadata-match-hint a {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--a-color-text);
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 0.18em;
}
.parallel-progress {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--a-color-border-soft);
}
.parallel-progress__lane {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}
.parallel-progress__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--a-color-text);
  font-size: 0.8rem;
  font-weight: 800;
}
.parallel-progress__heading strong {
  color: var(--a-color-muted);
  font-family: monospace;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.parallel-progress__track {
  height: 0.3rem;
  overflow: hidden;
  background: var(--a-color-surface-3);
}
.parallel-progress__track span {
  display: block;
  height: 100%;
  background: var(--a-color-text);
  transition: width 0.2s ease;
}
.parallel-progress__lane small {
  color: var(--a-color-muted);
  font-size: 0.72rem;
}
.parallel-progress__steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.3rem;
  height: 0.3rem;
}
.parallel-progress__steps span {
  background: var(--a-color-surface-3);
  transition: background-color 0.2s ease;
}
.parallel-progress__steps .is-done {
  background: var(--a-color-text);
}
.parallel-progress__steps .is-active {
  background: var(--a-color-accent-blue);
}
.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.82rem;
  font-weight: 800;
}
.state-line--error { color: var(--a-color-accent-destructive); }

/* Custom File Picker UI */
.custom-file-picker {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
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
  border-radius: 50%;
  background: var(--a-color-surface-3);
}
.file-picker-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.file-picker-title {
  color: var(--a-color-text);
  font-size: 0.95rem;
  font-weight: 800;
}
.file-picker-subtitle {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.folder-picker-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -0.25rem;
}
.folder-picker-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: none;
  color: var(--a-color-muted);
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}
.folder-picker-btn:hover:not(:disabled) {
  color: var(--a-color-text);
  background: var(--a-color-surface-3);
}
.folder-picker-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* File list */
.import-file-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}
.import-file-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  font-size: 0.8rem;
}
.import-file-item:last-child {
  border-bottom: none;
}
.import-file-item--uploaded, .import-file-item--completing {
  opacity: 0.7;
}
.import-file-name {
  flex: 1;
  color: var(--a-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.import-file-format {
  color: var(--a-color-muted);
  text-transform: uppercase;
  font-size: 0.7rem;
  font-weight: 800;
}
.import-file-speed {
  color: var(--a-color-muted);
  font-family: monospace;
  font-variant-numeric: tabular-nums;
}
.import-file-progress {
  min-width: 3rem;
  text-align: right;
  color: var(--a-color-text);
  font-family: monospace;
}
.import-file-error {
  color: var(--a-color-accent-destructive);
  margin-right: 0.5rem;
}
.import-file-action {
  background: transparent;
  border: none;
  color: var(--a-color-text);
  font-size: 0.76rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 0.25rem;
}
.import-file-action--danger {
  color: var(--a-color-accent-destructive);
}

.stage-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--a-color-accent-blue) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--a-color-accent-blue) 30%, transparent);
  border-radius: 4px;
}
.stage-label {
  color: var(--a-color-accent-blue);
  font-weight: 800;
  font-size: 0.85rem;
}
.stage-hint {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

@media (max-width: 640px) {
  .parallel-progress {
    grid-template-columns: 1fr;
  }
}
</style>
