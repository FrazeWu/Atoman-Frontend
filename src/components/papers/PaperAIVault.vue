<template>
 <details class="paper-ai-vault">
  <summary>本机加密配置与会话</summary>
  <p>可保存多个 API 配置及每个项目最近一次会话。数据使用你的保险库口令加密，仅保存在此浏览器，不上传到服务器。关闭或切换文件后需重新解锁；遗失口令无法恢复。</p>
  <template v-if="!vault">
   <PInput v-model="password" type="password" autocomplete="new-password" label="保险库口令" aria-label="保险库口令" maxlength="128" :disabled="working||disabled" placeholder="至少 12 个字符" />
   <PButton type="button" size="sm" variant="secondary" :disabled="working||disabled||password.length<12||!available" @click="unlock">{{exists?'解锁保险库':'创建加密保险库'}}</PButton>
  </template>
  <template v-else>
   <div class="paper-ai-vault__row">
    <PButton type="button" size="sm" variant="secondary" :disabled="working||disabled" @click="lock">锁定保险库</PButton>
    <small>{{vault.data.profiles.length}} / 10 个配置 · {{vault.data.sessions.length}} / 20 个项目会话</small>
   </div>
   <PSelect v-if="vault.data.profiles.length" :model-value="selected" :options="vault.data.profiles.map(p=>({value:p.id,label:p.name+' · '+p.model}))" label="已保存配置" size="sm" :disabled="working||disabled" @update:model-value="selected=String($event)" />
   <div class="paper-ai-vault__row" v-if="selectedProfile">
    <PButton type="button" size="sm" variant="secondary" :disabled="working||disabled" @click="useProfile">使用配置</PButton>
    <PButton type="button" size="sm" variant="secondary" :disabled="working||disabled" @click="removeProfile">删除所选配置</PButton>
   </div>
   <PInput v-model.trim="name" label="新配置名称" maxlength="60" :disabled="working||disabled" placeholder="例如：科研主力模型" />
   <PButton type="button" size="sm" variant="secondary" :disabled="working||disabled||!validCurrent||!name.trim()||vault.data.profiles.length>=10" @click="saveProfile">保存当前 API 配置</PButton>
   <PCheckbox v-model="autoSave" :disabled="working||disabled">每次收到模型回复后加密保存本项目会话</PCheckbox>
   <div class="paper-ai-vault__row">
    <PButton type="button" size="sm" variant="secondary" :disabled="working||disabled||!validSession" @click="saveSession">保存当前会话</PButton>
    <PButton v-if="savedSession" type="button" size="sm" variant="secondary" :disabled="working||disabled" @click="restoreSession">恢复项目会话</PButton>
    <PButton v-if="savedSession" type="button" size="sm" variant="secondary" :disabled="working||disabled" @click="removeSession">删除项目会话</PButton>
   </div>
   <small v-if="savedSession">已保存 {{new Date(savedSession.updatedAt).toLocaleString()}} · {{savedSession.history.length}} 轮对话。恢复后需重新选择源码和审批，不自动重发请求或应用旧建议。</small>
  </template>
  <p v-if="message" role="status">{{message}}</p>
 </details>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,shallowRef,watch} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PCheckbox from '@/components/ui/PCheckbox.vue'
import type {PaperAIHistoryTurn,PaperAITask} from '@/api/papersAI'
import {aiVaultStorageKey,openAIVault,commitAIVault,validAIProfile,validAICheckpoint,type AIProfile,type AISessionCheckpoint,type AIVaultData,type UnlockedAIVault} from './aiVault'
const props=defineProps<{accountId:string;projectId:string;fileId:string;revision:number;baseURL:string;model:string;apiKey:string;task:PaperAITask;instruction:string;history:PaperAIHistoryTurn[];disabled:boolean}>()
const emit=defineEmits<{profile:[AIProfile];restore:[AISessionCheckpoint,AIProfile|undefined];lock:[]}>()
const vault=shallowRef<UnlockedAIVault|null>(null)
const password=ref(''),name=ref(''),selected=ref(''),message=ref(''),working=ref(false),autoSave=ref(false),exists=ref(false),available=ref(false)
let disposed=false,serial=0
const scope=()=>props.accountId+':'+props.projectId+':'+props.fileId
function refresh(){
 try{exists.value=localStorage.getItem(aiVaultStorageKey(props.accountId))!==null;available.value=!!globalThis.crypto?.subtle}catch{available.value=false}
}
const selectedProfile=computed(()=>vault.value?.data.profiles.find(p=>p.id===selected.value))
const savedSession=computed(()=>vault.value?.data.sessions.find(s=>s.projectId===props.projectId))
function currentProfile(id:string):AIProfile{return {id,name:name.value.trim(),baseURL:props.baseURL,model:props.model,key:props.apiKey.trim()}}
const validCurrent=computed(()=>validAIProfile(currentProfile('new')))
function checkpoint():AISessionCheckpoint{return {projectId:props.projectId,fileId:props.fileId,revision:props.revision,baseURL:props.baseURL,model:props.model,task:props.task,instruction:props.instruction,history:[...props.history],updatedAt:Date.now()}}
const validSession=computed(()=>validAICheckpoint(checkpoint())&&!!(props.instruction.trim()||props.history.length))
function reset(){serial++;vault.value=null;password.value='';name.value='';selected.value='';autoSave.value=false;working.value=false;message.value='';refresh()}
function lock(){if(working.value||props.disabled)return;reset();emit('lock');message.value='保险库已锁定。'}
async function unlock(){
 if(working.value||props.disabled||!available.value||disposed)return
 const initial=scope(),n=++serial,secret=password.value,owner=props.accountId
 password.value='';working.value=true;message.value=''
 const valid=()=>!disposed&&initial===scope()&&n===serial
 try{const opened=await openAIVault(localStorage,owner,secret,valid);if(valid()){vault.value=opened;exists.value=true;message.value='保险库已解锁。'}}
 catch{if(valid())message.value='无法解锁或创建：请核对口令、浏览器存储与安全环境。'}
 finally{if(valid())working.value=false}
}
async function mutate(data:AIVaultData,success:string){
 const prior=vault.value
 if(!prior||working.value||props.disabled||disposed)return false
 const initial=scope(),n=++serial
 const valid=()=>!disposed&&initial===scope()&&n===serial&&vault.value===prior
 working.value=true;message.value=''
 try{const updated=await commitAIVault(localStorage,prior,data,valid);if(!valid())return false;vault.value=updated;message.value=success;return true}
 catch{if(valid())message.value='未保存。保险库可能已被其他窗口更新，或浏览器空间不足；请锁定后重新解锁。';return false}
 finally{if(!disposed&&initial===scope()&&n===serial)working.value=false}
}
async function saveProfile(){
 const prior=vault.value;if(!prior||!validCurrent.value||prior.data.profiles.length>=10)return
 const p=currentProfile(crypto.randomUUID())
 if(await mutate({...prior.data,profiles:[...prior.data.profiles,p]},'API 配置已加密保存。')){selected.value=p.id;name.value=''}
}
function useProfile(){if(!working.value&&!props.disabled&&selectedProfile.value)emit('profile',{...selectedProfile.value})}
async function removeProfile(){
 const prior=vault.value,p=selectedProfile.value;if(!prior||!p)return
 if(await mutate({...prior.data,profiles:prior.data.profiles.filter(x=>x.id!==p.id)},'所选配置已从本机保险库移除。'))selected.value=''
}
async function saveSession(){
 const prior=vault.value;if(!prior||!validSession.value)return
 const session=checkpoint(),other=prior.data.sessions.filter(s=>s.projectId!==session.projectId)
 if(other.length>=20){message.value='已达会话上限，请删除不需要的项目会话。';return}
 await mutate({...prior.data,sessions:[...other,session]},'本项目会话已加密保存。')
}
function restoreSession(){
 const s=savedSession.value,p=vault.value
 if(!s||!p||props.disabled||working.value)return
 const matches=p.data.profiles.filter(x=>x.baseURL===s.baseURL&&x.model===s.model)
 const profile=matches.length===1?matches[0]:undefined
 autoSave.value=false
 if(matches.length>1)message.value='此会话对应多个 API 配置，请手动选择正确的配置。'
 emit('restore',{...s,history:s.history.map(t=>({...t}))},profile?{...profile}:undefined)
}
async function removeSession(){
 const prior=vault.value;if(!prior||!savedSession.value)return
 await mutate({...prior.data,sessions:prior.data.sessions.filter(s=>s.projectId!==props.projectId)},'本项目会话已从保险库移除。')
}
watch(scope,reset,{flush:'sync'})
watch(()=>props.history,(current,previous)=>{if(autoSave.value&&current.length&&current!==previous&&current.at(-1)!==previous.at(-1))void saveSession()})
onBeforeUnmount(()=>{disposed=true;serial++;vault.value=null;password.value=''})
refresh()
</script>
<style scoped>
.paper-ai-vault{display:grid;gap:7px;border:1px solid var(--a-color-border-soft);border-radius:6px;padding:9px;min-width:0}
.paper-ai-vault summary{font-weight:600;cursor:pointer}
.paper-ai-vault p,.paper-ai-vault small{margin:4px 0;color:var(--a-color-muted);overflow-wrap:anywhere}
.paper-ai-vault__row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
</style>
