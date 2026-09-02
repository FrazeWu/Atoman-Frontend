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

    <div class="short-note-composer__actions">
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
      <PButton type="submit" :disabled="!content.trim() || charCount > 500" :loading="submitting">
        {{ submitLabel }}
      </PButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { IconGripVertical as GripVertical, IconPhotoPlus as ImagePlus, IconX as X } from '@tabler/icons-vue'
import Sortable from 'sortablejs'
import { apiRequestResult } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { resolveMediaURL } from '@/utils/mediaUrl'

const props = withDefaults(defineProps<{
  initialContent?: string
  initialMediaUrls?: string[]
  submitting?: boolean
  submitLabel?: string
  compact?: boolean
}>(), {
  initialContent: '', initialMediaUrls: () => [], submitting: false, submitLabel: '发布', compact: false,
})

const emit = defineEmits<{ submit: [payload: { content: string; media_urls: string[] }] }>()
const api = useApi()
const authStore = useAuthStore()
const content = ref(props.initialContent)
const mediaUrls = ref([...props.initialMediaUrls])
const mediaElement = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null
const uploading = ref(false)
const uploadError = ref('')
const charCount = computed(() => Array.from(content.value).length)

watch(() => props.initialContent, value => { content.value = value })
watch(() => props.initialMediaUrls, value => { mediaUrls.value = [...value] }, { deep: true })
watch(mediaUrls, () => void nextTick(syncSortable), { deep: true, flush: 'post' })

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

onMounted(() => void nextTick(syncSortable))
onBeforeUnmount(() => sortable?.destroy())

function removeImage(index: number) { mediaUrls.value.splice(index, 1) }

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
  emit('submit', { content: normalized, media_urls: [...mediaUrls.value] })
}
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
  box-shadow: var(--a-shadow-sm);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.short-note-composer:focus-within {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-md);
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
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  backdrop-filter: blur(4px);
  cursor: grab;
  touch-action: none;
  transition: background 0.15s ease;
}

.short-note-composer__drag-handle:active {
  cursor: grabbing;
  background: rgba(0, 0, 0, 0.75);
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
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  backdrop-filter: blur(4px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.short-note-composer__remove-btn:hover {
  background: var(--a-color-danger);
  transform: scale(1.05);
}

.short-note-composer__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.25rem;
}

.short-note-composer__image-button {
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
  transition: all 0.15s ease;
}

.short-note-composer__image-button:hover:not(.is-disabled) {
  background: var(--a-color-bg);
  border-color: var(--a-color-border);
  color: var(--a-color-primary);
}

.short-note-composer__image-button.is-disabled {
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

