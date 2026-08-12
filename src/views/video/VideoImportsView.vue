<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ExternalLink, Pencil, RefreshCw, Trash2, Upload, XCircle } from 'lucide-vue-next'

import {
  cancelVideoImport,
  deleteVideoImportRecord,
  listVideoImports,
  retryVideoImport,
  submitVideoImport,
  type VideoImportStatus,
  type VideoImportTask,
} from '@/api/video'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useVideoImportUpload } from '@/composables/useVideoImportUpload'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/logger'

type ImportGroup = 'active' | 'attention' | 'completed' | 'canceled'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const uploader = useVideoImportUpload()
const imports = ref<VideoImportTask[]>([])
const loading = ref(false)
const actionBusy = ref('')
const error = ref('')
const activeGroup = ref<ImportGroup>('active')
const selectedId = ref(typeof route.query.task === 'string' ? route.query.task : '')
const resumeInput = ref<HTMLInputElement | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const mergedImports = computed(() => imports.value.map(task => uploader.uploads.value[task.id]?.task ?? task))
const groups = computed(() => mergedImports.value.reduce<Record<ImportGroup, VideoImportTask[]>>((result, task) => {
  result[groupFor(task.status)].push(task)
  return result
}, { active: [], attention: [], completed: [], canceled: [] }))
const visibleImports = computed(() => groups.value[activeGroup.value])
const selected = computed(() => mergedImports.value.find(task => task.id === selectedId.value) ?? visibleImports.value[0])
const selectedUpload = computed(() => selected.value ? uploader.uploads.value[selected.value.id] : undefined)
const selectedProgress = computed(() => selectedUpload.value?.progress ?? progressOf(selected.value))

const groupTabs: Array<{ value: ImportGroup; label: string }> = [
  { value: 'active', label: '进行中' },
  { value: 'attention', label: '需要处理' },
  { value: 'completed', label: '已完成' },
  { value: 'canceled', label: '已取消' },
]

const statusLabels: Record<VideoImportStatus, string> = {
  pending_upload: '等待上传', uploading: '上传中', completing: '正在完成', awaiting_submit: '等待提交',
  publishing: '正在发布', published: '已发布', draft: '已保存草稿', scheduled: '已定时', failed: '需要处理', canceled: '已取消',
}

onMounted(() => void loadImports())
onUnmounted(() => { if (pollTimer) clearTimeout(pollTimer) })

async function loadImports(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try {
    imports.value = await listVideoImports(auth.token ?? undefined)
    imports.value.forEach(uploader.applyTask)
    const selectedTask = mergedImports.value.find(task => task.id === selectedId.value)
    if (selectedTask) activeGroup.value = groupFor(selectedTask.status)
    if (!visibleImports.value.some(task => task.id === selectedId.value)) selectedId.value = visibleImports.value[0]?.id ?? ''
  } catch (cause) {
    if (!silent) error.value = errorMessage(cause, '导入记录加载失败')
  } finally {
    loading.value = false
    schedulePoll()
  }
}

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer)
  const hasActive = mergedImports.value.some(task => ['pending_upload', 'uploading', 'completing', 'publishing'].includes(task.status))
  if (hasActive) pollTimer = setTimeout(() => void loadImports(true), 3000)
}

function selectGroup(group: ImportGroup) {
  activeGroup.value = group
  selectedId.value = groups.value[group][0]?.id ?? ''
}

function chooseResumeFile() { resumeInput.value?.click() }

async function resumeUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !selected.value) return
  actionBusy.value = 'resume'
  error.value = ''
  try {
    await uploader.resume(selected.value, file)
    schedulePoll()
  } catch (cause) {
    error.value = errorMessage(cause, '无法继续上传')
  } finally {
    actionBusy.value = ''
  }
}

async function cancelTask() {
  if (!selected.value || !window.confirm('确认取消这个导入任务？')) return
  actionBusy.value = 'cancel'
  try {
    uploader.stop(selected.value.id)
    await cancelVideoImport(selected.value.id, auth.token ?? undefined)
    await loadImports(true)
  } catch (cause) {
    error.value = errorMessage(cause, '取消失败')
  } finally {
    actionBusy.value = ''
  }
}

async function retryTask() {
  if (!selected.value) return
  actionBusy.value = 'retry'
  try {
    await retryVideoImport(selected.value.id, auth.token ?? undefined)
    await loadImports(true)
  } catch (cause) {
    error.value = errorMessage(cause, '重试失败')
  } finally {
    actionBusy.value = ''
  }
}

async function publishTask() {
  if (!selected.value || !selected.value.upload_completed_at || selected.value.publish_requested_at) return
  actionBusy.value = 'publish'
  error.value = ''
  try {
    await submitVideoImport(selected.value.id, selected.value.payload, 'published', null, auth.token ?? undefined)
    await loadImports(true)
  } catch (cause) {
    error.value = errorMessage(cause, '发布失败，请重试')
  } finally {
    actionBusy.value = ''
  }
}

async function deleteRecord() {
  if (!selected.value || !window.confirm('确认删除这条导入记录？')) return
  actionBusy.value = 'delete'
  try {
    await deleteVideoImportRecord(selected.value.id, auth.token ?? undefined)
    selectedId.value = ''
    await loadImports(true)
  } catch (cause) {
    error.value = errorMessage(cause, '删除记录失败')
  } finally {
    actionBusy.value = ''
  }
}

function needsFile(task: VideoImportTask) {
  return !task.upload_completed_at && !selectedUpload.value?.uploading && task.status !== 'canceled'
}

function groupFor(status: VideoImportStatus): ImportGroup {
  if (status === 'failed') return 'attention'
  if (status === 'published' || status === 'draft' || status === 'scheduled') return 'completed'
  if (status === 'canceled') return 'canceled'
  return 'active'
}

function progressOf(task?: VideoImportTask) {
  if (!task) return 0
  if (task.upload_completed_at) return 100
  return task.progress_total ? Math.round((task.progress_current / task.progress_total) * 100) : 0
}

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="video-imports">
    <PPageHeader title="导入中心">
      <template #action>
        <PButton to="/studio/video/new"><Upload :size="16" aria-hidden="true" />上传视频</PButton>
      </template>
    </PPageHeader>

    <p v-if="error" class="video-imports__error" role="alert">{{ error }}</p>

    <div class="video-imports__tabs" role="tablist" aria-label="导入状态">
      <button
        v-for="tab in groupTabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="activeGroup === tab.value"
        :class="{ 'is-active': activeGroup === tab.value }"
        @click="selectGroup(tab.value)"
      >
        {{ tab.label }} <span>{{ groups[tab.value].length }}</span>
      </button>
    </div>

    <p v-if="loading" class="video-imports__state">加载中...</p>
    <p v-else-if="!visibleImports.length" class="video-imports__state">暂无导入任务</p>

    <div v-else class="video-imports__layout">
      <div class="video-imports__list" role="list">
        <button
          v-for="task in visibleImports"
          :key="task.id"
          type="button"
          role="listitem"
          :class="{ 'is-selected': selected?.id === task.id }"
          @click="selectedId = task.id"
        >
          <span class="video-imports__list-main"><strong>{{ task.payload.title || task.file_name }}</strong><small>{{ task.file_name }}</small></span>
          <span class="video-imports__list-meta"><span>{{ statusLabels[task.status] }}</span><time>{{ formatDate(task.updated_at) }}</time></span>
        </button>
      </div>

      <section v-if="selected" class="video-imports__detail" aria-live="polite">
        <header>
          <div><h2>{{ selected.payload.title || selected.file_name }}</h2><p>{{ selected.file_name }} · {{ formatSize(selected.file_size) }}</p></div>
          <strong>{{ statusLabels[selected.status] }}</strong>
        </header>

        <div class="video-imports__progress" :aria-label="`上传进度 ${selectedProgress}%`">
          <div><span>上传进度</span><strong>{{ selectedProgress }}%</strong></div>
          <div class="video-imports__progress-track"><span :style="{ width: `${selectedProgress}%` }" /></div>
        </div>

        <dl>
          <div><dt>可见范围</dt><dd>{{ selected.payload.visibility === 'private' ? '私密' : selected.payload.visibility === 'followers' ? '仅关注者' : '公开' }}</dd></div>
          <div><dt>合集</dt><dd>{{ selected.payload.collection_ids.length }} 个</dd></div>
          <div><dt>提交方式</dt><dd>{{ selected.publish_mode === 'scheduled' ? '定时发布' : selected.publish_mode === 'draft' ? '保存草稿' : selected.publish_mode === 'published' ? '自动发布' : '尚未提交' }}</dd></div>
        </dl>

        <p v-if="selectedUpload?.error || selected.error_message" class="video-imports__error" role="alert">{{ selectedUpload?.error || selected.error_message }}</p>

        <div class="video-imports__actions">
          <template v-if="needsFile(selected)">
            <input ref="resumeInput" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" hidden @change="resumeUpload" />
            <PButton :loading="actionBusy === 'resume'" @click="chooseResumeFile"><Upload :size="16" aria-hidden="true" />继续上传</PButton>
          </template>
          <PButton v-if="!selected.publish_requested_at && selected.status !== 'canceled'" variant="secondary" @click="router.push(`/studio/video/new?import=${selected.id}`)"><Pencil :size="16" aria-hidden="true" />继续编辑</PButton>
          <PButton v-if="selected.upload_completed_at && !selected.publish_requested_at && selected.status !== 'canceled'" :loading="actionBusy === 'publish'" @click="publishTask"><Upload :size="16" aria-hidden="true" />立即发布</PButton>
          <PButton v-if="selected.status === 'failed' && selected.upload_completed_at && selected.publish_requested_at" :loading="actionBusy === 'retry'" @click="retryTask"><RefreshCw :size="16" aria-hidden="true" />重试发布</PButton>
          <PButton v-if="selected.target_video_id" variant="secondary" :to="`/videos/watch/${selected.target_video_id}`"><ExternalLink :size="16" aria-hidden="true" />查看视频</PButton>
          <PButton v-if="!selected.target_video_id && selected.status !== 'canceled'" variant="danger" :loading="actionBusy === 'cancel'" @click="cancelTask"><XCircle :size="16" aria-hidden="true" />取消任务</PButton>
          <PButton v-if="['published', 'draft', 'scheduled', 'canceled'].includes(selected.status)" variant="secondary" :loading="actionBusy === 'delete'" @click="deleteRecord"><Trash2 :size="16" aria-hidden="true" />删除记录</PButton>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.video-imports { display: grid; gap: 1rem; }
.video-imports__error { margin: 0; color: var(--a-color-danger); }
.video-imports__tabs { display: flex; gap: 1.25rem; overflow-x: auto; border-bottom: 1px solid var(--a-color-border-soft); }
.video-imports__tabs button { min-height: 44px; padding: 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--a-color-muted); cursor: pointer; white-space: nowrap; }
.video-imports__tabs button.is-active { border-bottom-color: currentColor; color: var(--a-color-fg); }
.video-imports__tabs span { margin-left: .25rem; font-variant-numeric: tabular-nums; }
.video-imports__state { min-height: 12rem; display: grid; place-items: center; margin: 0; color: var(--a-color-muted); }
.video-imports__layout { display: grid; grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr); border-top: 1px solid var(--a-color-border-soft); }
.video-imports__list { border-right: 1px solid var(--a-color-border-soft); }
.video-imports__list > button { width: 100%; min-height: 68px; display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .75rem; border: 0; border-bottom: 1px solid var(--a-color-border-soft); background: transparent; color: inherit; cursor: pointer; text-align: left; }
.video-imports__list > button:hover, .video-imports__list > button.is-selected { background: var(--a-color-surface-muted); }
.video-imports__list-main, .video-imports__list-meta { min-width: 0; display: grid; gap: .2rem; }
.video-imports__list-main strong, .video-imports__list-main small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.video-imports__list-main small, .video-imports__list-meta time { color: var(--a-color-muted); }
.video-imports__list-meta { flex: none; text-align: right; font-size: .78rem; }
.video-imports__detail { min-width: 0; display: grid; align-content: start; gap: 1.25rem; padding: 1.25rem; }
.video-imports__detail header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.video-imports__detail h2, .video-imports__detail p { margin: 0; }
.video-imports__detail h2 { font-size: 1.125rem; }
.video-imports__detail header p { margin-top: .25rem; color: var(--a-color-muted); }
.video-imports__detail header > strong { flex: none; font-size: .875rem; }
.video-imports__progress { display: grid; gap: .5rem; }
.video-imports__progress > div:first-child { display: flex; justify-content: space-between; }
.video-imports__progress-track { height: 6px; overflow: hidden; background: var(--a-color-surface-muted); }
.video-imports__progress-track span { display: block; height: 100%; background: var(--a-color-primary); transition: width .2s ease-out; }
.video-imports__detail dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin: 0; }
.video-imports__detail dl div { display: grid; gap: .25rem; }
.video-imports__detail dt { color: var(--a-color-muted); font-size: .8rem; }
.video-imports__detail dd { margin: 0; }
.video-imports__actions { display: flex; flex-wrap: wrap; gap: .5rem; padding-top: .25rem; }
@media (max-width: 760px) {
  .video-imports__layout { grid-template-columns: 1fr; }
  .video-imports__list { border-right: 0; }
  .video-imports__detail { padding: 1rem 0; }
  .video-imports__detail dl { grid-template-columns: 1fr; }
  .video-imports__actions :deep(.p-button) { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .video-imports__progress-track span { transition: none; } }
</style>
