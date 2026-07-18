<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PCreationSteps from '@/components/ui/PCreationSteps.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { ArrowLeft, ArrowRight, CheckCircle2, Upload, Video as VideoIcon } from 'lucide-vue-next'
import VideoCoverPanel from '@/components/video/VideoCoverPanel.vue'
import type { Video, Collection } from '@/types'
import { useApi } from '@/composables/useApi'

const api = useApi()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const studio = useStudioStore()

const isEdit = computed(() => !!route.params.id)
const savingDraft = ref(false)
const publishing = ref(false)
const showPublishConfirm = ref(false)
const draftSaved = ref(false)
const errorMsg = ref('')
const titleError = ref('')
const urlError = ref('')
const collections = ref<Collection[]>([])
const selectedCollectionIds = ref<string[]>([])
const selectedCollectionFromQuery = computed(() => (
  typeof route.query.collection === 'string' ? route.query.collection : ''
))
const currentStep = ref(isEdit.value ? 2 : 1)
const maxStep = ref(isEdit.value ? 2 : 1)
const creationSteps = [
  { value: 1, label: '媒体', description: '选择来源并上传' },
  { value: 2, label: '信息', description: '填写内容资料' },
  { value: 3, label: '发布', description: '检查并确认' },
]

// Upload state
const videoUploadProgress = ref(0)   // 0-100, -1 = error
const videoUploading = ref(false)
const coverUploading = ref(false)
const generatedCoverPreview = ref('')
const generatedCoverBlob = ref<Blob | null>(null)
const generatedCoverReady = ref(false)

const form = ref({
  channel_id: '' as string,
  title: '',
  description: '',
  storage_type: 'local' as 'local' | 'external',
  video_url: '',
  thumbnail_url: '',
  visibility: 'public' as 'public' | 'followers' | 'private',
  tags: '',
})

const storageOptions = [
  { label: '本地上传', value: 'local' },
  { label: '外部链接', value: 'external' },
]

function onStorageTypeChange(value: 'local' | 'external') {
  if (value === form.value.storage_type) return
  form.value.storage_type = value
  form.value.video_url = ''
  urlError.value = ''
  maxStep.value = 1
}

const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '仅关注者', value: 'followers' },
  { label: '私密', value: 'private' },
]

// ── Upload helpers ────────────────────────────────────────

function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        try {
          reject(JSON.parse(xhr.responseText))
        } catch {
          reject({ error: xhr.responseText || '上传失败' })
        }
      }
    })
    xhr.addEventListener('error', () => reject({ error: '网络错误，请重试' }))
    xhr.send(formData)
  })
}

function clearGeneratedCover() {
  generatedCoverReady.value = false
  generatedCoverBlob.value = null
  generatedCoverPreview.value = ''
}

async function extractFirstFrame(file: File): Promise<{ blob: Blob, preview: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = objectUrl

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
      video.src = ''
    }

    video.addEventListener('loadeddata', () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        cleanup()
        reject(new Error('封面提取失败'))
        return
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        cleanup()
        if (!blob) {
          reject(new Error('封面提取失败'))
          return
        }
        resolve({ blob, preview: canvas.toDataURL('image/jpeg', 0.9) })
      }, 'image/jpeg', 0.9)
    }, { once: true })

    video.addEventListener('error', () => {
      cleanup()
      reject(new Error('无法读取视频内容，未生成封面'))
    }, { once: true })
  })
}

async function uploadCoverBlob(blob: Blob) {
  coverUploading.value = true
  errorMsg.value = ''
  try {
    const fd = new FormData()
    fd.append('cover', new File([blob], `auto-cover-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    const res = await fetch(`${api.url}/videos/upload-cover`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: fd,
    })
    if (!res.ok) throw await res.json()
    const result = await res.json()
    form.value.thumbnail_url = result.url
  } catch (err: any) {
    errorMsg.value = err?.error || '封面上传失败'
  } finally {
    coverUploading.value = false
  }
}

async function useGeneratedCover() {
  if (!generatedCoverBlob.value) return
  await uploadCoverBlob(generatedCoverBlob.value)
}

async function onVideoFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  videoUploading.value = true
  videoUploadProgress.value = 0
  urlError.value = ''
  clearGeneratedCover()
  try {
    const fd = new FormData()
    fd.append('video', file)
    const result = await uploadWithProgress(
      `${api.url}/videos/upload-video`,
      fd,
      (pct) => { videoUploadProgress.value = pct },
    )
    form.value.video_url = result.url

    try {
      const generated = await extractFirstFrame(file)
      generatedCoverBlob.value = generated.blob
      generatedCoverPreview.value = generated.preview
      generatedCoverReady.value = true
    } catch {
      generatedCoverReady.value = false
      errorMsg.value = '自动封面生成失败，可手动上传封面'
    }
  } catch (err: any) {
    videoUploadProgress.value = -1
    urlError.value = err?.error || '视频上传失败'
  } finally {
    videoUploading.value = false
  }
}

async function onCoverFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  coverUploading.value = true
  try {
    const fd = new FormData()
    fd.append('cover', file)
    const res = await fetch(`${api.url}/videos/upload-cover`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: fd,
    })
    if (!res.ok) throw await res.json()
    const result = await res.json()
    form.value.thumbnail_url = result.url
  } catch (err: any) {
    errorMsg.value = err?.error || '封面上传失败'
  } finally {
    coverUploading.value = false
  }
}

// ── Form logic ────────────────────────────────────────────

function validateMedia(): boolean {
  urlError.value = form.value.video_url.trim() ? '' : (
    form.value.storage_type === 'local' ? '请先上传视频文件' : '请填写视频链接'
  )
  return !urlError.value
}

function validateInformation(): boolean {
  errorMsg.value = ''
  titleError.value = form.value.title.trim() ? '' : '请填写视频标题'
  if (titleError.value) return false
  if (!form.value.channel_id) {
    errorMsg.value = '请先创建频道'
    return false
  }
  return true
}

function validate(status: 'draft' | 'published'): boolean {
  if (!validateMedia() || !validateInformation()) return false
  if (status === 'published' && selectedCollectionIds.value.length === 0) {
    errorMsg.value = '请先选择合集'
    return false
  }
  return true
}

function goNext() {
  if (currentStep.value === 1) {
    if (!validateMedia()) return
    maxStep.value = Math.max(maxStep.value, 2)
    currentStep.value = 2
    return
  }
  if (currentStep.value === 2) {
    if (!validateInformation()) return
    maxStep.value = 3
    currentStep.value = 3
  }
}

function goPrevious() {
  currentStep.value = Math.max(1, currentStep.value - 1)
}

function buildPayload(status: 'draft' | 'published') {
  return {
    channel_id: form.value.channel_id || null,
    title: form.value.title.trim(),
    description: form.value.description,
    storage_type: form.value.storage_type,
    video_url: form.value.video_url.trim(),
    thumbnail_url: form.value.thumbnail_url,
    visibility: form.value.visibility,
    status,
    tags: form.value.tags.split(',').map(t => t.trim()).filter(Boolean),
    collection_ids: selectedCollectionIds.value,
  }
}

async function apiSave(payload: ReturnType<typeof buildPayload>): Promise<Video> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` }
  if (isEdit.value) {
    const res = await fetch(`${api.url}/videos/${route.params.id}`, {
      method: 'PUT', headers, body: JSON.stringify(payload),
    })
    if (!res.ok) throw await res.json()
    return res.json()
  } else {
    const res = await fetch(`${api.url}/videos`, {
      method: 'POST', headers, body: JSON.stringify(payload),
    })
    if (!res.ok) throw await res.json()
    return res.json()
  }
}

async function loadCollections(channelID: string) {
  collections.value = []
  if (!channelID) return
  await studio.loadCollections('video')
  collections.value = studio.collections.video
  if (!isEdit.value) {
    const queryCollectionId = selectedCollectionFromQuery.value
    selectedCollectionIds.value = queryCollectionId && collections.value.some(collection => collection.id === queryCollectionId)
      ? [queryCollectionId]
      : []
  }
}

function toggleCollection(id: string, checked: boolean) {
  if (checked) {
    if (!selectedCollectionIds.value.includes(id)) {
      selectedCollectionIds.value.push(id)
    }
    return
  }
  selectedCollectionIds.value = selectedCollectionIds.value.filter(item => item !== id)
}

async function loadVideo() {
  const id = route.params.id as string
  const res = await fetch(`${api.url}/videos/${id}`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (!res.ok) return
  const v: Video = await res.json()
  if (v.channel_id && studio.currentChannel?.id !== v.channel_id) {
    await studio.selectChannel(v.channel_id)
  }
  form.value = {
    channel_id: v.channel_id ?? '',
    title: v.title,
    description: v.description,
    storage_type: v.storage_type,
    video_url: v.video_url,
    thumbnail_url: v.thumbnail_url,
    visibility: v.visibility,
    tags: v.tags?.map(t => t.name).join(', ') ?? '',
  }
  await loadCollections(form.value.channel_id)
  selectedCollectionIds.value = v.collections?.map(collection => collection.id) ?? []
  currentStep.value = 2
  maxStep.value = 2
}

onMounted(async () => {
  await studio.loadState()
  if (isEdit.value) {
    await loadVideo()
    return
  }
  form.value.channel_id = studio.currentChannel?.id || ''
  await Promise.all([loadCollections(form.value.channel_id), studio.loadSettings('video')])
  const settings = studio.settings.video
  if (settings?.default_visibility) {
    form.value.visibility = settings.default_visibility === 'subscribers' ? 'followers' : settings.default_visibility
  }
  if (!selectedCollectionIds.value.length && settings?.default_collection_id && collections.value.some(item => item.id === settings.default_collection_id)) {
    selectedCollectionIds.value = [settings.default_collection_id]
  }
})

async function saveDraft() {
  if (!validate('draft')) return
  savingDraft.value = true
  errorMsg.value = ''
  draftSaved.value = false
  try {
    await apiSave(buildPayload('draft'))
    draftSaved.value = true
    await router.push({
      path: '/studio/video/content',
      query: selectedCollectionIds.value[0] ? { collection_id: selectedCollectionIds.value[0] } : undefined,
    })
    setTimeout(() => { draftSaved.value = false }, 3000)
  } catch (e: any) {
    errorMsg.value = e?.error || '保存失败，请重试'
  } finally {
    savingDraft.value = false
  }
}

function requestPublish() {
  if (!validate('published')) return
  showPublishConfirm.value = true
}

async function doPublish() {
  showPublishConfirm.value = false
  publishing.value = true
  errorMsg.value = ''
  try {
    const v = await apiSave(buildPayload('published'))
    router.push(`/videos/watch/${isEdit.value ? route.params.id : v.id}`)
  } catch (e: any) {
    errorMsg.value = e?.error || '发布失败，请重试'
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="ve-wrap">
    <PPageHeader :title="isEdit ? '编辑视频' : '上传视频'" accent mb="1.5rem" />

    <PCreationSteps
      v-model="currentStep"
      :steps="creationSteps"
      :max-step="maxStep"
      class="ve-steps"
    />

    <div class="ve-layout" :class="{ 've-layout--single': currentStep !== 2 }">
      <!-- 左栏 -->
      <div class="ve-main">
        <!-- 基本信息 -->
        <section v-if="currentStep === 2" class="ve-section">
          <h2 class="ve-section-title">基本信息</h2>
          <PInput
            v-model="form.title"
            label="标题 *"
            placeholder="为视频起一个吸引人的标题"
            :error="titleError"
            @input="titleError = ''"
          />
          <PTextarea
            v-model="form.description"
            label="简介"
            placeholder="介绍视频内容、背景或注意事项…"
            :rows="5"
          />
          <PInput
            v-model="form.tags"
            label="标签"
            placeholder="music, tutorial, vlog（逗号分隔）"
            hint="多个标签用英文逗号隔开"
          />
        </section>

        <!-- 视频来源 -->
        <section v-if="currentStep === 1" class="ve-section">
          <div class="ve-step-heading">
            <div>
              <h2 class="ve-section-title">选择视频来源</h2>
              <p>上传视频文件，或填写可直接访问的视频链接。</p>
            </div>
            <VideoIcon :size="22" aria-hidden="true" />
          </div>

          <PSegmentedControl
            :model-value="form.storage_type"
            :options="storageOptions"
            aria-label="视频来源"
            @update:model-value="onStorageTypeChange($event as 'local' | 'external')"
          />

          <!-- 外部链接 -->
          <PInput
            v-if="form.storage_type === 'external'"
            v-model="form.video_url"
            label="视频链接 *"
            placeholder="https://youtube.com/watch?v=..."
            hint="支持 YouTube / Bilibili 自动嵌入"
            :error="urlError"
            @input="urlError = ''"
          />

          <!-- 本地上传 -->
          <div v-else class="ve-upload-area">
            <label class="ve-field-label">视频文件 *</label>

            <!-- 已上传 -->
            <div v-if="form.video_url && !videoUploading" class="ve-uploaded">
              <CheckCircle2 :size="18" aria-hidden="true" />
              <span class="ve-uploaded-name">视频已上传</span>
              <button type="button" class="ve-reupload" @click="form.video_url = ''; maxStep = 1">重新上传</button>
            </div>

            <!-- 未上传 / 上传中 -->
            <template v-else>
              <label class="ve-drop-zone" :class="{ 've-drop-zone--uploading': videoUploading }">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  class="ve-file-hidden"
                  :disabled="videoUploading"
                  @change="onVideoFileChange"
                />
                <Upload v-if="!videoUploading" :size="30" aria-hidden="true" />
                <span v-if="!videoUploading" class="ve-drop-hint">选择视频文件</span>
                <span v-if="!videoUploading" class="ve-drop-sub">MP4、WebM 或 MOV，最大 2 GB</span>
                <span v-if="videoUploading" class="ve-uploading-label">上传中 {{ videoUploadProgress }}%</span>
              </label>

              <!-- 进度条 -->
              <div v-if="videoUploading" class="ve-progress-track">
                <div class="ve-progress-bar" :style="{ width: videoUploadProgress + '%' }" />
              </div>

              <p v-if="urlError" class="ve-field-error">{{ urlError }}</p>
            </template>
          </div>

          <p v-if="errorMsg" class="ve-error" role="alert">{{ errorMsg }}</p>

          <div class="ve-step-actions ve-step-actions--end">
            <PButton data-testid="creator-next" @click="goNext">
              下一步
              <ArrowRight :size="16" aria-hidden="true" />
            </PButton>
          </div>
        </section>

        <!-- 合集 -->
        <section v-if="currentStep === 2" class="ve-section">
          <h2 class="ve-section-title">归档位置</h2>
          <div class="ve-collections">
            <label class="ve-field-label">合集</label>
            <div v-if="collections.length === 0" class="ve-collections-empty">当前频道暂无合集</div>
            <div v-else class="ve-collections-list">
              <label v-for="collection in collections" :key="collection.id" class="ve-collection-item">
                <input
                  type="checkbox"
                  :checked="selectedCollectionIds.includes(collection.id)"
                  @change="toggleCollection(collection.id, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ collection.name }}</span>
              </label>
            </div>
          </div>
        </section>

        <p v-if="currentStep === 2 && errorMsg" class="ve-error" role="alert">{{ errorMsg }}</p>

        <div v-if="currentStep === 2" class="ve-step-actions">
          <PButton variant="secondary" @click="goPrevious">
            <ArrowLeft :size="16" aria-hidden="true" />
            上一步
          </PButton>
          <PButton data-testid="creator-next" @click="goNext">
            下一步
            <ArrowRight :size="16" aria-hidden="true" />
          </PButton>
        </div>

        <section v-if="currentStep === 3" class="ve-section ve-publish-step">
          <div class="ve-step-heading">
            <div>
              <h2 class="ve-section-title">检查并发布</h2>
              <p>确认展示信息和可见范围后发布。</p>
            </div>
          </div>

          <div class="ve-review">
            <div class="ve-review-media">
              <img v-if="form.thumbnail_url" :src="form.thumbnail_url" :alt="form.title" />
              <VideoIcon v-else :size="32" aria-hidden="true" />
            </div>
            <div class="ve-review-content">
              <h3>{{ form.title || '未命名视频' }}</h3>
              <p v-if="form.description">{{ form.description }}</p>
              <dl>
                <div><dt>来源</dt><dd>{{ form.storage_type === 'local' ? '本地上传' : '外部链接' }}</dd></div>
                <div><dt>合集</dt><dd>{{ selectedCollectionIds.length }} 个</dd></div>
              </dl>
            </div>
          </div>

          <PSelect
            label="可见范围"
            :model-value="form.visibility"
            :options="visibilityOptions"
            @update:model-value="form.visibility = $event as 'public' | 'followers' | 'private'"
          />

          <p v-if="errorMsg" class="ve-error" role="alert">{{ errorMsg }}</p>
          <p v-if="draftSaved" class="ve-saved" aria-live="polite">草稿已保存</p>

          <div class="ve-step-actions">
            <PButton variant="secondary" @click="goPrevious">
              <ArrowLeft :size="16" aria-hidden="true" />
              上一步
            </PButton>
            <div class="ve-publish-actions">
              <PButton
                variant="secondary"
                :loading="savingDraft"
                loading-text="保存中…"
                :disabled="publishing || videoUploading"
                @click="saveDraft"
              >
                保存草稿
              </PButton>
              <PButton
                :loading="publishing"
                loading-text="发布中…"
                :disabled="savingDraft || videoUploading"
                @click="requestPublish"
              >
                立即发布
              </PButton>
            </div>
          </div>
        </section>
      </div>

      <aside v-if="currentStep === 2" class="ve-panel" aria-label="视频封面">
        <VideoCoverPanel
          :generated-cover-ready="generatedCoverReady"
          :generated-cover-preview="generatedCoverPreview"
          :thumbnail-url="form.thumbnail_url"
          :cover-uploading="coverUploading"
          @use-generated-cover="useGeneratedCover"
          @cover-file-change="onCoverFileChange"
        />
      </aside>
    </div>

    <!-- 发布确认弹窗 -->
    <PConfirm
      :show="showPublishConfirm"
      title="确认发布视频"
      :message="`《${form.title || '未命名视频'}》将对${
        form.visibility === 'public' ? '所有人' :
        form.visibility === 'followers' ? '关注者' : '仅自己'
      }可见，发布后观众可立即观看。`"
      confirm-text="立即发布"
      cancel-text="再想想"
      @confirm="doPublish"
      @cancel="showPublishConfirm = false"
    />
  </div>
</template>

<style scoped>
.ve-wrap {
  max-width: 58rem;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 6rem;
}

.ve-steps {
  margin-bottom: 2rem;
}

.ve-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 16rem;
  gap: 2rem;
  align-items: start;
}

.ve-layout--single {
  grid-template-columns: minmax(0, 1fr);
}

.ve-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.5rem;
}

.ve-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0 0 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.ve-section-title {
  margin: 0;
  color: var(--a-color-text);
  font-size: 1.125rem;
  font-weight: 600;
}

.ve-step-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  color: var(--a-color-text-secondary);
}

.ve-step-heading p {
  margin: 0.35rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.875rem;
}

/* Field label (matches PInput label style) */
.ve-field-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--a-color-fg);
  margin-bottom: 0.375rem;
}

/* ── Video upload area ── */
.ve-upload-area { display: flex; flex-direction: column; gap: 0.5rem; }

.ve-uploaded {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
  color: var(--a-color-success);
  font-size: 0.875rem;
}
.ve-uploaded-name { flex: 1; color: var(--a-color-fg); font-weight: 500; }
.ve-reupload {
  min-height: 40px;
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.ve-reupload:hover { color: var(--a-color-text); }

.ve-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 180px;
  padding: 2rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}
.ve-drop-zone:hover:not(.ve-drop-zone--uploading) {
  border-color: var(--a-color-text-secondary);
  background: var(--a-color-surface);
  color: var(--a-color-text);
}
.ve-drop-zone--uploading { cursor: default; opacity: 0.7; }
.ve-drop-hint { font-size: 0.875rem; font-weight: 500; color: var(--a-color-fg); }
.ve-drop-sub { font-size: 0.75rem; color: var(--a-color-muted); }
.ve-uploading-label { font-size: 0.875rem; font-weight: 600; color: var(--a-color-text); }

.ve-progress-track {
  height: 4px;
  background: var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  overflow: hidden;
}
.ve-progress-bar {
  height: 100%;
  background: var(--a-color-primary);
  border-radius: inherit;
  transition: width 0.2s ease;
}

.ve-field-error { font-size: 0.8rem; color: var(--a-color-danger, #ef4444); margin: 0; }

.ve-panel {
  position: sticky;
  top: 5rem;
  padding-left: 2rem;
  border-left: 1px solid var(--a-color-border-soft);
}

.ve-collections {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ve-collections-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 12rem;
  overflow: auto;
  padding: 0.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
}

.ve-collection-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--a-color-fg);
}

.ve-collections-empty {
  font-size: 0.8rem;
  color: var(--a-color-muted, #6b7280);
}

.ve-file-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.ve-step-actions,
.ve-publish-actions {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
}

.ve-step-actions {
  justify-content: space-between;
}

.ve-step-actions--end {
  justify-content: flex-end;
}

.ve-review {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.ve-review-media {
  display: flex;
  aspect-ratio: 16 / 9;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
}

.ve-review-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ve-review-content h3,
.ve-review-content p,
.ve-review-content dl {
  margin: 0;
}

.ve-review-content {
  display: grid;
  gap: var(--a-space-3);
}

.ve-review-content h3 {
  font-size: 1.25rem;
}

.ve-review-content p {
  color: var(--a-color-text-secondary);
  line-height: 1.6;
}

.ve-review-content dl {
  display: grid;
  gap: var(--a-space-2);
  font-size: 0.875rem;
}

.ve-review-content dl div {
  display: grid;
  grid-template-columns: 4rem 1fr;
}

.ve-review-content dt {
  color: var(--a-color-muted);
}

.ve-review-content dd {
  margin: 0;
}

.ve-error { font-size: 0.8rem; color: var(--a-color-danger, #ef4444); margin: 0; }
.ve-saved { font-size: 0.8rem; color: var(--a-color-success, #10b981); margin: 0; }

@media (max-width: 768px) {
  .ve-layout { grid-template-columns: 1fr; }
  .ve-panel {
    position: static;
    padding: 0 0 1.5rem;
    border-left: 0;
    border-bottom: 1px solid var(--a-color-border-soft);
  }

  .ve-review {
    grid-template-columns: 8rem minmax(0, 1fr);
    gap: 1rem;
  }

  .ve-step-actions {
    align-items: stretch;
  }

  .ve-publish-actions {
    flex: 1;
    justify-content: flex-end;
  }

  .ve-publish-step > .ve-step-actions {
    position: sticky;
    z-index: calc(var(--a-z-navigation) - 1);
    bottom: var(--a-mobile-nav-reserved-height);
    padding: 0.75rem 0;
    border-top: 1px solid var(--a-color-border-soft);
    background: var(--a-color-bg);
  }
}
</style>
