<template>
 <section class="paper-share" aria-label="邀请链接">
  <div class="paper-share__heading"><strong>邀请链接</strong><PButton size="sm" variant="ghost" type="button" :disabled="busy||disabled" @click="load">刷新</PButton></div>
  <p>生成一次有效的私有链接。受邀者需要登录并拥有 Papers 访问资格，七天内接受邀请。</p>
  <PSelect :model-value="role" label="链接权限" size="sm" :options="[{value:'viewer',label:'可以查看'},{value:'editor',label:'可以编辑'}]" :disabled="busy||disabled" @update:model-value="role=$event as PaperMemberRole" />
  <p>{{ role==='viewer'?'可查看项目源码、资源和最新成功编译的 PDF，不能修改。':'可修改已有文本文件并参加实时协作，不授予管理权限。' }}</p>
  <PButton type="button" size="sm" :disabled="busy||disabled" @click="generate">生成邀请链接</PButton>
  <div v-if="created" class="paper-share__created">
   <label>邀请链接（仅本次显示）<PInput :model-value="link" readonly aria-label="新建邀请链接" autocomplete="off" @focus="($event.target as HTMLInputElement).select()" /></label>
   <PButton type="button" size="sm" variant="secondary" @click="copy">复制链接</PButton>
   <p>请发送给指定协作者，不要公开发布。已加入成员的权限需要在成员列表单独调整。</p>
  </div>
  <p v-if="rows.length===0&&!busy">暂无未使用邀请。</p>
  <div v-for="row in rows" :key="row.id" class="paper-share__row">
   <div><strong>{{ row.role==='viewer'?'可以查看':'可以编辑' }}</strong><small>有效至 {{ new Date(row.expires_at).toLocaleString() }}</small></div>
   <PButton size="sm" variant="ghost" type="button" :disabled="busy||disabled" @click="revoke(row.id)">撤销链接</PButton>
  </div>
  <p v-if="message" role="status">{{ message }}</p>
 </section>
</template>
<script setup lang="ts">
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import {createPaperInvitation,listPaperInvitations,revokePaperInvitation,type CreatedPaperInvitation,type PaperProjectInvitation,type PaperMemberRole} from '@/api/papers'
const props=defineProps<{projectId:string;accountId:string;disabled:boolean}>()
const role=ref<PaperMemberRole>('viewer'),rows=ref<PaperProjectInvitation[]>([]),created=ref<CreatedPaperInvitation|null>(null)
const busy=ref(false),message=ref('')
const link=computed(()=>created.value?new URL('/papers/invite#'+created.value.token,window.location.origin).href:'')
let serial=0,disposed=false
const scope=()=>props.accountId+':'+props.projectId
function reset(){serial++;rows.value=[];created.value=null;message.value='';busy.value=false}
watch(scope,()=>{reset();void load()})
onMounted(()=>void load())
onBeforeUnmount(()=>{disposed=true;reset()})
async function perform(task:(pid:string,valid:()=>boolean)=>Promise<void>){
 if(busy.value||disposed||props.disabled)return
 const n=++serial,key=scope(),pid=props.projectId
 const valid=()=>!disposed&&n===serial&&key===scope()
 busy.value=true;message.value=''
 try{await task(pid,valid)}catch{if(valid())message.value='邀请操作失败，请检查服务版本、网络及项目权限。'}
 finally{if(valid())busy.value=false}
}
async function load(){await perform(async(pid,valid)=>{const list=await listPaperInvitations(pid);if(valid())rows.value=Array.isArray(list)?list:[]})}
async function generate(){
 const selected=role.value
 await perform(async(pid,valid)=>{
  const result=await createPaperInvitation(pid,selected)
  if(!valid())return
  if(!/^[A-Za-z0-9_-]{43}$/.test(result.token))throw new Error('invalid invitation')
  created.value=result;message.value='邀请链接已生成。'
  // Do not discard the one-time token if a subsequent refresh fails.
  rows.value=[result,...rows.value.filter(row=>row.id!==result.id)]
 })
}
async function revoke(id:string){await perform(async(pid,valid)=>{
 await revokePaperInvitation(pid,id)
 if(!valid())return
 rows.value=rows.value.filter(row=>row.id!==id)
 if(created.value?.id===id)created.value=null
 message.value='邀请链接已撤销。'
})}
async function copy(){
 const value=link.value,key=scope()
 if(!value||disposed)return
 try{await navigator.clipboard.writeText(value);if(!disposed&&scope()===key&&link.value===value)message.value='邀请链接已复制。'}
 catch{if(!disposed&&scope()===key)message.value='请手动复制上方链接。'}
}
</script>
<style scoped>
.paper-share{display:grid;gap:8px;padding:12px;margin-bottom:10px;border:1px solid var(--a-color-border-soft,#ddd);border-radius:6px;min-width:0}
.paper-share__heading,.paper-share__row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.paper-share p{margin:0;font-size:12px;line-height:1.55;color:var(--a-color-text-secondary,#64748b)}
.paper-share__label,.paper-share__created,.paper-share__created label{display:grid;gap:5px;min-width:0}
.paper-share input,.paper-share select{box-sizing:border-box;width:100%;min-width:0;padding:7px;border-radius:5px;border:1px solid var(--a-color-border-soft,#ddd);background:var(--a-color-bg,#fff);color:inherit;font:inherit}
.paper-share__row{border-top:1px solid var(--a-color-border-soft,#ddd);padding-top:7px}
.paper-share__row>div{display:grid;gap:3px;min-width:0}
.paper-share__row small{font-size:11px;color:var(--a-color-text-secondary,#64748b)}
</style>
