<template>
 <div class="compile-history">
  <div class="compile-history__summary">
   <span>最近编译任务 · {{ rows.length }} 条</span>
   <PButton type="button" size="sm" variant="ghost" :disabled="busy" @click="load">刷新记录</PButton>
  </div>
  <p v-if="busy" role="status">正在读取编译记录…</p>
  <p v-if="error" role="alert">{{error}}</p>
  <div v-if="rows.length" class="compile-history__filters" aria-label="筛选编译任务">
   <PButton v-for="item in filters" :key="item.value" size="sm" type="button" variant="secondary" :aria-pressed="filter===item.value" @click="filter=item.value">{{item.label}} ({{count(item.value)}})</PButton>
  </div>
  <p v-if="!busy&&!error&&!visibleRows.length">{{rows.length?'没有符合条件的记录。':'暂无编译记录。'}}</p>
  <div class="compile-history__list">
   <PButton v-for="job in visibleRows" :key="job.id" type="button" variant="ghost" size="sm" class="compile-history__job" :aria-pressed="selected?.id===job.id" @click="selectedId=job.id">
    <span><strong :class="{'compile-history__failed':job.status==='failed'}">{{compileStatusLabel(job.status)}}</strong><small v-if="job.id===currentJob?.id">当前任务</small><small v-if="job.id===previewJobId">正在预览</small></span>
    <span>v{{job.source_revision}} · {{compileEngineLabel(job.compiler)}} · {{compileDuration(job)}}</span>
    <small>{{formatDate(job.created_at)}}<template v-if="job.diagnostics?.length"> · {{job.diagnostics.length}} 条诊断</template></small>
   </PButton>
  </div>
  <section v-if="selected" class="compile-history__detail" aria-label="所选编译记录">
   <div class="compile-history__summary"><strong>{{compileStatusLabel(selected.status)}} · v{{selected.source_revision}}</strong><PButton type="button" size="sm" variant="secondary" @click="copyReport">复制诊断</PButton></div>
   <p>{{compileEngineLabel(selected.compiler)}} · {{compileDuration(selected)}} · 尝试 {{selected.attempts}} / {{selected.max_attempts}}</p>
   <p v-if="selected.source_revision!==revision" class="compile-history__muted">此记录对应历史源码版本，不修改当前源码或 PDF。</p>
   <template v-if="selected.failure_code">
    <strong>{{compileFailureLabel(selected.failure_code)}}</strong>
    <p>{{compileFailureHint(selected.failure_code)}}</p>
    <small>错误代码：{{selected.failure_code}}</small>
   </template>
   <div v-for="(row,i) in (selected.diagnostics||[]).slice(0,12)" :key="i" class="compile-history__diagnostic">
    <strong>{{row.file&&row.line?row.file+':'+row.line:row.tool==='bibtex'?'BibTeX':'LaTeX'}}</strong>
    <code>{{row.message}}</code>
    <p v-if="compileDiagnosticHint(row)" class="compile-history__hint">建议：{{compileDiagnosticHint(row)}}</p>
   </div>
   <p v-if="selected.failure_code&&!selected.diagnostics?.length">暂无可用源码错误摘要。</p>
   <p v-if="copyMessage" role="status">{{copyMessage}}</p>
   <small class="compile-history__muted">仅提供安全过滤后的诊断摘要，不包含完整服务器日志。历史记录不会切换当前 PDF。</small>
  </section>
 </div>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import {listPaperCompileJobs,type PaperCompileJob} from '@/api/papers'
import {compileDiagnosticHint,compileDuration,compileEngineLabel,compileFailureHint,compileFailureLabel,compileReport,compileStatusLabel} from './compileDiagnostics'

const props=defineProps<{projectId:string;accountId:string;revision:number;currentJob:PaperCompileJob|null;previewJobId?:string}>()
type Filter='all'|'failed'|'succeeded'|'active'
const filters:{value:Filter;label:string}[]=[{value:'all',label:'全部'},{value:'failed',label:'失败'},{value:'succeeded',label:'成功'},{value:'active',label:'运行中'}]
const filter=ref<Filter>('all'),loaded=ref<PaperCompileJob[]>([]),selectedId=ref(''),busy=ref(false),error=ref(''),copyMessage=ref('')
let serial=0,disposed=false
const scope=()=>props.accountId+':'+props.projectId
const rows=computed(()=>{
 const result=new Map<string,PaperCompileJob>()
 for(const row of loaded.value)if(row.project_id===props.projectId)result.set(row.id,row)
 const current=props.currentJob
 if(current?.project_id===props.projectId)result.set(current.id,current)
 return [...result.values()].sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))
})
function matches(row:PaperCompileJob,value:Filter){return value==='all'||(value==='active'?['queued','running','recovering'].includes(row.status):row.status===value)}
function count(value:Filter){return rows.value.filter(row=>matches(row,value)).length}
const visibleRows=computed(()=>rows.value.filter(row=>matches(row,filter.value)))
const selected=computed(()=>visibleRows.value.find(row=>row.id===selectedId.value)||visibleRows.value[0]||null)
function formatDate(value:string){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString():'时间未知'}
async function load(){
 const initial=scope(),n=++serial,pid=props.projectId
 if(!props.accountId||!pid||disposed)return
 busy.value=true;error.value=''
 const valid=()=>!disposed&&n===serial&&scope()===initial
 try{
  const result=await listPaperCompileJobs(pid)
  if(valid())loaded.value=Array.isArray(result)?result.filter(row=>row.project_id===pid).slice(0,50):[]
 }catch{if(valid()){loaded.value=[];error.value='无法读取编译历史，请检查权限与网络后重试。'}}
 finally{if(valid())busy.value=false}
}
async function copyReport(){
 const job=selected.value,initial=scope()
 if(!job||disposed)return
 try{await navigator.clipboard.writeText(compileReport(job));if(!disposed&&scope()===initial&&selected.value?.id===job.id)copyMessage.value='已复制编译诊断。'}
 catch{if(!disposed&&scope()===initial&&selected.value?.id===job.id)copyMessage.value='剪贴板不可用，请手动复制。'}
}
watch(scope,()=>{serial++;loaded.value=[];selectedId.value='';filter.value='all';busy.value=false;error.value='';copyMessage.value='';void load()},{immediate:true})
watch(()=>selected.value?.id,()=>{copyMessage.value=''})
onBeforeUnmount(()=>{disposed=true;serial++;loaded.value=[]})
</script>
<style scoped>
.compile-history,.compile-history__detail,.compile-history__list{display:grid;gap:8px;min-width:0}
.compile-history p,.compile-history small{margin:0;line-height:1.5;overflow-wrap:anywhere}
.compile-history__summary,.compile-history__filters{display:flex;align-items:center;flex-wrap:wrap;gap:5px}
.compile-history__summary{justify-content:space-between}
.compile-history__summary>span,.compile-history__muted{color:var(--a-color-text-secondary,#64748b)}
.compile-history__filters button[aria-pressed=true],.compile-history__job[aria-pressed=true]{background:var(--a-color-bg-subtle,#e7edf3);outline:1px solid var(--a-color-border,#aaa)}
.compile-history__list{max-height:235px;overflow:auto;padding:2px}
.compile-history__job{display:grid;justify-content:stretch;text-align:left;gap:3px;white-space:normal;padding:7px;line-height:1.4;height:auto;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);border-radius:5px}
.compile-history__job>span:first-child{display:flex;align-items:center;flex-wrap:wrap;gap:7px}
.compile-history__job small{color:var(--a-color-text-secondary,#64748b);font-size:11px}
.compile-history__detail{border-top:1px solid var(--a-color-border-soft,#ddd);padding-top:8px}
.compile-history__failed{color:var(--a-color-danger,#b91c1c)}
.compile-history__diagnostic{display:grid;gap:5px;border-left:2px solid var(--a-color-danger,#b91c1c);padding:5px 8px;overflow-wrap:anywhere}
.compile-history__diagnostic code{white-space:pre-wrap;word-break:break-word}
.compile-history__hint{color:var(--a-color-text-secondary,#64748b)}
</style>
