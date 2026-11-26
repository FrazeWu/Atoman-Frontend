<template>
 <details class="paper-ai-activity">
  <summary>AI 操作记录 · 最近 50 条</summary>
  <p>服务器记录模型请求及结果、已审阅跨文件提交和回滚的时间与版本，不保存 API Key、提示词或 AI 原始输出。普通单文件与实时协作编辑仍按现有文件历史记录，不声称由 AI 独立提交。</p>
  <PButton type="button" size="sm" variant="secondary" :disabled="loading||mutating" @click="load">刷新操作记录</PButton>
  <p v-if="message" role="status">{{message}}</p>
  <p v-if="loading">读取记录中…</p>
  <p v-else-if="!events.length&&!message">暂无操作记录。</p>
  <ol v-else class="paper-ai-activity__list">
   <li v-for="group in groups" :key="group.id" class="paper-ai-activity__group">
    <div class="paper-ai-activity__heading"><strong>Papers Agent · {{taskLabels[group.latest.task]}}</strong><span>{{aiActivityStatus(group.latest,pendingProposal)}}</span></div>
    <small>任务 {{group.id.slice(0,8)}} · {{group.events.length}} 条记录</small>
    <div v-for="event in group.events" :key="event.id" class="paper-ai-activity__event">
    <strong>{{labels[event.action]}} · {{taskLabels[event.task]}}</strong>
    <small>{{formatTime(event.created_at)}} · 项目 v{{event.project_revision}}</small>
    <small>任务 {{event.attempt_id.slice(0,8)}} · 事件 {{event.id.slice(0,8)}}</small>
    <small v-if="event.input_tokens||event.output_tokens">输入 {{event.input_tokens||0}} · 输出 {{event.output_tokens||0}} tokens</small>
    <div v-for="file in event.files" :key="file.file_id" class="paper-ai-activity__file">
     <span>{{fileName(file.file_id)}} · v{{file.before_revision}} → v{{file.after_revision}}{{event.action==='papers.ai.proposed'?'（建议）':''}}</span>
     <PButton v-if="historicalChanges&&isCommitted(event)" size="sm" variant="ghost" type="button" :disabled="mutating||changeLoading" @click="openChange(event,file)">查看修改差异</PButton>
    </div>
    <small v-if="event.action==='papers.ai.applied'">AI 建议 · 拥有者批准并提交</small>
    <small v-else-if="event.action==='papers.ai.rolled_back'">拥有者批准回滚</small>
    <template v-if="event.action==='papers.ai.applied'&&rollback">
     <PButton type="button" size="sm" variant="secondary" :disabled="disabled||mutating||!canRollback(event)" @click="undo(event)">回滚此修改</PButton>
     <small v-if="!canRollback(event)">已回滚、文件不存在或后续版本已变化，不能直接回滚。</small>
    </template>
    </div>
   </li>
  </ol>
  <p v-if="changeLoading" role="status">读取历史差异中…</p>
  <p v-if="changeMessage" role="status">{{changeMessage}}</p>
  <section v-if="selectedChange" class="paper-ai-activity__change" aria-label="已提交的 AI 历史差异">
   <div class="paper-ai-activity__heading"><strong>{{selectedChange.path}} · v{{selectedChange.before_revision}} → v{{selectedChange.after_revision}}</strong><PButton size="sm" variant="ghost" type="button" @click="clearChange">关闭差异</PButton></div>
   <small>Papers Agent · {{selectedChange.decision==='owner_approved'?'拥有者批准并提交':'拥有者批准回滚'}}</small>
   <PaperAIDiff :before="selectedChange.before" :after="selectedChange.after" />
  </section>
 </details>
</template>
<script setup lang="ts">
import {computed,ref,shallowRef,watch,onBeforeUnmount,onMounted} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import type {PaperFile} from '@/api/papers'
import {listPaperAIActivity,getPaperAIHistoricalChange,type PaperAIHistoricalChange,type PaperAIActivity,type PaperAIActivityFile,type PaperAIEventAction,type PaperAITask} from '@/api/papersAI'
import {groupAIActivity,aiActivityStatus,matchesHistoricalAIChange} from './aiWorkbench'
import PaperAIDiff from './PaperAIDiff.vue'
const props=defineProps<{projectId:string;accountId:string;files:PaperFile[];refresh:number;disabled:boolean;historicalChanges?:boolean;pendingProposal?:string;rollback?:(event:PaperAIActivity)=>Promise<boolean>}>()
const labels:Record<PaperAIEventAction,string>={'papers.ai.started':'开始模型请求','papers.ai.proposed':'建议已生成','papers.ai.failed':'请求未完成','papers.ai.applied':'修改已提交','papers.ai.rolled_back':'已回滚'}
const taskLabels:Record<PaperAITask,string>={project:'跨文件 Agent',revise:'源码修改',explain:'分析'}
const events=shallowRef<PaperAIActivity[]>([]),loading=ref(false),mutating=ref(false),message=ref('')
const groups=computed(()=>groupAIActivity(events.value))
const selectedChange=shallowRef<PaperAIHistoricalChange|null>(null),changeLoading=ref(false),changeMessage=ref('')
let changeSerial=0,changeController:AbortController|null=null
function isCommitted(event:PaperAIActivity){return event.action==='papers.ai.applied'||event.action==='papers.ai.rolled_back'}
function clearChange(){
 changeSerial++;changeController?.abort();changeController=null
 selectedChange.value=null;changeLoading.value=false;changeMessage.value=''
}
async function openChange(event:PaperAIActivity,file:PaperAIActivityFile){
 if(disposed||!props.historicalChanges||!isCommitted(event)||mutating.value||changeLoading.value)return
 if(!events.value.some(row=>row.id===event.id&&row.files.some(f=>f.file_id===file.file_id&&f.before_revision===file.before_revision&&f.after_revision===file.after_revision)))return
 clearChange()
 const n=++changeSerial,initial=scope(),abort=new AbortController()
 changeController=abort;changeLoading.value=true
 const current=()=>!disposed&&n===changeSerial&&initial===scope()&&props.historicalChanges
 try{
  const data=await getPaperAIHistoricalChange(props.projectId,event.id,file.file_id,abort.signal)
  if(!current())return
  if(!matchesHistoricalAIChange(data,event,file))throw Error('Invalid historical change')
  selectedChange.value=data
 }catch{if(current())changeMessage.value='无法验证该历史差异，未显示源码。'}
 finally{if(current()){changeLoading.value=false;changeController=null}}
}
let serial=0,disposed=false,controller:AbortController|null=null
const scope=()=>props.accountId+':'+props.projectId
function valid(n:number,initial:string){return !disposed&&n===serial&&initial===scope()}
function fileName(id:string){return props.files.find(file=>file.id===id)?.path||('文件 '+id.slice(0,8))}
function formatTime(raw:string){const date=new Date(raw);return Number.isNaN(date.getTime())?'时间未知':date.toLocaleString()}
function canRollback(event:PaperAIActivity){
 return event.action==='papers.ai.applied'&&event.files.length>0&&!events.value.some(row=>row.action==='papers.ai.rolled_back'&&row.related_id===event.id)&&event.files.every(change=>props.files.some(f=>f.id===change.file_id&&f.kind==='text'&&f.revision===change.after_revision))
}
async function load(){
 if(disposed)return
 clearChange();controller?.abort()
 const n=++serial,initial=scope(),abort=new AbortController()
 controller=abort;loading.value=true;message.value=''
 try{
  const data=await listPaperAIActivity(props.projectId,abort.signal)
  if(!valid(n,initial))return
  if(!Array.isArray(data)||data.length>50||data.some(row=>!row||typeof row.id!=='string'||typeof row.attempt_id!=='string'||!Object.hasOwn(labels,row.action)||!Object.hasOwn(taskLabels,row.task)||!Array.isArray(row.files)||row.files.length>5||row.files.some(f=>!f||typeof f.file_id!=='string'||!Number.isSafeInteger(f.before_revision)||f.after_revision!==f.before_revision+1)))throw Error('Invalid activity')
  events.value=data
 }catch{if(valid(n,initial)){events.value=[];message.value='无法读取操作记录，请刷新重试。'}}
 finally{if(valid(n,initial)){loading.value=false;controller=null}}
}
async function undo(event:PaperAIActivity){
 if(disposed||props.disabled||mutating.value||loading.value||!props.rollback||!canRollback(event))return
 const initial=scope()
 mutating.value=true;message.value=''
 try{
  const done=await props.rollback(event)
  if(disposed||initial!==scope())return
  await load()
  if(!disposed&&initial===scope())message.value=done?'回滚已提交，原内容已恢复为新的文件版本。':'回滚未确认成功，请核对项目版本及操作记录；未自动重试。'
 }catch{if(!disposed&&initial===scope())message.value='回滚未确认成功，请刷新项目。'}
 finally{if(!disposed&&initial===scope())mutating.value=false}
}
watch(scope,()=>{serial++;controller?.abort();clearChange();events.value=[];mutating.value=false;void load()})
watch(()=>props.historicalChanges,enabled=>{if(!enabled)clearChange()})
watch(()=>props.refresh,()=>void load())
onMounted(()=>void load())
onBeforeUnmount(()=>{disposed=true;serial++;controller?.abort();clearChange();events.value=[]})
</script>
<style scoped>
.paper-ai-activity{display:grid;gap:8px;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);border-radius:6px;padding:9px;font-size:12px;line-height:1.5}
.paper-ai-activity summary{cursor:pointer;font-weight:600}
.paper-ai-activity p{margin:6px 0;color:var(--a-color-text-secondary,#64748b)}
.paper-ai-activity__list{display:grid;gap:8px;margin:8px 0 0;padding:0;list-style:none;max-height:360px;overflow:auto}
.paper-ai-activity__list li{display:grid;gap:3px;border-top:1px solid var(--a-color-border-soft,#ddd);padding-top:7px;overflow-wrap:anywhere}
.paper-ai-activity__heading{display:flex;align-items:flex-start;flex-wrap:wrap;justify-content:space-between;gap:5px}
.paper-ai-activity__heading>span{font-size:11px;color:var(--a-color-text-secondary,#64748b)}
.paper-ai-activity__group{padding-block:9px}
.paper-ai-activity__event{display:grid;gap:4px;padding:7px 0 7px 10px;border-left:2px solid var(--a-color-border-soft,#ddd)}
.paper-ai-activity__file{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px}
.paper-ai-activity__change{display:grid;gap:6px;padding-top:8px;border-top:1px solid var(--a-color-border-soft,#ddd)}
.paper-ai-activity small{color:var(--a-color-text-secondary,#64748b)}
</style>
