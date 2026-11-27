<template>
 <section class="paper-ai" aria-label="AI 修改建议">
  <nav class="paper-ai__navigation" aria-label="AI 工作区导航">
   <PButton size="sm" type="button" variant="ghost" :disabled="!capability?.enabled" @click="jumpAISection('settings')"><Settings2 :size="14" aria-hidden="true"/> 配置</PButton>
   <PButton size="sm" type="button" variant="ghost" :disabled="!capability?.enabled" @click="jumpAISection('task')"><MessageSquare :size="14" aria-hidden="true"/> 任务</PButton>
   <PButton size="sm" type="button" variant="ghost" :disabled="!suggestion" @click="jumpAISection('review')"><FileDiff :size="14" aria-hidden="true"/> 审阅{{suggestion?.changes?.length?' ('+suggestion.changes.length+')':''}}</PButton>
   <PButton v-if="capability?.activity" size="sm" type="button" variant="ghost" @click="jumpAISection('activity')"><History :size="14" aria-hidden="true"/> 记录</PButton>
  </nav>
  <header class="paper-ai__workbench" aria-label="当前 AI 任务">
   <div class="paper-ai__identity"><strong>{{capability?.agent?.id==='papers-agent'?capability.agent.display_name:'Papers Agent'}}</strong><small>拥有者审批</small></div>
   <p class="paper-ai__task-summary" :title="file.path">当前任务：{{task==='project'?'跨文件修改':task==='explain'?'解释与分析':'源码修改'}} · v{{file.revision}}</p>
   <p role="status" class="paper-ai__task-status">{{taskStatus}}</p>
   <details class="paper-ai__workflow"><summary>流程 {{taskStep+1}} / {{taskSteps.length}} · 审批说明</summary>
   <div class="paper-ai__steps" aria-label="任务进度">
    <span v-for="(step,index) in taskSteps" :key="step" :aria-current="index===taskStep?'step':undefined" :class="{current:index===taskStep,done:index<taskStep}">{{index+1}}. {{step}}</span>
   </div>
   <small>AI 不作为可登录成员，不能自主提交。跨文件任务的提交者仍是拥有者；实时协作编辑继续使用你的身份。</small>
   </details>
  </header>
  <p v-if="loading" role="status">正在检查 AI 服务…</p>
  <div v-else-if="!capability?.enabled" class="paper-ai__notice">
   <strong>AI 助手尚未开放</strong><p>{{ message||'源码编辑不受影响。' }}</p>
   <PButton size="sm" variant="secondary" type="button" @click="loadCapability">重新检查</PButton>
  </div>
  <template v-else>
   <details ref="settingsPanel" class="paper-ai__settings" open>
    <summary><span>模型与 API 设置</span><small>{{baseValid&&key.trim()&&model?model:'待配置'}}</small></summary>
    <div class="paper-ai__settings-body"><PInput v-if="capability?.custom_base_urls" v-model.trim="baseURL" label="API 地址" aria-label="AI API 地址" maxlength="512" placeholder="https://api.example.com/v1" spellcheck="false" autocomplete="off" :disabled="busy" :error="baseURL&&!baseValid?'请输入公开 HTTPS API 基础地址':''" />
    <PSelect v-else :model-value="baseURL" label="AI API 地址" size="sm" :options="capability!.base_urls.map(value=>({value,label:value}))" :disabled="busy" @update:model-value="baseURL=String($event)" />
    <small>填写 API 域名、基础地址或完整接口地址即可。获取列表时会在同一 HTTPS 域名内自动检测并修正多余或缺失的接口路径；手动更换地址会清除旧密钥。</small>
    <PInput v-model="key" label="API Key" type="password" autocomplete="off" spellcheck="false" aria-label="AI API Key" maxlength="2048" :disabled="busy" placeholder="使用该 API 服务的密钥" />
    <div v-if="capability?.model_discovery" class="paper-ai__row">
     <PButton type="button" size="sm" variant="secondary" :loading="modelsLoading" :disabled="!canDiscoverModels" @click="discoverModels">获取模型列表</PButton>
    </div>
    <small v-if="capability?.model_discovery">获取列表时会验证 API 地址并回填成功的基础地址。仅向填写的 HTTPS 域名发送 API Key，不发送论文内容，不跟随重定向。请选择支持聊天补全的模型。</small>
    <p v-if="modelsMessage" role="status">{{modelsMessage}}</p>
    <PSelect v-if="modelList.length" :model-value="model" :options="modelList.map(value=>({value,label:value}))" label="可用模型" placeholder="请选择模型" size="sm" :disabled="busy||modelsLoading" @update:model-value="model=String($event)" />
    <PInput v-model.trim="model" label="模型 ID" aria-label="AI 模型" maxlength="128" placeholder="也可手动输入，例如 gpt-4.1-mini" :disabled="busy" />
    <p>默认密钥只保留在当前面板。可主动使用下方本机加密保险库保存配置，模型调用由你的 API 账户计费；仅向你明确确认的服务发送源码。</p>
    <PaperAIVault :account-id="accountId" :project-id="projectId" :file-id="file.id" :revision="file.revision" v-bind="{baseURL}" :model="model" :api-key="key" :task="task" :instruction="instruction" :history="history" :disabled="busy||commitBusy||repairActive||disabled" @profile="restoreProfile" @restore="restoreCheckpoint" @lock="lockVault" />
    </div>
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
   <section ref="taskPanel" class="paper-ai__composer" aria-label="任务指令">
    <strong class="paper-ai__section-title">任务与指令</strong>
   <PSelect :model-value="task" :options="taskOptions" label="AI 任务类型" size="sm" :disabled="busy||repairActive" @update:model-value="task=$event as PaperAITask" />
   <p v-if="task==='project'">使用已保存的完整文件。每个文件最多一处连续替换，审阅并勾选后才能提交。该操作仅在普通编辑模式开放，可能使其他协作者的旧会话失效，请先协调。</p>
   <p v-if="task==='project'&&!projectReady" role="status">请先保存源码并选择整个文件，再生成跨文件建议。</p>
   <div class="paper-ai__row">
    <PButton size="sm" variant="secondary" type="button" :disabled="busy||repairActive" @click="preset('润色这段论文，保持研究事实、数值、引用键和 LaTeX 结构。','revise')">学术润色</PButton>
    <PButton size="sm" variant="secondary" type="button" :disabled="busy||repairActive" @click="preset('将这段论文翻译为英文，保留 LaTeX 命令、公式和引用。','revise')">英文翻译</PButton>
    <PButton size="sm" variant="secondary" type="button" :disabled="busy||repairActive" @click="preset('检查 LaTeX 语法和学术表达，解释问题并提出具体修改建议。','explain')">源码检查</PButton>
    <PButton size="sm" variant="secondary" v-if="diagnostics" type="button" :disabled="busy||repairActive" @click="diagnosticPreset">分析编译错误</PButton>
   </div>
   <PTextarea v-model="instruction" label="给 AI 的指令" aria-label="AI 修改指令" :rows="3" maxlength="4000" :disabled="busy" placeholder="描述需要完成的任务…" />
   </section>
   <section class="paper-ai__scope" aria-label="发送范围">
    <strong class="paper-ai__section-title">源码与上下文</strong>
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
    <summary>附加项目文件（{{ extras.length }}/{{ capability!.max_extra_files }}）</summary>
    <p>{{task==='project'?'仅允许 Agent 提议修改当前完整文件及下面勾选、预览的文件。':'仅发送下方主动选择并成功预览的已保存文本文件，不发送图片或其他项目内容。'}}</p>
    <PButton type="button" size="sm" variant="secondary" :disabled="busy||contextBusy||disabled||!target||stale||!instruction.trim()" @click="recommendContext">全项目检索并选择相关文件</PButton>
    <small>在本站读取已保存文本并按任务关键词、LaTeX 引用关系与编译错误推荐，替换下方附加文件选择。不会直接调用模型；仍需检查发送范围。每次受服务的文件数和字节限制。</small>
    <p v-if="recommendMessage" role="status">{{recommendMessage}}</p>
    <div v-for="candidate in recommended" :key="candidate.file.id"><small>{{candidate.file.path}} · {{candidate.reasons.join('；')}}</small></div>
    <PInput v-if="eligibleFiles.length>7" v-model.trim="contextFilter" aria-label="筛选 AI 附加文件" placeholder="按文件名或路径筛选" maxlength="200" :disabled="busy" />
    <p v-if="eligibleFiles.length&&!visibleContextFiles.length">没有匹配的文件；已选择的附加文件保持不变。</p>
    <PCheckbox v-for="item in visibleContextFiles" :key="item.id" class="paper-ai__check" :model-value="extras.some(extra=>extra.id===item.id)" :disabled="busy||contextBusy||(!extras.some(extra=>extra.id===item.id)&&extras.length>=capability!.max_extra_files)" @update:model-value="toggleContext(item,$event)">{{item.path}}</PCheckbox>
    <p v-if="contextBusy">读取文件预览中…</p>
    <details v-for="extra in extras" :key="extra.id"><summary>{{ extra.path }} · v{{ extra.revision }}</summary><pre>{{ extra.content }}</pre></details>
   </details>
   <details v-if="historyAvailable&&history.length" class="paper-ai__context" open>
    <summary>本轮对话（{{history.length}} 轮）</summary>
    <PCheckbox v-model="includeHistory" class="paper-ai__check" :disabled="busy">继续对话：发送以下已预览的历史记录</PCheckbox>
    <div v-for="(turn,index) in history" :key="index" class="paper-ai__turn">
     <strong>你 · 第 {{index+1}} 轮</strong><pre>{{turn.instruction}}</pre>
     <strong>AI 建议（不表示已应用）</strong><pre>{{turn.reply}}</pre>
    </div>
    <small>最多 {{capability!.max_history_turns}} 轮、{{capability!.max_history_bytes}} 字节；默认关闭面板、切换文件或模型配置后清除；可在保险库中加密保存会话。</small>
    <PButton type="button" size="sm" variant="secondary" :disabled="busy" @click="clearHistory">开始新对话</PButton>
   </details>
   </section>
   <section class="paper-ai__submit" aria-label="确认并生成">
   <PCheckbox v-model="consent" class="paper-ai__check paper-ai__consent" :disabled="busy">我确认将上方预览的源码、附加文件和指令以及勾选的对话历史发送到所选模型服务，允许该服务处理这些内容。</PCheckbox>
   <p>{{ contextBytes.toLocaleString() }} / {{ capability!.max_context_bytes.toLocaleString() }} 字节 · 每次最多生成 4096 tokens</p>
   <div class="paper-ai__row">
    <PButton size="sm" type="button" :disabled="!canGenerate" @click="generate">{{ busy?'生成中…':'生成建议' }}</PButton>
    <PButton v-if="busy&&!commitBusy" size="sm" type="button" variant="secondary" @click="cancel">取消等待</PButton>
   </div>
   <p v-if="message" role="status">{{ message }}</p>
   </section>
   <section v-if="suggestion" ref="resultPanel" class="paper-ai__result" aria-label="审阅 AI 建议">
    <strong>{{ suggestion.task==='project'?'Agent 跨文件修改计划':suggestion.task==='revise'?'待审阅修改':'AI 分析结果' }}</strong>
    <small>提议者：Papers Agent · {{suggestion.task==='explain'?'仅供分析':resultStale?'版本已变化，需重新生成':'尚未提交，请审阅'}}{{suggestion.response.proposal_id?' · '+suggestion.response.proposal_id.slice(0,8):''}}</small>
    <small v-if="suggestion.response.input_tokens||suggestion.response.output_tokens">输入 {{ suggestion.response.input_tokens||0 }} · 输出 {{ suggestion.response.output_tokens||0 }} tokens</small>
    <PaperAIDiff v-if="suggestion.task==='revise'" :before="suggestion.target.baseline.slice(suggestion.target.from,suggestion.target.to)" :after="suggestion.response.text" />
    <pre v-else>{{ suggestion.response.text }}</pre>
    <template v-if="suggestion.task==='project'">
     <p v-if="!suggestion.changes?.length">没有需要修改的文件。</p>
     <div v-if="suggestion.changes?.length" class="paper-ai__review-nav" aria-label="修改文件导航">
      <strong>{{approved.length}} / {{suggestion.changes.length}} 个文件已选</strong>
      <PButton size="sm" variant="ghost" type="button" :disabled="reviewIndex===0" @click="moveReview(-1)">上一文件</PButton>
      <PButton size="sm" variant="ghost" type="button" :disabled="reviewIndex>=suggestion.changes.length-1" @click="moveReview(1)">下一文件</PButton>
     </div>
     <div v-for="(change,index) in suggestion.changes||[]" :key="change.file_id" class="paper-ai__review-file" :class="{current:index===reviewIndex}">
      <div class="paper-ai__review-file-heading">
       <PCheckbox class="paper-ai__check" :model-value="approved.includes(change.file_id)" :disabled="busy||disabled||resultStale" @update:model-value="approve(change.file_id,$event)"><strong>{{change.path}} · v{{change.base_revision}}</strong></PCheckbox>
       <PButton size="sm" variant="ghost" type="button" :aria-expanded="index===reviewIndex" :aria-label="'审阅 '+change.path" @click="reviewIndex=index">查看差异</PButton>
      </div>
      <PaperAIDiff v-if="index===reviewIndex" :before="change.before" :after="change.after" />
     </div>
     <div v-if="suggestion.changes?.length" class="paper-ai__review-actions">
      <small>仅提交勾选的完整文件修改，仍需最终确认。</small>
      <PButton type="button" size="sm" :disabled="resultStale||disabled||busy||!approved.length" @click="acceptProject">应用已选修改（{{approved.length}}）</PButton>
     </div>
    </template>
    <p v-if="resultStale">当前源码或文件版本已变化，不能应用旧建议，请重新生成。</p>
    <div class="paper-ai__row">
     <PButton v-if="suggestion.task==='revise'" type="button" size="sm" :disabled="resultStale||disabled||busy" @click="accept">接受修改</PButton>
     <PButton type="button" size="sm" variant="secondary" @click="discard">丢弃建议</PButton>
    </div>
   </section>
  </template>
  <div v-if="capability?.activity" ref="activityPanel" class="paper-ai__activity-anchor"><PaperAIActivityPanel :project-id="projectId" :account-id="accountId" :files="files" :refresh="activityRefresh" :disabled="busy||disabled||repairActive||!!collaborationEpoch||source!==file.content" :rollback="rollbackActivity" :historical-changes="capability.historical_changes===true" :pending-proposal="suggestion?.response.proposal_id" /></div>
 </section>
</template>

<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue'
import {Settings2,MessageSquare,FileDiff,History} from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PCheckbox from '@/components/ui/PCheckbox.vue'
import {normalizePaperAIBase,paperAIModelBaseCandidates,paperAIProviderDiagnostic,paperAIModelPattern,validPaperAIBase,validPaperAIKey} from './aiProvider'
import PaperAIActivityPanel from './PaperAIActivityPanel.vue'
import PaperAIDiff from './PaperAIDiff.vue'
import PaperAIVault from './PaperAIVault.vue'
import type {AIProfile,AISessionCheckpoint} from './aiVault'
import {readProjectText,projectFileFence} from './projectRead'
import {rankProjectContext,chooseProjectContext,type ContextCandidate} from './aiProjectContext'
import {getPaperFile,type PaperFile,type PaperTextReplacement,type PaperCompileJob,type PaperCompiler} from '@/api/papers'
import {ApiErrorResponseError} from '@/api/client'
import {getPaperAICapability,requestPaperAISuggestion,discoverPaperAIModels,type PaperAICapability,type PaperAISuggestion,type PaperAITask,type PaperAIHistoryTurn,type PaperAIActivity} from '@/api/papersAI'
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
const resultPanel=ref<HTMLElement|null>(null),settingsPanel=ref<HTMLDetailsElement|null>(null),taskPanel=ref<HTMLElement|null>(null),activityPanel=ref<HTMLElement|null>(null)
const reviewIndex=ref(0)
function moveReview(delta:number){reviewIndex.value=Math.max(0,Math.min((suggestion.value?.changes?.length||1)-1,reviewIndex.value+delta))}
function jumpAISection(section:'settings'|'task'|'review'|'activity'){
 const target=section==='settings'?settingsPanel.value:section==='task'?taskPanel.value:section==='review'?resultPanel.value:activityPanel.value
 if(section==='settings'&&settingsPanel.value)settingsPanel.value.open=true
 if(section==='activity'){const details=activityPanel.value?.querySelector('details');if(details)details.open=true}
 target?.scrollIntoView?.({block:'start',behavior:'auto'})
}
watch(suggestion,async (value)=>{reviewIndex.value=0;if(!value)return;await nextTick();jumpAISection('review')})
const history=shallowRef<PaperAIHistoryTurn[]>([]),includeHistory=ref(true),approved=ref<string[]>([])
const historyAvailable=computed(()=>Number.isSafeInteger(capability.value?.max_history_turns)&&Number.isSafeInteger(capability.value?.max_history_bytes)&&(capability.value?.max_history_turns||0)>0&&(capability.value?.max_history_bytes||0)>0)
const projectModeAvailable=computed(()=>capability.value?.project_edits===true&&!props.collaborationEpoch&&!!props.applyProject&&Number.isSafeInteger(props.projectRevision)&&(props.projectRevision||0)>0)
const projectReady=computed(()=>projectModeAvailable.value&&!!target.value&&target.value.from===0&&target.value.to===target.value.baseline.length&&target.value.baseline===props.file.content&&props.source===props.file.content)
const busy=ref(false),contextBusy=ref(false)
const recommended=shallowRef<ContextCandidate[]>([]),recommendMessage=ref('')
const modelList=ref<string[]>([]),modelsLoading=ref(false),modelsMessage=ref('')
let modelsSerial=0,modelsController:AbortController|null=null
let applyingResolvedBase=false
const baseValid=computed(()=>!!capability.value&&validPaperAIBase(baseURL.value,capability.value.custom_base_urls===true,capability.value.base_urls))
const canDiscoverModels=computed(()=>!!capability.value?.enabled&&capability.value.model_discovery===true&&baseValid.value&&validPaperAIKey(key.value.trim())&&!busy.value&&!modelsLoading.value)
const taskOptions=computed(()=>[{value:'revise',label:'修改源码（可审阅后接受）'},{value:'explain',label:'解释、分析或排查'},...(projectModeAvailable.value?[{value:'project',label:'Agent · 跨文件修改'}]:[])])
let disposed=false,serial=0,contextSerial=0,controller:AbortController|null=null
const scope=()=>props.accountId+':'+props.projectId+':'+props.file.id+':'+(props.collaborationEpoch||'ordinary')
const selectedSource=computed(()=>target.value?target.value.baseline.slice(target.value.from,target.value.to):'')
const sourceBytes=computed(()=>paperAIBytes(selectedSource.value))
const contextBytes=computed(()=>sourceBytes.value+extras.value.reduce((n,item)=>n+paperAIBytes(item.content),0))
const eligibleFiles=computed(()=>props.files.filter(item=>item.kind==='text'&&item.id!==props.file.id))
const contextFilter=ref('')
const visibleContextFiles=computed(()=>eligibleFiles.value.filter(file=>file.path.toLowerCase().includes(contextFilter.value.toLowerCase())))
watch(()=>props.file.id,()=>{contextFilter.value=''})
const staleTarget=(item:Captured|null)=>!item||item.fileId!==props.file.id||item.revision!==props.file.revision||item.baseline!==props.source||item.collaborationEpoch!==props.collaborationEpoch
const stale=computed(()=>staleTarget(target.value))
const contextIsStale=(context:readonly PaperFile[])=>context.some(f=>!props.files.some(current=>current.id===f.id&&current.kind==='text'&&current.revision===f.revision&&current.path===f.path&&(!f.sha256||current.sha256===f.sha256)))
const resultStale=computed(()=>{
 const item=suggestion.value
 if(!item||staleTarget(item.target)||contextIsStale(item.context||[]))return true
 if(item.repairJobId&&(!repair.value||repair.value.phase!=='review'||repair.value.jobId!==item.repairJobId||!repairJobCurrent(repair.value)))return true
 if(item.task!=='project')return false
 return !projectModeAvailable.value||!projectReady.value||item.response.project_revision!==props.projectRevision
})
const extraStale=computed(()=>contextIsStale(extras.value))
const canGenerate=computed(()=>!!capability.value?.enabled&&!!target.value&&!stale.value&&!extraStale.value&&!props.disabled&&!busy.value&&!contextBusy.value&&consent.value&&baseValid.value&&paperAIModelPattern.test(model.value)&&validPaperAIKey(key.value.trim())&&!modelsLoading.value&&instruction.value.trim()&&selectedSource.value.trim()&&sourceBytes.value<=capability.value.max_source_bytes&&contextBytes.value<=capability.value.max_context_bytes&&paperAIBytes(instruction.value)<=4000&&(task.value!=='project'||projectReady.value)&&(!repairActive.value||(task.value==='project'&&repair.value?.phase==='review'&&repairJobCurrent(repair.value))))
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
function reset(){recommended.value=[];recommendMessage.value='';resetModels();repairSerial++;repair.value=null;commitBusy.value=false;stop();contextSerial++;contextBusy.value=false;capability.value=null;key.value='';target.value=null;extras.value=[];suggestion.value=null;history.value=[];approved.value=[];task.value='revise';includeHistory.value=true;message.value=''}
watch([baseURL,model,key],()=>{history.value=[];suggestion.value=null;approved.value=[]},{flush:'sync'})
function restoreProfile(profile:AIProfile){
 if(busy.value||commitBusy.value||repairActive.value||props.disabled||!capability.value)return
 if(!validPaperAIBase(profile.baseURL,capability.value.custom_base_urls===true,capability.value.base_urls)||!paperAIModelPattern.test(profile.model)||!validPaperAIKey(profile.key)){message.value='保存的配置不符合当前服务限制。';return}
 baseURL.value=profile.baseURL;model.value=profile.model;key.value=profile.key
 clearConsent();message.value='已载入加密配置；尚未向模型服务发送请求。'
}
function restoreCheckpoint(session:AISessionCheckpoint,profile:AIProfile|undefined){
 if(busy.value||commitBusy.value||repairActive.value||props.disabled||!capability.value||session.projectId!==props.projectId)return
 if(!validPaperAIBase(session.baseURL,capability.value.custom_base_urls===true,capability.value.base_urls)||!paperAIModelPattern.test(session.model)){message.value='会话对应的服务已不可用。';return}
 if(profile)restoreProfile(profile)
 else{baseURL.value=session.baseURL;model.value=session.model;key.value=''}
 instruction.value=session.instruction;task.value=session.task==='project'&&!projectModeAvailable.value?'revise':session.task
 const restored:PaperAIHistoryTurn[]=[]
 if(historyAvailable.value)for(const turn of session.history)restored.push(turn)
 history.value=restored.reduce((all,turn)=>appendAgentHistory(all,turn,Math.min(capability.value!.max_history_turns||0,6),Math.min(capability.value!.max_history_bytes||0,16384)),[] as PaperAIHistoryTurn[])
 target.value=null;extras.value=[];suggestion.value=null;approved.value=[];includeHistory.value=false;clearConsent()
 message.value='已恢复会话和任务指令。原文件 '+session.fileId.slice(0,8)+' · v'+session.revision+'；请重新选择当前源码和确认发送范围。'
}
function lockVault(){
 if(busy.value||commitBusy.value||repairActive.value)return
 key.value='';history.value=[];suggestion.value=null;approved.value=[];clearConsent()
}
function resetModels(){modelsSerial++;modelsController?.abort();modelsController=null;modelList.value=[];modelsLoading.value=false;modelsMessage.value=''}
watch(baseURL,(value,previous)=>{
 if(value!==previous&&!applyingResolvedBase){resetModels();key.value='';model.value=value==='https://api.openai.com/v1'?'gpt-4.1-mini':''}
},{flush:'sync'})
watch(key,resetModels,{flush:'sync'})
async function discoverModels(){
 if(!canDiscoverModels.value||disposed)return
 resetModels()
 let entered=baseURL.value
 const n=++modelsSerial,initial=scope(),endpoint=normalizePaperAIBase(entered),secret=key.value.trim(),abort=new AbortController()
 modelsController=abort;modelsLoading.value=true;modelsMessage.value='正在验证 API 地址并获取模型列表…';clearConsent()
 const alive=()=>!disposed&&n===modelsSerial&&initial===scope()&&entered===baseURL.value&&secret===key.value.trim()
 try{
  const result=await discoverPaperAIModels(props.projectId,{base_url:endpoint,api_key:secret,consent:true},abort.signal)
  if(!alive())return
  if(!Array.isArray(result.models)||result.models.length>512||result.models.some(id=>typeof id!=='string'||!paperAIModelPattern.test(id)||id.includes(secret)))throw Error('Invalid model list')
  const resolved=result.resolved_base_url??endpoint
  if(typeof resolved!=='string'||resolved.includes(secret)||!capability.value||!paperAIModelBaseCandidates(entered,capability.value.custom_base_urls===true,capability.value.base_urls).includes(resolved))throw Error('Invalid resolved API address')
  const corrected=resolved!==entered
  if(corrected){
   // A validated same-origin correction is not a user-initiated provider
   // change. Retain the key and keep this discovery request alive.
   applyingResolvedBase=true
   try{entered=resolved;baseURL.value=resolved}finally{applyingResolvedBase=false}
  }
  modelList.value=[...new Set(result.models)].sort()
  if(modelList.value.length&&!modelList.value.includes(model.value))model.value=''
  const summary=modelList.value.length?'已获取 '+modelList.value.length+' 个模型'+(result.truncated?'（列表已截断）':'')+'，请选择或手动输入。':'服务未返回可用模型，请手动输入模型 ID。'
  modelsMessage.value=(corrected?'已自动修正 API 地址：'+resolved+'。':'')+summary
 }catch(cause){
  if(!alive())return
  const code=cause instanceof ApiErrorResponseError?cause.code:''
  modelsMessage.value=paperAIProviderDiagnostic(code,'models',cause instanceof ApiErrorResponseError?cause.status:undefined)
 }finally{if(alive()){modelsLoading.value=false;modelsController=null}}
}
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
async function recommendContext(){
 if(disposed||busy.value||contextBusy.value||props.disabled||!target.value||stale.value||!instruction.value.trim()||!capability.value||!props.projectRevision)return
 const n=++contextSerial,initial=scope(),base=props.projectRevision,manifest=projectFileFence(props.files),query=instruction.value,captured=target.value,diagnosticText=props.diagnostics||'',limits=capability.value
 const valid=()=>!disposed&&n===contextSerial&&initial===scope()&&props.projectRevision===base&&projectFileFence(props.files)===manifest&&instruction.value===query&&target.value===captured&&!stale.value&&(props.diagnostics||'')===diagnosticText
 contextBusy.value=true;clearConsent();recommended.value=[];recommendMessage.value='正在检索项目的已保存文本…'
 try{
  const rows=await readProjectText([...props.files],base,id=>getPaperFile(props.projectId,id),valid)
  if(!valid())return
  const current={...props.file,content:captured.baseline}
  const ranked=rankProjectContext(rows,current,query,diagnosticText)
  const selected=chooseProjectContext(ranked,limits.max_extra_files,Math.max(0,limits.max_context_bytes-sourceBytes.value))
  if(!valid())return
  extras.value=selected.map(c=>c.file);recommended.value=selected
  recommendMessage.value='已检索 '+rows.length+' 个文本文件；'+ranked.length+' 个相关候选，已选择 '+selected.length+' 个符合发送容量的文件。请预览并确认。'
 }catch{if(n===contextSerial&&initial===scope()&&!disposed)recommendMessage.value='未更新发送范围：项目版本变化、读取失败或总源码超过 4 MiB。请刷新后重试。'}
 finally{if(n===contextSerial)contextBusy.value=false}
}
watch([instruction,()=>props.projectRevision,()=>props.file.revision,()=>props.source],()=>{recommended.value=[];recommendMessage.value=''})
async function toggleContext(file:PaperFile,checked:boolean){
 if(busy.value||contextBusy.value||disposed||!capability.value)return
 if(!checked){extras.value=extras.value.filter(item=>item.id!==file.id);recommended.value=recommended.value.filter(item=>item.file.id!==file.id);return}
 if(extras.value.length>=capability.value.max_extra_files)return
 const n=++contextSerial,initial=scope();contextBusy.value=true;message.value=''
 try{
  const loaded=await getPaperFile(props.projectId,file.id)
  if(disposed||n!==contextSerial||initial!==scope())return
  if(loaded.id!==file.id||loaded.kind!=='text'||loaded.path!==file.path||loaded.revision!==file.revision||(file.sha256&&loaded.sha256!==file.sha256)||contextIsStale([loaded]))throw new Error('changed')
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
 const request={base_url:normalizePaperAIBase(baseURL.value),model:model.value,api_key:key.value.trim(),file_id:captured.fileId,base_revision:captured.revision,source:selectedSource.value,task:mode,instruction:instruction.value,context:context.map(item=>({file_id:item.id,revision:item.revision})),consent:true as const,...(historyAvailable.value&&includeHistory.value&&history.value.length?{history:[...history.value]}:{}),...(mode==='project'?{project_revision:base}:{})}
 clearConsent()
 try{
  const response=await requestPaperAISuggestion(props.projectId,request,abort.signal)
  if(!alive(n,initial))return
  if(staleTarget(captured)||contextIsStale(context)||(mode==='project'&&base!==props.projectRevision)||request.base_url!==normalizePaperAIBase(baseURL.value)||request.model!==model.value||request.api_key!==key.value.trim()){message.value='源码、附加文件或模型配置已变化，已丢弃旧响应；请重新确认。';return}
  if(typeof response.text!=='string'||!response.text.trim()||paperAIBytes(response.text)>48*1024||response.text.includes(request.api_key))throw new Error('invalid result')
  let changes:ReviewedPaperAIChange[]|undefined
  if(mode==='project'){
   if(response.project_revision!==base)throw new Error('Invalid plan revision')
   if(capability.value?.activity&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.proposal_id||''))throw new Error('Missing server proposal identifier')
   if(response.edits?.some(edit=>[edit.path,edit.before,edit.after].some(text=>typeof text!=='string'||text.includes(request.api_key))))throw Error('Credential in proposal')
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
  message.value=code==='papers.ai_context_changed'?'服务器文件版本已变化，请刷新项目并重新确认上下文。':code==='papers.ai_provider_auth'?'模型服务拒绝了 API Key，请核对密钥及权限。':code==='papers.ai_provider_rate'?'模型服务限流或额度不足。':code==='papers.ai_endpoint_denied'?'该 API 地址不符合公开 HTTPS 安全限制。':code==='papers.ai_busy'?'AI 请求容量已满，请稍后重试。':code==='papers.ai_invalid_project_response'?'模型给出的文件或片段无法安全匹配，请缩小任务或重新生成。':code==='papers.ai_incomplete_response'?'模型输出不完整，请缩小源码范围或任务。':paperAIProviderDiagnostic(code,'chat',cause instanceof ApiErrorResponseError?cause.status:undefined)
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
.paper-ai{--a-control-height-sm:28px;display:grid;gap:6px;min-width:0;font-size:12px;line-height:1.5;container-type:inline-size}
.paper-ai__workbench,.paper-ai__settings,.paper-ai__composer,.paper-ai__scope,.paper-ai__submit,.paper-ai__result,.paper-ai__notice{border:1px solid var(--a-color-border-soft,#ddd);border-radius:6px;background:var(--a-color-bg,#fff);padding:8px;min-width:0;display:grid;gap:6px}
.paper-ai__workbench{gap:3px;padding:6px 8px}
.paper-ai__identity{display:flex;align-items:baseline;justify-content:space-between;gap:6px;min-width:0}
.paper-ai__identity strong{font-size:12px;font-weight:650}
.paper-ai__task-summary{font-size:11px}
.paper-ai__task-status{font-weight:600;color:var(--a-color-text,#20242c)!important}
.paper-ai__workflow{font-size:11px;color:var(--a-color-text-secondary,#64748b)}
.paper-ai__workflow[open]>.paper-ai__steps{margin:4px 0}
.paper-ai__steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
.paper-ai__steps span{padding:5px 4px;border-bottom:2px solid var(--a-color-border-soft,#ddd);color:var(--a-color-text-secondary,#64748b);font-size:11px;white-space:normal}
.paper-ai__steps .current{border-color:var(--a-color-primary,#26784b);color:var(--a-color-primary,#26784b);font-weight:650}
.paper-ai__steps .done{color:inherit}
.paper-ai p{margin:0;color:var(--a-color-text-secondary,#64748b);overflow-wrap:anywhere}
.paper-ai__workbench>small{font-size:11px}
.paper-ai__section-title{font-size:13px;font-weight:650}
.paper-ai label,.paper-ai__settings-body,.paper-ai__context{display:grid;gap:5px;min-width:0}
.paper-ai__settings>summary{display:flex;justify-content:space-between;align-items:center;gap:8px}
.paper-ai__settings>summary small{font-weight:400;max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.paper-ai__context{border:1px solid var(--a-color-border-soft,#ddd);border-radius:5px;padding:6px;background:var(--a-color-bg,#fff)}
.paper-ai__context>summary{margin-bottom:3px}
.paper-ai summary{cursor:pointer;font-weight:600;overflow-wrap:anywhere}
.paper-ai__row{display:flex;align-items:center;flex-wrap:wrap;gap:4px}
.paper-ai__row>button{font-size:11px;padding-inline:6px}
.paper-ai label.paper-ai__check{display:flex;align-items:flex-start;gap:6px;overflow-wrap:anywhere}
.paper-ai__check input{flex-shrink:0;margin-top:3px}
.paper-ai__submit{border-color:var(--a-color-border-soft,#ddd)}
.paper-ai__submit .paper-ai__row>button:first-child{flex:1}
.paper-ai__consent{padding:6px;background:var(--a-color-bg-soft,#f1f3f5);border-radius:5px}
.paper-ai pre{font:12px/1.6 monospace;margin:4px 0 0;max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:6px;background:var(--a-color-bg-soft,#f1f3f5);border:1px solid var(--a-color-border-soft,#ddd);border-radius:5px}
.paper-ai__result{border-top:3px solid var(--a-color-primary,#26784b)}
.paper-ai__result>strong{font-size:15px}
.paper-ai__turn{display:grid;gap:4px;padding-block:7px;border-top:1px solid var(--a-color-border-soft,#ddd)}
.paper-ai small{color:var(--a-color-text-secondary,#64748b)}
.paper-ai :deep(.paper-ai-activity){background:var(--a-color-bg,#fff)}
.paper-ai :deep(.p-input),.paper-ai :deep(.p-textarea){font-size:12px}
@media(pointer:fine) and (min-width:768px){.paper-ai :deep(.p-input){min-height:32px;padding:4px 7px}.paper-ai :deep(.p-field){gap:4px}.paper-ai :deep(.p-textarea){padding:6px 7px}}
@media(pointer:coarse){.paper-ai{--a-control-height-sm:32px}}
@container(max-width:350px){.paper-ai__steps{grid-template-columns:repeat(2,minmax(0,1fr))}.paper-ai__workbench,.paper-ai__settings,.paper-ai__composer,.paper-ai__scope,.paper-ai__submit,.paper-ai__result{padding:7px}}
@container(min-width:680px){.paper-ai__settings-body{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.paper-ai__settings-body>p,.paper-ai__settings-body>small,.paper-ai__settings-body>.paper-ai-vault{grid-column:1/-1}.paper-ai__composer{grid-template-columns:repeat(2,minmax(0,1fr))}.paper-ai__composer>.paper-ai__section-title,.paper-ai__composer>.p-field:last-child,.paper-ai__composer>p,.paper-ai__composer>.paper-ai__row{grid-column:1/-1}.paper-ai__steps span{font-size:12px}}

.paper-ai__navigation{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:3px;flex-wrap:wrap;background:var(--a-color-bg,#fff);padding:2px;border:1px solid var(--a-color-border-soft,#ddd);border-radius:7px}
.paper-ai__navigation button{display:flex;align-items:center;gap:3px;flex:1;min-width:0;font-size:11px;padding-inline:4px;white-space:nowrap}
.paper-ai__settings,.paper-ai__composer,.paper-ai__result,.paper-ai__activity-anchor{scroll-margin-top:38px}
.paper-ai__review-nav,.paper-ai__review-file-heading{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.paper-ai__review-nav strong{flex:1;font-size:12px}
.paper-ai__review-nav button{font-size:11px}
.paper-ai__review-file{display:grid;gap:8px;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);border-radius:6px;padding:9px}
.paper-ai__review-file.current{border-color:var(--a-color-primary,#26784b)}
.paper-ai__review-file-heading label{flex:1;min-width:100px;overflow-wrap:anywhere}
.paper-ai__review-file-heading button{font-size:11px}
.paper-ai__review-actions{display:grid;gap:6px;position:sticky;bottom:0;z-index:2;background:var(--a-color-bg,#fff);border-top:1px solid var(--a-color-border-soft,#ddd);padding-block:8px}
@container(max-width:350px){.paper-ai__navigation button{font-size:11px;padding-inline:4px}.paper-ai__navigation button svg{display:none}}
</style>
