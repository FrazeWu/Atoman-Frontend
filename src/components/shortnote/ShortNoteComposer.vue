<template>
  <form class="short-note-composer" :class="{ 'is-compact': compact }" @submit.prevent="submit">
    <div class="short-note-composer__field">
      <PTextarea
        v-model="content"
        aria-label="短笺内容"
        :rows="compact ? 3 : 5"
        :maxlength="500"
        placeholder="写点什么..."
        :disabled="submitting"
      >
        <template #suffix>
          <span class="short-note-composer__count" :class="{ 'is-limit': charCount >= 500 }">
            {{ charCount }}/500
          </span>
        </template>
      </PTextarea>
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

    <p v-if="uploadError" class="short-note-composer__error" role="alert">{{ uploadError }}</p>

    <div class="short-note-composer__actions">
      <div class="short-note-composer__tools">
        <label class="short-note-composer__image-button" :class="{ 'is-disabled': uploading || mediaUrls.length >= 9 }">
          <ImagePlus :size="16" aria-hidden="true" />
          <span>{{ uploading ? '上传中...' : `图片 ${mediaUrls.length}/9` }}</span>
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
          class="short-note-composer__media-button"
          :class="{ 'is-disabled': submitting || uploading }"
          :disabled="submitting || uploading"
          aria-label="视听"
          @click="openMediaPicker"
        >
          <Music :size="16" aria-hidden="true" />
          <span>视听</span>
        </button>
      </div>
      <PButton type="submit" :disabled="!content.trim() || charCount > 500" :loading="submitting">
        {{ submitLabel }}
      </PButton>
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
const content = ref(props.initialContent)
const mediaUrls = ref([...props.initialMediaUrls])

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
}

defineExpose({
  clearDraft,
  autoSaveState,
})
</script>

<style scoped>
.short-note-composer {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  box-shadow: none;
  transition: border-color 0.15s ease;
}

.short-note-composer:focus-within {
  border-color: var(--a-color-border);
  box-shadow: none;
}

.short-note-composer.is-compact {
  gap: 0.85rem;
}

.short-note-composer__count {
  padding: 0.5rem 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  transition: color 0.2s ease;
}

.short-note-composer__count.is-limit {
  color: var(--a-color-danger);
  font-weight: 600;
}

.short-note-composer__media {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.short-note-composer__preview {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
}

.short-note-composer__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.short-note-composer__drag-handle {
  position: absolute;
  top: 0.3rem;
  left: 0.3rem;
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border: 0;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--a-color-text) 65%, transparent);
  color: var(--a-color-bg);
  cursor: grab;
  touch-action: none;
  transition: background 0.15s ease;
}

.short-note-composer__drag-handle:active {
  cursor: grabbing;
  background: color-mix(in srgb, var(--a-color-text) 85%, transparent);
}

.short-note-composer__remove-btn {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border: 0;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--a-color-text) 65%, transparent);
  color: var(--a-color-bg);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.short-note-composer__remove-btn:hover {
  background: var(--a-color-danger);
  transform: scale(1.05);
}

.short-note-composer__attachment {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}

.short-note-composer__attachment-cover {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 4px;
  background: var(--a-color-surface-soft, rgba(0, 0, 0, 0.05));
  color: var(--a-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.short-note-composer__attachment-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.short-note-composer__attachment-info {
  flex: 1;
  min-width: 0;
}

.short-note-composer__attachment-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.short-note-composer__attachment-subtitle {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.125rem;
}

.short-note-composer__attachment-badge {
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: var(--a-color-surface-soft, rgba(0, 0, 0, 0.05));
  color: var(--a-color-muted);
  flex-shrink: 0;
}

.short-note-composer__attachment-remove {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.short-note-composer__attachment-remove:hover {
  background: var(--a-color-danger);
  color: #ffffff;
}

.short-note-composer__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.25rem;
}

.short-note-composer__tools {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.short-note-composer__image-button,
.short-note-composer__media-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.85rem;
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.short-note-composer__image-button:hover:not(.is-disabled),
.short-note-composer__media-button:hover:not(.is-disabled) {
  background: var(--a-color-bg);
  border-color: var(--a-color-border);
  color: var(--a-color-primary);
}

.short-note-composer__image-button.is-disabled,
.short-note-composer__media-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.short-note-composer__image-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
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
