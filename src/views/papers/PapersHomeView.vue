<template>
  <main class="a-page-md papers-home">
    <PPageHeader title="Papers" sub="在线 LaTeX 编辑与编译 · 申请审核制" />
    <p v-if="loading" aria-live="polite">正在加载论文项目...</p>
    <section v-else-if="!allowed" class="papers-home__notice">
      <h2>{{ application?.status === 'pending' ? '申请审核中' : application?.status === 'rejected' ? '申请未通过' : application?.status === 'approved' ? '访问权限暂未开放' : '申请使用 Atoman Papers' }}</h2>
      <p v-if="application?.status === 'pending'">申请已提交，请等待管理员审核。通过后会向你的 Atoman 账号邮箱发送通知。</p>
      <template v-else-if="application?.status === 'rejected'">
        <p>{{ application.review_note || '申请暂未通过。' }}</p>
        <p>审核完成七天后可重新申请。</p>
      </template>
      <p v-else-if="application?.status === 'approved'">请联系管理员恢复权限。</p>
      <p v-else>提交使用申请，审核通过后即可创建私有论文项目。通知邮件将发送到你当前账号绑定的邮箱。</p>
      <form v-if="canApply && !accessError" class="papers-home__apply" @submit.prevent="apply">
        <label for="paper-application-reason">申请理由</label>
        <PTextarea id="paper-application-reason" v-model.trim="reason" :rows="4" maxlength="1000" minlength="5" required :disabled="applying" placeholder="简要说明你的科研、写作或 LaTeX 使用需求（至少 5 字）" />
        <PButton type="submit" :disabled="applying || reason.length < 5">提交申请</PButton>
      </form>
      <PButton v-else size="sm" variant="secondary" @click="load">刷新状态</PButton>
      <p v-if="error" role="alert" class="papers-home__error">{{ error }}</p>
    </section>
    <section v-else class="papers-home__body">
      <form class="papers-home__create" @submit.prevent="create()">
        <h2>新建论文项目</h2>
        <div class="papers-home__import-actions">
          <PButton type="button" size="sm" :variant="!importSource && !selectedTemplate && !showTemplates ? 'primary' : 'secondary'" :disabled="creating" @click="clearImport">空白项目</PButton>
          <PButton type="button" size="sm" :variant="showTemplates||selectedTemplate?'primary':'secondary'" :disabled="creating" :aria-expanded="showTemplates" @click="showTemplates=!showTemplates">模板库</PButton>
          <PButton type="button" size="sm" variant="secondary" :disabled="creating" @click="folderInput?.click()">上传文件夹</PButton>
          <PButton type="button" size="sm" variant="secondary" :disabled="creating" @click="zipInput?.click()">上传 ZIP</PButton>
          <input ref="folderInput" type="file" webkitdirectory multiple hidden :disabled="creating" @change="chooseImport($event, 'folder')" />
          <input ref="zipInput" type="file" accept=".zip,application/zip" hidden :disabled="creating" @change="chooseImport($event, 'zip')" />
        </div>
        <PaperTemplateLibrary v-if="showTemplates" :selected-id="templateId" :disabled="creating" @select="chooseTemplate" />
        <div v-if="selectedTemplate" class="papers-home__template-selection" role="status">
          <div><strong>{{ selectedTemplate.name }}</strong><p>{{ selectedTemplate.compiler==='xelatex'?'需 XeLaTeX 中文环境 · ':'' }}{{ selectedTemplate.official?'写作稿，非正式投稿格式。':'包含章节源码与 BibTeX 文献库。' }}</p></div>
          <PButton type="button" size="sm" variant="ghost" :disabled="creating" @click="clearImport">取消选择</PButton>
        </div>
        <div v-if="importSource" class="papers-home__selected">
          <span>{{ importSource.label }} · {{ importSource.kind === 'folder' ? importSource.files.length + ' 个文件' : (importSource.files[0].size / 1048576).toFixed(2) + ' MiB' }}</span>
          <PButton size="sm" variant="ghost" :disabled="creating" @click="clearImport">取消选择</PButton>
        </div>
        <label for="paper-project-name">项目名称</label>
        <div class="papers-home__actions">
          <PInput id="paper-project-name" v-model.trim="projectName" maxlength="100" placeholder="例如：Jailbreak Defense" required :disabled="creating" />
          <PButton type="submit" :disabled="creating || !projectName || !!exclusion">{{ creating ? '处理中…' : selectedTemplate ? '从模板创建' : importSource ? '创建并导入' : '创建' }}</PButton>
        </div>
        <div v-if="importSource" class="papers-home__main-file">
          <label for="paper-main-file">主 TeX 文件（可选）</label>
          <PInput id="paper-main-file" v-model.trim="mainFile" maxlength="255" :disabled="creating" placeholder="自动识别，例如 paper.tex" />
          <p>支持 TeX、BibTeX、样式及 PNG/JPG/PDF 资源。ZIP 最大 5 MiB，编译源文件最多 64 个、编码后总计 4 MiB。忽略常见系统和 Git 元数据。</p>
        </div>
        <section v-if="exclusion" class="papers-home__exclusion" aria-label="不支持的项目文件">
          <h3>发现 {{ exclusion.files.length }} 个不支持的文件</h3>
          <p>以下文件类型或路径暂不支持。是否将它们从本次导入中排除？原始文件夹和 ZIP 压缩包不会被修改。</p>
          <ul class="papers-home__exclusion-list">
            <li v-for="file in exclusion.files" :key="file">{{ file }}</li>
          </ul>
          <p>其余论文源码、图片和参考文献仍将正常导入。排除的文件不会出现在项目或导出的 ZIP 中。</p>
          <div class="papers-home__exclusion-actions">
            <PButton type="button" variant="secondary" :disabled="creating" @click="cancelExclusion">取消导入</PButton>
            <PButton type="button" :disabled="creating || !projectName" @click="create(true)">排除这些文件并继续导入</PButton>
          </div>
        </section>
      </form>
      <PaperGitHubTools mode="import" :account-id="auth.isAuthenticated?auth.user?.uuid||'':''" :disabled="creating||!allowed" @imported="router.push('/papers/'+$event.id)" />
      <p v-if="error" role="alert" class="papers-home__error">{{ error }}</p>
      <div class="papers-home__list-heading">
        <h2>我的论文</h2>
        <PInput v-model.trim="query" aria-label="搜索论文项目" placeholder="搜索项目名称" />
        <PButton size="sm" variant="secondary" @click="toggleTrash">{{ showTrash?'返回项目':'回收站' }}</PButton>
      </div>
      <section v-if="showTrash" class="papers-home__create">
        <h3>回收站</h3>
        <p>项目删除后保留在这里，可恢复；暂不自动清理。</p>
        <p v-if="trashLoading">正在加载…</p>
        <p v-else-if="!trashed.length">暂无已删除项目。</p>
        <div v-for="item in trashed" :key="item.id" class="papers-home__trash-row">
          <span>{{ item.name }} · {{ new Date(item.trashed_at).toLocaleDateString() }}</span>
          <PButton size="sm" variant="secondary" :disabled="!!managing" @click="restore(item)">恢复</PButton>
        </div>
      </section>
      <template v-else>
      <p v-if="!visibleProjects.length" class="papers-home__empty">还没有论文项目。创建项目后会自动生成 main.tex。</p>
      <div v-else class="papers-home__grid">
        <article v-for="project in visibleProjects" :key="project.id" class="papers-home__card">
          <RouterLink :to="'/papers/' + project.id" class="papers-home__project-link">
            <strong>{{ project.name }}</strong>
            <span>项目版本 {{ project.head_revision }} · {{ projectRoleLabel(project) }}</span>
            <time :datetime="project.updated_at">{{ new Date(project.updated_at).toLocaleString() }}</time>
          </RouterLink>
          <div v-if="isOwner(project)&&renaming===project.id" class="papers-home__rename">
            <PInput v-model.trim="renameValue" maxlength="100" aria-label="新的项目名称" @keydown.enter.prevent="rename(project)" />
            <PButton size="sm" :disabled="!renameValue||!!managing" @click="rename(project)">确认</PButton>
            <PButton size="sm" variant="secondary" :disabled="!!managing" @click="renaming=''">取消</PButton>
          </div>
          <div v-if="isOwner(project)" class="papers-home__project-actions">
            <PButton type="button" size="sm" variant="secondary" :disabled="!!exporting" @click="exportProject(project)">{{ exporting === project.id ? '正在导出…' : '导出 ZIP' }}</PButton>
            <PButton size="sm" variant="secondary" :disabled="!!managing" @click="renaming=project.id;renameValue=project.name">重命名</PButton>
            <PButton size="sm" variant="secondary" :disabled="!!managing" @click="deleteProject(project)">删除</PButton>
          </div>
        </article>
      </div>
      </template>
    </section>
  <PConfirm :show="!!confirmationMessage" title="请确认操作" :message="confirmationMessage" danger @confirm="resolveConfirmation(true)" @cancel="resolveConfirmation(false)" />
  </main>
</template>

<script setup lang="ts">
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import {usePaperConfirmation} from '@/components/papers/usePaperConfirmation'
import {useAuthStore} from '@/stores/auth'
import PButton from '@/components/ui/PButton.vue'
import { paperAccess, listPaperProjects, createPaperProject, getPaperApplication, submitPaperApplication, importPaperProject, getPaperProjectZIP, downloadPaperZIP, paperImportZIPLimit, renamePaperProject, trashPaperProject, listTrashedPaperProjects, restorePaperProject, type TrashedPaperProject, type PaperProject, type PaperApplication } from '@/api/papers'
import { packPaperFolder, packPaperTemplate, suggestPaperProjectName, unsupportedPaperFolderFiles, paperArchiveExclusion } from '@/components/papers/projectArchive'
import PaperTemplateLibrary from '@/components/papers/PaperTemplateLibrary.vue'
import PaperGitHubTools from '@/components/papers/PaperGitHubTools.vue'
import { getPaperTemplate } from '@/components/papers/templateCatalog'

defineOptions({name:'PapersHomeView'})
const router = useRouter()
const auth=useAuthStore()
const {confirmationMessage,ask,resolveConfirmation}=usePaperConfirmation()
const loading = ref(true)
const allowed = ref(false)
const creating = ref(false)
const projectName = ref('')
const projects = ref<PaperProject[]>([])
function isOwner(p:PaperProject){return p.access_role===undefined||p.access_role==='owner'}
function projectRoleLabel(p:PaperProject){return isOwner(p)?'所有者':p.access_role==='editor'?'编辑者':'阅读者'}

const query=ref('')
const visibleProjects=computed(()=>projects.value.filter(p=>p.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())))
const showTrash=ref(false),trashLoading=ref(false)
const trashed=ref<TrashedPaperProject[]>([])
const managing=ref(''),renaming=ref(''),renameValue=ref('')
async function toggleTrash(){
 showTrash.value=!showTrash.value
 if(!showTrash.value)return
 trashLoading.value=true;error.value=''
 try{trashed.value=await listTrashedPaperProjects()}catch{error.value='无法加载回收站，请重试。'}finally{trashLoading.value=false}
}
async function rename(p:PaperProject){
 if(!isOwner(p)||managing.value||!renameValue.value)return
 managing.value=p.id;error.value=''
 try{const updated=await renamePaperProject(p.id,renameValue.value,p.head_revision);projects.value=projects.value.map(x=>x.id===p.id?updated:x);renaming.value=''}
 catch{error.value='重命名失败，请刷新项目列表后重试。'}finally{managing.value=''}
}
async function deleteProject(p:PaperProject){
 if(!isOwner(p))return
 if(managing.value||!await ask('将「'+p.name+'」移入回收站？可以恢复，源码不会立即删除。',()=>[
  auth.isAuthenticated,auth.user?.uuid,allowed.value,managing.value,projects.value.find(x=>x.id===p.id),
 ])||managing.value||!allowed.value||!projects.value.some(x=>x.id===p.id&&isOwner(x)&&x.head_revision===p.head_revision))return
 managing.value=p.id;error.value=''
 try{await trashPaperProject(p.id);projects.value=projects.value.filter(x=>x.id!==p.id);renaming.value=''}
 catch{error.value='删除失败，请刷新后重试。'}finally{managing.value=''}
}
async function restore(p:TrashedPaperProject){
 if(managing.value)return
 managing.value=p.id;error.value=''
 try{const restored=await restorePaperProject(p.id);projects.value=[restored,...projects.value];trashed.value=trashed.value.filter(x=>x.id!==p.id)}
 catch{error.value='恢复失败，请检查项目数量或等待旧编译任务结束。'}finally{managing.value=''}
}

const error = ref('')
const folderInput = ref<HTMLInputElement | null>(null)
const zipInput = ref<HTMLInputElement | null>(null)
const importSource = ref<{kind:'folder'|'zip'; files:File[]; label:string} | null>(null)
const mainFile = ref('')
const showTemplates=ref(false),templateId=ref('')
const selectedTemplate=computed(()=>getPaperTemplate(templateId.value))
function chooseTemplate(id:string){
  if(creating.value)return
  const template=getPaperTemplate(id)
  if(!template)return
  if(!projectName.value||projectName.value===selectedTemplate.value?.name||projectName.value===importSource.value?.label)projectName.value=template.name
  cancelExclusion();importSource.value=null;mainFile.value='';templateId.value=id;error.value=''
}
type Exclusion = {kind:'folder'; files:string[]} | {kind:'zip'; files:string[]; confirmation:string; archive:Blob}
const exclusion = ref<Exclusion | null>(null)
function cancelExclusion() {
  exclusion.value = null
  error.value = ''
}
const exporting = ref('')
function clearImport() {
  cancelExclusion()
  importSource.value = null
  templateId.value=''
  showTemplates.value=false
  mainFile.value = ''
  error.value = ''
}
function chooseImport(event: Event, kind: 'folder'|'zip') {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  if (kind === 'zip' && (!/\.zip$/i.test(files[0].name) || files[0].size > paperImportZIPLimit || !files[0].size)) {
    error.value = '请选择不超过 5 MiB 的有效 ZIP 压缩包。'
    return
  }
  const name = suggestPaperProjectName(files[0], kind === 'folder')
  if (!name) { error.value = '无法识别项目名称，请改用 ZIP 导入。'; return }
  cancelExclusion()
  templateId.value=''
  showTemplates.value=false
  importSource.value = { kind, files, label: kind === 'folder' ? name : files[0].name }
  projectName.value = name
  mainFile.value = ''
  error.value = ''
}
async function exportProject(project: PaperProject) {
  if (!isOwner(project)||exporting.value) return
  exporting.value = project.id
  error.value = ''
  try { downloadPaperZIP(await getPaperProjectZIP(project.id), project.name) }
  catch { error.value = '导出失败，请检查项目权限或网络后重试。' }
  finally { exporting.value = '' }
}
const application = ref<PaperApplication | null>(null)
const reason = ref('')
const applying = ref(false)
const accessError = ref(false)
const canApply = computed(() => !application.value || (application.value.status === 'rejected' && !!application.value.reviewed_at && Date.now() - new Date(application.value.reviewed_at).getTime() >= 7 * 86400000))
async function apply(){
  if (applying.value || reason.value.length < 5) return
  applying.value=true;error.value=''
  try {application.value=await submitPaperApplication(reason.value);reason.value=''}
  catch {error.value='提交申请失败，请刷新状态后重试。'}
  finally {applying.value=false}
}

async function load() {
  loading.value = true
  accessError.value = false
  error.value = ''
  try {
    allowed.value = (await paperAccess()).allowed
    if (allowed.value) projects.value = await listPaperProjects()
    else application.value = (await getPaperApplication()).application
  } catch {
    allowed.value = false
    accessError.value = true
    error.value = '无法确认 Papers 访问权限，请稍后重试。'
  } finally {
    loading.value = false
  }
}

async function create(confirmed = false) {
  if (creating.value || !projectName.value || (confirmed ? !exclusion.value : !!exclusion.value)) return
  const acknowledged = confirmed ? exclusion.value : null
  exclusion.value = null
  creating.value = true
  error.value = ''
  let archive: Blob | undefined
  try {
    const source = importSource.value
    let project: PaperProject
    if (selectedTemplate.value) {
      archive=await packPaperTemplate(selectedTemplate.value.id)
      project=await importPaperProject(projectName.value,archive,'main.tex')
    } else if (!source) project = await createPaperProject(projectName.value)
    else {
      if (source.kind === 'folder' && !acknowledged) {
        const files = unsupportedPaperFolderFiles(source.files)
        if (files.length) {
          exclusion.value = {kind:'folder',files}
          return
        }
      }
      archive = acknowledged?.kind === 'zip' ? acknowledged.archive :
        source.kind === 'folder' ? await packPaperFolder(source.files, acknowledged?.kind === 'folder') : source.files[0]
      project = acknowledged?.kind === 'zip'
        ? await importPaperProject(projectName.value, archive, mainFile.value, acknowledged.confirmation)
        : await importPaperProject(projectName.value, archive, mainFile.value)
    }
    await router.push('/papers/' + project.id)
  } catch (cause) {
    const challenge = archive && !selectedTemplate.value && paperArchiveExclusion(cause)
    if (challenge && archive) {
      exclusion.value = {kind:'zip',...challenge,archive}
    } else {
      error.value = selectedTemplate.value ? '模板创建失败，请检查网络、访问权限和项目数量后重试。' : importSource.value ? (cause instanceof Error && cause.message ? '导入失败：' + cause.message : '导入失败，请检查 ZIP 内容。') : '创建失败。请检查项目名称、访问权限或当前项目数量。'
    }
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.papers-home { max-width: 1100px; margin-inline: auto; padding: 32px 24px 64px; }
.papers-home__body { display: grid; gap: 22px; }
.papers-home__body h2 { font-size: 1.1rem; font-weight: 650; margin-top: 12px; }
.papers-home__notice,.papers-home__create,.papers-home__card { border: 1px solid var(--border, #d9dce2); border-radius: 12px; padding: 20px; }
.papers-home__notice p,.papers-home__empty,.papers-home__card span,.papers-home__card time { color: var(--text-secondary, #697281); }
.papers-home__create label { display: block; font-weight: 650; margin-bottom: 10px; }
.papers-home__actions { display: flex; gap: 12px; }
.papers-home__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.papers-home__card { display: flex; flex-direction: column; gap: 12px; color: inherit; text-decoration: none; }
.papers-home__card:hover { border-color: var(--text-primary, #4a5867); }
.papers-home__error { color: #b91c1c; }
@media (max-width: 600px) { .papers-home { padding: 20px 16px 48px; } .papers-home__actions { flex-direction: column; } }
.papers-home__apply {display:grid;gap:10px;margin-top:16px;max-width:620px}
.papers-home__create h2 {margin:0 0 14px}
.papers-home__import-actions {display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.papers-home__selected {display:flex;gap:12px;align-items:center;justify-content:space-between;overflow-wrap:anywhere;margin-bottom:12px;font-size:.85rem}
.papers-home__main-file {display:grid;gap:8px;margin-top:14px}
.papers-home__main-file label {margin:0}
.papers-home__main-file p {font-size:.8rem;color:var(--a-color-text-secondary);margin:0}
.papers-home__project-link {display:flex;flex-direction:column;gap:8px;color:inherit;text-decoration:none;overflow-wrap:anywhere}
.papers-home__project-link:hover strong {text-decoration:underline}
.papers-home__exclusion {display:grid;gap:10px;margin-top:18px;padding:16px;border:1px solid var(--a-color-border-soft,#d9dce2);border-radius:10px;background:var(--a-color-bg-soft,transparent)}
.papers-home__exclusion h3 {font-size:.95rem;font-weight:650;margin:0}
.papers-home__exclusion p {font-size:.84rem;line-height:1.6;margin:0;color:var(--a-color-text-secondary,#697281)}
.papers-home__exclusion-list {max-height:220px;overflow:auto;margin:0;padding-left:22px;font-size:.83rem;line-height:1.7;overflow-wrap:anywhere}
.papers-home__exclusion-actions {display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.papers-home__list-heading,.papers-home__project-actions,.papers-home__trash-row,.papers-home__rename{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.papers-home__list-heading h2{flex:1}
.papers-home__trash-row{justify-content:space-between;padding:8px 0;border-top:1px solid var(--a-color-border-soft,#ddd)}
.papers-home__template-selection{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;margin-bottom:14px;border:1px solid var(--a-color-border-soft,#ddd);border-radius:8px;background:var(--a-color-bg-subtle,transparent)}
.papers-home__template-selection p{font-size:.8rem;color:var(--a-color-text-secondary,#697281);margin:4px 0 0}
.papers-home__actions :deep(.p-field),.papers-home__rename :deep(.p-field){flex:1;min-width:0}
</style>
