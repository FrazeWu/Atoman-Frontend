<template>
  <section class="resource-upload" :aria-labelledby="`resource-upload-title${idSuffix}`">
    <div class="resource-upload__header">
      <h3 :id="`resource-upload-title${idSuffix}`" class="resource-upload__title">{{ replaceAsset ? '上传替换文件' : '上传电子书' }}</h3>
      <p class="resource-upload__desc">支持 EPUB、PDF、TXT、CBZ、CBR。文件先通过自动安全检查，默认仅上传者可读；确认有权分享时可选择公开。</p>
    </div>
    <form @submit.prevent="upload">
      <fieldset :disabled="busy || pending" class="resource-upload__fields">
        <div v-if="showFilePicker" class="resource-upload__file-picker">
          <label :for="`resource-file${idSuffix}`" class="resource-upload__file-label">
            <span class="resource-upload__file-icon">📁</span>
            <span class="resource-upload__file-text">{{ autoStart ? '更换电子书文件' : '选择电子书文件 (EPUB, PDF, TXT, CBZ, CBR)' }}</span>
          </label>
          <input :id="`resource-file${idSuffix}`" ref="fileInput" type="file" accept=".epub,.pdf,.txt,.cbz,.cbr" class="resource-upload__native-file" @change="chooseFile">
        </div>
        <p v-if="file" class="resource-upload__chosen-hint">{{ autoStart ? '沿用上一步的文件（无需再次选择）：' : '已选择：' }}<strong>{{ file.name }}</strong></p>
        <PInput v-if="!replaceAsset && !autoStart" id="resource-language" v-model="language" label="文件语言代码" placeholder="例如 zh、en；不确定时留空" />
        <label v-if="!autoStart" class="resource-upload__checkbox-label"><input v-model="confirmed" type="checkbox"> 同时公开分享此文件（我确认拥有公开分享所需权利）</label>
        <p v-if="autoStart">{{ busy ? '正在将选定文件上传到私有书架…' : '默认仅自己可读；公开分享需要另外确认版权与分享权限。' }}</p>
        <div class="resource-upload__action-row">
          <PButton v-if="!autoStart || !initialFile || !!error" type="submit" :loading="busy"
            :disabled="!file || (!!session && session.status !== 'uploading')">
            {{ session?.status === 'uploading' ? '继续本次上传' : (confirmed ? '上传并公开文件' : '上传文件（仅自己可读）') }}
          </PButton>
        </div>
      </fieldset>
    </form>
    <div v-if="busy" role="status" class="resource-upload__progress-wrap"><progress :value="percent" max="100" aria-label="文件上传进度" /> {{ percent }}% · {{ phase }}</div>
    <p v-if="session" role="status" class="resource-upload__status">{{ statusText }}</p>
    <p v-if="error" class="resource-upload__error" role="alert">{{ error }}</p>
    <div class="resource-upload__footer-actions">
      <PButton v-if="pending && !busy" variant="secondary" :disabled="checking" @click="checkStatus">检查处理状态</PButton>
      <PButton v-if="session?.status === 'ready' && session.revision_id" :to="resourceReaderPath(workId, session.asset_id, session.revision_id)">开始阅读</PButton>
      <PButton v-if="session && ['ready', 'failed', 'quarantined'].includes(session.status)" variant="secondary" @click="chooseAnother">重新选择文件</PButton>
    </div>
    <PConfirm :show="leaveOpen" title="中断文件上传" message="文件尚未上传完成。离开会中断本次传输，确定离开吗？" @confirm="leave(true)" @cancel="leave(false)" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ApiErrorResponseError } from '@/api/client'
import { createCatalogResource, createResourceUpload, getResourceUpload, resourceReaderPath, uploadResourceFile, type ResourceUpload } from '@/api/bookResources'
import type { CatalogResource } from '@/api/bookCatalog'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'

const props = defineProps<{ workId: string; title: string; editionId?: string; initialFile?: File | null; initialLanguage?: string; replaceAsset?: CatalogResource; autoStart?: boolean }>()
const idSuffix = `-${props.replaceAsset?.id || props.editionId || props.workId}`
const emit = defineEmits<{ ready: [] }>()
const auth = useAuthStore()
const storageKey = `atoman:book-upload:${auth.user?.uuid}:${props.workId}:${props.replaceAsset?.id || props.editionId || 'legacy'}`
const file = shallowRef<File | null>(props.initialFile || null)
const fileInput = ref<HTMLInputElement | null>(null)
const language = ref(props.initialLanguage || '')
const confirmed = ref(false)
const busy = ref(false)
const percent = ref(0)
const phase = ref('')
const error = ref('')
const resource = ref<CatalogResource | null>(null)
const session = ref<ResourceUpload | null>(null)
const checking = ref(false)
const leaveOpen = ref(false)
let resolveLeave: ((value: boolean) => void) | undefined
let controller: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let alive = true
const pending = computed(() => !!session.value && ['uploaded', 'scanning', 'completing'].includes(session.value.status))
const showFilePicker = computed(() => !props.autoStart || !props.initialFile || (!!error.value && !busy.value && !pending.value) || ['failed', 'quarantined'].includes(session.value?.status || ''))
const unsubmitted = computed(() => !!file.value && !pending.value && session.value?.status !== 'ready')
const statusText = computed(() => {
  const status = session.value?.status
  if (status === 'ready') return confirmed.value ? '文件已通过安全检查并公开分享。' : '文件已通过安全检查，仅自己可读；以后可以单独选择公开分享。'
  if (status === 'failed' || status === 'quarantined') return `文件未公开：${session.value?.error_message || '未通过自动安全检查，请检查源文件。'}`
  if (status === 'uploading') return '文件还未传完，可在本页继续本次上传。'
  return '文件已收到，正在自动安全检查。书目公开不代表电子书文件自动公开。'
})
function persistStatus() {
  // 只恢复已提交文件的处理状态；刷新后不复用无法核对内容的未完成分片。
  if (session.value && session.value.status !== 'uploading') {
    try { localStorage.setItem(storageKey, session.value.id) } catch { /* 不影响上传 */ }
  }
}
function chooseFile(event: Event) {
  if (busy.value || pending.value) return
  clearTimeout(timer)
  file.value = (event.target as HTMLInputElement).files?.[0] || null
  resource.value = null
  session.value = null
  percent.value = 0
  error.value = ''
  confirmed.value = false
  try { localStorage.removeItem(storageKey) } catch { /* best effort */ }
  if (file.value && (!/\.(epub|pdf|txt|cbz|cbr)$/i.test(file.value.name) || file.value.size === 0)) {
    error.value = '请选择非空的 EPUB、PDF、TXT、CBZ 或 CBR 文件。'
    file.value = null
  }
}
function chooseAnother() { if (fileInput.value) { fileInput.value.value = ''; fileInput.value.click() } else { error.value = '请选择下方文件输入框重新上传。' } }
async function upload() {
  if (!file.value || busy.value || pending.value) return
  busy.value = true
  error.value = ''
  controller = new AbortController()
  try {
    phase.value = '准备上传'
    if (props.replaceAsset) {
      if (file.value.name.split('.').pop()?.toLowerCase() !== props.replaceAsset.format) throw new Error('替换文件必须与原文件格式相同。不同格式请创建独立电子书。')
      resource.value = props.replaceAsset
    }
    if (!props.replaceAsset && !props.editionId) throw new Error('请先确认文件所属的版本／译本。')
    if (!resource.value) resource.value = await createCatalogResource(props.workId, { edition_id: props.editionId, title: props.title, language: language.value.trim(), format: file.value.name.split('.').pop()!.toLowerCase() as CatalogResource['format'] })
    if (!alive) return
    if (!session.value) session.value = await createResourceUpload(resource.value.id, file.value, confirmed.value)
    if (!alive) return
    phase.value = '传输文件'
    session.value = await uploadResourceFile(file.value, session.value, { signal: controller.signal, onProgress: value => { percent.value = Math.round(value.loaded / Math.max(1, value.total) * 100) } })
    if (!alive) return
    persistStatus()
    if (session.value.status === 'ready') emit('ready')
    else if (pending.value) timer = setTimeout(checkStatus, 3000)
  } catch (err) { if (alive) error.value = err instanceof Error ? err.message : '上传失败，请在本页继续重试。' }
  finally { if (alive) busy.value = false }
}
async function checkStatus() {
  if (!session.value || checking.value) return
  clearTimeout(timer)
  checking.value = true
  error.value = ''
  try {
    const result = await getResourceUpload(session.value.id)
    if (!alive) return
    session.value = result
    persistStatus()
    if (result.status === 'ready') emit('ready')
    else if (pending.value) timer = setTimeout(checkStatus, 3000)
  } catch (err) {
    if (!alive) return
    if (err instanceof ApiErrorResponseError && [401, 404].includes(err.status)) {
      session.value = null
      try { localStorage.removeItem(storageKey) } catch { /* best effort */ }
      error.value = '之前的上传记录已不可用，请确认登录状态后重新选择文件。'
    } else error.value = '暂时无法取得处理状态。文件不会因此重复上传，请点击检查处理状态重试。'
  }
  finally { if (alive) checking.value = false }
}
function leave(value: boolean) { leaveOpen.value = false; resolveLeave?.(value); resolveLeave = undefined }
onBeforeRouteLeave(() => {
  if (!busy.value && !unsubmitted.value) return true
  leaveOpen.value = true
  return new Promise<boolean>(resolve => { resolveLeave = resolve })
})
function beforeUnload(event: BeforeUnloadEvent) { if (busy.value || unsubmitted.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  let saved: string | null = null
  try { saved = localStorage.getItem(storageKey) } catch { /* best effort */ }
  if (saved) { session.value = { id: saved, status: 'scanning' } as ResourceUpload; await checkStatus() }
  else if (props.autoStart && file.value && !session.value) void upload()
})
onBeforeUnmount(() => { alive = false; controller?.abort(); clearTimeout(timer); window.removeEventListener('beforeunload', beforeUnload); resolveLeave?.(false) })
</script>

<style scoped>
.resource-upload {
  margin-block: 1.5rem;
  padding: 1.5rem;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.025);
}

.resource-upload__header {
  margin-bottom: 1.25rem;
}

.resource-upload__title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--a-color-text);
  margin: 0 0 0.35rem;
}

.resource-upload__desc {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.resource-upload__fields {
  display: grid;
  gap: 1rem;
  padding: 0;
  margin: 0;
  border: 0;
  min-width: 0;
}

.resource-upload__file-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.resource-upload__file-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  background: var(--a-color-bg, #ffffff);
  border: 1.5px solid rgba(0, 122, 255, 0.35);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
  user-select: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.resource-upload__file-label:hover {
  border-color: #007aff;
  background: rgba(0, 122, 255, 0.04);
  transform: translateY(-1px);
}

.resource-upload__file-icon {
  font-size: 1.15rem;
}

.resource-upload__file-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text);
}

.resource-upload__native-file {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.resource-upload__chosen-hint {
  font-size: 0.875rem;
  color: var(--a-color-primary, #0066cc);
  margin: 0;
  padding: 0.5rem 0.75rem;
  background: rgba(0, 102, 204, 0.06);
  border-radius: 6px;
}

.resource-upload__checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--a-color-text);
  cursor: pointer;
}

.resource-upload__action-row {
  margin-top: 0.25rem;
}

.resource-upload__progress-wrap {
  margin-top: 1rem;
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
}

.resource-upload__status {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
  margin-top: 0.5rem;
}

.resource-upload__error {
  color: var(--a-color-danger);
  font-size: 0.8125rem;
  margin-top: 0.5rem;
}

.resource-upload__footer-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}
</style>
