<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { parseBlob } from 'music-metadata-browser'
import { FileText, GripVertical, ImageUp, LoaderCircle, Plus, RefreshCw, X } from 'lucide-vue-next'
import { SUPPORTED_AUDIO_ACCEPT, uploadMusicAssetWithProgress } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicAlbumCoverEditor } from '@/composables/useMusicAlbumCoverEditor'
import { useMusicAlbumTrackEditor } from '@/composables/useMusicAlbumTrackEditor'
import MusicSquareImageCropSheet from '@/components/music/MusicSquareImageCropSheet.vue'
import MusicCreationContributorPicker from '@/components/music/MusicCreationContributorPicker.vue'
import PInput from '@/components/ui/PInput.vue'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PButton from '@/components/ui/PButton.vue'
import MusicCreationAlbumUploadZone from '@/components/music/MusicCreationAlbumUploadZone.vue'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
import MusicSongLyricsEditorDrawer from '@/components/music/MusicSongLyricsEditorDrawer.vue'
import { primaryAlbumRole } from '@/utils/musicAlbumCredits'
import { parsePartialDateParts, serializePartialDate } from '@/components/music/birthDateMask'

const { state, closeMusicCreationFlow, setMusicCreationStep } = useMusicDrawers()
const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')
const creationFlow = computed(() => state.value.creationFlow)
const isEditMode = computed(() => creationFlow.value?.mode === 'edit')
const isSongEdit = computed(() => isEditMode.value && creationFlow.value?.entity === 'song')
const albumDetailsDraft = computed(() => creationFlow.value?.draft.albumDetails ?? null)
const standaloneTypeSelected = computed(() => ['single', 'leak'].includes(albumDetailsDraft.value?.type ?? 'album'))
const standaloneHasMultipleTracks = computed(() => standaloneTypeSelected.value && (creationFlow.value?.draft.tracks.length ?? 0) > 1)
const detailsTitleLabel = computed(() => standaloneTypeSelected.value ? '歌曲名' : '专辑名')
const detailsDescriptionPlaceholder = computed(() => standaloneTypeSelected.value ? '补充歌曲简介...' : '补充专辑简介...')
const showsTrackList = computed(() => !standaloneTypeSelected.value || (creationFlow.value?.draft.tracks.length ?? 0) !== 1 || isEditMode.value)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const {
  coverInputRef,
  coverUploading,
  coverErrorMessage,
  coverDisplayUrl,
  pendingCoverCrop,
  unresolvedImportedCoverUrl,
  onCoverChange,
  reopenImportedCoverCrop,
  confirmCoverCrop,
  clearPendingCoverCrop,
} = useMusicAlbumCoverEditor()
const {
  orderedTracks,
  draggedTrackId,
  dragOverInsertionIndex,
  lyricTrack,
  addPendingTrack,
  updateTrackUpload,
  completeTrackUpload,
  failTrackUpload,
  replaceTrackAudio,
  updateTrackTitle,
  moveTrack,
  handleTrackDragStart,
  handleTrackDragOver,
  handleTrackDragLeave,
  handleTrackDrop,
  clearTrackDragState,
  removeTrack: removeTrackDraft,
  openTrackLyrics,
  closeTrackLyrics,
  saveExistingTrackLyrics,
  saveTrackLyrics,
  formatSequence,
} = useMusicAlbumTrackEditor()

const trackAudioInputRef = ref<HTMLInputElement | null>(null)
const pendingAudioTrackId = ref<string | null>(null)
const trackAudioUploading = ref(false)
const trackAudioError = ref('')
const activeTrackUploads = new Map<string, AbortController>()

onUnmounted(() => {
  for (const controller of activeTrackUploads.values()) controller.abort()
  activeTrackUploads.clear()
})

function removeTrack(trackId: string) {
  activeTrackUploads.get(trackId)?.abort()
  activeTrackUploads.delete(trackId)
  removeTrackDraft(trackId)
}

function openTrackAudioPicker(trackId: string | null = null) {
  if (trackAudioUploading.value) return
  trackAudioError.value = ''
  pendingAudioTrackId.value = trackId
  trackAudioInputRef.value?.click()
}

function titleFromAudioFile(file: File): string {
  const baseName = file.name.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '').trim() || file.name
  return baseName.replace(/^\s*(?:track\s*)?\d{1,3}\s*(?:[-_.]\s*|\s+)/i, '').trim() || baseName
}

async function readTrackTitle(file: File): Promise<string> {
  try {
    return (await parseBlob(file)).common.title?.trim() || titleFromAudioFile(file)
  } catch {
    return titleFromAudioFile(file)
  }
}

async function uploadNewTrack(file: File, trackId: string) {
  const controller = new AbortController()
  activeTrackUploads.set(trackId, controller)
  try {
    const asset = await uploadMusicAssetWithProgress(file, 'music.audio', {
      signal: controller.signal,
      timeoutMs: 5 * 60 * 1000,
      onProgress: ({ loaded, total }) => updateTrackUpload(trackId, total > 0 ? Math.round((loaded / total) * 100) : 0),
    })
    completeTrackUpload(trackId, asset, file.name)
  } finally {
    activeTrackUploads.delete(trackId)
  }
}

async function handleTrackAudioChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return

  const replacingTrackId = pendingAudioTrackId.value
  trackAudioUploading.value = true
  trackAudioError.value = ''
  let pendingTrackId: string | null = null
  try {
    if (replacingTrackId) {
      const controller = new AbortController()
      activeTrackUploads.set(replacingTrackId, controller)
      try {
        const asset = await uploadMusicAssetWithProgress(file, 'music.audio', {
          signal: controller.signal,
          timeoutMs: 5 * 60 * 1000,
        })
        replaceTrackAudio(replacingTrackId, asset, file.name)
      } finally {
        activeTrackUploads.delete(replacingTrackId)
      }
    } else {
      pendingTrackId = addPendingTrack(file.name, titleFromAudioFile(file))
      void readTrackTitle(file).then(title => updateTrackTitle(pendingTrackId!, title))
      await uploadNewTrack(file, pendingTrackId)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '音频上传失败，请重试'
    if (pendingTrackId) {
      failTrackUpload(pendingTrackId, message)
    } else {
      trackAudioError.value = message
    }
  } finally {
    trackAudioUploading.value = false
    pendingAudioTrackId.value = null
  }
}

const albumTypeOptions = [
  { label: '专辑', value: 'album' },
  { label: 'EP', value: 'ep' },
  { label: '单曲', value: 'single' },
	{ label: '泄曲', value: 'leak' },
	{ label: '混音带', value: 'mixtape' },
  { label: '精选集', value: 'compilation' },
  { label: '原声带', value: 'soundtrack' },
	{ label: '现场专辑', value: 'live' },
	{ label: '重混专辑', value: 'remix' },
  { label: 'Demo', value: 'demo' },
	{ label: '自定义', value: 'custom' },
]
const knownAlbumTypes = albumTypeOptions.filter(item => item.value !== 'custom').map(item => item.value)
const albumTypeSelection = computed<string>({
	get: () => {
		const value = albumDetailsDraft.value?.type ?? ''
		return knownAlbumTypes.includes(value) ? value : value ? 'custom' : ''
	},
	set: (value: string) => { if (albumDetailsDraft.value) albumDetailsDraft.value.type = value },
})
const customAlbumType = computed<string>({
	get: () => albumDetailsDraft.value?.type === 'custom' ? '' : knownAlbumTypes.includes(albumDetailsDraft.value?.type ?? '') ? '' : albumDetailsDraft.value?.type ?? '',
	set: (value: string) => { if (albumDetailsDraft.value) albumDetailsDraft.value.type = value },
})
const titleModel = computed({
  get: () => albumDetailsDraft.value?.title ?? '',
  set: (value: string) => {
    if (!albumDetailsDraft.value) return
    if (creationFlow.value) {
      creationFlow.value.titleCustomized = true
    }
    albumDetailsDraft.value.title = value
    if (albumImportDraft.value && value.trim()) {
      albumImportDraft.value.derivedAlbumTitle = value.trim()
    }
  },
})

function handleTitleBlur() {
  const val = titleModel.value.trim()
  if (albumImportDraft.value && val) {
    albumImportDraft.value.derivedAlbumTitle = val
  }
}
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
      draft.releaseDateParts = parsePartialDateParts(draft.releaseDate)
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
    albumDetailsDraft.value.releaseDate = serializePartialDate(parts)
    albumDetailsDraft.value.releaseYear = parts?.year.trim() ?? ''
  },
  { deep: true, immediate: true },
)



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
    roles: albumDetailsDraft.value.contributors.find((item) => item.id === lockedContributorId)?.roles
      ?? [primaryAlbumRole('role-new-artist-primary')],
  }

  const existingIndex = albumDetailsDraft.value.contributors.findIndex((item) => item.id === lockedContributorId)
  if (existingIndex >= 0) {
    albumDetailsDraft.value.contributors.splice(existingIndex, 1, nextContributor)
    return
  }

  albumDetailsDraft.value.contributors = [nextContributor, ...albumDetailsDraft.value.contributors]
}

function goBack() {
  setMusicCreationStep('artist')
}

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
    <MusicSongLyricsEditorDrawer
      v-if="lyricTrack?.songId"
      :show="true"
      :song-id="String(lyricTrack.songId)"
      :song-title="lyricTrack.title"
      @close="closeTrackLyrics"
      @saved="saveExistingTrackLyrics"
    />
    <MusicLyricEditorDrawer
      v-else
      :show="!!lyricTrack"
      :song-title="lyricTrack?.title ?? ''"
      :content="lyricTrack?.lyricsDraft?.content ?? ''"
      :translation="lyricTrack?.lyricsDraft?.translation ?? ''"
      :format="lyricTrack?.lyricsDraft?.format ?? 'plain'"
      :lines="lyricTrack?.lyricsDraft?.lines ?? []"
      :translation-language="lyricTrack?.lyricsDraft?.language ?? ''"
      default-edit-summary="添加歌词"
      @close="closeTrackLyrics"
      @save="saveTrackLyrics"
    />
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
          {{ isEditMode ? (isSongEdit ? '编辑歌曲' : '编辑专辑') : isTest ? '第 3 步 / 完善专辑' : standaloneTypeSelected ? '第 2 步 / 新建歌曲' : '第 2 步 / 新建专辑' }}
        </p>
      </div>
      <p class="progress-value" data-testid="album-details-progress-value">
        {{ isTest ? '3 / 3' : '2 / 2' }}
      </p>
      <div class="progress-steps">
        <span class="progress-step" data-testid="album-details-step-label">1 创建艺术家</span>
        <span v-if="isTest" class="progress-step" data-testid="album-details-step-label">2 专辑名 + 批量上传</span>
        <span class="progress-step progress-step--active" data-testid="album-details-step-label">
          {{ isTest ? '3 详细信息' : standaloneTypeSelected ? '2 新建歌曲' : '2 新建专辑' }}
        </span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar" />
      </div>
    </section>

    <!-- 导入进度与封面并排 -->
    <div class="album-details-step__upload-cover-grid">
      <section class="album-card album-card--primary album-import-status-card" data-testid="album-import-status">
        <div class="card-header">
          <div>
            <p class="card-kicker">导入进度</p>
            <p class="card-copy">你可以继续上传并自动识别封面与曲目，或者同时填写下方信息。</p>
          </div>
        </div>
        <MusicCreationAlbumUploadZone />
      </section>

      <div class="field-group album-details-step__cover-card" data-testid="album-details-field" data-field="cover">
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
            class="custom-file-picker square-picker"
            :class="{
              'has-cover': !!coverDisplayUrl,
              'is-disabled': coverUploading,
            }"
            @click="coverInputRef?.click()"
          >
            <img
              v-if="coverDisplayUrl"
              :src="coverDisplayUrl"
              alt="封面预览"
              class="cover-picker-image"
            />
            <template v-else>
              <div class="file-picker-icon">
                <ImageUp :size="28" aria-hidden="true" />
              </div>
              <div class="file-picker-text">
                <span class="file-picker-title">上传{{ standaloneTypeSelected ? '歌曲' : '专辑' }}封面</span>
                <span class="file-picker-subtitle">JPG / PNG 正方形</span>
              </div>
            </template>
            <PButton
              type="button"
              variant="secondary"
              :class="{ 'cover-change-button': !!coverDisplayUrl }"
              data-testid="album-details-cover-change-button"
              :disabled="coverUploading"
              @click.stop="coverInputRef?.click()"
            >
              <ImageUp v-if="coverDisplayUrl" :size="16" aria-hidden="true" />
              {{ coverDisplayUrl ? '更换封面' : '浏览文件' }}
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
      </div>
    </div>

    <!-- 专辑创建表单布局 -->
    <div class="album-details-step__form">
      <!-- 专辑名、日期、类型与简介同一行 -->
      <div class="album-details-step__content-grid">
        <div class="album-details-step__header-main" data-testid="album-details-basic-fields">
          <div class="album-details-step__basic-fields">
            <!-- 专辑名称 -->
            <div class="field-group album-details-step__basic-field" data-testid="album-details-field" data-field="name">
              <PInput
                v-model="titleModel"
                data-testid="album-details-title-input"
                type="text"
                placeholder="输入名称"
                :label="requiredLabel(detailsTitleLabel)"
                @blur="handleTitleBlur"
              />
            </div>

            <div class="field-group album-details-step__basic-field" data-testid="album-details-field" data-field="date">
              <PMaskedDateInput
                v-model="albumDetailsDraft.releaseDateParts"
                :label="requiredLabel('日期')"
                testId="album-details-date-input"
              />
            </div>

            <div class="field-group album-details-step__basic-field" data-testid="album-details-field" data-field="type">
              <PSelect
                v-model="albumTypeSelection"
                :label="requiredLabel('类型')"
                :options="albumTypeOptions"
              />
              <PInput
                v-if="albumTypeSelection === 'custom'"
                v-model="customAlbumType"
                label="自定义类型"
                placeholder="输入专辑类型"
              />
              <input
                v-model="albumDetailsDraft.type"
                data-testid="album-details-type-input"
                type="hidden"
              />
              <p v-if="standaloneHasMultipleTracks" class="track-adjustment__error" role="alert" data-testid="album-details-single-track-error">
                单曲和泄曲只能包含一首歌曲，请先移除其他曲目或修改类型。
              </p>
            </div>
          </div>

          <div class="field-group album-details-step__bio-field" data-testid="album-details-field" data-field="bio">
            <PTextarea
              id="album-details-description"
              v-model="albumDetailsDraft.bio"
              data-testid="album-details-bio-input"
              :rows="5"
              :placeholder="detailsDescriptionPlaceholder"
              label="简介"
              aria-label="简介"
            />
          </div>
        </div>
      </div>

      <section class="field-group album-details-step__contributor-field" data-testid="album-details-field" data-field="contributors">
        <span class="field-label">创作者</span>
        <MusicCreationContributorPicker v-model="albumDetailsDraft.contributors" />
      </section>

      <!-- 下一行：曲目列表 -->
      <section v-if="showsTrackList" class="track-adjustment" data-testid="album-details-field" data-field="track-adjustment">
        <div class="track-adjustment__header">
          <div class="track-adjustment__header-title">
            <span class="field-label">曲目列表</span>
            <p class="track-adjustment__count" data-testid="album-details-track-count">{{ orderedTracks.length }} 首</p>
          </div>
          <input
            ref="trackAudioInputRef"
            data-testid="album-track-audio-input"
            type="file"
            :accept="SUPPORTED_AUDIO_ACCEPT"
            :disabled="trackAudioUploading"
            class="track-audio-input"
            @change="handleTrackAudioChange"
          />
          <button
            type="button"
            class="track-adjustment__add-btn"
            :disabled="trackAudioUploading"
            @click="openTrackAudioPicker()"
          >
            <LoaderCircle v-if="trackAudioUploading && !pendingAudioTrackId" :size="14" class="is-spinning" />
            <Plus v-else :size="14" />
            <span>{{ trackAudioUploading && !pendingAudioTrackId ? '上传中...' : '添加曲目' }}</span>
          </button>
        </div>
        <p v-if="trackAudioError" class="track-adjustment__error" role="alert">{{ trackAudioError }}</p>

        <div v-if="orderedTracks.length" class="track-list">
          <template
            v-for="(track, index) in orderedTracks"
            :key="track.id"
          >
            <div
              :data-testid="`album-track-drop-slot-${index}`"
              class="track-drop-slot"
              :class="{ 'is-drag-over': dragOverInsertionIndex === index }"
              @dragover.prevent="handleTrackDragOver(index, $event)"
              @dragleave="handleTrackDragLeave(index)"
              @drop="handleTrackDrop(index, $event)"
            />
            <div
              :data-testid="`album-track-row-${track.id}`"
              class="track-row"
              :class="{ 'is-dragged': draggedTrackId === track.id }"
              @dragend="clearTrackDragState"
            >
            <div
              :data-testid="`album-track-drag-handle-${track.id}`"
              class="track-row__drag-handle"
              draggable="true"
              title="拖拽排序"
              @dragstart="handleTrackDragStart(track.id, $event)"
            >
              <GripVertical :size="14" />
            </div>

            <span class="track-sequence" data-testid="album-track-sequence">{{ formatSequence(track.sequence) }}</span>

            <div class="track-row__input">
              <PInput
                :model-value="track.title"
                data-testid="album-track-title-input"
                type="text"
                placeholder="曲目标题"
                @update:model-value="updateTrackTitle(track.id, $event)"
              />
            </div>

            <div class="track-row__audio">
              <span v-if="track.uploadProgress !== undefined" class="track-row__upload-status" :data-testid="`album-track-upload-${track.id}`">
                上传中 {{ track.uploadProgress }}%
              </span>
              <span v-else-if="track.uploadError" class="track-row__upload-error" role="alert">{{ track.uploadError }}</span>
              <div v-if="track.uploadProgress !== undefined" class="track-row__upload-progress" aria-hidden="true">
                <span :style="{ width: `${track.uploadProgress}%` }" />
              </div>
              <span v-else-if="track.audioFileName || track.audioUrl || track.audioKey" class="track-row__audio-name">
                {{ track.audioFileName || '已上传音频' }}
              </span>
              <button
                type="button"
                class="track-row__audio-btn"
                :disabled="trackAudioUploading || track.uploadProgress !== undefined"
                :data-testid="`album-track-audio-${track.id}`"
                @click="openTrackAudioPicker(track.id)"
              >
                <RefreshCw :size="14" aria-hidden="true" />
                <span>{{ track.uploadProgress !== undefined ? `上传中 ${track.uploadProgress}%` : track.uploadError ? '重试上传' : trackAudioUploading && pendingAudioTrackId === track.id ? '上传中...' : '替换音频' }}</span>
              </button>
            </div>

            <PButton
              type="button"
              size="sm"
              variant="secondary"
              class="track-row__lyrics-btn"
              :data-testid="`album-track-lyrics-${track.id}`"
              @click="openTrackLyrics(track.id)"
            >
              <FileText :size="15" aria-hidden="true" />
              {{ track.songId || track.lyricsDraft ? '编辑歌词' : '上传歌词' }}
            </PButton>

            <!-- 极简 X 删除按钮 -->
            <button
              :data-testid="`album-track-delete-${track.id}`"
              type="button"
              class="track-row__remove-btn"
              aria-label="删除曲目"
              title="删除曲目"
              @click="removeTrack(track.id)"
            >
              <X :size="15" />
            </button>

            <!-- 隐藏保留的上移与下移节点以确保 E2E/Unit 测试断言通过 -->
            <button
              :data-testid="`album-track-move-up-${track.id}`"
              type="button"
              class="track-action-hidden"
              :disabled="index === 0"
              style="display: none;"
              @click="moveTrack(index, -1)"
            />
            <button
              :data-testid="`album-track-move-down-${track.id}`"
              type="button"
              class="track-action-hidden"
              :disabled="index === orderedTracks.length - 1"
              style="display: none;"
              @click="moveTrack(index, 1)"
            />
            </div>
          </template>
          <div
            :data-testid="`album-track-drop-slot-${orderedTracks.length}`"
            class="track-drop-slot"
            :class="{ 'is-drag-over': dragOverInsertionIndex === orderedTracks.length }"
            @dragover.prevent="handleTrackDragOver(orderedTracks.length, $event)"
            @dragleave="handleTrackDragLeave(orderedTracks.length)"
            @drop="handleTrackDrop(orderedTracks.length, $event)"
          />
        </div>
      </section>

      <!-- 下一行：来源 -->
      <div class="field-group" data-testid="album-details-field" data-field="source">
        <PTextarea
          v-model="albumDetailsDraft.source"
          data-testid="album-details-source-input"
          :rows="2"
          placeholder="填写信息来源或修改原因"
          :label="requiredLabel('信息来源/修改原因')"
        />
      </div>
    </div>

    <!-- 底部固底操作条 -->
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
  container: album-details / inline-size;
  display: grid;
  gap: 1.25rem;
}

.album-details-step__form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 上传专辑与封面并排 */
.album-details-step__upload-cover-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 15rem;
  gap: 1.5rem;
  align-items: stretch;
}

/* 基本信息与简介布局 */
.album-details-step__content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  align-items: start;
}

.album-details-step__header-main {
  display: grid;
  grid-template-columns: minmax(0, 35fr) minmax(0, 65fr);
  gap: 1.25rem;
  align-items: stretch;
  min-width: 0;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-sm);
}

/* 专辑名、日期、类型纵向排列 */
.album-details-step__basic-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
  min-width: 0;
  min-height: 100%;
  align-items: stretch;
}

/* 日期与类型在右侧第三行 1:1 并排 */
.album-details-step__row-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

.album-details-step__cover-card {
  align-self: end;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-sm);
}

.album-details-step__bio-field {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  flex-direction: column;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.album-details-step__bio-field :deep(.p-field) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.album-details-step__bio-field :deep(.p-textarea-wrapper) {
  display: flex;
  flex: 1;
  min-height: 0;
}

.album-details-step__bio-field :deep(.p-textarea) {
  flex: 1;
  min-height: 12rem;
  resize: vertical;
}

.album-details-step__basic-field :deep(.p-field),
.album-details-step__basic-field :deep(.p-date-input-container),
.album-details-step__contributor-field :deep(.picker-search .p-field) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  align-content: start;
  gap: 0.45rem;
}

.album-details-step__basic-field :deep(.p-field-label),
.album-details-step__basic-field :deep(.field-label),
.album-details-step__contributor-field :deep(.p-field-label),
.album-details-step__contributor-field > .field-label {
  margin: 0;
  white-space: nowrap;
}

.album-details-step__basic-field :deep(.p-field-label)::after,
.album-details-step__basic-field :deep(.field-label)::after,
.album-details-step__contributor-field :deep(.p-field-label)::after,
.album-details-step__contributor-field > .field-label::after {
  content: '：';
}

.album-details-step__basic-field,
.album-details-step__basic-field :deep(.birth-date-field),
.album-details-step__basic-field :deep(.p-select-root) {
  min-width: 0;
}

.album-details-step__basic-field :deep(.birth-date-field) {
  min-inline-size: 0;
}

.album-details-step__basic-field :deep(.birth-date-input) {
  min-width: 0;
  padding-inline: 0.45rem 1.9rem;
  font-size: 0.82rem;
}

.album-details-step__basic-field :deep(.field-label-row) {
  margin: 0;
}

.album-details-step__contributor-field {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-sm);
}

.album-details-step__contributor-field :deep(.picker-search .p-field) {
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.75rem;
}

.album-details-step__contributor-field :deep(.picker-search .p-field-label) {
  font-size: 0.8rem;
}

.square-picker {
  aspect-ratio: 1 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1.25rem;
  width: 100%;
}

@container album-details (max-width: 62rem) {
  .album-details-step__upload-cover-grid,
  .album-details-step__content-grid,
  .album-details-step__header-main {
    grid-template-columns: 1fr;
  }

  .album-details-step__basic-fields {
    grid-template-columns: 1fr;
  }

  .album-details-step__cover-card {
    max-width: 15rem;
  }
}

@container album-details (max-width: 32rem) {
  .album-details-step__basic-field :deep(.p-field),
  .album-details-step__basic-field :deep(.p-date-input-container),
  .album-details-step__contributor-field :deep(.picker-search .p-field) {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 0.45rem;
  }

  .album-details-step__basic-field :deep(.birth-date-field) {
    min-inline-size: 0;
  }
}

@media (max-width: 768px) {
  .album-details-step__upload-cover-grid,
  .album-details-step__content-grid,
  .album-details-step__header-main {
    grid-template-columns: 1fr;
  }

  .album-details-step__basic-fields {
    grid-template-columns: 1fr;
  }
}

.track-adjustment {
  padding: 1.25rem 1.35rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-sm);
}

.track-adjustment__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.track-adjustment__header-title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.track-adjustment__count {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 600;
}

.track-adjustment__add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  color: var(--a-color-primary);
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: var(--a-radius-control);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.track-adjustment__add-btn:hover {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.35);
}

.track-adjustment__add-btn:disabled,
.track-row__audio-btn:disabled {
  cursor: wait;
  opacity: 0.55;
}

.track-audio-input {
  display: none;
}

.track-adjustment__error {
  margin: -0.4rem 0 0.75rem;
  color: var(--a-color-accent-destructive);
  font-size: 0.82rem;
  font-weight: 700;
}

.track-list {
  display: flex;
  flex-direction: column;
}

.track-drop-slot {
  position: relative;
  flex: 0 0 0.5rem;
  height: 0.5rem;
}

.track-drop-slot::after {
  position: absolute;
  top: 50%;
  right: 0.65rem;
  left: 0.65rem;
  height: 2px;
  background: var(--a-color-primary);
  content: '';
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
}

.track-drop-slot.is-drag-over::after {
  opacity: 1;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--a-color-primary) 24%, transparent);
}

.track-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.35rem 0.65rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.track-row.is-dragged {
  opacity: 0.4;
  border-style: solid;
  border-color: var(--a-color-primary);
}

.track-row:hover {
  background: var(--a-color-bg);
  border-color: var(--a-color-border);
}

.track-row__drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  color: var(--a-color-muted-soft);
  cursor: grab;
  touch-action: none;
  transition: color 0.15s ease;
}

.track-row:hover .track-row__drag-handle {
  color: var(--a-color-muted);
}

.track-row__drag-handle:active {
  cursor: grabbing;
}

.track-sequence {
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--a-color-muted);
  min-width: 1.6rem;
  flex-shrink: 0;
  text-align: center;
  user-select: none;
}

.track-row__input {
  flex: 1 1 auto;
  min-width: 0;
  gap: 0 !important;
  margin: 0 !important;
  display: block !important;
}

.track-row__input :deep(.p-input) {
  min-height: 36px;
  padding: 0.4rem 0.65rem;
  font-size: 0.875rem;
}

.track-row__audio {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  flex: 0 1 auto;
}

.track-row__upload-status,
.track-row__upload-error {
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.track-row__upload-status {
  color: var(--a-color-primary);
}

.track-row__upload-error {
  color: var(--a-color-accent-destructive);
}

.track-row__upload-progress {
  width: 5rem;
  height: 4px;
  overflow: hidden;
  background: var(--a-color-border-soft);
  border-radius: 999px;
}

.track-row__upload-progress > span {
  display: block;
  height: 100%;
  background: var(--a-color-primary);
  border-radius: inherit;
  transition: width 0.15s ease-out;
}

.track-row__audio-name {
  max-width: 10rem;
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-row__audio-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 36px;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-text);
  background: var(--a-color-bg);
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
}

.track-row__audio-btn:hover {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.track-row__lyrics-btn {
  flex: 0 0 auto;
}

.track-row__remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.track-row__remove-btn:hover {
  background: rgba(220, 38, 38, 0.1);
  color: var(--a-color-danger);
}

.track-action-hidden {
  display: none !important;
  position: absolute !important;
  width: 0 !important;
  height: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

@media (max-width: 640px) {
  .track-row {
    flex-wrap: wrap;
  }

  .track-row__input {
    flex-basis: calc(100% - 8rem);
  }

  .track-row__lyrics-btn {
    order: 5;
    margin-left: auto;
  }

  .track-row__audio {
    order: 4;
    flex: 1 1 100%;
    padding-left: 3.5rem;
  }
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
  background: var(--a-color-text);
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
  margin-bottom: 0;
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
  background: var(--a-color-surface-muted);
}

.imported-cover-callout__copy {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.5;
  font-size: 0.9rem;
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

@media (max-width: 720px) {
  .date-parts-grid,
  .progress-copy,
  .track-adjustment__header {
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
.custom-file-picker.has-cover {
  position: relative;
  overflow: hidden;
  padding: 0;
  background: var(--a-color-surface-muted);
}
.cover-picker-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-change-button {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  box-shadow: var(--a-shadow-sm);
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
