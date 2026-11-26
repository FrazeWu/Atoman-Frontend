<template>
 <details class="paper-github">
  <summary>GitHub {{mode==='import'?'仓库导入':'分支发布'}}</summary>
  <p>{{mode==='import'?'读取指定分支的固定提交，导入为新的私有 Papers 项目，不覆盖任何项目。':'读取当前已保存项目，向指定 GitHub 仓库创建独立的新分支供审阅合并。不覆盖现有分支，不删除仓库原有文件。'}}</p>
  <PInput v-model.trim="repository" label="GitHub 仓库（owner/repo）" maxlength="150" :disabled="busy||disabled" placeholder="owner/repository" />
  <PInput v-model.trim="branch" label="基准分支" maxlength="128" :disabled="busy||disabled" placeholder="main" />
  <PInput v-model="token" label="GitHub 访问令牌" type="password" autocomplete="off" maxlength="2048" :disabled="busy||disabled" />
  <small>{{mode==='import'?'公开仓库可不填令牌；私有仓库需要指定仓库的 Contents 读取权限。':'需要指定仓库的 Contents 写入权限。'}}令牌仅保留在面板内存中，直接发送到 api.github.com，不存储或发送到 Papers 后端。</small>
  <PButton type="button" size="sm" variant="secondary" :disabled="busy||disabled||!validTarget" @click="inspect">读取分支与文件清单</PButton>
  <p v-if="message" role="status">{{message}}</p>
  <template v-if="plan">
   <strong>{{plan.repository}} · {{plan.branch}} · {{plan.private?'私有仓库':'公开仓库'}} · {{plan.commit.slice(0,12)}}</strong>
   <template v-if="mode==='import'">
    <p>可导入 {{plan.included.length}} 个源文件；排除 {{plan.excluded.length}} 个不兼容文件（含非 LaTeX 类型、符号链接等）。</p>
    <div class="paper-github__list"><div v-for="file in plan.included" :key="file.path">{{file.path}}</div></div>
    <details v-if="plan.excluded.length"><summary>查看排除文件</summary><div class="paper-github__list">{{plan.excluded.join('\n')}}</div></details>
    <PInput v-model.trim="name" label="新项目名称" maxlength="100" :disabled="busy||disabled" />
    <PSelect :model-value="mainFile" label="主 TeX 文件" size="sm" :options="rootTex" :disabled="busy||disabled" @update:model-value="mainFile=String($event)" />
    <PCheckbox v-model="consent" :disabled="busy||disabled">确认导入上述固定提交中的兼容文件，并接受排除清单。</PCheckbox>
    <PButton type="button" size="sm" :disabled="busy||disabled||!consent||!name||!mainFile||!plan.included.length||plan.included.length>64" @click="importProject">导入为新项目</PButton>
   </template>
   <template v-else>
    <p>当前项目 v{{revision}} · {{files.length}} 个文件。发布前需明确确认将源码和图片发送至此仓库。</p>
    <p v-if="!plan.private">注意：目标是公开仓库，提交中的论文、图片和参考文献可能对所有人可见。请确认不是未公开或匿名投稿资料。</p>
    <PButton type="button" size="sm" variant="secondary" :disabled="busy||disabled||!revision" @click="prepareExport">读取当前保存版本并预览</PButton>
    <template v-if="exportPlan">
     <strong>拟创建分支：{{exportPlan.branch}}</strong>
     <p>将上传 {{exportPlan.files.length}} 个项目文件；{{exportPlan.overlap.length}} 个路径与基准分支同名，只在新分支中替换。</p>
     <div class="paper-github__list"><div v-for="file in exportPlan.files" :key="file.path">{{file.path}}</div></div>
     <PCheckbox v-model="consent" :disabled="busy||disabled">我确认将上方全部已保存项目文件发送至这个{{plan.private?'私有':'公开'}} GitHub 仓库并创建新分支。</PCheckbox>
     <PButton type="button" size="sm" :disabled="busy||disabled||!consent||!token" @click="exportBranch">确认发布新分支</PButton>
    </template>
   </template>
  </template>
  <PButton v-if="busy" type="button" size="sm" variant="secondary" @click="cancel">停止等待</PButton>
  <a v-if="resultURL" :href="resultURL" target="_blank" rel="noopener noreferrer">在 GitHub 查看已创建分支</a>
 </details>
</template>
<script setup lang="ts">
import {computed,ref,shallowRef,watch,onBeforeUnmount} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PCheckbox from '@/components/ui/PCheckbox.vue'
import {importPaperProject,getPaperProject,getPaperFile,type PaperFile,type PaperProject} from '@/api/papers'
import {inspectGitHub,validGitHubRepo,validGitHubBranch,importGitHubZIP,publishGitHubBranch,projectFileToGitSource,checkGitOverlay,type GitHubTarget,type GitHubPlan,type GitPaperSource} from './githubPapers'
import {projectFileFence} from './projectRead'
const props=withDefaults(defineProps<{mode:'import'|'export';accountId:string;projectId?:string;revision?:number;files?:PaperFile[];disabled:boolean}>(),{files:()=>[]})
const emit=defineEmits<{imported:[project:PaperProject]}>()
const repository=ref(''),branch=ref('main'),token=ref(''),name=ref(''),mainFile=ref(''),consent=ref(false),message=ref(''),resultURL=ref(''),busy=ref(false)
const plan=shallowRef<GitHubPlan|null>(null),exportPlan=shallowRef<{branch:string;files:GitPaperSource[];overlap:string[];fence:string;revision:number}|null>(null)
const validTarget=computed(()=>!!props.accountId&&validGitHubRepo(repository.value)&&validGitHubBranch(branch.value)&&token.value.length<=2048&&!/[\s]/.test(token.value))
const rootTex=computed(()=>plan.value?.included.filter(f=>/^[^/]+\.tex$/i.test(f.path)).map(f=>({value:f.path,label:f.path}))||[])
let disposed=false,serial=0,controller:AbortController|null=null
const scope=()=>props.accountId+':'+(props.projectId||'')
function reset(){serial++;controller?.abort();controller=null;busy.value=false;plan.value=null;exportPlan.value=null;consent.value=false;resultURL.value='';message.value=''}
watch([repository,branch],()=>{reset();token.value=''},{flush:'sync'})
watch(token,reset,{flush:'sync'})
watch(scope,()=>{reset();token.value='';repository.value='';branch.value='main'},{flush:'sync'})
watch(()=>props.revision,()=>{exportPlan.value=null;consent.value=false})
watch(()=>projectFileFence(props.files),()=>{exportPlan.value=null;consent.value=false})
watch([name,mainFile],()=>{consent.value=false})
function begin(){
 if(disposed||props.disabled||busy.value||!validTarget.value)return null
 const initial=scope(),n=++serial,target:GitHubTarget={repository:repository.value,branch:branch.value,token:token.value},ctrl=new AbortController()
 controller=ctrl;busy.value=true;message.value=''
 const deadline=setTimeout(()=>ctrl.abort(),90000)
 const current=()=>!disposed&&n===serial&&initial===scope()&&target.repository===repository.value&&target.branch===branch.value&&target.token===token.value
 const valid=()=>current()&&!ctrl.signal.aborted
 return {target,signal:ctrl.signal,valid,current,done:()=>{clearTimeout(deadline);if(!disposed&&n===serial&&initial===scope()){busy.value=false;controller=null}}}
}
function cancel(){reset();message.value='已停止等待；若外部写入已发送，需在 GitHub 核对是否创建分支，不会自动重试。'}
async function inspect(){
 const state=begin();if(!state)return
 plan.value=null;exportPlan.value=null;consent.value=false
 try{const value=await inspectGitHub(state.target,state.signal);if(state.valid()){plan.value=value;name.value=repository.value.split('/').at(-1)||'GitHub project';mainFile.value=rootTex.value.find(x=>x.value==='main.tex')?.value||rootTex.value[0]?.value||'';message.value='已读取固定分支提交，请核对文件清单。'}}
 catch{if(state.current())message.value='无法读取仓库，请检查仓库、分支、令牌权限或网络。'}
 finally{state.done()}
}
async function importProject(){
 const p=plan.value
 if(!p||!consent.value||!name.value||!rootTex.value.some(f=>f.value===mainFile.value))return
 const state=begin();if(!state)return
 const projectName=name.value,main=mainFile.value
 consent.value=false
 try{
  const archive=await importGitHubZIP(state.target,p,state.signal,state.valid)
  if(!state.valid()||props.disabled||projectName!==name.value||main!==mainFile.value)return
  const project=await importPaperProject(projectName,archive,main)
  if(state.valid()){message.value='已从固定提交创建项目。';emit('imported',project)}
 }catch{if(state.current())message.value='导入未确认：请检查项目容量、文件格式和网络；先刷新项目列表，避免重复导入。'}
 finally{state.done()}
}
async function prepareExport(){
 const p=plan.value,base=props.revision,pid=props.projectId
 if(!p||!base||!pid)return
 const state=begin();if(!state)return
 const fence=projectFileFence(props.files),valid=()=>state.valid()&&props.revision===base&&fence===projectFileFence(props.files)&&!props.disabled
 consent.value=false;exportPlan.value=null
 try{
  const before=await getPaperProject(pid)
  if(!valid()||before.id!==pid||before.head_revision!==base||before.access_role&&before.access_role!=='owner'||props.files.length>64)throw Error('Changed project')
  const sources:GitPaperSource[]=[];let bytes=0
  for(const f of [...props.files]){
   if(!valid())throw Error('Changed project')
   const row=await getPaperFile(pid,f.id)
   if(!valid()||row.id!==f.id||row.path!==f.path||row.revision!==f.revision||row.kind!==f.kind||(f.sha256&&row.sha256!==f.sha256)||(row.project_head_revision!==undefined&&row.project_head_revision!==base))throw Error('Changed file')
   const source=projectFileToGitSource(row);bytes+=row.kind==='binary'?Math.ceil(source.data.length/3)*4:source.data.length
   if(bytes>4*1024*1024)throw Error('Project too large')
   sources.push(source)
  }
  const after=await getPaperProject(pid)
  if(!valid()||after.id!==pid||after.head_revision!==base)throw Error('Changed project')
  const overlap=checkGitOverlay(p,sources)
  exportPlan.value={branch:'papers-export-'+new Date().toISOString().slice(0,10)+'-'+crypto.randomUUID().slice(0,12),files:sources,overlap,fence,revision:base}
  message.value='已准备新分支文件清单，尚未向 GitHub 上传源码。'
 }catch{if(state.current())message.value='无法准备导出：项目版本变化、路径冲突、容量超限或读取失败。'}
 finally{state.done()}
}
async function exportBranch(){
 const p=plan.value,x=exportPlan.value
 if(!p||!x||!consent.value||!token.value||!props.projectId||x.revision!==props.revision||x.fence!==projectFileFence(props.files))return
 const state=begin();if(!state)return
 consent.value=false
 const valid=()=>state.valid()&&props.revision===x.revision&&x.fence===projectFileFence(props.files)&&!props.disabled
 try{
  const current=await getPaperProject(props.projectId)
  if(!valid()||current.id!==props.projectId||current.head_revision!==x.revision||current.access_role&&current.access_role!=='owner')throw Error('Project changed')
  const result=await publishGitHubBranch(state.target,p,x.files,x.branch,state.signal,valid)
  if(state.valid()){resultURL.value='https://github.com/'+p.repository+'/tree/'+result.branch;message.value='已确认创建独立分支 '+result.branch+' · '+result.commit.slice(0,12)+'。现有分支未更新。';exportPlan.value=null}
 }catch{if(state.current())message.value='发布未确认：基准可能变化或权限、网络异常。请在 GitHub 核对 '+x.branch+'，避免重复发布。'}
 finally{state.done()}
}
onBeforeUnmount(()=>{disposed=true;reset();token.value=''})
</script>
<style scoped>
.paper-github{display:grid;gap:8px;min-width:0;border:1px solid var(--a-color-border-soft);border-radius:8px;padding:12px}
.paper-github summary{font-weight:600;cursor:pointer}
.paper-github p,.paper-github small{margin:4px 0;overflow-wrap:anywhere}
.paper-github__list{max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:6px;border:1px solid var(--a-color-border-soft);border-radius:4px}
</style>
