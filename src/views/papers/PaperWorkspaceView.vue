<template>
  <main class="papers-workspace">
    <header class="papers-workspace__header">
      <RouterLink to="/papers">← 我的论文</RouterLink>
      <strong>{{ project?.name || '论文工作台' }}</strong>
      <span class="papers-workspace__status" role="status">{{ saveStatus }}</span>
    </header>
    <p v-if="loading" class="papers-workspace__message">正在打开项目...</p>
    <p v-else-if="error" role="alert" class="papers-workspace__error">{{ error }}</p>
    <div v-else class="papers-workspace__content">
      <aside class="papers-workspace__files" aria-label="论文文件">
        <div class="papers-workspace__files-heading"><h2>文件</h2><span>{{ files.length }}</span></div>
        <button v-for="file in files" :key="file.id" type="button" :class="{ active: activeFile?.id === file.id }" @click="selectFile(file)">
          {{ file.path }}
        </button>
        <form class="papers-workspace__add" @submit.prevent="addFile">
          <label for="papers-new-file">新建文本文件</label>
          <input id="papers-new-file" v-model.trim="newFilePath" placeholder="chapters/intro.tex" maxlength="512" required />
          <PButton type="submit" size="sm" :disabled="!newFilePath || addingFile">添加文件</PButton>
        </form>
        <p v-if="fileError" class="papers-workspace__error" role="alert">{{ fileError }}</p>
      </aside>
      <section class="papers-workspace__editor" aria-label="源码编辑">
        <div class="papers-workspace__editor-header">
          <span>{{ activeFile?.path || '请选择文件' }}</span>
          <PButton type="button" size="sm" variant="secondary" :disabled="!activeFile || saving" @click="saveNow">保存</PButton>
        </div>
        <LatexEditor v-if="activeFile" v-model="draft" />
        <p v-else class="papers-workspace__message">在左侧选择一个文件开始编辑。</p>
        <p v-if="saveError" class="papers-workspace__error" role="alert">
          {{ saveError }} 当前输入已保留在编辑器中，请先处理冲突，避免离开页面。
        </p>
      </section>
      <aside class="papers-workspace__preview" aria-label="编译预览">
        <div class="papers-workspace__preview-heading">
          <strong>PDF 预览</strong>
          <PButton type="button" size="sm" :disabled="!compileEnabled || compiling || saving || !project || hasActiveCompile" @click="compileNow">
            {{ compiling ? '提交中...' : '编译' }}
          </PButton>
        </div>
        <p v-if="compileError" class="papers-workspace__error" role="alert">{{ compileError }}</p>
        <div v-if="!compileEnabled" class="papers-workspace__preview-empty">
          <strong>编译尚未开放</strong>
          <p>源码编辑与保存可用。可信编译服务尚未完成生产安全验收，编译按钮保持禁用。</p>
        </div>
        <div v-else-if="compileJob" class="papers-workspace__preview-empty" role="status">
          <strong>编译状态：{{ compileStateLabel }}</strong>
          <p>源码版本 {{ compileJob.source_revision }}，已尝试 {{ compileJob.attempts }} 次。</p>
          <p v-if="compileJob.failure_code">错误代码：{{ compileJob.failure_code }}</p>
          <p v-if="compileJob.cancel_requested && hasActiveCompile">取消请求已提交，等待沙箱安全回收。</p>
          <PButton v-if="canCancelCompile" type="button" size="sm" variant="secondary" :disabled="canceling" @click="cancelCompile">
            {{ canceling ? '取消中...' : '取消任务' }}
          </PButton>
          <p v-if="compileJob.status === 'succeeded'">
            编译已完成，但 PDF 持久化与私有下载接口尚未上线，暂不提供预览。
          </p>
        </div>
        <div v-else class="papers-workspace__preview-empty">
          <strong>准备编译</strong>
          <p>先保存当前源码，再提交项目快照。编译任务将进入持久队列。</p>
        </div>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import LatexEditor from '@/components/papers/LatexEditor.vue'
import {
  createPaperFile, getPaperFile, getPaperProject, listPaperFiles, savePaperFile,
  getPaperCompileCapability, getPaperCompileJob, listPaperCompileJobs, submitPaperCompile, cancelPaperCompile,
  type PaperFile, type PaperProject, type PaperCompileJob,
} from '@/api/papers'

const route = useRoute()
const projectId = computed(() => String(route.params.projectId || ''))
const loading = ref(true)
const error = ref('')
const fileError = ref('')
const saveError = ref('')
const saving = ref(false)
const addingFile = ref(false)
const project = ref<PaperProject | null>(null)
const files = ref<PaperFile[]>([])
const activeFile = ref<PaperFile | null>(null)
const draft = ref('')
const newFilePath = ref('')
const saveStatus = ref('尚未打开文件')
const compileEnabled = ref(false)
const compileJob = ref<PaperCompileJob | null>(null)
const compileError = ref('')
const compiling = ref(false)
const canceling = ref(false)
const compileStateLabel = computed(() => {
  const labels: Record<string, string> = {
    queued: '排队中', running: '编译中', recovering: '恢复中',
    succeeded: '已完成', failed: '编译失败', canceled: '已取消', blocked: '已阻断',
  }
  return labels[compileJob.value?.status ?? ''] ?? '未知'
})
const hasActiveCompile = computed(() => !!compileJob.value &&
  ['queued', 'running', 'recovering'].includes(compileJob.value.status))
const canCancelCompile = computed(() => hasActiveCompile.value && !compileJob.value?.cancel_requested)
let compilePollTimer: ReturnType<typeof setTimeout> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let savePromise: Promise<boolean> | null = null
let loadSerial = 0
let fileSerial = 0
let disposed = false

async function loadProject() {
  const serial = ++loadSerial
  const requestedProjectId = projectId.value
  loading.value = true
  error.value = ''
  try {
    const [currentProject, currentFiles, capability] = await Promise.all([
      getPaperProject(requestedProjectId), listPaperFiles(requestedProjectId),
      Promise.resolve().then(() => getPaperCompileCapability(requestedProjectId)).catch(() => ({ enabled: false, pdf_available: false })),
    ])
    if (disposed || serial !== loadSerial || requestedProjectId !== projectId.value) return
    project.value = currentProject
    files.value = currentFiles
    compileEnabled.value = capability?.enabled === true
    const main = currentFiles.find((file) => file.id === currentProject.main_file_id) || currentFiles[0]
    if (main) await selectFile(main)
    if (compileEnabled.value && !disposed && serial === loadSerial) {
      // Do not hold the editor's loading state hostage to queue history.
      void listPaperCompileJobs(requestedProjectId).then((history) => {
        if (!disposed && serial === loadSerial && requestedProjectId === projectId.value) {
          compileJob.value = history[0] ?? null
          scheduleCompilePoll()
        }
      }).catch(() => {})
    }
  } catch {
    if (!disposed && serial === loadSerial) {
      error.value = '无法打开论文。请确认项目存在且当前账号具有访问权限。'
    }
  } finally {
    if (!disposed && serial === loadSerial) loading.value = false
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveStatus.value = '尚未保存'
  saveTimer = setTimeout(() => { void persist() }, 800)
}

watch(draft, (content) => {
  if (activeFile.value && content !== activeFile.value.content) scheduleSave()
})

async function persist(): Promise<boolean> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (savePromise) {
    await savePromise
    if (saveError.value) return false
  }
  const file = activeFile.value
  if (!file || draft.value === file.content) return true
  const content = draft.value
  saving.value = true
  saveStatus.value = '保存中...'
  savePromise = (async () => {
    try {
      const saved = await savePaperFile(projectId.value, file.id, content, file.revision)
      if (activeFile.value?.id === file.id) {
        activeFile.value = saved
        if (draft.value === content) saveStatus.value = '已保存'
        else scheduleSave()
      }
      files.value = files.value.map((item) => item.id === saved.id ? { ...item, revision: saved.revision } : item)
      if (project.value) project.value.head_revision += 1
      saveError.value = ''
      return true
    } catch {
      saveStatus.value = '保存失败'
      saveError.value = '保存失败或版本发生冲突。'
      return false
    } finally {
      saving.value = false
    }
  })()
  const success = await savePromise
  savePromise = null
  return success
}

async function selectFile(file: PaperFile) {
  const serial = ++fileSerial
  const requestedProjectId = projectId.value
  if (activeFile.value?.id === file.id) return
  if (activeFile.value && !await persist()) return
  if (disposed || serial !== fileSerial || requestedProjectId !== projectId.value) return
  fileError.value = ''
  try {
    const content = await getPaperFile(requestedProjectId, file.id)
    if (disposed || serial !== fileSerial || requestedProjectId !== projectId.value) return
    activeFile.value = content
    draft.value = content.content
    saveStatus.value = '已保存'
    saveError.value = ''
  } catch {
    if (!disposed && serial === fileSerial) fileError.value = '无法读取该文件。'
  }
}

async function addFile() {
  if (!newFilePath.value || addingFile.value) return
  if (!await persist()) return
  addingFile.value = true
  fileError.value = ''
  try {
    const created = await createPaperFile(projectId.value, newFilePath.value)
    files.value.push(created)
    files.value.sort((a, b) => a.path.localeCompare(b.path))
    if (project.value) project.value.head_revision += 1
    newFilePath.value = ''
    await selectFile(created)
  } catch {
    fileError.value = '无法创建文件。请检查路径、扩展名，或确认该文件尚不存在。'
  } finally {
    addingFile.value = false
  }
}

function stopCompilePoll() {
  if (compilePollTimer) clearTimeout(compilePollTimer)
  compilePollTimer = null
}

function scheduleCompilePoll() {
  stopCompilePoll()
  if (disposed || !compileEnabled.value || !compileJob.value ||
      !['queued', 'running', 'recovering'].includes(compileJob.value.status)) return
  compilePollTimer = setTimeout(() => { void refreshCompileStatus() }, 2500)
}

async function refreshCompileStatus() {
  const current = compileJob.value
  const requestedProjectId = projectId.value
  if (!current || disposed || !compileEnabled.value) return
  if (document.visibilityState === 'hidden') { scheduleCompilePoll(); return }
  try {
    const latest = await getPaperCompileJob(requestedProjectId, current.id)
    if (disposed || requestedProjectId !== projectId.value || compileJob.value?.id !== current.id) return
    compileJob.value = latest
    compileError.value = ''
  } catch {
    if (!disposed && requestedProjectId === projectId.value) compileError.value = '暂时无法更新编译状态，请检查网络。'
  } finally {
    if (!disposed && requestedProjectId === projectId.value) scheduleCompilePoll()
  }
}

async function compileNow() {
  if (!compileEnabled.value || compiling.value || hasActiveCompile.value || !project.value || disposed) return
  const requestedProjectId = projectId.value
  compileError.value = ''
  compiling.value = true
  try {
    // Do not compile an unsaved draft, even if a debounce timer is pending.
    if (!await persist()) {
      compileError.value = '请先解决源码保存失败或版本冲突。'
      return
    }
    const latestProject = await getPaperProject(requestedProjectId)
    if (disposed || requestedProjectId !== projectId.value) return
    project.value = latestProject
    const key = globalThis.crypto?.randomUUID?.() ?? ('compile-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2))
    const job = await submitPaperCompile(requestedProjectId, latestProject.head_revision, key)
    if (disposed || requestedProjectId !== projectId.value) return
    compileJob.value = job
    scheduleCompilePoll()
  } catch {
    if (!disposed && requestedProjectId === projectId.value)
      compileError.value = '无法提交编译任务。可能是环境未就绪、源码格式不支持或项目版本发生冲突。'
  } finally {
    compiling.value = false
  }
}

async function cancelCompile() {
  if (!canCancelCompile.value || canceling.value || !compileJob.value) return
  const requestedProjectId = projectId.value
  const jobId = compileJob.value.id
  canceling.value = true
  try {
    const updated = await cancelPaperCompile(requestedProjectId, jobId)
    if (disposed || requestedProjectId !== projectId.value || compileJob.value?.id !== jobId) return
    compileJob.value = updated
    scheduleCompilePoll()
  } catch {
    if (!disposed && requestedProjectId === projectId.value)
      compileError.value = '取消请求失败，请重新检查任务状态。'
  } finally {
    canceling.value = false
  }
}

function onCompileVisibilityChange() {
  if (document.visibilityState === 'visible') void refreshCompileStatus()
}

function saveNow() { void persist() }

function beforeUnload(event: BeforeUnloadEvent) {
  if (savePromise || (activeFile.value && draft.value !== activeFile.value.content)) {
    event.preventDefault()
  }
}

onBeforeRouteLeave(async () => persist())
onBeforeRouteUpdate(async () => persist())

watch(projectId, () => {
  loadSerial++
  fileSerial++
  stopCompilePoll()
  compileJob.value = null
  compileEnabled.value = false
  compileError.value = ''
  activeFile.value = null
  draft.value = ''
  files.value = []
  project.value = null
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  void loadProject()
})

onMounted(() => {
  void loadProject()
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('visibilitychange', onCompileVisibilityChange)
})

onBeforeUnmount(() => {
  disposed = true
  loadSerial++
  fileSerial++
  if (saveTimer) clearTimeout(saveTimer)
  window.removeEventListener('beforeunload', beforeUnload)
  document.removeEventListener('visibilitychange', onCompileVisibilityChange)
  stopCompilePoll()
  if (activeFile.value && draft.value !== activeFile.value.content) void persist()
})
</script>

<style scoped>
.papers-workspace { height: calc(100vh - 88px); min-height: 590px; display: flex; flex-direction: column; }
.papers-workspace__header { display:flex; gap:18px; align-items:center; padding:15px 22px; border-bottom:1px solid var(--border,#e1e5ea); }
.papers-workspace__header a { color:inherit; text-decoration:none; }
.papers-workspace__header strong { flex:1; }
.papers-workspace__status { font-size:12px; color:var(--text-secondary,#718096); }
.papers-workspace__content { display:grid; grid-template-columns: 230px minmax(320px,1fr) minmax(250px, 38%); flex:1; min-height:0; }
.papers-workspace__files,.papers-workspace__preview { padding:15px; overflow:auto; }
.papers-workspace__files { border-right:1px solid var(--border,#e1e5ea); }
.papers-workspace__files-heading { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.papers-workspace__files-heading h2 { font-weight:650; font-size:14px; }
.papers-workspace__files button:not(.p-button) { display:block; width:100%; text-align:left; border:0; background:transparent; color:inherit; padding:9px; cursor:pointer; border-radius:7px; word-break:break-all; }
.papers-workspace__files button.active { background:var(--surface-secondary,#edf1f6); font-weight:650; }
.papers-workspace__add { margin-top:23px; display:grid; gap:9px; }
.papers-workspace__add label { font-size:12px; font-weight:650; }
.papers-workspace__add input { min-width:0; padding:9px; border:1px solid var(--border,#d6dde3); border-radius:7px; background:var(--surface,#fff); color:inherit; }
.papers-workspace__editor { min-width:0; display:flex; flex-direction:column; overflow:hidden; }
.papers-workspace__editor-header { padding:9px 16px; border-bottom:1px solid var(--border,#e1e5ea); display:flex; align-items:center; justify-content:space-between; }
.papers-workspace__editor :deep(.papers-latex-editor) { flex:1; }
.papers-workspace__preview { border-left:1px solid var(--border,#e1e5ea); }
.papers-workspace__preview-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; font-weight:650; padding-bottom:14px; }
.papers-workspace__preview-empty { padding:24px 14px; text-align:center; border:1px dashed var(--border,#ccd1d8); border-radius:10px; }
.papers-workspace__preview-empty p,.papers-workspace__message { color:var(--text-secondary,#718096); }
.papers-workspace__error { color:#b91c1c; padding:12px; }
@media (max-width: 960px) { .papers-workspace { height:auto; min-height:calc(100vh - 88px); } .papers-workspace__content { grid-template-columns:160px minmax(0,1fr); min-height:650px; } .papers-workspace__preview { grid-column:1/-1; border-left:0; border-top:1px solid var(--border,#e1e5ea); } }
@media (max-width: 600px) { .papers-workspace__content { display:flex; flex-direction:column; } .papers-workspace__files { max-height:200px; border-right:0; border-bottom:1px solid var(--border,#e1e5ea); } .papers-workspace__editor { min-height:460px; } }
</style>
