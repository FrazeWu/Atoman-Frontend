<template>
 <section class="paper-ai" aria-label="AI 修改建议">
  <header class="paper-ai__workbench" aria-label="当前 AI 任务">
   <div class="paper-ai__identity"><span class="paper-ai__avatar" aria-hidden="true">AI</span><div><strong>{{capability?.agent?.id==='papers-agent'?capability.agent.display_name:'Papers Agent'}}</strong><small>AI 建议者 · 拥有者审批</small></div></div>
   <p>当前任务：{{task==='project'?'跨文件修改':task==='explain'?'解释与分析':'源码修改'}} · {{file.path}} · v{{file.revision}}</p>
   <div class="paper-ai__steps" aria-label="任务进度">
    <span v-for="(step,index) in taskSteps" :key="step" :aria-current="index===taskStep?'step':undefined" :class="{current:index===taskStep,done:index<taskStep}">{{index+1}}. {{step}}</span>
   </div>
   <p role="status">{{taskStatus}}</p>
   <small>AI 不作为可登录成员，不能自主提交。跨文件任务的提交者仍是拥有者；实时协作编辑继续使用你的身份。</small>
  </header>
  <PaperAIActivityPanel v-if="capability?.activity" :project-id="projectId" :account-id="accountId" :files="files" :refresh="activityRefresh" :disabled="busy||disabled||repairActive||!!collaborationEpoch||source!==file.content" :rollback="rollbackActivity" :historical-changes="capability.historical_changes===true" :pending-proposal="suggestion?.response.proposal_id" />
  <p v-if="loading" role="status">正在检查 AI 服务…</p>
  <div v-else-if="!capability?.enabled" class="paper-ai__notice">
   <strong>AI 助手尚未开放</strong><p>{{ message||'源码编辑不受影响。' }}</p>
   <PButton size="sm" variant="secondary" type="button" @click="loadCapability">重新检查</PButton>
  </div>
  <template v-else>
   <details class="paper-ai__settings" open>
    <summary>模型与 API 设置</summary>
    <label>API 地址<select v-model="baseURL" aria-label="AI API 地址" :disabled="busy"><option v-for="url in capability.base_urls" :key="url" :value="url">{{ url }}</option></select></label>
    <label>模型<input v-model.trim="model" aria-label="AI 模型" maxlength="128" placeholder="例如 gpt-4.1-mini" :disabled="busy" /></label>
    <label>API Key<input v-model="key" type="password" autocomplete="off" spellcheck="false" aria-label="AI API Key" maxlength="2048" :disabled="busy" placeholder="使用你的模型账户密钥" /></label>
    <p>密钥仅保留在当前面板内存中，关闭即清除，不写入数据库或浏览器存储。模型调用由你的 API 账户计费。其他兼容 API 地址需由服务器批准后才会出现在列表中。</p>
   </details>
   <section v-if="repairAvailable||repair" class="paper-ai__context" aria-label="Agent 编译修复">
    <strong>Agent 编译修复</strong>
    <p>复用当前编译器，最多三轮。每轮检查已保存版本的错误，审阅并应用修复后自动重新编译。模型请求仍需逐轮确认发送范围。</p>
    <p v-if="repair" role="status">{{repair.message}} · 已应用 {{repair.rounds}} / {{MAX_REPAIR_ROUNDS}} 轮 · {{repair.compiler}}</p>
    <p v-if="repair?.phase==='review'&&repair.files.length">涉及文件：{{repair.files.join('、')}}。如有其他源码文件，请在下方勾选并预览。</p>
    <div class="paper-ai__row">
     <PButton v-if="!repairActive" type="button" size="sm" :disabled="!canStartRepair" @click="startRepair">开始编译修复</PButton>
     <PButton v-else type="button" size="sm" variant="secondary" :disabled="commitBusy" @click="endRepair('已停止修复。已提交的编译仍可在 PDF 面板查看或取消。')">停止修复</PButton>
    </div>
   </section>
   <div class="paper-ai__row">
    <PButton type="button" size="sm" variant="secondary" :disabled="busy||disabled||repairActive" @click="capture(true)">使用编辑器选区</PButton>
    <PButton type="button" size="sm" variant="secondary" :disabled="busy||disabled||repairActive" @click="capture(false)">使用整个文件</PButton>
   </div>
   <p v-if="collaborationEpoch">实时协作：仅处理已获服务器确认的当前版本；接受的建议作为你的本地编辑同步，断线或未确认时暂停操作。</p>
   <p v-if="!target">请选择源码范围。也可先在编辑器选中段落，再点击「使用编辑器选区」。</p>
   <div v-else class="paper-ai__context">
    <strong>{{ file.path }} · {{ target.from===0&&target.to===target.baseline.length?'整个文件':'选中文本' }}</strong>
    <small>{{ sourceBytes.toLocaleString() }} 字节 · {{ stale?'原稿已变化，请重新选取':'待发送源码' }}</small>
    <details open><summary>预览待发送源码</summary><pre>{{ selectedSource }}</pre></details>
   </div>
   <details class="paper-ai__context">
    <summary>附加项目文件（{{ extras.length }}/{{ capability.max_extra_files }}）</summary>
    <p>{{task==='project'?'仅允许 Agent 提议修改当前完整文件及下面勾选、预览的文件。':'仅发送下方主动选择并成功预览的已保存文本文件，不发送图片或其他项目内容。'}}</p>
    <label v-for="item in eligibleFiles" :key="item.id" class="paper-ai__check">
     <input type="checkbox" :checked="extras.some(extra=>extra.id===item.id)" :disabled="busy||contextBusy||(!extras.some(extra=>extra.id===item.id)&&extras.length>=capability.max_extra_files)" @change="toggleContext(item,($event.target as HTMLInputElement).checked)" /><span>{{ item.path }}</span>
    </label>
    <p v-if="contextBusy">读取文件预览中…</p>
    <details v-for="extra in extras" :key="extra.id"><summary>{{ extra.path }} · v{{ extra.revision }}</summary><pre>{{ extra.content }}</pre></details>
   </details>
   <label>任务类型<select v-model="task" :disabled="busy||repairActive" aria-label="AI 任务类型"><option value="revise">修改源码（可审阅后接受）</option><option value="explain">解释、分析或排查</option><option v-if="projectModeAvailable" value="project">Agent · 跨文件修改</option></select></label>
   <p v-if="task==='project'">使用已保存的完整文件。每个文件最多一处连续替换，审阅并勾选后才能提交。该操作仅在普通编辑模式开放，可能使其他协作者的旧会话失效，请先协调。</p>
   <p v-if="task==='project'&&!projectReady" role="status">请先保存源码并选择整个文件，再生成跨文件建议。</p>
   <details v-if="historyAvailable&&history.length" class="paper-ai__context" open>
    <summary>本轮对话（{{history.length}} 轮）</summary>
    <label class="paper-ai__check"><input v-model="includeHistory" type="checkbox" :disabled="busy" /><span>继续对话：发送以下已预览的历史记录</span></label>
    <div v-for="(turn,index) in history" :key="index" class="paper-ai__turn">
     <strong>你 · 第 {{index+1}} 轮</strong><pre>{{turn.instruction}}</pre>
     <strong>AI 建议（不表示已应用）</strong><pre>{{turn.reply}}</pre>
    </div>
    <small>最多 {{capability.max_history_turns}} 轮、{{capability.max_history_bytes}} 字节；关闭面板、切换文件或模型配置后清除。</small>
    <PButton type="button" size="sm" variant="secondary" :disabled="busy" @click="clearHistory">开始新对话</PButton>
   </details>
   <div class="paper-ai__row">
    <button type="button" :disabled="busy||repairActive" @click="preset('润色这段论文，保持研究事实、数值、引用键和 LaTeX 结构。','revise')">学术润色</button>
    <button type="button" :disabled="busy||repairActive" @click="preset('将这段论文翻译为英文，保留 LaTeX 命令、公式和引用。','revise')">英文翻译</button>
    <button type="button" :disabled="busy||repairActive" @click="preset('检查 LaTeX 语法和学术表达，解释问题并提出具体修改建议。','explain')">源码检查</button>
    <button v-if="diagnostics" type="button" :disabled="busy||repairActive" @click="diagnosticPreset">分析编译错误</button>
   </div>
   <label>给 AI 的指令<textarea v-model="instruction" aria-label="AI 修改指令" rows="3" maxlength="4000" :disabled="busy" placeholder="描述需要完成的任务…" /></label>
   <label class="paper-ai__check paper-ai__consent"><input v-model="consent" type="checkbox" :disabled="busy" /> <span>我确认将上方预览的源码、附加文件和指令以及勾选的对话历史发送到所选模型服务，允许该服务处理这些内容。</span></label>
   <p>{{ contextBytes.toLocaleString() }} / {{ capability.max_context_bytes.toLocaleString() }} 字节 · 每次最多生成 4096 tokens</p>
   <div class="paper-ai__row">
    <PButton size="sm" type="button" :disabled="!canGenerate" @click="generate">{{ busy?'生成中…':'生成建议' }}</PButton>
    <PButton v-if="busy&&!commitBusy" size="sm" type="button" variant="secondary" @click="cancel">取消等待</PButton>
   </div>
   <p v-if="message" role="status">{{ message }}</p>
   <section v-if="suggestion" class="paper-ai__result">
    <strong>{{ suggestion.task==='project'?'Agent 跨文件修改计划':suggestion.task==='revise'?'待审阅修改':'AI 分析结果' }}</strong>
    <small>提议者：Papers Agent · {{suggestion.task==='explain'?'仅供分析':resultStale?'版本已变化，需重新生成':'尚未提交，请审阅'}}{{suggestion.response.proposal_id?' · '+suggestion.response.proposal_id.slice(0,8):''}}</small>
    <small v-if="suggestion.response.input_tokens||suggestion.response.output_tokens">输入 {{ suggestion.response.input_tokens||0 }} · 输出 {{ suggestion.response.output_tokens||0 }} tokens</small>
    <PaperAIDiff v-if="suggestion.task==='revise'" :before="suggestion.target.baseline.slice(suggestion.target.from,suggestion.target.to)" :after="suggestion.response.text" />
    <pre v-else>{{ suggestion.response.text }}</pre>
    <template v-if="suggestion.task==='project'">
     <p v-if="!suggestion.changes?.length">没有需要修改的文件。</p>
     <div v-for="change in suggestion.changes||[]" :key="change.file_id" class="paper-ai__context">
      <label class="paper-ai__check"><input type="checkbox" :checked="approved.includes(change.file_id)" :disabled="busy||disabled||resultStale" @change="approve(change.file_id,($event.target as HTMLInputElement).checked)" /><strong>{{change.path}} · v{{change.base_revision}}</strong></label>
      <PaperAIDiff :before="change.before" :after="change.after" />
     </div>
     <PButton v-if="suggestion.changes?.length" type="button" size="sm" :disabled="resultStale||disabled||busy||!approved.length" @click="acceptProject">应用已选修改（{{approved.length}}）</PButton>
    </template>
    <p v-if="resultStale">当前源码或文件版本已变化，不能应用旧建议，请重新生成。</p>
    <div class="paper-ai__row">
     <PButton v-if="suggestion.task==='revise'" type="button" size="sm" :disabled="resultStale||disabled||busy" @click="accept">接受修改</PButton>
     <PButton type="button" size="sm" variant="secondary" @click="discard">丢弃建议</PButton>
    </div>
   </section>
  </template>
 </section>
</template>

<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PaperAIActivityPanel from './PaperAIActivityPanel.vue'
import PaperAIDiff from './PaperAIDiff.vue'
import {getPaperFile,type PaperFile,type PaperTextReplacement,type PaperCompileJob,type PaperCompiler} from '@/api/papers'
import {ApiErrorResponseError} from '@/api/client'
import {getPaperAICapability,requestPaperAISuggestion,type PaperAICapability,type PaperAISuggestion,type PaperAITask,type PaperAIHistoryTurn,type PaperAIActivity} from '@/api/papersAI'
import {paperAIBytes,validAIRange,type PaperAISourceRange,type PaperAIEdit} from './aiSuggestion'
import {reviewProjectEdits,appendAgentHistory,type ReviewedPaperAIChange} from './aiAgent'
import {MAX_REPAIR_ROUNDS,matchesRepairJob,repairOutcome,validRepairApplyFence,type RepairApplyFence} from './aiRepair'

type Captured=PaperAISourceRange&{fileId:string;revision:number;collaborationEpoch?:string}
type Suggestion={target:Captured;task:PaperAITask;response:PaperAISuggestion;changes?:ReviewedPaperAIChange[];context?:PaperFile[];repairJobId?:string}
const props=defineProps<{projectId:string;accountId:string;file:PaperFile;source:string;files:PaperFile[];disabled:boolean;captureSelection:()=>PaperAISourceRange|null;applyEdit:(edit:PaperAIEdit)=>boolean;diagnostics?:string;collaborationEpoch?:string;projectRevision?:number;applyProject?:(revision:number,replacements:PaperTextReplacement[],repairFence?:RepairApplyFence,proposalId?:string)=>Promise<boolean>;rollbackActivity?:(event:PaperAIActivity)=>Promise<boolean>;compileEnabled?:boolean;compileJob?:PaperCompileJob|null;compiler?:PaperCompiler;compileRepair?:(revision:number,compiler:PaperCompiler)=>Promise<PaperCompileJob|null>}>()
const emit=defineEmits<{'repair-active':[active:boolean]}>()
type RepairState={phase:'submitting'|'compiling'|'review'|'applying'|'passed'|'stopped';revision:number;compiler:PaperCompiler;rounds:number;jobId:string;message:string;files:string[]}
const repair=shallowRef<RepairState|null>(null)
const commitBusy=ref(false)
const activityRefresh=ref(0)
let repairSerial=0
const repairActive=computed(()=>!!repair.value&&['submitting','compiling','review','applying'].includes(repair.value.phase))
watch(repairActive,active=>emit('repair-active',active),{flush:'sync'})
const repairAvailable=computed(()=>projectModeAvailable.value&&props.compileEnabled===true&&!!props.compileRepair&&!!props.compiler)
const cleanSource=computed(()=>props.source===props.file.content&&props.source.trim()!==''&&!!capability.value&&paperAIBytes(props.source)<=capability.value.max_source_bytes)
const canStartRepair=computed(()=>repairAvailable.value&&!repairActive.value&&!busy.value&&!contextBusy.value&&!props.disabled&&cleanSource.value)
function repairCurrent(state:RepairState){
 return repairAvailable.value&&cleanSource.value&&props.projectRevision===state.revision&&props.compiler===state.compiler
}
function repairJobCurrent(state:RepairState){
 return repairCurrent(state)&&validRepairApplyFence(props.compileJob,{projectId:props.projectId,revision:state.revision,compiler:state.compiler},{jobId:state.jobId,compiler:state.compiler})
}
function endRepair(reason:string){
 if(commitBusy.value)return
 repairSerial++
 if(busy.value)stop()
 if(repair.value)repair.value={...repair.value,phase:'stopped',message:reason}
 if(suggestion.value?.repairJobId){suggestion.value=null;approved.value=[]}
 clearConsent()
}
function settleRepair(){
 const state=repair.value
 if(!state||!['compiling','review'].includes(state.phase))return
 if(!repairCurrent(state)||props.compileJob?.id!==state.jobId){
  endRepair('源码、编译器或任务已变化，已停止；请重新开始。');return
 }
 if(state.phase==='review'){
  if(!repairJobCurrent(state))endRepair('编译状态已变化，旧修复计划已失效。')
  return
 }
 const job=props.compileJob
 if(!job)return
 const result=repairOutcome(job,{projectId:props.projectId,revision:state.revision,compiler:state.compiler},state.rounds)
 if(result.kind==='waiting')return
 if(result.kind==='review'){
  if(props.disabled)return
  task.value='project';capture(false);instruction.value=result.instruction
  repair.value={...state,phase:'review',message:result.message,files:result.files}
  clearConsent()
 }else repair.value={...state,phase:result.kind,message:result.message}
}
async function runRepairCompile(revision:number,rounds:number,compiler:PaperCompiler){
 if(disposed||!props.compileRepair||!repairAvailable.value||props.projectRevision!==revision||props.compiler!==compiler||!cleanSource.value||props.disabled){endRepair('源码或编译状态已变化，未重新编译。');return}
 const n=++repairSerial,initial=scope()
 repair.value={phase:'submitting',revision,rounds,compiler,jobId:'',message:'正在提交已保存版本进行编译…',files:[]}
 clearConsent()
 try{
  const job=await props.compileRepair(revision,compiler)
  await nextTick()
  if(disposed||n!==repairSerial||initial!==scope())return
  const state=repair.value
  if(!state||!job||!repairCurrent(state)||!matchesRepairJob(job,{projectId:props.projectId,revision,compiler})||props.compileJob?.id!==job.id){
   endRepair('未确认编译任务成功提交，请核对编译状态后重试。');return
  }
  repair.value={...state,phase:'compiling',jobId:job.id,message:'等待编译结果…'}
  settleRepair()
 }catch{if(!disposed&&n===repairSerial)endRepair('提交编译失败，已停止修复。')}
}
function startRepair(){
 if(!canStartRepair.value||!props.projectRevision||!props.compiler)return
 const revision=props.projectRevision,compiler=props.compiler
 suggestion.value=null;approved.value=[];task.value='project';capture(false);clearConsent()
 const latest=props.compileJob
 if(latest&&latest.status==='failed'&&latest.failure_code==='compile_failed'&&!latest.cancel_requested&&matchesRepairJob(latest,{projectId:props.projectId,revision,compiler})){
  repair.value={phase:'compiling',revision,compiler,rounds:0,jobId:latest.id,message:'读取当前编译错误…',files:[]}
  settleRepair()
 }else void runRepairCompile(revision,0,compiler)
}


const capability=ref<PaperAICapability|null>(null),loading=ref(false),message=ref('')
const baseURL=ref(''),model=ref('gpt-4.1-mini'),key=ref(''),instruction=ref(''),task=ref<PaperAITask>('revise'),consent=ref(false)
const target=shallowRef<Captured|null>(null),extras=shallowRef<PaperFile[]>([])
const suggestion=shallowRef<Suggestion|null>(null)
const history=shallowRef<PaperAIHistoryTurn[]>([]),includeHistory=ref(true),approved=ref<string[]>([])
const historyAvailable=computed(()=>Number.isSafeInteger(capability.value?.max_history_turns)&&Number.isSafeInteger(capability.value?.max_history_bytes)&&(capability.value?.max_history_turns||0)>0&&(capability.value?.max_history_bytes||0)>0)
const projectModeAvailable=computed(()=>capability.value?.project_edits===true&&!props.collaborationEpoch&&!!props.applyProject&&Number.isSafeInteger(props.projectRevision)&&(props.projectRevision||0)>0)
const projectReady=computed(()=>projectModeAvailable.value&&!!target.value&&target.value.from===0&&target.value.to===target.value.baseline.length&&target.value.baseline===props.file.content&&props.source===props.file.content)
const busy=ref(false),contextBusy=ref(false)
let disposed=false,serial=0,contextSerial=0,controller:AbortController|null=null
const scope=()=>props.accountId+':'+props.projectId+':'+props.file.id+':'+(props.collaborationEpoch||'ordinary')
const selectedSource=computed(()=>target.value?target.value.baseline.slice(target.value.from,target.value.to):'')
const sourceBytes=computed(()=>paperAIBytes(selectedSource.value))
const contextBytes=computed(()=>sourceBytes.value+extras.value.reduce((n,item)=>n+paperAIBytes(item.content),0))
const eligibleFiles=computed(()=>props.files.filter(item=>item.kind==='text'&&item.id!==props.file.id))
const staleTarget=(item:Captured|null)=>!item||item.fileId!==props.file.id||item.revision!==props.file.revision||item.baseline!==props.source||item.collaborationEpoch!==props.collaborationEpoch
const stale=computed(()=>staleTarget(target.value))
const resultStale=computed(()=>{
 const item=suggestion.value
 if(!item||staleTarget(item.target))return true
 if(item.repairJobId&&(!repair.value||repair.value.phase!=='review'||repair.value.jobId!==item.repairJobId||!repairJobCurrent(repair.value)))return true
 if(item.task!=='project')return false
 return !projectModeAvailable.value||!projectReady.value||item.response.project_revision!==props.projectRevision||!!item.context?.some(f=>!props.files.some(current=>current.id===f.id&&current.revision===f.revision&&current.path===f.path))
})
const extraStale=computed(()=>extras.value.some(extra=>!eligibleFiles.value.some(item=>item.id===extra.id&&item.revision===extra.revision)))
const canGenerate=computed(()=>!!capability.value?.enabled&&!!target.value&&!stale.value&&!extraStale.value&&!props.disabled&&!busy.value&&!contextBusy.value&&consent.value&&baseURL.value&&model.value&&key.value.trim().length>=8&&instruction.value.trim()&&selectedSource.value.trim()&&sourceBytes.value<=capability.value.max_source_bytes&&contextBytes.value<=capability.value.max_context_bytes&&paperAIBytes(instruction.value)<=4000&&(task.value!=='project'||projectReady.value)&&(!repairActive.value||(task.value==='project'&&repair.value?.phase==='review'&&repairJobCurrent(repair.value))))
const taskSteps=['准备模型','确认范围','生成建议','审阅审批']
const taskStep=computed(()=>{
 if(commitBusy.value||suggestion.value)return 3
 if(busy.value||repairActive.value)return 2
 if(!key.value.trim()||!model.value||!baseURL.value)return 0
 return 1
})
const taskStatus=computed(()=>{
 if(loading.value)return '读取服务能力'
 if(!capability.value?.enabled)return '模型服务未开放'
 if(commitBusy.value)return '等待拥有者确认或服务器提交结果'
 if(suggestion.value)return resultStale.value?'旧建议已失效':suggestion.value.task==='explain'?'分析已返回':suggestion.value.task==='project'?'等待审批 · '+approved.value.length+' / '+(suggestion.value.changes?.length||0)+' 个文件已勾选':'等待审批 · 单文件建议'
 if(busy.value)return '等待模型返回'
 if(repairActive.value)return repair.value?.message||'编译修复进行中'
 if(taskStep.value===0)return '请配置模型和 API Key'
 return canGenerate.value?'已确认发送范围，可以生成':'请选择并确认任务及源码范围'
})
function alive(n:number,initial:string){return !disposed&&n===serial&&initial===scope()}
function clearConsent(){consent.value=false}
watch([baseURL,model,key,instruction,task,target,extras,()=>props.source,()=>props.file.revision,()=>props.disabled,()=>props.projectRevision,extraStale,includeHistory,history],clearConsent,{flush:'sync'})
function stop(){serial++;controller?.abort();controller=null;busy.value=false;loading.value=false;clearConsent()}
function reset(){repairSerial++;repair.value=null;commitBusy.value=false;stop();contextSerial++;contextBusy.value=false;capability.value=null;key.value='';target.value=null;extras.value=[];suggestion.value=null;history.value=[];approved.value=[];task.value='revise';includeHistory.value=true;message.value=''}
watch([baseURL,model,key],()=>{history.value=[];suggestion.value=null;approved.value=[]},{flush:'sync'})
watch(projectModeAvailable,available=>{if(!available&&task.value==='project')task.value='revise'})
watch([()=>props.compileJob,()=>props.projectRevision,()=>props.compiler,()=>props.source,()=>props.file.revision,()=>props.disabled,repairAvailable],settleRepair,{flush:'post'})
function clearHistory(){if(!busy.value){history.value=[];suggestion.value=null;approved.value=[];message.value='已开始新对话。'}}
function approve(id:string,checked:boolean){
 if(busy.value||props.disabled||resultStale.value||!suggestion.value?.changes?.some(change=>change.file_id===id))return
 approved.value=checked?[...new Set([...approved.value,id])]:approved.value.filter(value=>value!==id)
}
watch(scope,()=>{reset();void loadCapability()})
onBeforeUnmount(()=>{disposed=true;reset()})
onMounted(()=>void loadCapability())
async function loadCapability(){
 if(disposed||busy.value||loading.value)return
 const n=++serial,initial=scope(),abort=new AbortController()
 controller=abort;loading.value=true;message.value=''
 try{
  const value=await getPaperAICapability(props.projectId,abort.signal)
  if(!alive(n,initial))return
  if(!Array.isArray(value.base_urls)||!value.base_urls.length||value.max_source_bytes<=0||value.max_context_bytes<=0||value.max_extra_files<0)throw new Error('invalid capability')
  capability.value=value
  baseURL.value=value.base_urls[0]||''
  if(value.enabled)capture(!!props.captureSelection())
 }catch{if(alive(n,initial)){capability.value=null;message.value='暂时无法获取 AI 服务能力，请稍后重试。'}}
 finally{if(alive(n,initial)){loading.value=false;controller=null}}
}
function capture(selectionOnly:boolean){
 if(busy.value||props.disabled)return
 const range=selectionOnly?props.captureSelection():{from:0,to:props.source.length,baseline:props.source}
 if(!range||range.baseline!==props.source||!validAIRange(range)){message.value=selectionOnly?'请先在源码编辑器中选中需要处理的文字。':'当前文件没有可处理的源码。';return}
 if(capability.value&&paperAIBytes(range.baseline.slice(range.from,range.to))>capability.value.max_source_bytes){message.value='源码范围过大，请缩小选区。';return}
 target.value={...range,fileId:props.file.id,revision:props.file.revision,...(props.collaborationEpoch?{collaborationEpoch:props.collaborationEpoch}:{})}
 suggestion.value=null;message.value='';clearConsent()
}
async function toggleContext(file:PaperFile,checked:boolean){
 if(busy.value||contextBusy.value||disposed||!capability.value)return
 if(!checked){extras.value=extras.value.filter(item=>item.id!==file.id);return}
 if(extras.value.length>=capability.value.max_extra_files)return
 const n=++contextSerial,initial=scope();contextBusy.value=true;message.value=''
 try{
  const loaded=await getPaperFile(props.projectId,file.id)
  if(disposed||n!==contextSerial||initial!==scope())return
  if(loaded.id!==file.id||loaded.kind!=='text'||loaded.revision!==file.revision||!eligibleFiles.value.some(item=>item.id===file.id&&item.revision===file.revision))throw new Error('changed')
  if(paperAIBytes(loaded.content)>32*1024||contextBytes.value+paperAIBytes(loaded.content)>capability.value.max_context_bytes){message.value='附加文件过大，未加入发送范围。';return}
  extras.value=[...extras.value,loaded]
 }catch{if(!disposed&&initial===scope()&&n===contextSerial)message.value='无法读取选定文件，请刷新项目后重试。'}
 finally{if(n===contextSerial)contextBusy.value=false}
}
function preset(value:string,mode:PaperAITask){if(busy.value)return;instruction.value=value;task.value=mode}
function diagnosticPreset(){preset('分析以下编译错误，注意行号可能对应之前的编译版本。不要编造内容：\\n'+(props.diagnostics||'').slice(0,1800),'explain')}
function cancel(){if(commitBusy.value)return;stop();activityRefresh.value++;message.value='已取消等待；如果模型服务已收到请求，仍可能产生费用。'}
function discard(){suggestion.value=null;approved.value=[];message.value='已丢弃建议，原稿未修改。'}
async function generate(){
 if(!canGenerate.value||!target.value||disposed)return
 const captured={...target.value},mode=task.value,initial=scope(),n=++serial,abort=new AbortController()
 controller=abort;busy.value=true;message.value='';suggestion.value=null;approved.value=[]
 const context=extras.value.map(item=>({...item})),base=props.projectRevision,repairJobId=repairActive.value?repair.value?.jobId:undefined
 const currentFile={...props.file,content:captured.baseline}
 const request={base_url:baseURL.value,model:model.value,api_key:key.value.trim(),file_id:captured.fileId,base_revision:captured.revision,source:selectedSource.value,task:mode,instruction:instruction.value,context:context.map(item=>({file_id:item.id,revision:item.revision})),consent:true as const,...(historyAvailable.value&&includeHistory.value&&history.value.length?{history:[...history.value]}:{}),...(mode==='project'?{project_revision:base}:{})}
 clearConsent()
 try{
  const response=await requestPaperAISuggestion(props.projectId,request,abort.signal)
  if(!alive(n,initial))return
  if(typeof response.text!=='string'||!response.text.trim()||paperAIBytes(response.text)>48*1024)throw new Error('invalid result')
  let changes:ReviewedPaperAIChange[]|undefined
  if(mode==='project'){
   if(response.project_revision!==base)throw new Error('Invalid plan revision')
   if(capability.value?.activity&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.proposal_id||''))throw new Error('Missing server proposal identifier')
   changes=reviewProjectEdits([currentFile,...context],response.edits??[])
   if(!changes)throw new Error('Invalid project plan')
  }
  if(repairJobId&&(!repair.value||repair.value.phase!=='review'||repair.value.jobId!==repairJobId||!repairJobCurrent(repair.value)))return
  suggestion.value={target:captured,task:mode,response,changes,context,repairJobId}
  if(historyAvailable.value&&capability.value){
   const reply=mode==='project'?JSON.stringify({summary:response.text,edits:response.edits||[]}):response.text
   history.value=appendAgentHistory(history.value,{task:mode,instruction:request.instruction,reply},Math.min(capability.value.max_history_turns||0,6),Math.min(capability.value.max_history_bytes||0,16384))
  }
  message.value=mode==='project'?'Agent 计划已生成，尚未修改任何文件。':mode==='revise'?'修改建议已生成，尚未修改源码。':'分析已完成。'
 }catch(cause){
  if(!alive(n,initial))return
  const code=cause instanceof ApiErrorResponseError?cause.code:''
  message.value=code==='papers.ai_context_changed'?'服务器文件版本已变化，请刷新项目并重新确认上下文。':code==='papers.ai_provider_auth'?'模型服务拒绝了 API Key，请核对密钥及权限。':code==='papers.ai_provider_rate'?'模型服务限流或额度不足。':code==='papers.ai_endpoint_denied'?'该 API 地址尚未获服务器批准。':code==='papers.ai_busy'?'AI 请求容量已满，请稍后重试。':code==='papers.ai_invalid_project_response'?'模型给出的文件或片段无法安全匹配，请缩小任务或重新生成。':code==='papers.ai_incomplete_response'?'模型输出不完整，请缩小源码范围或任务。':'生成失败，请检查模型、API Key 和网络，原稿未修改。'
 }finally{if(alive(n,initial)){busy.value=false;controller=null;activityRefresh.value++}}
}
async function acceptProject(){
 const item=suggestion.value
 if(!item||item.task!=='project'||!item.changes||resultStale.value||props.disabled||busy.value||!props.applyProject||!item.response.project_revision)return
 const chosen=item.changes.filter(change=>approved.value.includes(change.file_id))
 if(!chosen.length)return
 const n=++serial,initial=scope(),repairBefore=item.repairJobId?repair.value:null
 if(repairBefore)repair.value={...repairBefore,phase:'applying',message:'正在提交已审阅的修复…'}
 commitBusy.value=true;busy.value=true;message.value=''
 try{
  const replacements=chosen.map(({file_id,base_revision,content})=>({file_id,base_revision,content}))
  const fence=repairBefore?{jobId:repairBefore.jobId,compiler:repairBefore.compiler}:undefined
  const proposalId=capability.value?.activity?item.response.proposal_id:undefined
  if(capability.value?.activity&&!proposalId)throw Error('Missing server proposal identifier')
  const saved=proposalId?await props.applyProject(item.response.project_revision,replacements,fence,proposalId):fence?await props.applyProject(item.response.project_revision,replacements,fence):await props.applyProject(item.response.project_revision,replacements)
  activityRefresh.value++
  if(!alive(n,initial))return
  if(!saved){message.value='未确认提交成功。若项目版本变化或网络中断，请刷新服务器版本后再重新生成，避免重复提交。';if(repairBefore){commitBusy.value=false;busy.value=false;endRepair('修复未确认提交成功，已停止自动编译。')}return}
  suggestion.value=null;approved.value=[];target.value=null;extras.value=[]
  message.value='已原子提交所选文件修改，原版本保留在文件历史中。'
  if(repairBefore){
   await nextTick()
   if(!alive(n,initial))return
   commitBusy.value=false;busy.value=false
   await runRepairCompile(repairBefore.revision+1,repairBefore.rounds+1,repairBefore.compiler)
  }
 }catch{if(alive(n,initial)){message.value='提交未确认，请核对服务器版本后重试。';if(repairBefore){commitBusy.value=false;busy.value=false;endRepair('修复提交未确认，已停止。')}}}
 finally{if(alive(n,initial)){commitBusy.value=false;busy.value=false}}
}
function accept(){
 const item=suggestion.value
 if(!item||item.task!=='revise'||resultStale.value||props.disabled||busy.value)return
 if(!props.applyEdit({...item.target,replacement:item.response.text})){message.value='当前源码或权限已变化，未应用建议。';return}
 suggestion.value=null;approved.value=[];target.value=null;message.value=props.collaborationEpoch?'已接受修改，正在通过实时协作通道同步；请留意服务器确认状态。':'已接受修改，可使用编辑器撤销；保存沿用现有版本校验。'
}
</script>

<style scoped>
.paper-ai{display:grid;gap:9px;min-width:0;font-size:12px;line-height:1.5}
.paper-ai__workbench{display:grid;gap:8px;padding:12px;border:1px solid var(--a-color-border-soft,#ddd);border-radius:8px}
.paper-ai__identity{display:flex;align-items:center;gap:9px}
.paper-ai__identity>div{display:grid;gap:2px}
.paper-ai__identity strong{font-size:14px}
.paper-ai__avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--a-color-bg-subtle,#e7edf3);color:var(--a-color-primary,#26784b);font-weight:700}
.paper-ai__steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
.paper-ai__steps span{padding:5px 7px;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;color:var(--a-color-text-secondary,#64748b)}
.paper-ai__steps .current{border-color:var(--a-color-primary,#26784b);color:var(--a-color-primary,#26784b);font-weight:600}
.paper-ai__steps .done{color:inherit}
.paper-ai p{margin:0;color:var(--a-color-text-secondary,#64748b)}
.paper-ai label,.paper-ai__settings,.paper-ai__context,.paper-ai__result{display:grid;gap:5px;min-width:0}
.paper-ai__settings,.paper-ai__context,.paper-ai__result,.paper-ai__notice{border:1px solid var(--a-color-border-soft,#ddd);border-radius:6px;padding:9px}
.paper-ai summary{cursor:pointer;font-weight:600}
.paper-ai input:not([type=checkbox]),.paper-ai textarea,.paper-ai select{box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;background:var(--a-color-bg,#fff);color:inherit;padding:6px;font:inherit}
.paper-ai textarea{resize:vertical}
.paper-ai__row{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.paper-ai__row>button{font-size:12px}
.paper-ai label.paper-ai__check{display:flex;align-items:flex-start;gap:6px;overflow-wrap:anywhere}
.paper-ai__check input{flex-shrink:0;margin-top:3px}
.paper-ai__consent{padding:7px;background:var(--a-color-bg-soft,#f1f3f5);border-radius:4px}
.paper-ai pre{font:12px/1.6 monospace;margin:4px 0 0;max-height:210px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;background:var(--a-color-bg-soft,#f1f3f5);border-radius:4px}
.paper-ai__diff{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:8px;min-width:0}
.paper-ai__diff>div{min-width:0}
.paper-ai small{color:var(--a-color-text-secondary,#64748b)}
</style>
