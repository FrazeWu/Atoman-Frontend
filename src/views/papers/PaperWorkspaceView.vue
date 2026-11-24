<template>
  <main class="papers-workspace">
    <header class="papers-workspace__header">
      <RouterLink to="/papers">← 我的论文</RouterLink>
      <strong>{{ project?.name || '论文工作台' }}</strong>
      <div class="papers-workspace__layout-tools">
        <button type="button" title="文件栏" :aria-pressed="showFiles" @click="showFiles = !showFiles">文件</button>
        <button type="button" :aria-pressed="layoutMode === 'split'" @click="layoutMode = 'split'">分栏</button>
        <button type="button" :aria-pressed="layoutMode === 'editor'" @click="layoutMode = 'editor'">源码</button>
        <button type="button" :aria-pressed="layoutMode === 'pdf'" @click="layoutMode = 'pdf'">预览</button>
      </div>
      <span class="papers-workspace__status" role="status">{{ saveStatus }}</span>
      <PButton v-if="project" type="button" size="sm" variant="secondary" :disabled="exporting || saving" @click="exportProject">{{ exporting ? '正在导出…' : '导出 ZIP' }}</PButton>
    </header>
    <p v-if="loading" class="papers-workspace__message">正在打开项目...</p>
    <p v-else-if="error" role="alert" class="papers-workspace__error">{{ error }}</p>
    <div v-else ref="workspaceRoot" class="papers-workspace__content" :class="{ 'files-hidden': !showFiles, 'editor-only': layoutMode === 'editor', 'pdf-only': layoutMode === 'pdf' }" :style="{ '--preview-width': previewWidth + '%' }">
      <aside class="papers-workspace__files" aria-label="论文文件">
        <div class="papers-workspace__files-heading"><h2>文件</h2><span>{{ files.length }}</span></div>
        <button v-for="file in files" :key="file.id" type="button" :class="{ active: activeFile?.id === file.id }" @click="selectFile(file)">
          {{ file.path }}<span v-if="file.kind === 'binary'" class="papers-workspace__asset-label">资源</span>
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
          <button type="button" class="papers-workspace__sync" title="定位当前源码行对应的 PDF 内容 (Ctrl/Cmd+Shift+J)" :disabled="!syncReady || activeFile?.kind !== 'text'" @click="jumpToPDF">定位 PDF →</button>
          <PButton type="button" size="sm" variant="secondary" :disabled="!activeFile || activeFile.kind !== 'text' || saving" @click="saveNow">保存</PButton>
        </div>
        <LatexEditor v-if="activeFile?.kind === 'text'" :key="activeFile.id" ref="editorRef" v-model="draft" @show-pdf="jumpToPDF" />
        <p v-else-if="activeFile?.kind === 'binary'" class="papers-workspace__message">此资源文件随项目编译与导出保留，不支持文本编辑。</p>
        <p v-else class="papers-workspace__message">在左侧选择一个文件开始编辑。</p>
        <p v-if="exportError" class="papers-workspace__error" role="alert">{{ exportError }}</p>
        <p v-if="saveError" class="papers-workspace__error" role="alert">
          {{ saveError }} 当前输入已保留在编辑器中，请先处理冲突，避免离开页面。
        </p>
      </section>
      <div v-if="layoutMode === 'split'" class="papers-workspace__divider" role="separator" aria-label="调整编辑器和预览宽度" aria-orientation="vertical" tabindex="0" :aria-valuenow="previewWidth" @pointerdown="beginResize" @pointermove="resizeMove" @pointerup="endResize" @pointercancel="endResize" @keydown.left.prevent="previewWidth=Math.min(75,previewWidth+3)" @keydown.right.prevent="previewWidth=Math.max(25,previewWidth-3)" />
      <aside class="papers-workspace__preview" aria-label="编译预览">
        <div class="papers-workspace__preview-heading">
          <strong>PDF 预览</strong>
          <button type="button" class="papers-workspace__sync" title="跳到预览对应源码（也可双击 PDF）" :disabled="!syncReady" @click="jumpToCode">← 源码</button>
          <label class="papers-workspace__auto"><input type="checkbox" v-model="autoCompile" /> 自动编译</label>
          <PButton type="button" size="sm" :disabled="!compileEnabled || compiling || saving || !project || hasActiveCompile" @click="compileNow">
            {{ compiling ? '提交中...' : hasActiveCompile ? '编译中' : '编译' }}
          </PButton>
        </div>
        <p v-if="syncMessage" class="papers-workspace__sync-message" role="status">{{ syncMessage }}</p>
        <p v-if="compileError" class="papers-workspace__error" role="alert">{{ compileError }}</p>
        <div v-if="!compileEnabled" class="papers-workspace__preview-empty">
          <strong>编译尚未开放</strong>
          <p>源码编辑与保存可用。可信编译服务尚未完成生产安全验收，编译按钮保持禁用。</p>
        </div>
        <div v-else-if="compileJob" class="papers-workspace__compile-status" role="status">
          <span><strong>{{ compileStateLabel }}</strong> · 版本 {{ compileJob.source_revision }}</span>
          <span v-if="previewStale" class="papers-workspace__stale">预览为上次成功版本</span>
          <p v-if="compileJob.failure_code">错误代码：{{ compileJob.failure_code }}</p>
          <p v-if="compileJob.cancel_requested && hasActiveCompile">取消请求已提交，等待沙箱安全回收。</p>
          <PButton v-if="canCancelCompile" type="button" size="sm" variant="secondary" :disabled="canceling" @click="cancelCompile">
            {{ canceling ? '取消中...' : '取消任务' }}
          </PButton>
          <p v-if="compileJob.status === 'succeeded' && (!pdfEnabled || !compileJob.pdf_available)">
            编译已完成，暂无可验证的 PDF 产物。
          </p>
        </div>
        <div v-else class="papers-workspace__preview-empty">
          <strong>准备编译</strong><p>点击编译生成 PDF。</p>
        </div>
        <PaperPDFPreview
          v-if="compileEnabled && pdfEnabled && previewJob"
          ref="pdfRef"
          :key="projectId"
          :project-id="projectId"
          :job-id="previewJob.id"
          :revision="previewJob.source_revision"
          @pdf-position="jumpFromPDF"
          @displayed-job="displayedPDFJob = $event"
        />
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import LatexEditor from '@/components/papers/LatexEditor.vue'
import PaperPDFPreview from '@/components/papers/PaperPDFPreview.vue'
import { decodeSourceMap, sourceToPDF, pdfToSource, type PaperSourceMap } from '@/components/papers/sourceMap'
import {
  createPaperFile, getPaperFile, getPaperProject, listPaperFiles, savePaperFile, getPaperProjectZIP, downloadPaperZIP,
  getPaperCompileCapability, getPaperCompileJob, listPaperCompileJobs, submitPaperCompile, cancelPaperCompile, getPaperCompileSourceMap,
  type PaperFile, type PaperProject, type PaperCompileJob,
} from '@/api/papers'

const route = useRoute()
const projectId = computed(() => String(route.params.projectId || ''))
const loading = ref(true)
const error = ref('')
const fileError = ref('')
const saveError = ref('')
const saving = ref(false)
const exporting = ref(false)
const exportError = ref('')
const addingFile = ref(false)
const project = ref<PaperProject | null>(null)
const files = ref<PaperFile[]>([])
const activeFile = ref<PaperFile | null>(null)
const draft = ref('')
const newFilePath = ref('')
const saveStatus = ref('尚未打开文件')
const compileEnabled = ref(false)
const pdfEnabled = ref(false)
const compileJob = ref<PaperCompileJob | null>(null)
const previewJob = ref<PaperCompileJob | null>(null)
const previewStale = computed(() => !!previewJob.value && (previewJob.value.id !== compileJob.value?.id || previewJob.value.source_revision !== project.value?.head_revision || (activeFile.value?.kind === 'text' && draft.value !== activeFile.value.content)))
const editorRef=ref<InstanceType<typeof LatexEditor>|null>(null)
const pdfRef=ref<InstanceType<typeof PaperPDFPreview>|null>(null)
const sourceMap=shallowRef<PaperSourceMap|null>(null)
const mapJob=ref('')
const displayedPDFJob=ref('')
const syncMessage=ref('')
let mapAbort:AbortController|undefined
let mapSerial=0
const syncReady=computed(()=>!!sourceMap.value&&!!previewJob.value&&mapJob.value===previewJob.value.id&&displayedPDFJob.value===mapJob.value&&previewJob.value.source_revision===project.value?.head_revision&&draft.value===activeFile.value?.content)
watch(()=>[projectId.value,previewJob.value?.id] as const,async ([pid,jid])=>{
 const serial=++mapSerial;mapAbort?.abort();mapAbort=new AbortController()
 sourceMap.value=null;mapJob.value='';syncMessage.value=''
 if(!jid)return
 try{
  const raw=await getPaperCompileSourceMap(pid,jid,mapAbort.signal)
  if(serial!==mapSerial||disposed||projectId.value!==pid)return
  sourceMap.value=decodeSourceMap(raw);mapJob.value=sourceMap.value?jid:''
 }catch{if(serial===mapSerial&&!disposed)sourceMap.value=null}
})
function checkSync(){
 if(!syncReady.value){syncMessage.value=previewJob.value?.source_revision!==project.value?.head_revision||draft.value!==activeFile.value?.content?'源码已更新，请重新编译后再定位。':'此 PDF 尚无定位数据，请重新编译。';return false}
 return true
}
async function jumpToPDF(){
 if(!checkSync()||!sourceMap.value||!activeFile.value)return
 const p=sourceToPDF(sourceMap.value,activeFile.value.path,editorRef.value?.getLine?.()||1, pdfRef.value?.page||1)
 if(!p){syncMessage.value='当前源码行没有对应的 PDF 内容。';return}
 if(layoutMode.value==='editor')layoutMode.value='split'
 await nextTick()
 if(!await pdfRef.value?.showPosition(p[2],p[3]/10,p[4]/10,mapJob.value)){syncMessage.value='PDF 正在更新，请稍后再定位。';return}
 syncMessage.value=''
}
async function jumpFromPDF(pos:{jobId:string;page:number;x:number;y:number}){
 if(!checkSync()||!sourceMap.value||pos.jobId!==mapJob.value)return
 const p=pdfToSource(sourceMap.value,pos.page,pos.x,pos.y)
 if(!p){syncMessage.value='这个位置没有可定位的源码。';return}
 const target=files.value.find(f=>f.path===sourceMap.value?.files[p[0]]&&f.kind==='text')
 if(!target){syncMessage.value='没有找到对应的项目源文件。';return}
 if(layoutMode.value==='pdf')layoutMode.value='split'
 await selectFile(target)
 await nextTick()
 if(activeFile.value?.id===target.id){editorRef.value?.goToLine?.(p[1]);syncMessage.value=''}
}
function jumpToCode(){const pos=pdfRef.value?.currentPosition();if(pos)void jumpFromPDF(pos)}

const workspaceRoot=ref<HTMLElement|null>(null)
const previewWidth=ref(49)
const showFiles=ref(true)
const layoutMode=ref<'split'|'editor'|'pdf'>('split')
const autoCompile=ref(false)
let dragging=false
let autoTimer:ReturnType<typeof setTimeout>|null=null
let lastAutoCompile=0
let autoDirty=false
function beginResize(e:PointerEvent){dragging=true;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);resizeMove(e)}
function resizeMove(e:PointerEvent){
 if(!dragging||!workspaceRoot.value)return
 const r=workspaceRoot.value.getBoundingClientRect()
 const filesWidth=showFiles.value?(workspaceRoot.value.querySelector('.papers-workspace__files')?.clientWidth||0):0
 previewWidth.value=Math.max(25,Math.min(75,(r.right-e.clientX)/Math.max(1,r.width-filesWidth)*100))
}
function endResize(){dragging=false}
function clearAuto(){if(autoTimer)clearTimeout(autoTimer);autoTimer=null}
function scheduleAuto(){
 clearAuto()
 if(!autoCompile.value||!autoDirty||!compileEnabled.value||hasActiveCompile.value||compiling.value||disposed)return
 autoTimer=setTimeout(()=>{
  if(!autoCompile.value||!autoDirty||hasActiveCompile.value||compiling.value||disposed||document.visibilityState==='hidden')return
  autoDirty=false;lastAutoCompile=Date.now();void compileNow()
 },Math.max(15000,60000-(Date.now()-lastAutoCompile)))
}
watch(autoCompile,enabled=>{if(enabled){autoDirty=previewStale.value||!previewJob.value;scheduleAuto()}else clearAuto()})
watch(compileJob,job=>{if(job?.status==='succeeded'&&job.pdf_available)previewJob.value=job})

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
watch([hasActiveCompile,compiling],()=>scheduleAuto())
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
    pdfEnabled.value = compileEnabled.value && capability?.pdf_available === true
    const main = currentFiles.find((file) => file.id === currentProject.main_file_id) || currentFiles[0]
    if (main) await selectFile(main)
    if (compileEnabled.value && !disposed && serial === loadSerial) {
      // Do not hold the editor's loading state hostage to queue history.
      void listPaperCompileJobs(requestedProjectId).then((history) => {
        if (!disposed && serial === loadSerial && requestedProjectId === projectId.value) {
          compileJob.value = history[0] ?? null
          previewJob.value = history.find(job => job.status === 'succeeded' && job.pdf_available) ?? null
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
  if (activeFile.value?.kind === 'text' && content !== activeFile.value.content) { scheduleSave();autoDirty=true;scheduleAuto() }
})

async function persist(): Promise<boolean> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (savePromise) {
    await savePromise
    if (saveError.value) return false
  }
  const file = activeFile.value
  if (!file || file.kind !== 'text' || draft.value === file.content) return true
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
  if (file.kind === 'binary') {
    activeFile.value = { ...file, content: '' }
    draft.value = ''
    saveStatus.value = '资源文件'
    saveError.value = ''
    return
  }
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
  clearAuto();autoDirty=false;lastAutoCompile=Date.now()
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
  if (document.visibilityState === 'visible') { void refreshCompileStatus();scheduleAuto() }
}

async function exportProject() {
  if (exporting.value || !project.value) return
  exporting.value = true
  exportError.value = ''
  const id = projectId.value
  const name = project.value.name
  try {
    if (!await persist()) { exportError.value = '请先解决保存失败或版本冲突再导出。'; return }
    if (disposed || id !== projectId.value) return
    const blob = await getPaperProjectZIP(id)
    if (!disposed && id === projectId.value) downloadPaperZIP(blob, name)
  } catch {
    if (!disposed && id === projectId.value) exportError.value = '导出失败，请稍后重试。'
  } finally { exporting.value = false }
}

function saveNow() { void persist() }

function beforeUnload(event: BeforeUnloadEvent) {
  if (savePromise || (activeFile.value?.kind === 'text' && draft.value !== activeFile.value.content)) {
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
  previewJob.value = null
  displayedPDFJob.value='';sourceMap.value=null;mapJob.value='';mapAbort?.abort();mapSerial++;syncMessage.value=''
  clearAuto();autoDirty=false
  compileEnabled.value = false
  pdfEnabled.value = false
  compileError.value = ''
  exportError.value = ''
  activeFile.value = null
  draft.value = ''
  files.value = []
  project.value = null
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  void loadProject()
})

function onShortcut(e:KeyboardEvent){
 if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();void compileNow()}
}
onMounted(() => {
  window.addEventListener('keydown',onShortcut)
  void loadProject()
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('visibilitychange', onCompileVisibilityChange)
})

onBeforeUnmount(() => {
  disposed = true
  loadSerial++
  fileSerial++
  if (saveTimer) clearTimeout(saveTimer)
  clearAuto()
  mapAbort?.abort();mapSerial++
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('keydown',onShortcut)
  document.removeEventListener('visibilitychange', onCompileVisibilityChange)
  stopCompilePoll()
  if (activeFile.value && draft.value !== activeFile.value.content) void persist()
})
</script>

<style scoped>
.papers-workspace{height:calc(100dvh - 64px - var(--a-content-bottom-offset,0px));min-height:440px;display:flex;flex-direction:column;overflow:hidden;color:var(--a-color-text,#20242c)}
.papers-workspace__header{display:flex;gap:12px;align-items:center;padding:8px 14px;flex-shrink:0;border-bottom:1px solid var(--a-color-border-soft,#e0e4ea);min-height:44px}
.papers-workspace__header a{color:inherit;text-decoration:none;white-space:nowrap;font-size:12px}
.papers-workspace__header strong{flex:1;min-width:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
.papers-workspace__status{font-size:12px;color:var(--a-color-text-secondary,#64748b);white-space:nowrap}
.papers-workspace__layout-tools{display:flex;gap:3px;align-items:center}
.papers-workspace__layout-tools button{border:1px solid var(--a-color-border-soft,#dce1e7);border-radius:4px;padding:4px 7px;background:transparent;color:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.papers-workspace__layout-tools button[aria-pressed=true]{background:var(--a-color-bg-subtle,#e7edf3);font-weight:600}
.papers-workspace__content{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden}
.papers-workspace__files{width:196px;flex-shrink:0;min-height:0;overflow:auto;padding:10px 8px;border-right:1px solid var(--a-color-border-soft,#e0e4ea)}
.papers-workspace__files-heading{display:flex;justify-content:space-between;align-items:center;margin:4px 6px 10px}
.papers-workspace__files-heading h2{font-weight:650;font-size:13px;margin:0}
.papers-workspace__files button:not(.p-button){display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:7px 6px;cursor:pointer;border-radius:4px;overflow-wrap:anywhere;font-size:12px;line-height:1.4}
.papers-workspace__files button.active{background:var(--a-color-bg-subtle,#e7edf3);font-weight:650}
.papers-workspace__add{margin-top:18px;display:grid;gap:6px}
.papers-workspace__add label{font-size:12px;font-weight:600}
.papers-workspace__add input{min-width:0;padding:6px;border:1px solid var(--a-color-border-soft,#d6dde3);border-radius:5px;background:var(--a-color-bg,#fff);color:inherit;font-size:12px}
.papers-workspace__editor{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;flex:1}
.papers-workspace__editor-header{min-height:42px;box-sizing:border-box;flex-shrink:0;padding:6px 10px;border-bottom:1px solid var(--a-color-border-soft,#e0e4ea);display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
.papers-workspace__editor-header span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.papers-workspace__editor :deep(.papers-latex-editor){flex:1;min-height:0;height:auto}
.papers-workspace__divider{width:8px;flex-shrink:0;background:var(--a-color-bg-subtle,#e5e9ee);border-left:1px solid var(--a-color-border-soft,#d0d6de);border-right:1px solid var(--a-color-border-soft,#d0d6de);cursor:col-resize;touch-action:none;position:relative}
.papers-workspace__divider:after{content:'';position:absolute;left:2px;top:calc(50% - 18px);width:2px;height:36px;border-radius:3px;background:#9ba6b5}
.papers-workspace__preview{flex:0 0 var(--preview-width);min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.papers-workspace__preview-heading{min-height:42px;flex-shrink:0;padding:5px 10px;display:flex;align-items:center;gap:9px;justify-content:space-between;font-size:13px;border-bottom:1px solid var(--a-color-border-soft,#e0e4ea)}
.papers-workspace__auto{display:flex;align-items:center;gap:4px;font-weight:400;font-size:12px;margin-left:auto;white-space:nowrap}
.papers-workspace__preview-empty{padding:24px 12px;text-align:center;font-size:13px;color:var(--a-color-text-secondary,#64748b)}
.papers-workspace__compile-status{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:5px 10px;font-size:12px;flex-shrink:0;border-bottom:1px solid var(--a-color-border-soft,#e0e4ea);color:var(--a-color-text-secondary,#64748b)}
.papers-workspace__compile-status p{margin:0;overflow-wrap:anywhere}.papers-workspace__stale{color:#96620a}
.papers-workspace__message{padding:12px;font-size:13px;color:var(--a-color-text-secondary,#64748b)}
.papers-workspace__error{color:#b91c1c;padding:6px 10px;font-size:12px;margin:0}
.papers-workspace__asset-label{font-size:10px;opacity:.65;margin-left:6px}
.files-hidden .papers-workspace__files,.pdf-only .papers-workspace__files,.pdf-only .papers-workspace__editor,.editor-only .papers-workspace__preview{display:none}
.pdf-only .papers-workspace__preview{flex:1}
@media(max-width:1000px){.papers-workspace__files{width:155px}.papers-workspace__header{gap:7px}.papers-workspace__header strong{min-width:60px}}
@media(max-width:700px){.papers-workspace{height:calc(100dvh - 56px);min-height:320px}.papers-workspace__header{flex-wrap:wrap}.papers-workspace__header strong{min-width:80px}.papers-workspace__files{width:115px}.papers-workspace__auto{font-size:11px}.papers-workspace__preview-heading{flex-wrap:wrap}.papers-workspace__content:not(.editor-only):not(.pdf-only) .papers-workspace__files{display:none}.papers-workspace__content:not(.editor-only):not(.pdf-only) .papers-workspace__editor{min-width:0}.papers-workspace__preview{flex-basis:var(--preview-width)}}
.papers-workspace__sync{font-size:11px;white-space:nowrap;background:transparent;color:var(--a-color-primary,#26784b);border:1px solid var(--a-color-border-soft,#d7dde4);border-radius:4px;padding:4px 7px;cursor:pointer}.papers-workspace__sync:disabled{opacity:.4;cursor:default}.papers-workspace__sync-message{font-size:12px;padding:5px 10px;margin:0;color:var(--a-color-text-secondary,#64748b);flex-shrink:0}
</style>
