<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { isNavigationFailure, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PodcastCoverPanel from '@/components/podcast/PodcastCoverPanel.vue'
import type { PodcastEpisode, Channel, Collection } from '@/types'
import { useApi } from '@/composables/useApi'

const api = useApi()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isEdit = computed(() => !!route.params.id)
const savingDraft = ref(false)
const publishing = ref(false)
const showPublishConfirm = ref(false)
const publishedEpisodeId = ref('')
const publishNavigationFailed = ref(false)
const publishNavigationError = '单集已发布，但跳转失败，请重试'
const draftSaved = ref(false)
const errorMsg = ref('')
const titleError = ref('')
const audioError = ref('')
const channels = ref<Channel[]>([])
const collections = ref<Collection[]>([])
const selectedCollectionId = ref('')
const selectedChannelFromQuery = computed(() => (
  typeof route.query.channel === 'string' ? route.query.channel : ''
))
const selectedCollectionFromQuery = computed(() => (
  typeof route.query.collection === 'string' ? route.query.collection : ''
))

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
  audio_url: '',
  episode_cover_url: '',
  season_number: 1,
  episode_number: 1,
})

const channelOptions = computed(() => [
  { label: '请选择节目频道', value: '' },
  ...channels.value.map(ch => ({ label: ch.name, value: ch.id })),
])

const selectedCollection = computed(() =>
  collections.value.find(collection => collection.id === selectedCollectionId.value) || null,
)
const effectiveCoverURL = computed(() =>
  form.value.episode_cover_url || selectedCollection.value?.cover_url || '',
)
const effectiveCoverLabel = computed(() =>
  form.value.episode_cover_url ? '单集封面' : selectedCollection.value?.cover_url ? '合集封面' : '',
)
const canEditMetadata = computed(() => isEdit.value || uploadStarted.value)
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

function validate(): boolean {
  titleError.value = form.value.title.trim() ? '' : '请填写单集标题'
  audioError.value = form.value.audio_url.trim() ? '' : '请先上传音频文件'
  if (!form.value.channel_id) {
    errorMsg.value = '请选择节目频道'
  }
  return !titleError.value && !audioError.value && !!form.value.channel_id
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

  const res = await fetch(`${api.url}/blog/channels/${channelID}/collections`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (!res.ok) return

  const data = await res.json()
  collections.value = data.data ?? data
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

function onChannelChange(value: string) {
  form.value.channel_id = value
  if (value && errorMsg.value === '请选择节目频道') errorMsg.value = ''
  selectedCollectionId.value = ''
  void loadCollections(value)
}

async function loadChannels() {
  if (!authStore.user) return
  const userID = authStore.user.uuid ?? authStore.user.id
  if (!userID) return
  const res = await fetch(
    `${api.url}/blog/channels?user_id=${encodeURIComponent(String(userID))}`,
    { headers: { Authorization: `Bearer ${authStore.token}` } },
  )
  if (res.ok) {
    const data = await res.json()
    const rows: Channel[] = data.data ?? data
    channels.value = rows.filter(channel => channel.content_type === 'podcast')
    const queryChannelId = selectedChannelFromQuery.value
    if (!form.value.channel_id && queryChannelId && channels.value.some(channel => channel.id === queryChannelId)) {
      form.value.channel_id = queryChannelId
    }
    if (!form.value.channel_id) {
      const defaultRes = await fetch(`${api.url}/users/me/default-channels`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (defaultRes.ok) {
        const defaultData = await defaultRes.json()
        const defaultChannelID = defaultData.data?.podcast?.id
        if (defaultChannelID && channels.value.some(channel => channel.id === defaultChannelID)) {
          form.value.channel_id = defaultChannelID
        }
      }
    }
    if (!form.value.channel_id && channels.value.length > 0) {
      form.value.channel_id = channels.value[0].id
    }
    if (form.value.channel_id) {
      await loadCollections(form.value.channel_id)
    }
  }
}

async function loadEpisode() {
  const id = route.params.id as string
  const res = await fetch(`${api.url}/podcast/episodes/${id}`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (!res.ok) return
  const ep: PodcastEpisode = await res.json()
  form.value = {
    channel_id: ep.channel_id,
    title: ep.post?.title || '',
    shownotes: ep.post?.content || '',
    audio_url: ep.audio_url,
    episode_cover_url: ep.episode_cover_url,
    season_number: ep.season_number,
    episode_number: ep.episode_number,
  }
  await loadCollections(ep.channel_id)
  selectedCollectionId.value = ep.post?.collection_id || ep.collections?.[0]?.id || ''
}

onMounted(async () => {
  await loadChannels()
  if (isEdit.value) {
    uploadStarted.value = true
    await loadEpisode()
  }
})

async function saveDraft() {
  if (publishedEpisodeId.value && publishNavigationFailed.value) {
    errorMsg.value = publishNavigationError
    showPublishConfirm.value = true
    return
  }
  if (!validate()) return
  savingDraft.value = true
  errorMsg.value = ''
  draftSaved.value = false
  try {
    const ep = await apiSave(buildPayload('draft'))
    if (!isEdit.value) router.replace(`/podcasts/editor/${ep.id}`)
    draftSaved.value = true
    setTimeout(() => { draftSaved.value = false }, 3000)
  } catch (e: any) {
    errorMsg.value = e?.error || '保存失败，请重试'
  } finally {
    savingDraft.value = false
  }
}

function requestPublish() {
  if (!validate()) return
  errorMsg.value = ''
  showPublishConfirm.value = true
}

function cancelPublish() {
  if (publishing.value || (publishedEpisodeId.value && publishNavigationFailed.value)) return
  showPublishConfirm.value = false
}

async function doPublish() {
  if (publishing.value) return
  publishing.value = true
  errorMsg.value = ''
  try {
    if (!publishedEpisodeId.value) {
      try {
        const ep = await apiSave(buildPayload('published'))
        publishedEpisodeId.value = isEdit.value ? String(route.params.id) : ep.id
      } catch (e: any) {
        errorMsg.value = e?.error || '发布失败，请重试'
        return
      }
    }

    try {
      const failure = await router.push(`/podcasts/episode/${publishedEpisodeId.value}`)
      if (isNavigationFailure(failure)) {
        publishNavigationFailed.value = true
        errorMsg.value = publishNavigationError
        showPublishConfirm.value = true
        return
      }
      publishNavigationFailed.value = false
      showPublishConfirm.value = false
    } catch (e) {
      console.error('Failed to navigate after publishing podcast episode:', e)
      publishNavigationFailed.value = true
      errorMsg.value = publishNavigationError
      showPublishConfirm.value = true
    }
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="pe-wrap">
    <PPageHeader :title="isEdit ? '编辑单集' : '发布新单集'" accent />

    <PSurface v-if="!canEditMetadata" tone="paper" :layer="1" class="pe-gate">
      <h2 class="pe-section-title">上传节目音频</h2>
      <label class="pe-drop-zone pe-source-card">
        <input
          type="file"
          accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,audio/x-m4a,audio/webm,video/mp4,video/webm,video/quicktime,.mp3,.ogg,.wav,.aac,.m4a,.flac,.webm,.mp4,.mov"
          class="pe-file-hidden"
          @change="onMediaFileChange"
        />
        <span class="pe-source-icon">♪</span>
        <span class="pe-drop-hint">选择或拖拽音频/视频文件</span>
        <span class="pe-drop-sub">支持音频 MP3、AAC、M4A、OGG、WAV、FLAC、WebM，也支持上传 MP4、MOV、WebM 视频提取音频</span>
      </label>
      <p v-if="audioError" class="pe-field-error">{{ audioError }}</p>
    </PSurface>

    <div v-else class="pe-layout">
      <!-- 左栏 -->
      <div class="pe-main">
        <!-- 音频文件 -->
        <PSurface tone="paper" :layer="1" class="pe-section">
          <h2 class="pe-section-title">音频文件</h2>

          <!-- 已上传 -->
          <div v-if="form.audio_url && !audioUploading" class="pe-uploaded">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color:var(--a-color-success,#166534);flex-shrink:0">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span class="pe-uploaded-name">音频已上传</span>
            <button type="button" class="pe-reupload" @click="form.audio_url = ''">重新上传</button>
          </div>

          <!-- 未上传 / 上传中 -->
          <template v-else>
            <div v-if="audioBusy" class="pe-uploading-box">
              <span class="pe-uploading-label">{{ uploadStage || '处理中' }} {{ audioUploadProgress }}%</span>
            </div>
            <label v-else class="pe-drop-zone pe-source-card">
              <input
                type="file"
                accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,audio/x-m4a,audio/webm,video/mp4,video/webm,video/quicktime,.mp3,.ogg,.wav,.aac,.m4a,.flac,.webm,.mp4,.mov"
                class="pe-file-hidden"
                @change="onMediaFileChange"
              />
              <span class="pe-source-icon">♪</span>
              <span class="pe-drop-hint">重新选择音频/视频文件</span>
              <span class="pe-drop-sub">音频直接上传；视频会先提取为 WebM 音频</span>
            </label>

            <!-- 进度条 -->
            <div v-if="audioBusy" class="pe-progress-track">
              <div class="pe-progress-bar" :style="{ width: audioUploadProgress + '%' }" />
            </div>

            <p v-if="audioError" class="pe-field-error">{{ audioError }}</p>
          </template>

          <!-- 音频预览 -->
          <div v-if="form.audio_url && !audioUploading" class="pe-audio-preview">
            <audio :src="form.audio_url" controls preload="none" style="width:100%" />
          </div>
        </PSurface>

        <!-- 基本信息 -->
        <PSurface tone="paper" :layer="1" class="pe-section">
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
        </PSurface>

        <!-- 归档位置 -->
        <PSurface tone="paper" :layer="1" class="pe-section">
          <h2 class="pe-section-title">归档位置</h2>
          <div class="a-field--line">
            <PSelect
              label="节目频道 *"
              :model-value="form.channel_id"
              :options="channelOptions"
              @update:model-value="onChannelChange($event as string)"
            />
          </div>

          <div class="pe-collections">
            <label class="pe-field-label">加入合集</label>
            <div v-if="!form.channel_id" class="pe-collections-empty">请先选择节目频道</div>
            <div v-else-if="collections.length === 0" class="pe-collections-empty">当前频道暂无合集</div>
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
        </PSurface>

        <!-- 单集编号 -->
        <PSurface tone="paper" :layer="1" class="pe-section">
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
        </PSurface>
      </div>

      <!-- 右栏：发布面板 -->
      <PSurface tone="paper" :layer="1" class="pe-panel">
        <PodcastCoverPanel
          :effective-cover-u-r-l="effectiveCoverURL"
          :effective-cover-label="effectiveCoverLabel"
          :cover-uploading="coverUploading"
          @cover-file-change="onCoverFileChange"
        />

        <!-- 全局错误 / 成功 -->
        <p v-if="errorMsg" class="pe-error">{{ errorMsg }}</p>
        <p v-if="draftSaved" class="pe-saved">草稿已保存</p>

        <!-- 操作按钮 -->
        <div class="pe-panel-actions">
          <PPress
            variant="secondary"
            class="w-full"
            :loading="savingDraft"
            loading-text="保存中…"
            :disabled="publishing || audioBusy || !form.audio_url"
            @click="saveDraft"
          >
            保存草稿
          </PPress>
          <PPress
            class="w-full"
            :loading="publishing"
            loading-text="发布中…"
            :disabled="savingDraft || audioBusy || !form.audio_url"
            @click="requestPublish"
          >
            立即发布
          </PPress>
        </div>
      </PSurface>
    </div>

    <!-- 发布确认弹窗 -->
    <PConfirm
      :show="showPublishConfirm"
      title="确认发布单集"
      :message="errorMsg || `《${form.title || '未命名单集'}》将立即对听众公开，发布后可继续编辑。`"
      :confirm-text="publishNavigationFailed && !publishing ? '查看单集' : publishing ? '发布中...' : '立即发布'"
      cancel-text="再想想"
      @confirm="doPublish"
      @cancel="cancelPublish"
    />
  </div>
</template>

<style scoped>
.pe-wrap {
  max-width: 60rem;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 6rem;
}

.pe-layout {
  display: grid;
  grid-template-columns: 1fr 17rem;
  gap: 1.5rem;
  align-items: start;
  margin-top: 1.5rem;
}

.pe-main { display: flex; flex-direction: column; gap: 1.5rem; }

.pe-gate {
  max-width: 40rem;
  margin: 1.5rem auto 0;
  padding: 1.5rem;
}

.pe-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
}

.pe-section-title {
  font-family: var(--a-font-serif);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--a-color-fg);
  margin: 0 0 0.25rem 0;
}

.pe-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

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
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line-soft);
  border-radius: 8px;
  font-size: 0.8rem;
}
.pe-uploaded-name { flex: 1; color: var(--a-color-fg); font-weight: 500; }
.pe-reupload {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
.pe-reupload:hover { color: var(--a-color-fg); }

.pe-source-card {
  min-height: 13rem;
}

.pe-source-icon {
  font-size: 1.75rem;
  line-height: 1;
  color: var(--a-color-muted);
}

.pe-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 2rem 1rem;
  border: 1px dashed var(--a-color-line);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}
.pe-drop-zone:hover:not(.pe-drop-zone--uploading) {
  border-color: var(--a-color-fg);
  background: var(--a-color-paper-soft);
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
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line-soft);
}

.pe-progress-track {
  height: 4px;
  background: var(--a-color-line-soft);
  overflow: hidden;
}
.pe-progress-bar {
  height: 100%;
  background: var(--a-color-fg);
  transition: width 0.2s ease;
}

.pe-field-error { font-size: 0.8rem; color: var(--a-color-danger); margin: 0; }

.pe-audio-preview { margin-top: 0.25rem; }

/* ── Publish panel ── */
.pe-panel {
  position: sticky;
  top: 5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
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
  border: 1px solid var(--a-color-line-soft);
  padding: 0.375rem;
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

.pe-cover-section { display: flex; flex-direction: column; gap: 0.375rem; }

.pe-cover-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1/1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--a-color-paper-soft);
}
.pe-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pe-cover-source {
  position: absolute;
  left: 0.5rem;
  bottom: 0.5rem;
  padding: 0.125rem 0.375rem;
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: 0.6875rem;
}
.pe-cover-reupload {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.45);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.pe-cover-preview:hover .pe-cover-reupload { opacity: 1; }

.pe-cover-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  width: 100%;
  aspect-ratio: 1/1;
  border: 1px dashed var(--a-color-line);
  cursor: pointer;
  transition: border-color 0.15s;
}
.pe-cover-empty:hover:not(.pe-cover-empty--uploading) {
  border-color: var(--a-color-fg);
}
.pe-cover-empty--uploading { cursor: default; opacity: 0.6; }
.pe-cover-hint { font-size: 0.75rem; color: var(--a-color-muted); }
.pe-cover-sub { font-size: 0.7rem; color: var(--a-color-muted); margin: 0; }

.pe-file-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.pe-panel-actions { display: flex; flex-direction: column; gap: 0.625rem; }

.pe-error { font-size: 0.8rem; color: var(--a-color-danger); margin: 0; }
.pe-saved { font-size: 0.8rem; color: var(--a-color-success); margin: 0; }

@media (max-width: 768px) {
  .pe-layout { grid-template-columns: 1fr; }
  .pe-panel { position: static; order: -1; }
}
</style>
