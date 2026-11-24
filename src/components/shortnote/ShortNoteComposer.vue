<template>
  <form
    ref="formRef"
    class="short-note-composer"
    :class="{ 'is-compact': compact, 'is-expanded': isExpanded }"
    @submit.prevent="submit"
  >
    <!-- 视听附件预览卡片 -->
    <div
      v-if="attachedMedia"
      data-testid="short-note-media-attachment"
      class="short-note-composer__attachment"
    >
      <div class="short-note-composer__attachment-cover">
        <img
          v-if="attachedMedia.cover_url"
          :src="attachedMedia.cover_url"
          :alt="attachedMedia.title"
          class="short-note-composer__attachment-img"
        />
        <Music v-else-if="attachedMedia.type === 'song'" :size="18" aria-hidden="true" />
        <Disc v-else-if="attachedMedia.type === 'album'" :size="18" aria-hidden="true" />
        <Video v-else :size="18" aria-hidden="true" />
      </div>

      <div class="short-note-composer__attachment-info">
        <div class="short-note-composer__attachment-title">{{ attachedMedia.title }}</div>
        <div v-if="attachmentSubtitle" class="short-note-composer__attachment-subtitle">
          {{ attachmentSubtitle }}
        </div>
      </div>

      <span class="short-note-composer__attachment-badge">
        {{ typeLabelMap[attachedMedia.type] }}
      </span>

      <button
        type="button"
        class="short-note-composer__attachment-remove"
        aria-label="移除视听附件"
        title="移除"
        @click="removeAttachedMedia"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </div>

    <!-- 图片预览 -->
    <div v-if="mediaUrls.length" ref="mediaElement" data-testid="short-note-media" class="short-note-composer__media">
      <div v-for="(url, index) in mediaUrls" :key="url" class="short-note-composer__preview">
        <img :src="resolveMediaURL(url)" alt="上传的图片" />
        <button
          type="button"
          data-testid="short-note-drag-handle"
          class="short-note-composer__drag-handle"
          aria-label="拖拽排序图片"
          title="拖拽排序图片"
        >
          <GripVertical :size="14" />
        </button>
        <button
          type="button"
          class="short-note-composer__remove-btn"
          aria-label="移除图片"
          title="移除图片"
          @click="removeImage(index)"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <p v-if="uploadError" class="short-note-composer__error" role="alert">{{ uploadError }}</p>

    <!-- 主编辑交互区：写点什么在左，发布在右下角（发布永远停靠在最下一行），横线右侧到发布左侧留空间隙，图片视听位于横线左侧下方 -->
    <div class="short-note-composer__main">
      <div class="short-note-composer__editor-row">
        <!-- 输入框与每行信纸横线 -->
        <div class="short-note-composer__input-box" :style="{ height: `${inputHeight}px` }">
          <PTextarea
            v-model="content"
            aria-label="短笺内容"
            :rows="1"
            :maxlength="500"
            placeholder="写点什么..."
            :disabled="submitting"
            @focus="onFocus"
            @blur="onBlur"
            @input="onInput"
            @keydown="onKeydown"
          />
        </div>

        <!-- 右侧独立的发布操作：永远底对齐在最下一行，左侧横线不接上 -->
        <div class="short-note-composer__action-col">
          <PButton
            type="submit"
            size="sm"
            variant="primary"
            class="short-note-composer__submit"
            :disabled="!content.trim() || charCount > 500"
            :loading="submitting"
          >
            {{ submitLabel }}
          </PButton>
        </div>
      </div>

      <!-- 横线左侧下方：图片、视听与字数统计 -->
      <div class="short-note-composer__subline">
        <div class="short-note-composer__tools">
          <label class="short-note-composer__tool-btn short-note-composer__image-button" :class="{ 'is-disabled': uploading || mediaUrls.length >= 9 }">
            <ImagePlus :size="15" aria-hidden="true" />
            <span>{{ uploading ? '上传中...' : (mediaUrls.length ? `图片 ${mediaUrls.length}/9` : '图片') }}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              :disabled="uploading || mediaUrls.length >= 9"
              @change="uploadImages"
            />
          </label>

          <button
            type="button"
            class="short-note-composer__tool-btn short-note-composer__media-button"
            :class="{ 'is-disabled': submitting || uploading }"
            :disabled="submitting || uploading"
            aria-label="视听"
            @click="openMediaPicker"
          >
            <Music :size="15" aria-hidden="true" />
            <span>视听</span>
          </button>
        </div>

        <div v-if="charCount > 0" class="short-note-composer__meta">
          <span class="short-note-composer__count" :class="{ 'is-limit': charCount >= 500 }">
            {{ charCount }}/500
          </span>
        </div>
      </div>
    </div>

    <MediaPickerModal
      :open="mediaPickerOpen"
      @close="mediaPickerOpen = false"
      @select="handleMediaSelect"
    />
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Disc, GripVertical, ImagePlus, Music, Video, X } from 'lucide-vue-next'
import Sortable from 'sortablejs'
import { apiRequestResult } from '@/api/client'
import MediaPickerModal from '@/components/shared/MediaPickerModal.vue'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useApi } from '@/composables/useApi'
import { useAutoSave } from '@/composables/useAutoSave'
import { useAuthStore } from '@/stores/auth'
import type { MediaPickerItem, MediaPickerType } from '@/types/mediaPicker'
import type { ShortNoteMediaAttachment } from '@/types'
import { resolveMediaURL } from '@/utils/mediaUrl'

const props = withDefaults(defineProps<{
  initialContent?: string
  initialMediaUrls?: string[]
  initialMediaAttachment?: ShortNoteMediaAttachment | null
  submitting?: boolean
  submitLabel?: string
  compact?: boolean
}>(), {
  initialContent: '',
  initialMediaUrls: () => [],
  initialMediaAttachment: null,
  submitting: false,
  submitLabel: '发布',
  compact: false,
})

const emit = defineEmits<{
  submit: [payload: {
    content: string
    media_urls: string[]
    media_attachment_type?: string
    media_attachment_id?: string
  }]
}>()

const typeLabelMap: Record<MediaPickerType, string> = {
  song: '单曲',
  album: '专辑',
  video: '视频',
}

const api = useApi()
const authStore = useAuthStore()
const formRef = ref<HTMLFormElement | null>(null)
const isFocused = ref(false)
const content = ref(props.initialContent)
const mediaUrls = ref([...props.initialMediaUrls])
const attachedMedia = ref<MediaPickerItem | null>(
  props.initialMediaAttachment
    ? {
        id: props.initialMediaAttachment.id,
        type: props.initialMediaAttachment.type,
        title: props.initialMediaAttachment.title,
        subtitle: props.initialMediaAttachment.subtitle,
        cover_url: props.initialMediaAttachment.cover_url,
        artist: props.initialMediaAttachment.artist,
        album_id: props.initialMediaAttachment.album_id,
        album_title: props.initialMediaAttachment.album_title,
        year: props.initialMediaAttachment.year,
        song_count: props.initialMediaAttachment.song_count,
      }
    : null
)
const mediaPickerOpen = ref(false)
const mediaElement = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null
const uploading = ref(false)
const uploadError = ref('')
const charCount = computed(() => Array.from(content.value).length)

const isExpanded = computed(() => {
  return (
    isFocused.value ||
    Boolean(content.value.trim()) ||
    mediaUrls.value.length > 0 ||
    Boolean(attachedMedia.value)
  )
})

const LINE_HEIGHT = 36
const inputHeight = ref(LINE_HEIGHT)

function onFocus() {
  isFocused.value = true
  adjustHeight()
}

function onBlur(event: FocusEvent) {
  const nextTarget = event.relatedTarget as HTMLElement | null
  if (formRef.value?.contains(nextTarget)) return
  if (!content.value.trim() && !mediaUrls.value.length && !attachedMedia.value) {
    isFocused.value = false
    adjustHeight()
  }
}

function clampContent(val: string): string {
  // 严格限制不能输入第 6 行（最多 5 行内容，最多 4 个换行符）
  const lines = val.split('\n')
  if (lines.length > 5) {
    return lines.slice(0, 5).join('\n')
  }
  return val
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    const text = content.value
    const newlineLines = text.split('\n').length
    // 已达到 5 行，阻止 Enter 键继续生成第 6 行
    if (newlineLines >= 5) {
      event.preventDefault()
      return
    }
    const el = formRef.value?.querySelector('textarea')
    if (el) {
      const scrollLines = Math.max(Math.ceil((el.scrollHeight - 4) / LINE_HEIGHT), 1)
      if (scrollLines >= 5) {
        event.preventDefault()
        return
      }
    }
  }
}

function onInput() {
  const clamped = clampContent(content.value)
  if (clamped !== content.value) {
    content.value = clamped
  }
  adjustHeight()
}

function adjustHeight() {
  nextTick(() => {
    const el = formRef.value?.querySelector('textarea')
    if (!el) return
    let text = content.value
    const splitLines = text.split('\n')
    if (splitLines.length > 5) {
      text = splitLines.slice(0, 5).join('\n')
      content.value = text
    }
    // 内容为空时严格保持单行 36px，绝不点击后自动变成两行
    if (!text || !text.trim()) {
      inputHeight.value = LINE_HEIGHT
      el.style.overflowY = 'hidden'
      return
    }
    // 自动折行超过 5 行时，截断多余字符确保不能输入第六行
    while (text.length > 0 && Math.ceil((el.scrollHeight - 4) / LINE_HEIGHT) > 5) {
      text = text.slice(0, -1)
      el.value = text
      content.value = text
    }
    const newlineLines = text.split('\n').length
    const scrollLines = Math.max(Math.ceil((el.scrollHeight - 4) / LINE_HEIGHT), 1)
    const lines = Math.min(Math.max(newlineLines, scrollLines), 5)
    inputHeight.value = lines * LINE_HEIGHT
    el.style.overflowY = 'hidden'
  })
}

watch(content, () => {
  adjustHeight()
})

watch(isExpanded, () => {
  adjustHeight()
})

interface ShortNoteDraftPayload {
  content: string
  mediaUrls: string[]
}

const { autoSaveState, triggerAutoSave, loadDraft, clearDraft } = useAutoSave<ShortNoteDraftPayload>({
  getDraftKey: () => 'atoman:short_note_composer_draft',
  getPayload: () => ({
    content: content.value,
    mediaUrls: mediaUrls.value,
  }),
  shouldPersist: (payload) => Boolean(payload.content.trim() || payload.mediaUrls.length > 0),
})

const attachmentSubtitle = computed(() => {
  if (!attachedMedia.value) return ''
  const item = attachedMedia.value
  if (item.type === 'song') {
    const parts = [
      item.artist,
      item.album_title ? `《${item.album_title}》` : '',
      item.year ? `${item.year}` : '',
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' · ')
  } else if (item.type === 'album') {
    const parts = [
      item.artist,
      item.year ? `${item.year}` : '',
      item.song_count ? `${item.song_count} 首曲目` : '',
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' · ')
  }
  return item.subtitle || ''
})

watch(() => props.initialContent, value => { content.value = value })
watch(() => props.initialMediaUrls, value => { mediaUrls.value = [...value] }, { deep: true })
watch(
  () => props.initialMediaAttachment,
  attachment => {
    attachedMedia.value = attachment
      ? {
          id: attachment.id,
          type: attachment.type,
          title: attachment.title,
          subtitle: attachment.subtitle,
          cover_url: attachment.cover_url,
          artist: attachment.artist,
          album_id: attachment.album_id,
          album_title: attachment.album_title,
          year: attachment.year,
          song_count: attachment.song_count,
        }
      : null
  },
  { deep: true }
)
watch(mediaUrls, () => void nextTick(syncSortable), { deep: true, flush: 'post' })
watch(
  [content, mediaUrls],
  () => {
    triggerAutoSave()
  },
  { deep: true }
)

function syncSortable() {
  if (mediaUrls.value.length < 2 || !mediaElement.value) {
    sortable?.destroy()
    sortable = null
    return
  }
  if (sortable) return
  sortable = new Sortable(mediaElement.value, {
    animation: 150,
    handle: '.short-note-composer__drag-handle',
    onEnd(event) {
      const oldIndex = event.oldIndex
      const newIndex = event.newIndex
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
      const [url] = mediaUrls.value.splice(oldIndex, 1)
      mediaUrls.value.splice(newIndex, 0, url)
    },
  })
}

onMounted(() => {
  const saved = loadDraft()
  if (saved?.payload) {
    if (saved.payload.content && !content.value) {
      content.value = saved.payload.content
    }
    if (Array.isArray(saved.payload.mediaUrls) && saved.payload.mediaUrls.length > 0 && mediaUrls.value.length === 0) {
      mediaUrls.value = [...saved.payload.mediaUrls]
    }
  }
  void nextTick(syncSortable)
  adjustHeight()
})
onBeforeUnmount(() => sortable?.destroy())

function removeImage(index: number) { mediaUrls.value.splice(index, 1) }

function openMediaPicker() {
  mediaPickerOpen.value = true
}

function handleMediaSelect(item: MediaPickerItem) {
  attachedMedia.value = item
  mediaPickerOpen.value = false
}

function removeAttachedMedia() {
  attachedMedia.value = null
}

async function uploadImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? []).slice(0, 9 - mediaUrls.value.length)
  input.value = ''
  if (!files.length) return
  uploading.value = true
  uploadError.value = ''
  try {
    for (const file of files) {
      const body = new FormData()
      body.append('image', file)
      const response = await apiRequestResult(api.blog.uploadImage, {
        method: 'POST',
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        body,
      })
      const payload = await Promise.resolve(response.data).catch(() => null) as { data?: { url?: string }; url?: string; error?: string } | null
      const url = payload?.data?.url ?? payload?.url
      if (!response.ok || !url) throw new Error(payload?.error || '图片上传失败')
      mediaUrls.value.push(url)
    }
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : '图片上传失败'
  } finally {
    uploading.value = false
  }
}

function submit() {
  const normalized = content.value.trim()
  if (!normalized || charCount.value > 500 || uploading.value) return
  const payload: {
    content: string
    media_urls: string[]
    media_attachment_type?: string
    media_attachment_id?: string
  } = {
    content: normalized,
    media_urls: [...mediaUrls.value],
  }
  if (attachedMedia.value) {
    payload.media_attachment_type = attachedMedia.value.type
    payload.media_attachment_id = attachedMedia.value.id
  }
  emit('submit', payload)
  clearDraft()
  content.value = ''
  mediaUrls.value = []
  attachedMedia.value = null
  isFocused.value = false
  adjustHeight()
}

defineExpose({
  clearDraft,
  autoSaveState,
})
</script>

<style scoped>
.short-note-composer {
  display: flex;
  flex-direction: column;
  padding: 0.65rem 0.25rem 0;
  background: transparent;
  gap: 0.5rem;
}

.short-note-composer.is-compact {
  padding: 0.55rem 0.25rem 0;
}

/* 核心布局：输入行与右侧发布同行，底对齐保证发布永远在最下一行；横线右侧到发布左侧留空间隙，图片视听位于横线左侧下方 */
.short-note-composer__main {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.short-note-composer__editor-row {
  display: flex;
  align-items: flex-end;
  gap: 0.85rem;
  width: 100%;
}

.short-note-composer__input-box {
  flex: 1;
  min-width: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  box-sizing: border-box;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 35px,
    var(--a-color-border-soft) 35px,
    var(--a-color-border-soft) 36px
  );
  background-size: 100% 36px;
  background-repeat: repeat-y;
  transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.short-note-composer :deep(.p-field),
.short-note-composer :deep(.p-textarea-wrapper) {
  height: 100%;
  margin: 0;
  gap: 0;
  display: block;
}

.short-note-composer :deep(.p-textarea) {
  width: 100%;
  height: 100% !important;
  border: none !important;
  background: transparent !important;
  font-size: 0.92rem;
  line-height: 36px !important;
  resize: none;
  box-shadow: none !important;
  color: var(--a-color-fg);
  padding: 1px 0 0 0 !important;
  margin: 0 !important;
  box-sizing: border-box;
  overflow-y: hidden;
  display: block;
}

.short-note-composer :deep(.p-textarea:focus) {
  outline: none !important;
}

.short-note-composer :deep(.p-textarea::placeholder) {
  color: var(--a-color-muted);
  line-height: 36px;
}

/* 右侧发布操作列：底对齐固定在最下一行，高度与行高一致，左侧横线不接上 */
.short-note-composer__action-col {
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 横线左侧下方操作区：图片、视听与字数，带向下弹出滑入动画 */
.short-note-composer__subline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-top: 0.4rem;
  padding-bottom: 0.2rem;
  box-sizing: border-box;
  animation: sublineSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes sublineSlideDown {
  from {
    opacity: 0.6;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.short-note-composer__tools {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-left: 0;
  margin-right: auto;
}

.short-note-composer__meta {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.short-note-composer__count {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.short-note-composer__count.is-limit {
  color: var(--a-color-danger);
  font-weight: 600;
}

.short-note-composer__tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 28px;
  padding: 0 0.55rem;
  color: var(--a-color-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 500;
  transition: color 0.15s ease, background-color 0.15s ease;
  white-space: nowrap;
  box-sizing: border-box;
}

.short-note-composer__tool-btn:hover:not(.is-disabled) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.short-note-composer__tool-btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.short-note-composer__tool-btn input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.short-note-composer__submit {
  height: 28px;
  min-width: 3.75rem;
  padding: 0 0.75rem;
  border-radius: var(--a-radius-control);
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
}

.short-note-composer__error {
  margin: 0;
  color: var(--a-color-danger);
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .short-note-composer__media {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
