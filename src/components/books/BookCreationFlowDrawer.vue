<template>
  <PSheet
    :show="show"
    title="添加图书"
    side="right"
    close-type="header"
    @close="$emit('close')"
  >
    <div class="book-creation">
      <nav class="book-creation__steps" aria-label="创建步骤">
        <button
          type="button"
          class="book-creation__step-btn"
          :class="{ 'is-active': step === 1, 'is-completed': step > 1 }"
          @click="step > 1 && (step = 1)"
        >
          <span class="book-creation__step-num">1</span>
          <span>文件解析</span>
        </button>
        <span class="book-creation__step-sep">/</span>
        <button
          type="button"
          class="book-creation__step-btn"
          :class="{ 'is-active': step === 2, 'is-completed': step > 2 }"
          :disabled="step < 2"
          @click="step > 2 && (step = 2)"
        >
          <span class="book-creation__step-num">2</span>
          <span>作者与版本</span>
        </button>
        <span class="book-creation__step-sep">/</span>
        <button
          type="button"
          class="book-creation__step-btn"
          :class="{ 'is-active': step === 3 }"
          :disabled="step < 3"
        >
          <span class="book-creation__step-num">3</span>
          <span>预览入库</span>
        </button>
      </nav>

      <!-- 步骤 1: 选取与解析文件 -->
      <section v-if="step === 1" class="book-creation__panel">
        <header class="book-creation__panel-header">
          <h3>第 1 步：选取文件与解析</h3>
          <p>支持 EPUB、PDF、TXT、MOBI 等格式，上传后将自动进入公共书库。</p>
        </header>

        <div
          class="book-creation__dropzone"
          :class="{ 'is-dragover': isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="handleDrop"
          @click="triggerFilePicker"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="book-creation__hidden-input"
            accept=".epub,.pdf,.txt,.mobi,.azw3,.cbz,.cbr"
            @change="handleFileChange"
          />
          <div class="book-creation__dropzone-content">
            <Upload :size="28" aria-hidden="true" />
            <p v-if="!selectedFile">拖拽电子书到此处，或点击浏览文件</p>
            <div v-else class="book-creation__file-info">
              <strong>{{ selectedFile.name }}</strong>
              <small>{{ formatSize(selectedFile.size) }}</small>
            </div>
          </div>
        </div>

        <div v-if="selectedFile" class="book-creation__initial-meta">
          <PInput
            id="book-title-guess"
            v-model="draftTitle"
            label="识别书名"
            required
            maxlength="200"
          />
          <PInput
            id="book-author-guess"
            v-model="draftAuthor"
            label="识别作者"
            maxlength="100"
          />
        </div>

        <footer class="book-creation__actions">
          <PButton
            variant="primary"
            :disabled="!selectedFile || !draftTitle.trim()"
            @click="step = 2"
          >
            下一步：确认信息
          </PButton>
        </footer>
      </section>

      <!-- 步骤 2: 作者与版本信息 -->
      <section v-else-if="step === 2" class="book-creation__panel">
        <header class="book-creation__panel-header">
          <h3>第 2 步：作者与出版信息</h3>
          <p>补充作品基础出版档案，便于社区检索与归类。</p>
        </header>

        <form class="book-creation__form" @submit.prevent="step = 3">
          <PInput
            id="book-author-name"
            v-model="draftAuthor"
            label="作者姓名"
            placeholder="如：刘慈欣"
            required
          />
          <PInput
            id="book-publisher"
            v-model="draftPublisher"
            label="出版社 / 发行方"
            placeholder="如：重庆出版社"
          />
          <PInput
            id="book-isbn"
            v-model="draftIsbn"
            label="ISBN（可选）"
            placeholder="978-..."
          />
          <PTextarea
            id="book-desc"
            v-model="draftDescription"
            label="内容简介"
            :rows="3"
            placeholder="简要描述本书主要内容"
          />

          <footer class="book-creation__actions">
            <PButton variant="secondary" @click="step = 1">上一步</PButton>
            <PButton variant="primary" type="submit">下一步：确认发布</PButton>
          </footer>
        </form>
      </section>

      <!-- 步骤 3: 预览与提交入库 -->
      <section v-else class="book-creation__panel">
        <header class="book-creation__panel-header">
          <h3>第 3 步：确认并发布到书库</h3>
          <p>图书入库后将同步加入您的个人书架，并对全社区开放阅读。</p>
        </header>

        <div class="book-creation__preview-card">
          <div class="book-creation__preview-spine" />
          <div class="book-creation__preview-body">
            <h4>{{ draftTitle }}</h4>
            <p>{{ draftAuthor || '未知作者' }}</p>
            <small v-if="draftPublisher">{{ draftPublisher }}</small>
            <span class="book-creation__preview-format">{{ fileFormat.toUpperCase() }}</span>
          </div>
        </div>

        <p v-if="uploadError" class="book-creation__error" role="alert">{{ uploadError }}</p>
        <p v-if="isSubmitting" class="book-creation__progress" aria-live="polite">
          正在入库并解析图书文件...
        </p>

        <footer class="book-creation__actions">
          <PButton variant="secondary" :disabled="isSubmitting" @click="step = 2">上一步</PButton>
          <PButton
            variant="primary"
            :loading="isSubmitting"
            @click="submitCreation"
          >
            发布图书
          </PButton>
        </footer>
      </section>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconUpload as Upload } from '@tabler/icons-vue'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { uploadBookFile, submitBookEdit, submitPublicationRequest } from '@/api/books'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', workId: string, assetId: string): void
}>()

const step = ref<1 | 2 | 3>(1)
const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)

const draftTitle = ref('')
const draftAuthor = ref('')
const draftPublisher = ref('')
const draftIsbn = ref('')
const draftDescription = ref('')

const isSubmitting = ref(false)
const uploadError = ref('')

const fileFormat = computed(() => {
  if (!selectedFile.value) return 'TXT'
  const name = selectedFile.value.name
  const ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase()
  return ext || 'TXT'
})

watch(() => props.show, (val) => {
  if (!val) {
    resetState()
  }
})

function resetState() {
  step.value = 1
  selectedFile.value = null
  draftTitle.value = ''
  draftAuthor.value = ''
  draftPublisher.value = ''
  draftIsbn.value = ''
  draftDescription.value = ''
  uploadError.value = ''
  isSubmitting.value = false
}

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    processFile(target.files[0])
  }
}

function handleDrop(e: DragEvent) {
  isDragOver.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    processFile(e.dataTransfer.files[0])
  }
}

function processFile(file: File) {
  selectedFile.value = file
  // 智能推断书名
  const baseName = file.name.replace(/\.[^/.]+$/, '')
  draftTitle.value = baseName
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

async function submitCreation() {
  if (!selectedFile.value) return
  isSubmitting.value = true
  uploadError.value = ''

  try {
    // 1. 上传电子书
    const importSession = await uploadBookFile(selectedFile.value)
    
    // 2. 提交公共作品元数据
    const editPayload = {
      title: draftTitle.value,
      description: draftDescription.value,
      language: 'zh',
      author_name: draftAuthor.value,
      publisher: draftPublisher.value,
      isbn: draftIsbn.value,
    }

    const editRes = await submitBookEdit({
      type: 'create',
      entity_type: 'work',
      payload: editPayload,
      sources: [{ url: window.location.origin, kind: 'direct_upload', title: '用户公开贡献' }],
    })

    const workId = editRes.entity_id || importSession.work_id || ''
    const assetId = importSession.asset_id || importSession.id

    // 3. 关联为公共正文
    try {
      if (assetId) {
        await submitPublicationRequest(assetId, {
          work_id: workId,
          license_type: 'public_domain',
          rights_holder: draftAuthor.value || 'Public',
          source_url: window.location.origin,
          declaration: '我确认本书内容符合公开阅读分发规范',
        })
      }
    } catch {
      // 容错处理
    }

    emit('created', workId, assetId)
    emit('close')
  } catch (err: unknown) {
    uploadError.value = err instanceof Error ? err.message : '上传入库失败，请重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.book-creation {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.5rem 0;
}

.book-creation__steps {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.book-creation__step-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
}

.book-creation__step-btn.is-active {
  color: var(--a-color-primary);
}

.book-creation__step-btn.is-completed {
  color: var(--a-color-fg);
}

.book-creation__step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  font-size: 0.75rem;
}

.book-creation__step-btn.is-active .book-creation__step-num {
  background: var(--a-color-primary);
  color: var(--a-color-bg);
}

.book-creation__step-sep {
  color: var(--a-color-border-soft);
  font-size: 0.8rem;
}

.book-creation__panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.book-creation__panel-header h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 500;
}

.book-creation__panel-header p {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.book-creation__dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.book-creation__dropzone:hover,
.book-creation__dropzone.is-dragover {
  border-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
}

.book-creation__dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--a-color-muted);
  text-align: center;
}

.book-creation__file-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--a-color-fg);
}

.book-creation__hidden-input {
  display: none;
}

.book-creation__initial-meta {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.book-creation__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.book-creation__preview-card {
  display: flex;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  overflow: hidden;
}

.book-creation__preview-spine {
  width: 0.5rem;
  background: var(--a-color-primary);
}

.book-creation__preview-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  flex: 1;
}

.book-creation__preview-body h4 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 500;
}

.book-creation__preview-body p {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.book-creation__preview-format {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-muted);
  font-size: 0.7rem;
  width: fit-content;
}

.book-creation__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.book-creation__error {
  color: var(--a-color-danger);
  font-size: 0.85rem;
}

.book-creation__progress {
  color: var(--a-color-muted);
  font-size: 0.85rem;
}
</style>
