<script setup lang="ts">
import { computed } from 'vue'
import { FileText, GripVertical, ImageUp, LoaderCircle, Plus, RefreshCw, X } from 'lucide-vue-next'
import { SUPPORTED_AUDIO_ACCEPT } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicCreationFlow } from './musicCreationFlowContext'
import { useMusicAlbumCoverEditor } from '@/composables/useMusicAlbumCoverEditor'
import { useMusicAlbumTrackEditor } from '@/composables/useMusicAlbumTrackEditor'
import { useMusicCreationAlbumForm } from '@/composables/music/useMusicCreationAlbumForm'
import { useMusicCreationTrackAudioUpload } from '@/composables/music/useMusicCreationTrackAudioUpload'
import MusicSquareImageCropSheet from '@/components/music/MusicSquareImageCropSheet.vue'
import MusicCreationContributorPicker from '@/components/music/MusicCreationContributorPicker.vue'
import PInput from '@/components/ui/PInput.vue'
import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import MusicCreationAlbumUploadZone from '@/components/music/MusicCreationAlbumUploadZone.vue'
import MusicBrainzEditNotice from '@/components/music/MusicBrainzEditNotice.vue'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
import MusicSongLyricsEditorDrawer from '@/components/music/MusicSongLyricsEditorDrawer.vue'
import { musicCreationProgress } from '@/utils/musicCreationProgress'
import { musicTrackLyricsLabel } from '@/utils/musicTrackLyrics'

const { state, closeMusicCreationFlow, setMusicCreationStep, openMusicContributorFlow } = useMusicDrawers()
const creationFlowFallback = computed(() => state.value.creationFlow)
const creationFlow = useMusicCreationFlow(creationFlowFallback)
const progress = computed(() => musicCreationProgress(creationFlow.value))
const isEditMode = computed(() => creationFlow.value?.mode === 'edit')
const isSongEdit = computed(() => isEditMode.value && creationFlow.value?.entity === 'song')
const artistFirstFlow = computed(() => creationFlow.value?.artistFirstFlow === true)
const albumDetailsDraft = computed(() => creationFlow.value?.draft.albumDetails ?? null)
const standaloneTypeSelected = computed(() => ['single', 'leak'].includes(albumDetailsDraft.value?.type ?? 'album'))
const standaloneHasMultipleTracks = computed(() => standaloneTypeSelected.value && (creationFlow.value?.draft.tracks.length ?? 0) > 1)
const detailsTitleLabel = computed(() => standaloneTypeSelected.value ? '歌曲名' : '专辑名')
const detailsDescriptionPlaceholder = computed(() => standaloneTypeSelected.value ? '补充歌曲简介...' : '补充专辑简介...')
const showsTrackList = computed(() => !standaloneTypeSelected.value || (creationFlow.value?.draft.tracks.length ?? 0) !== 1 || isEditMode.value)
const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)
const unmatchedTrackCount = computed(() => (creationFlow.value?.draft.tracks ?? []).filter(track => track.matchStatus === 'unmatched' || track.matchStatus === 'ambiguous').length)
const musicBrainzMatched = computed(() => isEditMode.value && albumDetailsDraft.value?.musicBrainzMatched === true)
const importMetadataMatched = computed(() => !isEditMode.value && albumImportDraft.value?.metadataMatched === true)
const importMetadataSourceLabel = computed(() => albumImportDraft.value?.metadataSource === 'discogs' ? 'Discogs' : 'MusicBrainz')
const importMetadataModified = computed(() => importMetadataMatched.value && (
  creationFlow.value?.tracksCustomized === true || creationFlow.value?.titleCustomized === true
))
const importedMetadata = computed(() => {
  const importDraft = albumImportDraft.value
  if (!importDraft) return []
  return [
    ['厂牌', (importDraft.metadataLabels ?? []).join('、')],
    ['格式', (importDraft.metadataFormats ?? []).join('、')],
    ['外部分类', (importDraft.metadataGenres ?? []).join('、')],
    ['外部风格建议', (importDraft.metadataStyles ?? []).join('、')],
  ].filter(([, value]) => value)
})

const sourceFieldLabel = computed(() => isEditMode.value ? '修改原因*' : '信息来源/修改原因（可选）')
const sourceFieldPlaceholder = computed(() => isEditMode.value ? '填写本次修改原因' : '填写信息来源或修改原因')

const {
  coverInputRef,
  coverUploading,
  coverErrorMessage,
  coverDisplayUrl,
  pendingCoverCrop,
  unresolvedImportedCoverUrl,
  onCoverChange,
  reopenImportedCoverCrop,
  retryImportedCoverUpload,
  confirmCoverCrop,
  clearPendingCoverCrop,
} = useMusicAlbumCoverEditor()

const {
  orderedTracks,
  draggedTrackId,
  dragOverInsertionIndex,
  hoverTrackIndex,
  lyricTrack,
  addPendingTrack,
  updateTrackUpload,
  completeTrackUpload,
  failTrackUpload,
  replaceTrackAudio,
  updateTrackTitle,
  moveTrack,
  reorderTrackBySequence,
  handleTrackDragStart,
  handleTrackDragOver,
  handleTrackDragLeave,
  handleTrackDrop,
  handleTrackRowDragOver,
  handleTrackRowDrop,
  getTrackDisplacementClass,
  clearTrackDragState,
  removeTrack: removeTrackDraft,
  openTrackLyrics,
  closeTrackLyrics,
  saveExistingTrackLyrics,
  saveTrackLyrics,
  selectLyricsCandidate,
  formatSequence,
} = useMusicAlbumTrackEditor()

const {
  trackAudioInputRef,
  pendingAudioTrackId,
  trackAudioUploading,
  trackAudioError,
  pendingTrackRemovalId,
  lyricsCandidateLabel,
  selectTrackLyricsCandidate,
  requestTrackRemoval,
  confirmTrackRemoval,
  cancelTrackRemoval,
  handleTrackSequenceChange,
  openTrackAudioPicker,
  handleTrackAudioChange,
} = useMusicCreationTrackAudioUpload({
  orderedTracks,
  albumDetailsDraft,
  isEditMode,
  addPendingTrack,
  updateTrackUpload,
  completeTrackUpload,
  failTrackUpload,
  replaceTrackAudio,
  updateTrackTitle,
  removeTrackDraft,
  selectLyricsCandidate,
  formatSequence,
  reorderTrackBySequence,
})

const {
  albumTypeOptions,
  albumTypeSelection,
  customAlbumType,
  titleModel,
  handleTitleBlur,
  releaseDateModel,
  updateMetadataCountry,
  requiredLabel,
} = useMusicCreationAlbumForm({
  creationFlow,
  albumDetailsDraft,
  albumImportDraft,
  isEditMode,
})

function goBack() {
  if (creationFlow.value) creationFlow.value.returnedToImport = true
  setMusicCreationStep('albumImport')
}

function createNewContributor(name: string) {
  const flow = creationFlow.value
  if (flow) openMusicContributorFlow(flow, name)
}
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
      title="裁剪-封面"
      @cancel="clearPendingCoverCrop"
      @confirm="confirmCoverCrop"
    />

    <h2 v-if="isEditMode">{{ isSongEdit ? '编辑歌曲' : '编辑专辑' }}</h2>
    <section v-if="!isEditMode" class="progress-card">
      <div class="progress-copy">
        <p class="progress-label" data-testid="album-details-progress-label">
          {{ progress.label }}
        </p>
      </div>
      <p class="progress-value" data-testid="album-details-progress-value">
        {{ progress.value }}
      </p>
      <div class="progress-steps">
        <span v-for="(step, index) in progress.steps" :key="step.key" class="progress-step" :class="{ 'progress-step--active': index === progress.index }" data-testid="album-details-step-label">{{ index + 1 }} {{ step.label }}</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar" />
      </div>
    </section>

    <MusicBrainzEditNotice v-if="musicBrainzMatched" data-testid="musicbrainz-edit-notice" />

    <details v-if="!isEditMode || albumImportDraft?.importId" class="album-import-panel">
      <summary>上传与处理进度</summary>
      <section v-if="!isEditMode || albumImportDraft?.importId"
        class="album-card album-card--primary album-import-status-card"
        data-testid="album-import-status"
      >
        <div class="card-header">
          <div>
            <p class="card-kicker">导入进度</p>
            <p class="card-copy">你可以继续上传并自动识别封面与曲目，或者同时填写下方信息。</p>
          </div>
        </div>
        <MusicCreationAlbumUploadZone />
      </section>

    </details>

    <div class="album-details-step__form">
      <div class="album-details-step__overview">
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

            <div class="album-details-step__row-two-col">
            <div class="field-group album-details-step__basic-field" data-testid="album-details-field" data-field="date">
              <PMaskedDateInput
                v-model="releaseDateModel"
                :label="isEditMode ? requiredLabel('日期') : '日期（可选）'"
                testId="album-details-date-input"
              />
            </div>

            <div class="field-group album-details-step__basic-field" data-testid="album-details-field" data-field="type">
              <PSelect
                v-model="albumTypeSelection"
                label="类型"
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

            <div v-if="albumImportDraft" class="field-group album-details-step__basic-field" data-testid="album-details-field" data-field="country">
              <PCountryRegionField
                :model-value="albumImportDraft.metadataCountry ?? ''"
                label="国家/地区"
                trigger-test-id="album-details-country-input"
                data-testid="album-details-country-input"
                @update:model-value="updateMetadataCountry"
              />
              <PButton v-if="albumImportDraft.metadataCountry" variant="ghost" size="sm" @click="updateMetadataCountry('')">清空国家/地区</PButton>
            </div>

          </div>
        </div>
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
            {{ isEditMode ? requiredLabel('封面') : '封面（可选）' }}
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
        <p v-if="coverErrorMessage" class="state-line state-line--error" role="alert">{{ coverErrorMessage }}</p>
        <p v-else-if="coverUploading" class="state-line" role="status">正在上传封面...</p>
        <PButton v-if="coverDisplayUrl" variant="ghost" size="sm" :disabled="coverUploading" data-testid="album-details-crop-cover" @click="reopenImportedCoverCrop">裁剪封面（可选）</PButton>
        <div
          v-if="unresolvedImportedCoverUrl && coverErrorMessage && !coverUploading"
          class="imported-cover-callout"
          data-testid="album-details-imported-cover-callout"
        >
          <p class="imported-cover-callout__copy">识别封面上传失败，无需重新选择文件，可以直接重试。</p>
          <PButton
            type="button"
            variant="secondary"
            data-testid="album-details-imported-cover-action"
            @click="retryImportedCoverUpload"
          >
            重试上传封面
          </PButton>
        </div>
      </div>
      </div>

      <section class="field-group album-details-step__contributor-field" data-testid="album-details-field" data-field="contributors">
        <span class="field-label">创作者</span>
        <MusicCreationContributorPicker
          v-model="albumDetailsDraft.contributors"
          allow-create
          @create-artist="createNewContributor"
        />
      </section>

      <div class="album-details-step__editorial-row">
          <div class="field-group album-details-step__bio-field" data-testid="album-details-field" data-field="bio">
            <PTextarea
              id="album-details-description"
              v-model="albumDetailsDraft.bio"
              data-testid="album-details-bio-input"
              :rows="4"
              :placeholder="detailsDescriptionPlaceholder"
              label="简介"
              aria-label="简介"
            />
          </div>
      <div class="field-group" data-testid="album-details-field" data-field="source">
        <PTextarea
          v-model="albumDetailsDraft.source"
          @update:model-value="creationFlow && (creationFlow.sourceCustomized = true)"
          data-testid="album-details-source-input"
          :rows="4"
          :placeholder="sourceFieldPlaceholder"
          :label="sourceFieldLabel"
        />
      </div>
      </div>

          <dl v-if="importedMetadata.length" class="imported-metadata" data-testid="album-imported-metadata">
            <div v-for="([label, value]) in importedMetadata" :key="label" class="imported-metadata__item">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </div>
          </dl>

      <!-- 下一行：曲目列表 -->
      <section v-if="showsTrackList" class="track-adjustment" data-testid="album-details-field" data-field="track-adjustment">
        <div class="track-adjustment__header">
          <div class="track-adjustment__header-title">
            <span class="field-label">曲目列表</span>
            <p class="track-adjustment__count" data-testid="album-details-track-count">{{ orderedTracks.length }} 首</p>
            <span
              v-if="importMetadataMatched"
              class="track-adjustment__matched"
              :aria-label="importMetadataModified ? `${importMetadataSourceLabel} 已匹配，用户已修改曲目` : `${importMetadataSourceLabel} 已匹配`"
              data-testid="album-details-matched-status"
            >
              <span class="track-adjustment__matched-mark" aria-hidden="true">{{ importMetadataSourceLabel === 'Discogs' ? 'DG' : 'MB' }}</span>
              <span>已匹配</span>
              <template v-if="importMetadataModified">
                <span class="track-adjustment__matched-divider" aria-hidden="true">·</span>
                <span>已修改</span>
              </template>
            </span>
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
        <p v-if="unmatchedTrackCount" class="track-adjustment__hint" data-testid="album-track-match-summary">{{ unmatchedTrackCount }} 首未匹配资料，仅表示未找到外部曲目资料，不影响创建。</p>
        <p v-if="trackAudioError" class="track-adjustment__error" role="alert">{{ trackAudioError }}</p>

        <div v-if="orderedTracks.length" class="track-list" :class="{ 'is-dragging-active': draggedTrackId !== null }">
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
              :class="getTrackDisplacementClass(index)"
              @dragover.prevent="handleTrackRowDragOver(index, $event)"
              @drop="handleTrackRowDrop(index, $event)"
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

            <span
              class="track-sequence"
              data-testid="album-track-sequence"
            >
              <span class="track-sequence__text">{{ formatSequence(track.sequence) }}</span>
              <input
                :data-testid="`album-track-sequence-input-${track.id}`"
                class="track-sequence__input"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                :value="formatSequence(track.sequence)"
                :aria-label="`修改曲目 ${track.title || track.sequence} 序号`"
                title="修改序号以重排"
                @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                @change="handleTrackSequenceChange(track.id, $event)"
              />
            </span>

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
              <span v-else class="track-row__audio-name" :title="track.audioFileName">
                {{ track.audioUrl || track.audioKey || track.audioAssetId ? '音频就绪' : track.origin === 'manual' ? '待上传音频' : '音频处理中' }}
              </span>

            </div>

            <div class="track-row__lyrics">
              <span class="track-row__lyrics-status">{{ musicTrackLyricsLabel(track, albumImportDraft?.status) }}</span>
              <PButton
                type="button"
                size="sm"
                variant="secondary"
                class="track-row__lyrics-btn"
                :data-testid="`album-track-lyrics-${track.id}`"
                @click="openTrackLyrics(track.id)"
              >
                <FileText :size="15" aria-hidden="true" />
                {{ track.songId || track.lyricsDraft ? '查看歌词' : '上传歌词' }}
              </PButton>
            </div>

            <details v-if="track.lyricsCandidates && track.lyricsCandidates.length > 1" class="track-row__lyrics-candidates">
              <summary>对比歌词</summary>
              <div class="track-row__lyrics-candidate-list">
                <article v-for="candidate in track.lyricsCandidates" :key="`${candidate.source}-${candidate.content}`" class="track-row__lyrics-candidate">
                  <header>
                    <strong>{{ lyricsCandidateLabel(candidate.source) }}</strong>
                    <PButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      @click="selectTrackLyricsCandidate(track.id, candidate)"
                    >
                      {{ track.lyricsCandidateChoice === candidate.source ? '已选择' : '采用' }}
                    </PButton>
                  </header>
                  <pre>{{ candidate.content }}</pre>
                </article>
              </div>
            </details>

            <details class="track-row__more">
              <summary :aria-label="`${track.title}的更多操作`">更多</summary>
              <div class="track-row__menu">
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
            <button
              :data-testid="`album-track-delete-${track.id}`"
              type="button"
              class="track-row__remove-btn"
              aria-label="删除曲目"
              title="删除曲目"
              @click="requestTrackRemoval(track.id)"
            >
              <X :size="15" aria-hidden="true" />
              <span>删除曲目</span>
            </button>
                <button :data-testid="`album-track-move-up-${track.id}`" type="button" :disabled="index === 0" @click="moveTrack(index, -1)">上移曲目</button>
                <button :data-testid="`album-track-move-down-${track.id}`" type="button" :disabled="index === orderedTracks.length - 1" @click="moveTrack(index, 1)">下移曲目</button>
              </div>
            </details>
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

  <PConfirm
    above-player
    :show="pendingTrackRemovalId !== null"
    title="从当前版本移除曲目？"
    message="这首曲目只会从当前专辑版本移除，旧版本仍会保留，之后可以通过版本回滚恢复。"
    confirm-text="移除曲目"
    cancel-text="保留曲目"
    danger
    @confirm="confirmTrackRemoval"
    @cancel="cancelTrackRemoval"
  />
</template>

<style scoped>
@import "./musicCreationAlbumDetailsStep.css";

/* Contract rules verified by tests/unit/components/music/MusicCreationAlbumDetailsStep.spec.ts */
.album-details-step {
  container: album-details / inline-size;
}

.album-details-step__basic-fields {
  grid-template-columns: minmax(0, 1fr);
}

.album-details-step__basic-field :deep(.birth-date-field) {
  min-inline-size: 0;
}

@container album-details (max-width: 62rem) {
  .album-details-step__header-main {
    grid-template-columns: 1fr;
  }
}

@container album-details (max-width: 32rem) {
  .album-details-step__basic-field :deep(.p-date-input-container) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.track-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0;
  background: var(--a-color-bg);
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  will-change: transform;
}

@media (max-width: 640px) {
  .track-row {
    flex-wrap: wrap;
  }
}
</style>
