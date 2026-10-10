<template>
  <section class="book-private-upload books-detail__section" aria-labelledby="private-books-title">
    <header class="book-private-upload__header">
      <div>
        <h2 id="private-books-title">我的电子书</h2>
        <p>上传的文件仅自己可见，处理完成后可以直接阅读。</p>
      </div>
      <PButton
        type="button"
        variant="secondary"
        :loading="isUploading"
        :disabled="!authStore.isAuthenticated"
        @click="openFilePicker"
      >
        <Upload :size="16" aria-hidden="true" />
        <span>{{ authStore.isAuthenticated ? '上传电子书' : '登录后上传' }}</span>
      </PButton>
      <input
        ref="fileInput"
        class="book-private-upload__input"
        type="file"
        accept=".epub,.pdf,.txt,.cbz,.cbr,.mobi,.azw3,application/epub+zip,application/pdf,text/plain,application/vnd.comicbook+zip,application/vnd.rar,application/x-mobipocket-ebook,application/vnd.amazon.mobi8-ebook"
        @change="handleFileChange"
      />
    </header>

    <p v-if="isUploading" class="book-private-upload__feedback" aria-live="polite">正在上传 {{ uploadProgress }}%</p>
    <p v-if="errorMessage" class="book-private-upload__feedback book-private-upload__feedback--error" role="alert">{{ errorMessage }}</p>
    <p v-if="message" class="book-private-upload__feedback" aria-live="polite">{{ message }}</p>

    <ul v-if="relatedImports.length" class="book-private-upload__list">
      <li v-for="item in relatedImports" :key="item.id">
        <div>
          <RouterLink v-if="item.asset_id && item.processing_status === 'private_available'" :to="`/books/read/${item.asset_id}`">
            <strong>{{ item.title || item.file_name }}</strong>
          </RouterLink>
          <strong v-else>{{ item.title || item.file_name }}</strong>
          <span>{{ item.file_name }} · {{ formatSize(item.size) }}</span>
        </div>
        <div class="book-private-upload__status">
          <span>{{ statusLabel(item) }}</span>
          <RouterLink v-if="item.asset_id && item.processing_status === 'private_available'" :to="`/books/read/${item.asset_id}`">开始阅读</RouterLink>
        </div>
      </li>
    </ul>
    <p v-else-if="authStore.isAuthenticated && !isLoading" class="book-private-upload__empty">还没有关联的电子书</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { IconUpload as Upload } from '@tabler/icons-vue'
import PButton from '@/components/ui/PButton.vue'
import { ApiErrorResponseError } from '@/api/client'
import {
  linkBookImportToCatalog,
  listBookImports,
  uploadBookFile,
  type BookImportSession,
} from '@/api/books'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  workId: string
  editionId?: string
  title?: string
  author?: string
}>()

const authStore = useAuthStore()
const fileInput = ref<HTMLInputElement | null>(null)
const imports = ref<BookImportSession[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref('')
const message = ref('')

const relatedImports = computed(() => imports.value.filter((item) => (
  props.editionId ? item.edition_id === props.editionId : item.work_id === props.workId
)))

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function statusLabel(item: BookImportSession): string {
  if (item.status === 'failed' || item.processing_status === 'failed') return '处理失败'
  if (item.processing_status === 'private_available' || item.status === 'metadata_ready') return '可以阅读'
  if (item.processing_status === 'processing') return '正在解析'
  if (item.status === 'scanning' || item.processing_status === 'scanning') return '等待扫描'
  return '处理中'
}

async function loadImports() {
  if (!authStore.isAuthenticated) return
  isLoading.value = true
  try {
    imports.value = await listBookImports()
  } catch (error) {
    if (error instanceof ApiErrorResponseError && error.status === 401) return
    errorMessage.value = '电子书列表加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const extension = file.name.toLowerCase().split('.').pop()
  if (!extension || !['epub', 'pdf', 'txt', 'cbz', 'cbr', 'mobi', 'azw3'].includes(extension)) {
    errorMessage.value = '仅支持 EPUB、PDF、TXT、CBZ、CBR、MOBI 和 AZW3 文件'
    return
  }

  isUploading.value = true
  uploadProgress.value = 0
  errorMessage.value = ''
  message.value = ''
  try {
    const session = await uploadBookFile(file, {
      title: props.title,
      author: props.author,
      onProgress: ({ loaded, total }) => {
        uploadProgress.value = total > 0 ? Math.round((loaded / total) * 100) : 0
      },
    })
    const linked = await linkBookImportToCatalog(session.id, {
      work_id: props.workId,
      edition_id: props.editionId,
    })
    imports.value = [linked, ...imports.value.filter((item) => item.id !== linked.id)]
    message.value = '电子书已上传并关联到当前书籍'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '电子书上传失败，请稍后重试'
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

onMounted(() => { void loadImports() })
watch(() => authStore.isAuthenticated, (authenticated) => {
  if (authenticated) void loadImports()
  else imports.value = []
})
</script>

<style scoped>
.book-private-upload__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.book-private-upload__header h2 { margin: 0; }
.book-private-upload__header p,
.book-private-upload__feedback,
.book-private-upload__empty { margin: 0.35rem 0 0; color: var(--a-color-muted); font-size: 0.88rem; }
.book-private-upload__feedback--error { color: var(--a-color-danger); }
.book-private-upload__input { display: none; }
.book-private-upload__list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--a-color-border-soft); }
.book-private-upload__list li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.7rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.book-private-upload__list strong,
.book-private-upload__list span { display: block; }
.book-private-upload__list span { margin-top: 0.2rem; color: var(--a-color-muted); font-size: 0.8125rem; }
.book-private-upload__list a { color: var(--a-color-fg); text-decoration: none; }
.book-private-upload__list a:hover { color: var(--a-color-primary); text-decoration: underline; }
.book-private-upload__status { flex-shrink: 0; color: var(--a-color-muted); font-size: 0.8125rem; text-align: right; }
.book-private-upload__status a { display: block; margin-top: 0.2rem; color: var(--a-color-primary); }
@media (max-width: 540px) {
  .book-private-upload__header,
  .book-private-upload__list li { align-items: stretch; flex-direction: column; }
  .book-private-upload__status { text-align: left; }
}
</style>
