<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PCreationSteps from '@/components/ui/PCreationSteps.vue'
import { ArrowLeft, ArrowRight, CheckCircle2, Headphones, Upload } from 'lucide-vue-next'
import PodcastCoverPanel from '@/components/podcast/PodcastCoverPanel.vue'
import type { PodcastEpisode, Collection } from '@/types'
import { useApi } from '@/composables/useApi'
import { useStudioStore } from '@/stores/studio'
import ContentScheduleControl from '@/components/content/ContentScheduleControl.vue'
import { useContentLifecycle } from '@/composables/useContentLifecycle'

const api = useApi()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const studio = useStudioStore()
const lifecycle = useContentLifecycle()

const isEdit = computed(() => !!route.params.id)
const savingDraft = ref(false)
const publishing = ref(false)
const scheduling = ref(false)
const scheduledAt = ref('')
const showPublishConfirm = ref(false)
const preferredPublishStatus = ref<'draft' | 'published'>('published')
const draftSaved = ref(false)
const errorMsg = ref('')
const titleError = ref('')
const audioError = ref('')
const collections = ref<Collection[]>([])
const selectedCollectionId = ref('')
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
const audioUploadProgress = ref(0)   // 0-100, -1 = error
const audioUploading = ref(false)
const audioProcessing = ref(false)
const uploadStarted = ref(false)
const uploadStage = ref('')
const coverUploading = ref(false)

const form = ref({
  channel_id: '' as string,
  title: '',
  shownotes: '',
  visibility: 'public' as 'public' | 'followers' | 'private',
  audio_url: '',
  episode_cover_url: '',
  season_number: 1,
  episode_number: 1,
})

const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '仅订阅', value: 'followers' },
  { label: '私有', value: 'private' },
]

const selectedCollection = computed(() =>
  collections.value.find(collection => collection.id === selectedCollectionId.value) || null,
)
const effectiveCoverURL = computed(() =>
  form.value.episode_cover_url || selectedCollection.value?.cover_url || '',
)
const effectiveCoverLabel = computed(() =>
  form.value.episode_cover_url ? '单集封面' : selectedCollection.value?.cover_url ? '合集封面' : '',
)
const audioBusy = computed(() => audioUploading.value || audioProcessing.value)
// ── Upload helpers ─────────────────────────────────────────

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
        try { reject(JSON.parse(xhr.responseText)) } catch { reject({ error: '上传失败' }) }
      }
    })
    xhr.addEventListener('error', () => reject({ error: '网络错误，请重试' }))
    xhr.send(formData)
  })
}

function titleFromFilename(filename: string) {
  return filename.replace(/\.[^/.]+$/, '').trim()
}

async function uploadAudioFile(file: File, sourceName: string) {
  uploadStarted.value = true
  audioUploading.value = true
  audioUploadProgress.value = 0
  uploadStage.value = '上传音频'
  audioError.value = ''
  try {
    const fd = new FormData()
    fd.append('audio', file)
    const result = await uploadWithProgress(
      `${api.url}/podcast/upload-audio`,
      fd,
      (pct) => { audioUploadProgress.value = pct },
    )
    form.value.audio_url = result.url
    if (!form.value.title.trim()) {
      form.value.title = titleFromFilename(sourceName)
      titleError.value = ''
    }
  } catch (err: any) {
    audioUploadProgress.value = -1
    audioError.value = err?.error || '音频上传失败'
  } finally {
    audioUploading.value = false
    uploadStage.value = ''
  }
}

async function onAudioFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadAudioFile(file, file.name)
  ;(e.target as HTMLInputElement).value = ''
}

function isVideoFile(file: File) {
  const name = file.name.toLowerCase()
  return file.type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm')
}

async function extractAudioFromVideo(file: File): Promise<File> {
  if (!MediaRecorder.isTypeSupported('audio/webm')) {
    throw new Error('当前浏览器不支持从视频提取音频')
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    const chunks: BlobPart[] = []
    let recorder: MediaRecorder | null = null
    let settled = false

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
      video.pause()
      video.src = ''
    }
    const fail = (message: string) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(message))
    }

    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = objectUrl

    video.addEventListener('loadedmetadata', async () => {
      const stream = (video as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream()
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        fail('这个视频没有可提取的音轨')
        return
      }

      try {
        recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType: 'audio/webm' })
      } catch {
        fail('当前浏览器不支持从视频提取音频')
        return
      }

      recorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) chunks.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        if (settled) return
        settled = true
        cleanup()
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        resolve(new File([audioBlob], `${titleFromFilename(file.name)}.webm`, { type: 'audio/webm' }))
      })
      recorder.addEventListener('error', () => fail('视频音频提取失败'))

      video.addEventListener('timeupdate', () => {
        if (video.duration) {
          audioUploadProgress.value = Math.min(99, Math.round((video.currentTime / video.duration) * 100))
        }
      })
      video.addEventListener('ended', () => {
        if (recorder && recorder.state !== 'inactive') recorder.stop()
      })
      video.addEventListener('error', () => fail('无法读取视频文件'))

      try {
        recorder.start()
        await video.play()
      } catch {
        fail('无法开始提取视频音频')
      }
    }, { once: true })

    video.addEventListener('error', () => fail('无法读取视频文件'), { once: true })
  })
}

async function onVideoFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadStarted.value = true
  audioProcessing.value = true
  audioUploadProgress.value = 0
  uploadStage.value = '提取视频音频'
  audioError.value = ''
  try {
    const audioFile = await extractAudioFromVideo(file)
    audioProcessing.value = false
    await uploadAudioFile(audioFile, file.name)
  } catch (err: any) {
    audioUploadProgress.value = -1
    audioError.value = err?.message || '视频音频提取失败'
  } finally {
    audioProcessing.value = false
    uploadStage.value = ''
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function onMediaFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (isVideoFile(file)) {
    await onVideoFileChange(e)
    return
  }
  await onAudioFileChange(e)
}

async function onCoverFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  coverUploading.value = true
  try {
    const fd = new FormData()
    fd.append('cover', file)
    const res = await fetch(`${api.url}/podcast/upload-cover`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: fd,
    })
    if (!res.ok) throw await res.json()
    const result = await res.json()
    form.value.episode_cover_url = result.url
  } catch (err: any) {
    errorMsg.value = err?.error || '封面上传失败'
  } finally {
    coverUploading.value = false
  }
}

// ── Form logic ─────────────────────────────────────────────

function validateMedia(): boolean {
  audioError.value = form.value.audio_url.trim() ? '' : '请先上传音频文件'
  return !audioError.value
}

function validateInformation(): boolean {
  errorMsg.value = ''
  titleError.value = form.value.title.trim() ? '' : '请填写单集标题'
  if (titleError.value) return false
  if (!form.value.channel_id) {
    errorMsg.value = '请选择节目频道'
    return false
  }
  return true
}

function validate(status: 'draft' | 'published'): boolean {
  if (!validateMedia() || !validateInformation()) return false
  if (status === 'published' && !selectedCollectionId.value) {
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
    channel_id: form.value.channel_id,
    title: form.value.title.trim(),
    shownotes: form.value.shownotes,
    audio_url: form.value.audio_url.trim(),
    episode_cover_url: form.value.episode_cover_url,
    season_number: form.value.season_number,
    episode_number: form.value.episode_number,
    status,
    visibility: form.value.visibility,
    collection_ids: selectedCollectionId.value ? [selectedCollectionId.value] : [],
  }
}

async function apiSave(payload: ReturnType<typeof buildPayload>): Promise<PodcastEpisode> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` }
  if (isEdit.value) {
    const res = await fetch(`${api.url}/podcast/episodes/${route.params.id}`, {
      method: 'PUT', headers, body: JSON.stringify(payload),
    })
    if (!res.ok) throw await res.json()
    return res.json()
  } else {
    const res = await fetch(`${api.url}/podcast/episodes`, {
      method: 'POST', headers, body: JSON.stringify(payload),
    })
    if (!res.ok) throw await res.json()
    return res.json()
  }
}

async function loadCollections(channelID: string) {
  collections.value = []
  if (!channelID) return
  await studio.loadCollections('podcast')
  collections.value = studio.collections.podcast
  if (isEdit.value) {
    if (selectedCollectionId.value && !collections.value.some(collection => collection.id === selectedCollectionId.value)) {
      selectedCollectionId.value = ''
    }
    return
  }

  const queryCollectionId = selectedCollectionFromQuery.value
  if (queryCollectionId && collections.value.some(collection => collection.id === queryCollectionId)) {
    selectedCollectionId.value = queryCollectionId
    return
  }

  if (selectedCollectionId.value && !collections.value.some(collection => collection.id === selectedCollectionId.value)) {
    selectedCollectionId.value = ''
  }
}

async function loadEpisode() {
  const id = route.params.id as string
  const res = await fetch(`${api.url}/podcast/episodes/${id}`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (!res.ok) return
  const ep: PodcastEpisode = await res.json()
  if (ep.channel_id && studio.currentChannel?.id !== ep.channel_id) {
    await studio.selectChannel(ep.channel_id)
  }
  form.value = {
    channel_id: ep.channel_id,
    title: ep.post?.title || '',
    shownotes: ep.post?.content || '',
    visibility: ep.post?.visibility || 'public',
    audio_url: ep.audio_url,
    episode_cover_url: ep.episode_cover_url,
    season_number: ep.season_number,
    episode_number: ep.episode_number,
  }
  await loadCollections(ep.channel_id)
  selectedCollectionId.value = ep.post?.collections?.[0]?.id || ep.collections?.[0]?.id || ''
  currentStep.value = 2
  maxStep.value = 2
}

function applyCreationDefaults() {
  const settings = studio.settings.podcast
  preferredPublishStatus.value = settings?.default_publish_status || 'published'
  if (settings?.default_visibility) {
    form.value.visibility = settings.default_visibility === 'subscribers' ? 'followers' : settings.default_visibility
  }
  if (selectedCollectionFromQuery.value) return
  if (settings?.default_collection_id && collections.value.some(item => item.id === settings.default_collection_id)) {
    selectedCollectionId.value = settings.default_collection_id
  }
}

onMounted(async () => {
  await studio.loadState()
  if (isEdit.value) {
    uploadStarted.value = true
    await loadEpisode()
    return
  }
  form.value.channel_id = studio.currentChannel?.id || ''
	await Promise.all([loadCollections(form.value.channel_id), studio.loadSettings('podcast')])
	applyCreationDefaults()
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
      path: '/studio/podcast/content',
      query: selectedCollectionId.value ? { collection_id: selectedCollectionId.value } : undefined,
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
    const ep = await apiSave(buildPayload('published'))
    router.push(`/podcasts/episode/${isEdit.value ? route.params.id : ep.id}`)
  } catch (e: any) {
    errorMsg.value = e?.error || '发布失败，请重试'
  } finally {
    publishing.value = false
  }
}

async function schedulePublish() {
  if (!validate('published')) return
  const publishAt = new Date(scheduledAt.value)
  if (!Number.isFinite(publishAt.getTime()) || publishAt.getTime() <= Date.now()) {
    errorMsg.value = '请选择未来的发布时间'
    return
  }
  scheduling.value = true
  errorMsg.value = ''
  try {
    const episode = await apiSave(buildPayload('draft'))
    await lifecycle.schedule('podcast', episode.id, publishAt.toISOString())
    await router.push({ path: '/studio/podcast/content', query: { status: 'scheduled' } })
  } catch (e: any) {
    errorMsg.value = e?.error?.message || e?.error || e?.message || '设置失败，请重试'
  } finally {
    scheduling.value = false
  }
}
</script>

<template>
  <div class="pe-wrap">
    <PPageHeader :title="isEdit ? '编辑单集' : '发布新单集'" accent mb="1.5rem" />

    <PCreationSteps
      v-model="currentStep"
      :steps="creationSteps"
      :max-step="maxStep"
      class="pe-steps"
    />

    <section v-if="currentStep === 1" class="pe-gate">
      <div class="pe-step-heading">
        <div>
          <h2 class="pe-section-title">上传节目音频</h2>
          <p>可直接上传音频，也可以从视频中提取音轨。</p>
        </div>
        <Headphones :size="22" aria-hidden="true" />
      </div>

      <div v-if="form.audio_url && !audioBusy" class="pe-uploaded">
        <CheckCircle2 :size="18" aria-hidden="true" />
        <span class="pe-uploaded-name">音频已上传</span>
        <button type="button" class="pe-reupload" @click="form.audio_url = ''; maxStep = 1">重新上传</button>
      </div>
      <div v-else-if="audioBusy" class="pe-uploading-box">
        <span class="pe-uploading-label">{{ uploadStage || '处理中' }} {{ audioUploadProgress }}%</span>
      </div>
      <label v-else class="pe-drop-zone pe-source-card">
        <input
          type="file"
          accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,audio/x-m4a,audio/webm,video/mp4,video/webm,video/quicktime,.mp3,.ogg,.wav,.aac,.m4a,.flac,.webm,.mp4,.mov"
          class="pe-file-hidden"
          @change="onMediaFileChange"
        />
        <Upload :size="30" aria-hidden="true" />
        <span class="pe-drop-hint">选择音频或视频文件</span>
        <span class="pe-drop-sub">支持 MP3、AAC、M4A、OGG、WAV、FLAC、WebM、MP4 和 MOV</span>
      </label>

      <div v-if="audioBusy" class="pe-progress-track" role="progressbar" :aria-valuenow="audioUploadProgress" aria-valuemin="0" aria-valuemax="100">
        <div class="pe-progress-bar" :style="{ width: audioUploadProgress + '%' }" />
      </div>
      <div v-if="form.audio_url && !audioBusy" class="pe-audio-preview">
        <audio :src="form.audio_url" controls preload="none" />
      </div>
      <p v-if="audioError" class="pe-field-error" role="alert">{{ audioError }}</p>

      <div class="pe-step-actions pe-step-actions--end">
        <PButton data-testid="creator-next" @click="goNext">
          下一步
          <ArrowRight :size="16" aria-hidden="true" />
        </PButton>
      </div>
    </section>

    <div v-else-if="currentStep === 2" class="pe-layout">
      <!-- 左栏 -->
      <div class="pe-main">
        <!-- 基本信息 -->
        <section class="pe-section">
          <h2 class="pe-section-title">基本信息</h2>
          <div class="a-field--line">
            <PInput
              v-model="form.title"
              label="单集标题 *"
              placeholder="上传音频后自动填充，可手动修改"
              :error="titleError"
              @input="titleError = ''"
            />
          </div>
          <div class="a-field--line">
            <PTextarea
              v-model="form.shownotes"
              label="节目说明（Shownotes）"
              placeholder="节目内容简介、时间轴、嘉宾介绍、相关链接…"
              :rows="7"
            />
          </div>
        </section>

        <!-- 归档位置 -->
        <section class="pe-section">
          <h2 class="pe-section-title">归档位置</h2>
          <div class="pe-collections">
            <label class="pe-field-label">加入合集</label>
            <div v-if="collections.length === 0" class="pe-collections-empty">当前频道暂无合集</div>
            <div v-else class="pe-collections-list">
              <label v-for="collection in collections" :key="collection.id" class="pe-collection-item">
                <input
                  v-model="selectedCollectionId"
                  type="radio"
                  name="podcast-collection"
                  :value="collection.id"
                />
                <span>{{ collection.name }}</span>
              </label>
            </div>
          </div>
        </section>

        <!-- 单集编号 -->
        <section class="pe-section">
          <h2 class="pe-section-title">单集编号</h2>
          <div class="pe-row">
            <div class="a-field--line">
              <PInput
                v-model.number="form.season_number"
                label="季"
                type="number"
                :min="1"
              />
            </div>
            <div class="a-field--line">
              <PInput
                v-model.number="form.episode_number"
                label="集"
                type="number"
                :min="1"
              />
            </div>
          </div>
        </section>

        <p v-if="errorMsg" class="pe-error" role="alert">{{ errorMsg }}</p>
        <div class="pe-step-actions">
          <PButton variant="secondary" @click="goPrevious">
            <ArrowLeft :size="16" aria-hidden="true" />
            上一步
          </PButton>
          <PButton data-testid="creator-next" @click="goNext">
            下一步
            <ArrowRight :size="16" aria-hidden="true" />
          </PButton>
        </div>
      </div>

      <aside class="pe-panel" aria-label="单集封面">
        <PodcastCoverPanel
          :effective-cover-u-r-l="effectiveCoverURL"
          :effective-cover-label="effectiveCoverLabel"
          :cover-uploading="coverUploading"
          @cover-file-change="onCoverFileChange"
        />
      </aside>
    </div>

    <section v-else class="pe-publish-step">
      <div class="pe-step-heading">
        <div>
          <h2 class="pe-section-title">检查并发布</h2>
          <p>确认单集信息和可见范围后发布。</p>
        </div>
      </div>

      <div class="pe-review">
        <div class="pe-review-media">
          <img v-if="effectiveCoverURL" :src="effectiveCoverURL" :alt="form.title" />
          <Headphones v-else :size="32" aria-hidden="true" />
        </div>
        <div class="pe-review-content">
          <h3>{{ form.title || '未命名单集' }}</h3>
          <p v-if="form.shownotes">{{ form.shownotes }}</p>
          <dl>
            <div><dt>单集</dt><dd>第 {{ form.season_number }} 季 · 第 {{ form.episode_number }} 集</dd></div>
            <div><dt>合集</dt><dd>{{ selectedCollection?.name || '未加入合集' }}</dd></div>
          </dl>
        </div>
      </div>

      <PSelect v-model="form.visibility" label="可见范围" :options="visibilityOptions" />
      <p v-if="errorMsg" class="pe-error" role="alert">{{ errorMsg }}</p>
      <p v-if="draftSaved" class="pe-saved" aria-live="polite">草稿已保存</p>

      <ContentScheduleControl
        v-model="scheduledAt"
        :busy="scheduling"
        :disabled="publishing || savingDraft || audioBusy || !form.audio_url"
        @schedule="schedulePublish"
      />

      <div class="pe-step-actions">
        <PButton variant="secondary" @click="goPrevious">
          <ArrowLeft :size="16" aria-hidden="true" />
          上一步
        </PButton>
        <div class="pe-publish-actions">
		  <PButton
			:variant="preferredPublishStatus === 'draft' ? 'primary' : 'secondary'"
            :loading="savingDraft"
            loading-text="保存中…"
            :disabled="publishing || audioBusy || !form.audio_url"
            @click="saveDraft"
          >
            保存草稿
          </PButton>
		  <PButton
			:variant="preferredPublishStatus === 'published' ? 'primary' : 'secondary'"
            :loading="publishing"
            loading-text="发布中…"
            :disabled="savingDraft || audioBusy || !form.audio_url"
            @click="requestPublish"
          >
            立即发布
          </PButton>
        </div>
      </div>
    </section>

    <PConfirm
      :show="showPublishConfirm"
      title="确认发布单集"
      :message="`《${form.title || '未命名单集'}》将立即对听众公开，发布后可继续编辑。`"
      confirm-text="立即发布"
      cancel-text="再想想"
      @confirm="doPublish"
      @cancel="showPublishConfirm = false"
    />
  </div>
</template>

<style scoped>
.pe-wrap {
  max-width: 58rem;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 6rem;
}

.pe-steps {
  margin-bottom: 2rem;
}

.pe-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 16rem;
  gap: 2rem;
  align-items: start;
}

.pe-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1.5rem;
}

.pe-gate {
  display: grid;
  max-width: 44rem;
  margin: 0 auto;
  gap: 1.25rem;
}

.pe-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0 0 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.pe-section-title {
  margin: 0;
  color: var(--a-color-text);
  font-size: 1.125rem;
  font-weight: 600;
}

.pe-step-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  color: var(--a-color-text-secondary);
}

.pe-step-heading p {
  margin: 0.35rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.875rem;
}

.pe-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.pe-default-channel-row {
  display: flex;
  justify-content: flex-start;
  margin-top: -0.25rem;
}

.pe-default-channel-btn {
  min-height: 40px;
  border: 0;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.pe-default-channel-btn:disabled {
  cursor: default;
  opacity: 0.65;
}

.pe-field-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--a-color-fg);
  margin-bottom: 0.375rem;
}

/* ── Audio upload area ── */
.pe-uploaded {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
  color: var(--a-color-success);
  font-size: 0.875rem;
}
.pe-uploaded-name { flex: 1; color: var(--a-color-fg); font-weight: 500; }
.pe-reupload {
  min-height: 40px;
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.pe-reupload:hover { color: var(--a-color-text); }

.pe-source-card {
  min-height: 13rem;
}

.pe-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}
.pe-drop-zone:hover:not(.pe-drop-zone--uploading) {
  border-color: var(--a-color-text-secondary);
  background: var(--a-color-surface);
  color: var(--a-color-text);
}
.pe-drop-zone--uploading { cursor: default; opacity: 0.7; }
.pe-drop-hint { font-size: 0.875rem; font-weight: 500; color: var(--a-color-fg); }
.pe-drop-sub { font-size: 0.75rem; color: var(--a-color-muted); }
.pe-uploading-label { font-size: 0.875rem; font-weight: 600; color: var(--a-color-fg); }

.pe-uploading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 7rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
}

.pe-progress-track {
  height: 4px;
  background: var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  overflow: hidden;
}
.pe-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--a-color-primary);
  transition: width 0.2s ease;
}

.pe-field-error { font-size: 0.8rem; color: var(--a-color-danger); margin: 0; }

.pe-audio-preview audio {
  display: block;
  width: 100%;
}

.pe-panel {
  position: sticky;
  top: 5rem;
  padding-left: 2rem;
  border-left: 1px solid var(--a-color-border-soft);
}

/* Cover */
.pe-collections {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.pe-collections-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 10rem;
  overflow: auto;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  padding: 0.5rem;
}

.pe-collection-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.25rem;
  font-size: 0.8rem;
  color: var(--a-color-fg);
  cursor: pointer;
}

.pe-collections-empty {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  padding: 0.625rem 0;
}

.pe-file-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.pe-publish-step {
  display: grid;
  gap: 1.5rem;
}

.pe-step-actions,
.pe-publish-actions {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
}

.pe-step-actions {
  justify-content: space-between;
}

.pe-step-actions--end {
  justify-content: flex-end;
}

.pe-review {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.pe-review-media {
  display: flex;
  aspect-ratio: 1;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
}

.pe-review-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pe-review-content {
  display: grid;
  gap: var(--a-space-3);
}

.pe-review-content h3,
.pe-review-content p,
.pe-review-content dl {
  margin: 0;
}

.pe-review-content h3 {
  font-size: 1.25rem;
}

.pe-review-content p {
  color: var(--a-color-text-secondary);
  line-height: 1.6;
}

.pe-review-content dl {
  display: grid;
  gap: var(--a-space-2);
  font-size: 0.875rem;
}

.pe-review-content dl div {
  display: grid;
  grid-template-columns: 4rem 1fr;
}

.pe-review-content dt {
  color: var(--a-color-muted);
}

.pe-review-content dd {
  margin: 0;
}

.pe-error { font-size: 0.8rem; color: var(--a-color-danger); margin: 0; }
.pe-saved { font-size: 0.8rem; color: var(--a-color-success); margin: 0; }

@media (max-width: 768px) {
  .pe-layout { grid-template-columns: 1fr; }
  .pe-panel {
    position: static;
    padding: 0 0 1.5rem;
    border-left: 0;
    border-bottom: 1px solid var(--a-color-border-soft);
  }

  .pe-review {
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: 1rem;
  }

  .pe-publish-actions {
    flex: 1;
    justify-content: flex-end;
  }

  .pe-publish-step > .pe-step-actions {
    position: sticky;
    z-index: calc(var(--a-z-navigation) - 1);
    bottom: var(--a-mobile-nav-reserved-height);
    padding: 0.75rem 0;
    border-top: 1px solid var(--a-color-border-soft);
    background: var(--a-color-bg);
  }
}
</style>
