<template>
  <PSheet :show="show" title="导入图书" mode="full" close-type="header" @close="handleClose">
    <form id="book-create-form" class="book-create" @submit.prevent="create">
      <ol class="book-create__steps" aria-label="导入进度">
        <li v-for="(label, index) in stepLabels" :key="label" :class="{ 'is-current': step === index + 1, 'is-done': step > index + 1 }">
          <span>{{ index + 1 }}</span>{{ label }}
        </li>
      </ol>

      <section v-if="step === 1" class="book-create__section" aria-labelledby="book-create-upload">
        <h2 id="book-create-upload">上传电子书</h2>
        <p class="book-create__hint">文件安全处理完成后会自动公开阅读；你可以在接下来的步骤填写书目资料。</p>
        <input
          ref="fileInput"
          class="book-create__file-input"
          type="file"
          accept=".epub,.pdf,.txt,.cbz,.cbr,.mobi,.azw3,application/epub+zip,application/pdf,text/plain,application/vnd.comicbook+zip,application/vnd.rar,application/x-mobipocket-ebook,application/vnd.amazon.mobi8-ebook"
          aria-label="选择电子书文件"
          @change="handleFileChange"
        />
        <PButton type="button" variant="secondary" :disabled="uploading || Boolean(uploadSession)" @click="fileInput?.click()">
          <Upload :size="16" aria-hidden="true" />
          <span>{{ uploadSession ? '已选择文件' : '选择 EPUB、PDF 等电子书' }}</span>
        </PButton>
        <p v-if="fileName" class="book-create__file-name">{{ fileName }}</p>
        <div v-if="uploading" class="book-create__progress" aria-live="polite">
          <span>正在上传 {{ uploadProgress }}%</span>
          <progress :value="uploadProgress" max="100" aria-label="电子书上传进度" />
        </div>
        <p v-if="uploadSession" class="book-create__upload-status" aria-live="polite">
          文件已上传 · {{ uploadStatus }}。填写书目资料后即可创建并关联。
        </p>
      </section>

      <section v-else-if="step === 2" class="book-create__section" aria-labelledby="book-create-details">
        <h2 id="book-create-details">作品信息</h2>
        <p class="book-create__hint">先填写作品本身的信息。作者一行一位；文字会按你填写的内容保存，不自动翻译。</p>
        <PInput v-model="draft.title" label="书名" required maxlength="500" autocomplete="off" />
        <div class="book-create__columns">
          <PInput v-model="draft.originalTitle" label="原名" maxlength="500" />
          <PInput v-model="draft.subtitle" label="副标题" maxlength="500" />
        </div>
        <PInput v-model="draft.language" label="作品语言" maxlength="64" hint="例如：中文、英语；可留空。" />
        <PTextarea v-model="draft.authors" label="作者" :rows="3" maxlength="2000" hint="可填写多位作者，每行一位。可暂不填写。" />
        <PTextarea v-model="draft.description" label="简介" :rows="5" maxlength="20000" />
      </section>

      <section v-else-if="step === 3" class="book-create__section" aria-labelledby="book-create-edition">
        <h2 id="book-create-edition">首个版本</h2>
        <p class="book-create__hint">新作品会同时创建一个版本。出版社会作为独立资料保存，可按原文填写。</p>
        <PInput v-model="draft.editionTitle" label="版本名称" maxlength="500" hint="可填写具体版次或留空。" />
        <PInput v-model="draft.publisher" label="出版社" maxlength="500" />
        <PInput v-model="draft.producer" label="出品方" maxlength="500" />
        <div class="book-create__columns">
          <PInput v-model="draft.isbn10" label="ISBN-10" maxlength="32" />
          <PInput v-model="draft.isbn13" label="ISBN-13" maxlength="32" />
        </div>
        <div class="book-create__columns">
          <PInput v-model="draft.editionLanguage" label="版本语言" maxlength="64" />
          <PInput v-model="draft.publishedDate" label="出版日期" type="date" />
        </div>
        <div class="book-create__columns">
          <PInput v-model="draft.pageCount" label="页数" type="number" min="0" />
          <PInput v-model="draft.binding" label="装帧" maxlength="128" />
        </div>
        <PInput v-model="draft.coverURL" label="封面图片 URL" type="url" maxlength="4096" />
      </section>

      <section v-else class="book-create__section" aria-labelledby="book-create-review">
        <h2 id="book-create-review">检查并创建</h2>
        <p class="book-create__hint">创建后作品立即进入公共目录。正文会在安全处理完成后公开，并关联到这本书；之后修改书目资料仍通过 Wiki 协作审核。</p>
        <dl class="book-create__summary">
          <div><dt>电子书文件</dt><dd>{{ fileName }}</dd></div>
          <div><dt>书名</dt><dd>{{ draft.title.trim() }}</dd></div>
          <div v-if="draft.originalTitle.trim()"><dt>原名</dt><dd>{{ draft.originalTitle.trim() }}</dd></div>
          <div v-if="authors.length"><dt>作者</dt><dd>{{ authors.join('、') }}</dd></div>
          <div v-if="draft.language.trim()"><dt>作品语言</dt><dd>{{ draft.language.trim() }}</dd></div>
          <div v-if="draft.publisher.trim()"><dt>出版社</dt><dd>{{ draft.publisher.trim() }}</dd></div>
          <div v-if="draft.producer.trim()"><dt>出品方</dt><dd>{{ draft.producer.trim() }}</dd></div>
          <div v-if="draft.isbn10.trim() || draft.isbn13.trim()"><dt>ISBN</dt><dd>{{ [draft.isbn13, draft.isbn10].filter(value => value.trim()).join(' · ') }}</dd></div>
          <div v-if="draft.publishedDate"><dt>出版日期</dt><dd>{{ draft.publishedDate }}</dd></div>
          <div v-if="draft.description.trim()"><dt>简介</dt><dd class="book-create__description">{{ draft.description.trim() }}</dd></div>
        </dl>
        <PInput v-model="draft.sourceURL" label="资料来源 URL（选填）" type="url" maxlength="4096" placeholder="https://" hint="填写后会作为作品和版本的资料来源记录。" />
      </section>

      <p v-if="errorMessage" class="book-create__error" role="alert">{{ errorMessage }}</p>
    </form>

    <template #footer>
      <div class="book-create__footer">
        <PButton v-if="step > 1" type="button" variant="ghost" :disabled="saving || uploading" @click="step--">上一步</PButton>
        <span class="book-create__footer-spacer" />
        <PButton type="button" variant="ghost" :disabled="saving || uploading" @click="handleClose">取消</PButton>
        <PButton v-if="step < 4" type="button" :disabled="uploading || (step === 1 && !uploadSession)" @click="nextStep">下一步</PButton>
        <PButton v-else type="submit" form="book-create-form" :loading="saving" :disabled="!uploadSession" loading-text="创建中...">创建并发布</PButton>
      </div>
    </template>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { IconUpload as Upload } from '@tabler/icons-vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { createPublicBook, uploadBookFile, type BookImportSession } from '@/api/books'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; created: [workId: string] }>()
const step = ref(1)
const saving = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadSession = ref<BookImportSession | null>(null)
const fileName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const errorMessage = ref('')
const stepLabels = ['上传', '作品', '版本', '确认']
const draft = reactive({
  title: '', originalTitle: '', subtitle: '', language: '', authors: '', description: '', editionTitle: '', publisher: '', producer: '',
  isbn10: '', isbn13: '', editionLanguage: '', publishedDate: '', pageCount: '', binding: '', coverURL: '', sourceURL: '',
})
const authors = computed(() => draft.authors.split('\n').map(name => name.trim()).filter(Boolean))

watch(() => props.show, (show) => {
  if (!show) return
  step.value = 1
  uploading.value = false
  uploadProgress.value = 0
  uploadSession.value = null
  fileName.value = ''
  errorMessage.value = ''
})

function nextStep() {
  errorMessage.value = ''
  if (step.value === 2 && !draft.title.trim()) {
    errorMessage.value = '请先填写书名。'
    return
  }
  step.value = Math.min(4, step.value + 1)
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const extension = file.name.toLowerCase().split('.').pop()
  if (!extension || !['epub', 'pdf', 'txt', 'cbz', 'cbr', 'mobi', 'azw3'].includes(extension)) {
    errorMessage.value = '仅支持 EPUB、PDF、TXT、CBZ、CBR、MOBI 和 AZW3 文件。'
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  fileName.value = file.name
  errorMessage.value = ''
  try {
    uploadSession.value = await uploadBookFile(file, {
      title: draft.title.trim(),
      author: authors.value.join('、'),
      onProgress: ({ loaded, total }) => { uploadProgress.value = total > 0 ? Math.round(loaded / total * 100) : 0 },
    })
    uploadProgress.value = 100
  } catch (error) {
    fileName.value = ''
    errorMessage.value = error instanceof Error ? error.message : '电子书上传失败，请检查网络后重试。'
  } finally {
    uploading.value = false
  }
}

const uploadStatus = computed(() => {
  if (uploadSession.value?.processing_status === 'failed' || uploadSession.value?.status === 'failed') return '处理失败，可在书架重试'
  if (uploadSession.value?.processing_status === 'private_available' || uploadSession.value?.status === 'metadata_ready') return '安全处理完成'
  return '等待安全处理，完成后自动公开'
})

async function handleClose() {
  if (uploading.value || saving.value) {
    errorMessage.value = '请等待当前操作完成后再关闭。'
    return
  }
  if (uploadSession.value && !window.confirm('文件仍会继续安全处理并公开，但不会关联到书目。确定关闭吗？')) return
  emit('close')
}

async function create() {
  if (saving.value || !draft.title.trim()) {
    errorMessage.value = '请先填写书名。'
    step.value = 1
    return
  }
  if (!uploadSession.value) {
    errorMessage.value = '请先上传一本电子书。'
    step.value = 1
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const work = await createPublicBook({
      import_id: uploadSession.value.id,
      title: draft.title.trim(), subtitle: draft.subtitle.trim(), original_title: draft.originalTitle.trim(),
      description: draft.description.trim(), language: draft.language.trim(), authors: authors.value,
      edition: {
        title: draft.editionTitle.trim(), publisher: draft.publisher.trim(), producer: draft.producer.trim(), isbn10: draft.isbn10.trim(), isbn13: draft.isbn13.trim(),
        language: draft.editionLanguage.trim(), published_date: draft.publishedDate, page_count: Number(draft.pageCount) || 0,
        binding: draft.binding.trim(), cover_url: draft.coverURL.trim(),
      },
      source_url: draft.sourceURL.trim(),
    })
    emit('created', work.id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '创建图书失败，请检查信息后重试。'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.book-create { display: grid; gap: 1.5rem; max-width: 54rem; margin: 0 auto; padding: 1.5rem 1.25rem 2rem; }
.book-create__file-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
.book-create__file-name, .book-create__upload-status { margin: 0; color: var(--a-color-text-secondary); overflow-wrap: anywhere; }
.book-create__progress { display: grid; gap: .5rem; color: var(--a-color-text-secondary); }
.book-create__progress progress { width: 100%; accent-color: var(--a-color-primary); }
.book-create__steps { display: flex; gap: 1rem; padding: 0; margin: 0; list-style: none; color: var(--a-color-muted); }
.book-create__steps li { display: inline-flex; align-items: center; gap: .5rem; font-size: .9rem; }
.book-create__steps li span { display: grid; width: 1.75rem; height: 1.75rem; place-items: center; border: 1px solid var(--a-color-border); border-radius: 50%; }
.book-create__steps li.is-current { color: var(--a-color-text); font-weight: 600; }
.book-create__steps li.is-current span, .book-create__steps li.is-done span { color: var(--a-color-primary); border-color: var(--a-color-primary); }
.book-create__section { display: grid; gap: 1rem; }
.book-create__section h2 { margin: 0; font-size: 1.35rem; color: var(--a-color-text); }
.book-create__hint { margin: -.5rem 0 .25rem; color: var(--a-color-text-secondary); line-height: 1.6; }
.book-create__columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.book-create__summary { margin: 0; border-top: 1px solid var(--a-color-border-soft); }
.book-create__summary div { display: grid; grid-template-columns: 8rem minmax(0, 1fr); gap: 1rem; padding: .8rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.book-create__summary dt { color: var(--a-color-text-secondary); }
.book-create__summary dd { min-width: 0; margin: 0; color: var(--a-color-text); overflow-wrap: anywhere; }
.book-create__description { white-space: pre-wrap; }
.book-create__error { margin: 0; color: var(--a-color-danger); }
.book-create__footer { display: flex; align-items: center; gap: .75rem; width: 100%; }
.book-create__footer-spacer { flex: 1; }
@media (max-width: 640px) {
  .book-create { padding: 1rem; }
  .book-create__columns { grid-template-columns: 1fr; }
  .book-create__summary div { grid-template-columns: 6.5rem minmax(0, 1fr); }
}
</style>
