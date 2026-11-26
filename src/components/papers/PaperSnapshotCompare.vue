<template>
 <section class="paper-snapshot-compare">
  <strong>投稿版本对比</strong>
  <p>选择两个不可变快照，比较新增、删除、重命名和内容变化；仅查看，不修改项目。</p>
  <PSelect :model-value="beforeId" label="基准快照" size="sm" :options="options" :disabled="disabled||busy" @update:model-value="beforeId=String($event)" />
  <PSelect :model-value="afterId" label="目标快照" size="sm" :options="options" :disabled="disabled||busy" @update:model-value="afterId=String($event)" />
  <PButton type="button" size="sm" variant="secondary" :disabled="disabled||busy||!beforeId||!afterId||beforeId===afterId" @click="compare">比较两个快照</PButton>
  <p v-if="message" role="status">{{message}}</p>
  <template v-if="result">
   <p>{{result.from.name}} (v{{result.from.source_revision}}) → {{result.to.name}} (v{{result.to.source_revision}})</p>
   <p v-if="result.from.main_file_id!==result.to.main_file_id">主文件设置发生变化。</p>
   <p v-if="!result.changes.length">文件内容和路径一致。</p>
   <div v-for="(item,index) in result.changes" :key="index" class="paper-snapshot-compare__row"><strong>{{labels[item.kind]}} · {{item.oldPath?item.oldPath+' → ':''}}{{item.path}}</strong><small>版本 {{item.before??'—'}} → {{item.after??'—'}}{{item.kind==='renamed'&&item.contentChanged?' · 内容也已变化':''}}</small></div>
  </template>
 </section>
</template>
<script setup lang="ts">
import {computed,ref,shallowRef,watch,onBeforeUnmount} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import {getPaperProjectSnapshot,type PaperProjectSnapshot,type PaperSnapshotDetail} from '@/api/papers'
import {compareSnapshotManifests,type SnapshotDifference} from './submissionChecks'
const props=defineProps<{projectId:string;accountId:string;rows:PaperProjectSnapshot[];disabled:boolean}>()
const options=computed(()=>props.rows.map(row=>({value:row.id,label:row.name+' · v'+row.source_revision})))
const beforeId=ref(''),afterId=ref(''),busy=ref(false),message=ref('')
const result=shallowRef<{from:PaperSnapshotDetail;to:PaperSnapshotDetail;changes:SnapshotDifference[]}|null>(null)
const labels={added:'新增',removed:'删除',renamed:'重命名',changed:'修改'}
let serial=0,disposed=false
const scope=()=>props.accountId+':'+props.projectId
const allowed=()=>props.rows.some(r=>r.id===beforeId.value)&&props.rows.some(r=>r.id===afterId.value)
async function compare(){
 if(disposed||props.disabled||busy.value||!allowed()||beforeId.value===afterId.value)return
 const n=++serial,initial=scope(),from=beforeId.value,to=afterId.value,pid=props.projectId
 const valid=()=>!disposed&&n===serial&&scope()===initial&&beforeId.value===from&&afterId.value===to&&allowed()
 busy.value=true;message.value='';result.value=null
 try{
  const [a,b]=await Promise.all([getPaperProjectSnapshot(pid,from),getPaperProjectSnapshot(pid,to)])
  if(!valid())return
  if(a.id!==from||b.id!==to||!Array.isArray(a.files)||!Array.isArray(b.files)||a.files.length>100||b.files.length>100)throw Error('Invalid snapshots')
  result.value={from:a,to:b,changes:compareSnapshotManifests(a.files,b.files)}
  message.value='快照差异读取完成。'
 }catch{if(valid())message.value='无法读取快照差异，请刷新快照列表。'}
 finally{if(valid())busy.value=false}
}
watch([scope,beforeId,afterId],()=>{serial++;result.value=null;busy.value=false;message.value=''})
watch(()=>props.rows,()=>{if(!allowed()){serial++;result.value=null;busy.value=false}})
onBeforeUnmount(()=>{disposed=true;serial++;result.value=null})
</script>
<style scoped>
.paper-snapshot-compare{display:grid;gap:7px;padding-top:8px;border-top:1px solid var(--a-color-border-soft);min-width:0}
.paper-snapshot-compare p{margin:0;overflow-wrap:anywhere}
.paper-snapshot-compare__row{display:grid;gap:3px;overflow-wrap:anywhere}
</style>
