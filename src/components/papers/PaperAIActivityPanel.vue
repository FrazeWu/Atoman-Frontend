<template>
 <details class="paper-ai-activity">
  <summary>AI 操作记录 · 最近 50 条</summary>
  <p>服务器记录模型请求及结果、已审阅跨文件提交和回滚的时间与版本，不保存 API Key、提示词或 AI 原始输出。普通单文件与实时协作编辑仍按现有文件历史记录，不声称由 AI 独立提交。</p>
  <PButton type="button" size="sm" variant="secondary" :disabled="loading||mutating" @click="load">刷新操作记录</PButton>
  <p v-if="message" role="status">{{message}}</p>
  <p v-if="loading">读取记录中…</p>
  <p v-else-if="!events.length&&!message">暂无操作记录。</p>
  <ol v-else class="paper-ai-activity__list">
   <li v-for="event in events" :key="event.id">
    <strong>{{labels[event.action]}} · {{taskLabels[event.task]}}</strong>
    <small>{{formatTime(event.created_at)}} · 项目 v{{event.project_revision}}</small>
    <small>任务 {{event.attempt_id.slice(0,8)}} · 事件 {{event.id.slice(0,8)}}</small>
    <small v-if="event.input_tokens||event.output_tokens">输入 {{event.input_tokens||0}} · 输出 {{event.output_tokens||0}} tokens</small>
    <div v-for="file in event.files" :key="file.file_id">{{fileName(file.file_id)}} · v{{file.before_revision}} → v{{file.after_revision}}{{event.action==='papers.ai.proposed'?'（建议）':''}}</div>
    <template v-if="event.action==='papers.ai.applied'&&rollback">
     <PButton type="button" size="sm" variant="secondary" :disabled="disabled||mutating||!canRollback(event)" @click="undo(event)">回滚此修改</PButton>
     <small v-if="!canRollback(event)">已回滚、文件不存在或后续版本已变化，不能直接回滚。</small>
    </template>
   </li>
  </ol>
 </details>
</template>
<script setup lang="ts">
import {ref,shallowRef,watch,onBeforeUnmount,onMounted} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import type {PaperFile} from '@/api/papers'
import {listPaperAIActivity,type PaperAIActivity,type PaperAIEventAction,type PaperAITask} from '@/api/papersAI'
const props=defineProps<{projectId:string;accountId:string;files:PaperFile[];refresh:number;disabled:boolean;rollback?:(event:PaperAIActivity)=>Promise<boolean>}>()
const labels:Record<PaperAIEventAction,string>={'papers.ai.started':'开始模型请求','papers.ai.proposed':'建议已生成','papers.ai.failed':'请求未完成','papers.ai.applied':'修改已提交','papers.ai.rolled_back':'已回滚'}
const taskLabels:Record<PaperAITask,string>={project:'跨文件 Agent',revise:'源码修改',explain:'分析'}
const events=shallowRef<PaperAIActivity[]>([]),loading=ref(false),mutating=ref(false),message=ref('')
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
 controller?.abort()
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
watch(scope,()=>{serial++;controller?.abort();events.value=[];mutating.value=false;void load()})
watch(()=>props.refresh,()=>void load())
onMounted(()=>void load())
onBeforeUnmount(()=>{disposed=true;serial++;controller?.abort();events.value=[]})
</script>
<style scoped>
.paper-ai-activity{display:grid;gap:8px;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);border-radius:6px;padding:9px;font-size:12px;line-height:1.5}
.paper-ai-activity summary{cursor:pointer;font-weight:600}
.paper-ai-activity p{margin:6px 0;color:var(--a-color-text-secondary,#64748b)}
.paper-ai-activity__list{display:grid;gap:8px;margin:8px 0 0;padding:0;list-style:none;max-height:360px;overflow:auto}
.paper-ai-activity__list li{display:grid;gap:3px;border-top:1px solid var(--a-color-border-soft,#ddd);padding-top:7px;overflow-wrap:anywhere}
.paper-ai-activity small{color:var(--a-color-text-secondary,#64748b)}
</style>
