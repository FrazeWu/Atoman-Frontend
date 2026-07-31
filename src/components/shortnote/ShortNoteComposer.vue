<template>
  <form class="short-note-composer" @submit.prevent="submit">
    <PTextarea
      v-model="content"
      aria-label="短话内容"
      :rows="6"
      :maxlength="500"
      placeholder="写点什么"
      :disabled="submitting || uploading"
    >
      <template #suffix><span class="short-note-composer__count">{{ charCount }}/500</span></template>
    </PTextarea>

    <div v-if="mediaUrls.length" class="short-note-composer__media">
      <div v-for="(url, index) in mediaUrls" :key="url" class="short-note-composer__preview">
        <img :src="url" alt="上传的图片" />
        <button type="button" aria-label="移除图片" @click="removeImage(index)">移除</button>
      </div>
    </div>

    <p v-if="uploadError" class="short-note-composer__error" role="alert">{{ uploadError }}</p>
    <div class="short-note-composer__actions">
      <label class="short-note-composer__image-button" :class="{ 'is-disabled': uploading || mediaUrls.length >= 9 }">
        <ImagePlus :size="18" aria-hidden="true" />
        <span>{{ uploading ? '上传中...' : `图片 ${mediaUrls.length}/9` }}</span>
        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple :disabled="uploading || mediaUrls.length >= 9" @change="uploadImages" />
      </label>
      <PButton :disabled="!content.trim()" :loading="submitting">{{ submitLabel }}</PButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ImagePlus } from 'lucide-vue-next'
import { apiRequest } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(defineProps<{
  initialContent?: string
  initialMediaUrls?: string[]
  submitting?: boolean
  submitLabel?: string
}>(), {
  initialContent: '', initialMediaUrls: () => [], submitting: false, submitLabel: '发布',
})

const emit = defineEmits<{ submit: [payload: { content: string; media_urls: string[] }] }>()
const api = useApi()
const authStore = useAuthStore()
const content = ref(props.initialContent)
const mediaUrls = ref([...props.initialMediaUrls])
const uploading = ref(false)
const uploadError = ref('')
const charCount = computed(() => Array.from(content.value).length)

watch(() => props.initialContent, value => { content.value = value })
watch(() => props.initialMediaUrls, value => { mediaUrls.value = [...value] }, { deep: true })

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
      const response = await apiRequest(api.blog.uploadImage, {
        method: 'POST',
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        body,
      })
      const payload = await response.json().catch(() => null) as { data?: { url?: string }; url?: string; error?: string } | null
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
.short-note-composer { display:grid; gap:1rem; }
.short-note-composer__count { padding:.7rem; color:var(--a-color-muted); font-size:.75rem; }
.short-note-composer__media { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:.5rem; }
.short-note-composer__preview { position:relative; aspect-ratio:1; overflow:hidden; border-radius:var(--a-radius-control); background:var(--a-color-bg-subtle); }
.short-note-composer__preview img { width:100%; height:100%; object-fit:cover; }
.short-note-composer__preview button { position:absolute; right:.25rem; bottom:.25rem; border:0; padding:.25rem .45rem; background:rgba(0,0,0,.7); color:#fff; cursor:pointer; font:inherit; font-size:.75rem; }
.short-note-composer__actions { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.short-note-composer__image-button { display:inline-flex; align-items:center; gap:.4rem; color:var(--a-color-muted); cursor:pointer; font-size:.875rem; }
.short-note-composer__image-button.is-disabled { opacity:.5; cursor:not-allowed; }
.short-note-composer__image-button input { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
.short-note-composer__error { margin:0; color:var(--a-color-danger); font-size:.875rem; }
</style>
