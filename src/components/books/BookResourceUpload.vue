<template>
  <section class="resource-upload" :aria-labelledby="`resource-upload-title${idSuffix}`">
    <h3 :id="`resource-upload-title${idSuffix}`">{{ replaceAsset ? '上传替换文件' : '上传电子书' }}</h3>
    <p>支持 EPUB、PDF、TXT、CBZ、CBR。文件通过自动安全检查后直接公开，不需要人工审核。</p>
    <form @submit.prevent="upload">
      <fieldset :disabled="busy || pending" class="resource-upload__fields">
        <label :for="`resource-file${idSuffix}`">电子书文件</label>
        <input :id="`resource-file${idSuffix}`" ref="fileInput" type="file" accept=".epub,.pdf,.txt,.cbz,.cbr" @change="chooseFile">
        <PInput v-if="!replaceAsset" id="resource-language" v-model="language" label="文件语言代码" placeholder="例如 zh、en；不确定时留空" />
        <label><input v-model="confirmed" type="checkbox"> 我确认有权将这个文件公开分享</label>
        <PButton type="submit" :loading="busy" :disabled="!file || !confirmed || (!!session && session.status !== 'uploading')">{{ session?.status === 'uploading' ? '继续本次上传' : '上传并公开文件' }}</PButton>
      </fieldset>
    </form>
    <div v-if="busy" role="status"><progress :value="percent" max="100" aria-label="文件上传进度" /> {{ percent }}% · {{ phase }}</div>
    <p v-if="session" role="status">{{ statusText }}</p>
    <p v-if="error" class="resource-upload__error" role="alert">{{ error }}</p>
    <PButton v-if="pending && !busy" variant="secondary" :disabled="checking" @click="checkStatus">检查处理状态</PButton>
    <PButton v-if="session?.status === 'ready' && session.revision_id" :to="resourceReaderPath(workId, session.asset_id, session.revision_id)">开始阅读</PButton>
    <PButton v-if="session && ['ready', 'failed', 'quarantined'].includes(session.status)" variant="secondary" @click="chooseAnother">重新选择文件</PButton>
    <PConfirm :show="leaveOpen" title="中断文件上传" message="文件尚未上传完成。离开会中断本次传输，确定离开吗？" @confirm="leave(true)" @cancel="leave(false)" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ApiErrorResponseError } from '@/api/client'
import { createCatalogResource, createResourceUpload, getResourceUpload, resourceReaderPath, uploadResourceFile, type ResourceUpload } from '@/api/bookResources'
import type { CatalogResource } from '@/api/bookCatalog'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'

const props = defineProps<{ workId: string; title: string; replaceAsset?: CatalogResource }>()
const idSuffix = props.replaceAsset ? `-${props.replaceAsset.id}` : ''
const emit = defineEmits<{ ready: [] }>()
const auth = useAuthStore()
const storageKey = `atoman:book-upload:${auth.user?.uuid}:${props.workId}${props.replaceAsset ? ':' + props.replaceAsset.id : ''}`
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const language = ref('')
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
const statusText = computed(() => {
  const status = session.value?.status
  if (status === 'ready') return '文件已公开，可以开始阅读。'
  if (status === 'failed' || status === 'quarantined') return `文件未公开：${session.value?.error_message || '未通过自动安全检查，请检查源文件。'}`
  if (status === 'uploading') return '文件还未传完，可在本页继续本次上传。'
  return '文件已收到，正在自动检查。图书本身始终公开，检查完成后文件会自动公开。'
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
function chooseAnother() { if (fileInput.value) { fileInput.value.value = ''; fileInput.value.click() } }
async function upload() {
  if (!file.value || !confirmed.value || busy.value || pending.value) return
  busy.value = true
  error.value = ''
  controller = new AbortController()
  try {
    phase.value = '准备上传'
    if (props.replaceAsset) {
      if (file.value.name.split('.').pop()?.toLowerCase() !== props.replaceAsset.format) throw new Error('替换文件必须与原文件格式相同。不同格式请创建独立电子书。')
      resource.value = props.replaceAsset
    }
    if (!resource.value) resource.value = await createCatalogResource(props.workId, { title: props.title, language: language.value.trim(), format: file.value.name.split('.').pop()!.toLowerCase() as CatalogResource['format'] })
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
  if (!busy.value) return true
  leaveOpen.value = true
  return new Promise<boolean>(resolve => { resolveLeave = resolve })
})
function beforeUnload(event: BeforeUnloadEvent) { if (busy.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  let saved: string | null = null
  try { saved = localStorage.getItem(storageKey) } catch { /* best effort */ }
  if (saved) { session.value = { id: saved, status: 'scanning' } as ResourceUpload; await checkStatus() }
})
onBeforeUnmount(() => { alive = false; controller?.abort(); clearTimeout(timer); window.removeEventListener('beforeunload', beforeUnload); resolveLeave?.(false) })
</script>

<style scoped>
.resource-upload { margin-block: 1.5rem; padding-block: 1rem; border-top: 1px solid var(--a-color-border-soft); }
.resource-upload__fields { display: grid; gap: 1rem; padding: 0; margin: 0; border: 0; min-width: 0; }
.resource-upload__error { color: var(--a-color-danger); }
.resource-upload progress { max-width: 100%; }
</style>
