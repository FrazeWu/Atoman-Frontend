<template>
  <PSheet
    :show="show"
    title="添加图书"
    side="right"
    close-type="header"
    @close="$emit('close')"
  >
    <div class="book-creation">
      <!-- 顶部 3 步骤导航 -->
      <nav class="book-creation__steps" aria-label="创建步骤">
        <button
          type="button"
          class="book-creation__step-btn"
          :class="{ 'is-active': step === 1, 'is-completed': step > 1 }"
          @click="step > 1 && (step = 1)"
        >
          <span class="book-creation__step-num">1</span>
          <span>上传</span>
        </button>
        <span class="book-creation__step-sep">/</span>
        <button
          type="button"
          class="book-creation__step-btn"
          :class="{ 'is-active': step === 2, 'is-completed': step > 2 }"
          :disabled="!selectedFile"
          @click="step > 2 && (step = 2)"
        >
          <span class="book-creation__step-num">2</span>
          <span>信息填写</span>
        </button>
        <span class="book-creation__step-sep">/</span>
        <button
          type="button"
          class="book-creation__step-btn"
          :class="{ 'is-active': step === 3 }"
          :disabled="!selectedFile || !draftTitle.trim()"
        >
          <span class="book-creation__step-num">3</span>
          <span>提交</span>
        </button>
      </nav>

      <!-- 步骤 1: 上传电子书 -->
      <section v-if="step === 1" class="book-creation__panel">
        <header class="book-creation__panel-header">
          <h3>第 1 步：上传电子书</h3>
          <p>选择或拖拽电子书文件，支持 EPUB、PDF、TXT、MOBI、AZW3 等格式。</p>
        </header>

        <div
          class="book-creation__dropzone"
          :class="{ 'is-dragover': isDragOver, 'has-file': Boolean(selectedFile) }"
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
              <div class="book-creation__file-name-row">
                <span class="book-creation__badge">{{ fileFormat.toUpperCase() }}</span>
                <strong>{{ selectedFile.name }}</strong>
              </div>
              <small>{{ formatSize(selectedFile.size) }} · 点击可更换文件</small>
            </div>
          </div>
        </div>

        <div v-if="selectedFile" class="book-creation__extract-card">
          <div class="book-creation__extract-header">
            <span>智能推测信息</span>
          </div>
          <div class="book-creation__extract-body">
            <PInput
              id="book-title-guess"
              v-model="draftTitle"
              label="识别书名"
              required
              maxlength="200"
              placeholder="从文件名识别的书名"
            />
            <PInput
              id="book-author-guess"
              v-model="quickAuthorInput"
              label="识别作者"
              maxlength="200"
              placeholder="如：吕思勉 著 / 李不白 绘"
              @blur="syncQuickAuthor"
            />
          </div>
        </div>

        <footer class="book-creation__actions">
          <PButton
            variant="primary"
            :disabled="!selectedFile || !draftTitle.trim()"
            @click="goToStep2"
          >
            下一步：信息填写
          </PButton>
        </footer>
      </section>

      <!-- 步骤 2: 信息填写 -->
      <section v-else-if="step === 2" class="book-creation__panel">
        <header class="book-creation__panel-header">
          <h3>第 2 步：信息填写</h3>
          <p>完善作品基础档案与出版信息，便于社区检索与归类。</p>
        </header>

        <form class="book-creation__form" @submit.prevent="step = 3">
          <!-- 1. 基础信息 -->
          <div class="book-creation__group">
            <h4 class="book-creation__group-title">基础信息</h4>
            <PInput
              id="book-title"
              v-model="draftTitle"
              label="书名"
              placeholder="如：地图上的中国通史"
              required
              maxlength="200"
            />
            <div class="book-creation__row">
              <PInput
                id="book-original-title"
                v-model="draftOriginalTitle"
                label="原作名（选填）"
                placeholder="如：中国通史"
                maxlength="200"
              />
              <PInput
                id="book-subtitle"
                v-model="draftSubtitle"
                label="副标题（选填）"
                maxlength="200"
              />
            </div>
          </div>

          <!-- 2. 作者与创作者 -->
          <div class="book-creation__group">
            <div class="book-creation__group-header">
              <h4 class="book-creation__group-title">作者与创作团队</h4>
              <button
                type="button"
                class="book-creation__add-btn"
                @click="addAuthor"
              >
                + 添加作者
              </button>
            </div>

            <div class="book-creation__authors-list">
              <div
                v-for="(auth, index) in draftAuthors"
                :key="index"
                class="book-creation__author-row"
              >
                <div class="book-creation__author-name">
                  <PInput
                    :id="`author-name-${index}`"
                    v-model="auth.name"
                    label=""
                    placeholder="作者姓名，如：吕思勉"
                    required
                  />
                </div>
                <div class="book-creation__author-role">
                  <select
                    v-model="auth.role"
                    class="book-creation__role-select"
                    aria-label="身份角色"
                  >
                    <option value="著">著</option>
                    <option value="绘">绘</option>
                    <option value="译">译</option>
                    <option value="编">编</option>
                    <option value="摄影">摄影</option>
                    <option value="主编">主编</option>
                    <option value="编著">编著</option>
                  </select>
                </div>
                <button
                  v-if="draftAuthors.length > 1"
                  type="button"
                  class="book-creation__remove-btn"
                  title="移除此创作者"
                  @click="removeAuthor(index)"
                >
                  &times;
                </button>
              </div>
            </div>

            <div class="book-creation__quick-author-hint">
              <PInput
                id="quick-author-sync"
                v-model="quickAuthorInput"
                label="或直接粘贴作者串"
                placeholder="如：吕思勉 著 / 李不白 绘"
                @blur="syncQuickAuthor"
              />
            </div>
          </div>

          <!-- 3. 出版与版本信息 -->
          <div class="book-creation__group">
            <h4 class="book-creation__group-title">出版与版本信息</h4>
            <div class="book-creation__row">
              <PInput
                id="book-publisher"
                v-model="draftPublisher"
                label="出版社"
                placeholder="如：人民日报出版社"
              />
              <PInput
                id="book-producer"
                v-model="draftProducer"
                label="出品方"
                placeholder="如：鹿柴文化"
              />
            </div>

            <div class="book-creation__row">
              <PInput
                id="book-published-date"
                v-model="draftPublishedDate"
                label="出版年 / 日期"
                placeholder="如：2023-8"
              />
              <PInput
                id="book-isbn"
                v-model="draftIsbn"
                label="ISBN"
                placeholder="如：9787511575920"
              />
            </div>

            <div class="book-creation__row">
              <PInput
                id="book-page-count"
                v-model="draftPageCount"
                label="页数"
                type="number"
                placeholder="如：615"
              />
              <PInput
                id="book-price"
                v-model="draftPrice"
                label="定价"
                placeholder="如：199.00元"
              />
            </div>

            <div class="book-creation__binding-field">
              <label class="book-creation__field-label">装帧</label>
              <div class="book-creation__chips">
                <button
                  v-for="b in commonBindings"
                  :key="b"
                  type="button"
                  class="book-creation__chip"
                  :class="{ 'is-selected': draftBinding === b }"
                  @click="draftBinding = b"
                >
                  {{ b }}
                </button>
                <input
                  v-model="draftBinding"
                  type="text"
                  class="book-creation__chip-input"
                  placeholder="自定义装帧..."
                />
              </div>
            </div>
          </div>

          <!-- 4. 封面与简介 -->
          <div class="book-creation__group">
            <h4 class="book-creation__group-title">封面与内容简介</h4>
            <div class="book-creation__cover-field">
              <div class="book-creation__cover-inputs">
                <PInput
                  id="book-cover-url"
                  v-model="draftCoverUrl"
                  label="封面图片 URL"
                  placeholder="https://..."
                />
                <div class="book-creation__cover-local">
                  <input
                    ref="coverInputRef"
                    type="file"
                    class="book-creation__hidden-input"
                    accept="image/*"
                    @change="handleCoverFileChange"
                  />
                  <PButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    @click="coverInputRef?.click()"
                  >
                    选择本地封面图片
                  </PButton>
                </div>
              </div>
              <div class="book-creation__cover-preview">
                <img
                  v-if="coverPreviewUrl"
                  :src="coverPreviewUrl"
                  alt="封面预览"
                  class="book-creation__cover-img"
                />
                <div v-else class="book-creation__cover-empty">
                  <span>封面</span>
                </div>
              </div>
            </div>

            <PTextarea
              id="book-desc"
              v-model="draftDescription"
              label="内容简介"
              :rows="4"
              placeholder="简要描述本书主要内容与背景"
            />
          </div>

          <footer class="book-creation__actions">
            <PButton variant="secondary" @click="step = 1">上一步</PButton>
            <PButton
              variant="primary"
              type="submit"
              :disabled="!draftTitle.trim()"
            >
              下一步：提交
            </PButton>
          </footer>
        </form>
      </section>

      <!-- 步骤 3: 提交与确认 -->
      <section v-else class="book-creation__panel">
        <header class="book-creation__panel-header">
          <h3>第 3 步：确认信息并提交</h3>
          <p>确认后直接创建公开书目；正文通过自动安全检查后立即开放阅读，无需等待人工审核。</p>
        </header>

        <!-- 豆瓣风格图书档案卡片 -->
        <article class="book-douban-card">
          <div class="book-douban-card__left">
            <div class="book-douban-card__cover">
              <img
                v-if="coverPreviewUrl"
                :src="coverPreviewUrl"
                alt="图书封面"
                class="book-douban-card__img"
              />
              <div v-else class="book-douban-card__spine-cover">
                <span class="book-douban-card__spine-line" />
                <strong class="book-douban-card__spine-title">{{ draftTitle }}</strong>
              </div>
            </div>
          </div>

          <div class="book-douban-card__right">
            <h3 class="book-douban-card__title">{{ draftTitle }}</h3>
            <ul class="book-douban-card__meta-list">
              <li v-if="authorsSummary">
                <span class="book-douban-card__meta-label">作者:</span>
                <span class="book-douban-card__meta-val">{{ authorsSummary }}</span>
              </li>
              <li v-if="draftPublisher">
                <span class="book-douban-card__meta-label">出版社:</span>
                <span class="book-douban-card__meta-val">{{ draftPublisher }}</span>
              </li>
              <li v-if="draftProducer">
                <span class="book-douban-card__meta-label">出品方:</span>
                <span class="book-douban-card__meta-val">{{ draftProducer }}</span>
              </li>
              <li v-if="draftPublishedDate">
                <span class="book-douban-card__meta-label">出版年:</span>
                <span class="book-douban-card__meta-val">{{ draftPublishedDate }}</span>
              </li>
              <li v-if="draftIsbn">
                <span class="book-douban-card__meta-label">ISBN:</span>
                <span class="book-douban-card__meta-val">{{ draftIsbn }}</span>
              </li>
              <li v-if="draftPageCount">
                <span class="book-douban-card__meta-label">页数:</span>
                <span class="book-douban-card__meta-val">{{ draftPageCount }}</span>
              </li>
              <li v-if="draftBinding">
                <span class="book-douban-card__meta-label">装帧:</span>
                <span class="book-douban-card__meta-val">{{ draftBinding }}</span>
              </li>
              <li v-if="draftPrice">
                <span class="book-douban-card__meta-label">定价:</span>
                <span class="book-douban-card__meta-val">{{ draftPrice }}</span>
              </li>
              <li v-if="draftOriginalTitle">
                <span class="book-douban-card__meta-label">原作名:</span>
                <span class="book-douban-card__meta-val">{{ draftOriginalTitle }}</span>
              </li>
            </ul>

            <div class="book-douban-card__asset-pill">
              <span class="book-creation__badge">{{ fileFormat.toUpperCase() }}</span>
              <span class="book-douban-card__file-name">{{ selectedFile?.name }}</span>
              <small>{{ formatSize(selectedFile?.size || 0) }}</small>
            </div>
          </div>
        </article>

        <!-- 简介预览 -->
        <div v-if="draftDescription.trim()" class="book-creation__desc-preview">
          <h4>内容简介</h4>
          <p>{{ draftDescription }}</p>
        </div>

        <label class="book-creation__rights-confirmation">
          <input v-model="publicDistributionConfirmed" type="checkbox" />
          <span>我确认有权公开分享这本电子书，并理解上传后所有人都可以阅读。</span>
        </label>

        <p v-if="uploadError" class="book-creation__error" role="alert">{{ uploadError }}</p>
        <div v-if="isSubmitting" class="book-creation__progress">
          <p role="status" aria-live="polite" aria-atomic="true">{{ submitProgressLabel }}</p>
          <progress
            v-if="submitStage === 'upload'"
            class="book-creation__progress-bar"
            :value="uploadPercent"
            max="100"
            aria-label="电子书上传进度"
          />
          <span v-if="submitStage === 'upload'" aria-hidden="true">{{ uploadPercent }}%</span>
        </div>

        <footer class="book-creation__actions">
          <PButton variant="secondary" :disabled="isSubmitting" @click="step = 2">上一步</PButton>
          <PButton
            variant="primary"
            :loading="isSubmitting"
            :disabled="isSubmitting || !publicDistributionConfirmed"
            @click="submitCreation"
          >
            创建并公开
          </PButton>
        </footer>
      </section>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Upload } from 'lucide-vue-next'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { apiPostMultipart } from '@/api/client'
import { uploadBookFile, createPublicBook, getBookImport } from '@/api/books'
import { useApi } from '@/composables/useApi'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', workId: string, publishedAssetId: string, notice: string): void
}>()

const api = useApi()

const step = ref<1 | 2 | 3>(1)
const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const coverFile = ref<File | null>(null)

// 基础信息
const draftTitle = ref('')
const draftOriginalTitle = ref('')
const draftSubtitle = ref('')

// 作者团队
interface AuthorItem {
  name: string
  role: string
}
const draftAuthors = ref<AuthorItem[]>([
  { name: '', role: '著' },
])
const quickAuthorInput = ref('')

// 出版信息
const draftPublisher = ref('')
const draftProducer = ref('')
const draftPublishedDate = ref('')
const draftIsbn = ref('')
const draftPageCount = ref('')
const draftBinding = ref('精装')
const draftPrice = ref('')

const commonBindings = ['精装', '平装', '线装', '电子书']

// 封面与简介
const draftCoverUrl = ref('')
const localCoverPreview = ref('')
const draftDescription = ref('')

const isSubmitting = ref(false)
const uploadError = ref('')
const publicDistributionConfirmed = ref(false)
const uploadPercent = ref(0)
const submitStage = ref<'cover' | 'upload' | 'catalog' | 'publish'>('upload')
const submitProgressLabel = computed(() => {
  if (submitStage.value === 'cover') return '正在上传封面...'
  if (submitStage.value === 'upload') return '正在上传电子书...'
  if (submitStage.value === 'catalog') return '正在创建公开书目...'
  return '正在自动检查正文，检查通过后立即公开...'
})

const fileFormat = computed(() => {
  if (!selectedFile.value) return 'EPUB'
  const name = selectedFile.value.name
  const ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase()
  return ext || 'EPUB'
})

const coverPreviewUrl = computed(() => {
  return localCoverPreview.value || draftCoverUrl.value.trim()
})

const authorsSummary = computed(() => {
  const valid = draftAuthors.value.filter(a => a.name.trim())
  if (valid.length === 0) return quickAuthorInput.value.trim()
  return valid.map(a => `${a.name.trim()} ${a.role}`).join(' / ')
})

watch(() => props.show, (val) => {
  if (!val) {
    resetState()
  }
})

function resetState() {
  step.value = 1
  selectedFile.value = null
  coverFile.value = null
  localCoverPreview.value = ''
  draftTitle.value = ''
  draftOriginalTitle.value = ''
  draftSubtitle.value = ''
  draftAuthors.value = [{ name: '', role: '著' }]
  quickAuthorInput.value = ''
  draftPublisher.value = ''
  draftProducer.value = ''
  draftPublishedDate.value = ''
  draftIsbn.value = ''
  draftPageCount.value = ''
  draftBinding.value = '精装'
  draftPrice.value = ''
  draftCoverUrl.value = ''
  draftDescription.value = ''
  uploadError.value = ''
  publicDistributionConfirmed.value = false
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

function handleCoverFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    coverFile.value = file
    localCoverPreview.value = URL.createObjectURL(file)
  }
}

function processFile(file: File) {
  selectedFile.value = file
  // 智能推测书名与作者
  const rawBase = file.name.replace(/\.[^/.]+$/, '')
  // 尝试匹配 "作者 - 书名" 或 "书名 - 作者"
  if (rawBase.includes(' - ')) {
    const parts = rawBase.split(' - ')
    if (parts.length >= 2) {
      draftTitle.value = parts[1].trim()
      quickAuthorInput.value = parts[0].trim()
      syncQuickAuthor()
      return
    }
  }
  draftTitle.value = rawBase
}

function addAuthor() {
  draftAuthors.value.push({ name: '', role: '著' })
}

function removeAuthor(index: number) {
  if (draftAuthors.value.length > 1) {
    draftAuthors.value.splice(index, 1)
  }
}

function syncQuickAuthor() {
  const raw = quickAuthorInput.value.trim()
  if (!raw) return
  // 解析 "吕思勉 著 / 李不白 绘" 或逗号分隔
  const parts = raw.split(/[/,，、;\n]+/).map(p => p.trim()).filter(Boolean)
  if (parts.length > 0) {
    const parsed: AuthorItem[] = []
    const knownRoles = ['著', '绘', '译', '编', '摄影', '主编', '编著']
    for (const p of parts) {
      let matched = false
      for (const r of knownRoles) {
        if (p.endsWith(' ' + r) || p.endsWith(r)) {
          const name = p.replace(new RegExp(`\\s*${r}$`), '').trim()
          if (name) {
            parsed.push({ name, role: r })
            matched = true
            break
          }
        }
      }
      if (!matched) {
        parsed.push({ name: p, role: '著' })
      }
    }
    if (parsed.length > 0) {
      draftAuthors.value = parsed
    }
  }
}

function goToStep2() {
  syncQuickAuthor()
  step.value = 2
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

async function uploadCoverImage(): Promise<string> {
  if (!coverFile.value) return draftCoverUrl.value.trim()
  const formData = new FormData()
  formData.append('image', coverFile.value)
  const uploaded = await apiPostMultipart<{ url?: string }>(api.blog.uploadImage, formData)
  if (!uploaded.url?.trim()) throw new Error('封面上传失败，请重试')
  return uploaded.url
}

async function submitCreation() {
  if (!selectedFile.value || !publicDistributionConfirmed.value || isSubmitting.value) return
  isSubmitting.value = true
  uploadError.value = ''
  uploadPercent.value = 0

  try {
    // 0. 上传封面（若有本地封面图）
    let coverUrl = draftCoverUrl.value.trim()
    if (coverFile.value) {
      submitStage.value = 'cover'
      const uploaded = await uploadCoverImage()
      if (uploaded) coverUrl = uploaded
    }

    // 1. 上传电子书
    submitStage.value = 'upload'
    const importSession = await uploadBookFile(selectedFile.value, {
      title: draftTitle.value.trim(),
      author: authorsSummary.value,
      onProgress: ({ loaded, total }) => {
        uploadPercent.value = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
      },
    })

    // 2. 原子创建公共作品并关联已上传正文；安全处理完成后由后端自动公开。
    submitStage.value = 'catalog'
    const validAuthors = draftAuthors.value.filter(a => a.name.trim())
    const isbn = draftIsbn.value.trim()
    const work = await createPublicBook({
      import_id: importSession.id,
      title: draftTitle.value.trim(),
      original_title: draftOriginalTitle.value.trim(),
      subtitle: draftSubtitle.value.trim(),
      description: draftDescription.value.trim(),
      language: 'zh',
      authors: validAuthors.map(author => author.name.trim()),
      edition: {
        title: draftTitle.value.trim(),
        publisher: draftPublisher.value.trim(),
        producer: draftProducer.value.trim(),
        isbn10: isbn.replace(/[-\s]/g, '').length === 10 ? isbn : undefined,
        isbn13: isbn.replace(/[-\s]/g, '').length === 13 ? isbn : undefined,
        published_date: draftPublishedDate.value.trim(),
        page_count: draftPageCount.value ? Number(draftPageCount.value) : undefined,
        binding: draftBinding.value.trim(),
        cover_url: coverUrl,
      },
      source_url: window.location.origin,
      public_distribution_confirmed: true,
    })

    let publishedAssetId = importSession.published_asset_id || ''
    let latestImport = importSession
    if (!publishedAssetId) {
      submitStage.value = 'publish'
      for (let attempt = 0; attempt < 15; attempt += 1) {
        try {
          latestImport = await getBookImport(importSession.id)
        } catch {
          break
        }
        publishedAssetId = latestImport.published_asset_id || ''
        if (publishedAssetId || latestImport.status === 'failed' || latestImport.processing_status === 'quarantined') break
        if (attempt < 14) await new Promise(resolve => window.setTimeout(resolve, 1000))
      }
    }
    const notice = publishedAssetId
      ? ''
      : latestImport.status === 'failed' || latestImport.processing_status === 'quarantined'
        ? `书目已创建，但正文处理失败：${latestImport.error_message || '请到书架的上传记录中重试。'}`
        : '书目已创建，正文正在自动安全检查；检查通过后会直接公开，可在“书籍 → 可以阅读”中打开。'
    emit('created', work.id, publishedAssetId, notice)
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
  padding: 2.25rem 1.5rem;
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

.book-creation__dropzone.has-file {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 3%, var(--a-color-bg));
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
  align-items: center;
  gap: 0.35rem;
  color: var(--a-color-fg);
}

.book-creation__file-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.book-creation__badge {
  display: inline-flex;
  padding: 0.1rem 0.4rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-primary);
  color: var(--a-color-bg);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.2;
}

.book-creation__hidden-input {
  display: none;
}

.book-creation__extract-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.book-creation__extract-header {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.book-creation__extract-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.book-creation__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.book-creation__group {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.book-creation__group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.book-creation__group-title {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

.book-creation__add-btn {
  border: none;
  background: transparent;
  color: var(--a-color-primary);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.book-creation__add-btn:hover {
  text-decoration: underline;
}

.book-creation__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.book-creation__authors-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.book-creation__author-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.book-creation__author-name {
  flex: 1;
}

.book-creation__author-role {
  width: 5.5rem;
}

.book-creation__role-select {
  width: 100%;
  height: 2.25rem;
  padding: 0 0.5rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.85rem;
  outline: none;
}

.book-creation__role-select:focus {
  border-color: var(--a-color-primary);
}

.book-creation__remove-btn {
  width: 1.75rem;
  height: 2.25rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-creation__remove-btn:hover {
  color: var(--a-color-danger);
}

.book-creation__quick-author-hint {
  margin-top: 0.25rem;
}

.book-creation__binding-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.book-creation__field-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.book-creation__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.book-creation__chip {
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.82rem;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.book-creation__chip:hover {
  border-color: var(--a-color-primary);
}

.book-creation__chip.is-selected {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 10%, var(--a-color-bg));
  color: var(--a-color-primary);
  font-weight: 500;
}

.book-creation__chip-input {
  width: 7rem;
  height: 1.85rem;
  padding: 0 0.5rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.8rem;
  outline: none;
}

.book-creation__chip-input:focus {
  border-color: var(--a-color-primary);
}

.book-creation__cover-field {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.book-creation__cover-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.book-creation__cover-preview {
  width: 4.5rem;
  height: 6rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  overflow: hidden;
  background: var(--a-color-surface-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.book-creation__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-creation__cover-empty {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

/* 豆瓣风格图书档案卡片 */
.book-douban-card {
  display: flex;
  gap: 1.25rem;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.book-douban-card__left {
  flex-shrink: 0;
}

.book-douban-card__cover {
  width: 7.25rem;
  height: 10.25rem;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  overflow: hidden;
  background: var(--a-color-surface-muted);
  box-shadow: none;
}

.book-douban-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-douban-card__spine-cover {
  display: flex;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--a-color-surface-muted), var(--a-color-bg));
  position: relative;
}

.book-douban-card__spine-line {
  width: 0.45rem;
  height: 100%;
  background: var(--a-color-primary);
  flex-shrink: 0;
}

.book-douban-card__spine-title {
  padding: 0.75rem 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.35;
  color: var(--a-color-fg);
  word-break: break-all;
}

.book-douban-card__right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.book-douban-card__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--a-color-fg);
  line-height: 1.3;
}

.book-douban-card__meta-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.book-douban-card__meta-list li {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 0.85rem;
  line-height: 1.4;
}

.book-douban-card__meta-label {
  color: var(--a-color-muted);
  flex-shrink: 0;
}

.book-douban-card__meta-val {
  color: var(--a-color-fg);
  word-break: break-all;
}

.book-douban-card__asset-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.4rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  width: fit-content;
}

.book-douban-card__file-name {
  font-size: 0.8rem;
  color: var(--a-color-fg);
  max-width: 12rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-douban-card__asset-pill small {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.book-creation__desc-preview {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.book-creation__desc-preview h4 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--a-color-muted);
}

.book-creation__desc-preview p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--a-color-fg);
  line-height: 1.5;
  white-space: pre-wrap;
}

.book-creation__rights-confirmation {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  color: var(--a-color-fg);
  font-size: 0.875rem;
  line-height: 1.5;
}

.book-creation__rights-confirmation input {
  flex: 0 0 auto;
  margin: 0.15rem 0 0;
  accent-color: var(--a-color-primary);
}

.book-creation__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.book-creation__error {
  margin: 0;
  color: var(--a-color-danger);
  font-size: 0.85rem;
}

.book-creation__progress {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) auto;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.book-creation__progress p { grid-column: 1 / -1; margin: 0; }
.book-creation__progress-bar { width: 100%; accent-color: var(--a-color-primary); }

@media (max-width: 640px) {
  .book-creation__row {
    grid-template-columns: 1fr;
  }

  .book-douban-card {
    flex-direction: column;
  }

  .book-douban-card__cover {
    width: 6rem;
    height: 8.5rem;
  }
}
</style>
