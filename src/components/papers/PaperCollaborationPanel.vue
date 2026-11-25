<template>
 <section class="papers-collab" aria-label="实时协作">
  <div class="papers-collab__bar">
   <strong>实时协作 · {{ file.path }}</strong>
   <span role="status">{{ statusLabel }}</span>
   <button v-if="view?.text" type="button" @click="copySource">复制协作源码</button>
   <button type="button" :disabled="operationBusy" @click="requestExit">退出协作</button>
  </div>
  <p v-if="message" role="alert">{{ message }}</p>
  <p v-if="view?.message" role="alert">{{ view.message }}</p>
  <p v-if="view?.pending" class="papers-collab__warning">{{ draftSaved?'尚有服务器未确认的修改，当前内容已备份至本机。':'尚有服务器未确认的修改，当前内容未完整备份。请勿刷新或关闭网页。' }}</p>
  <details v-if="scope()&&capabilityChecked" class="papers-collab__drafts">
   <summary>本机协作草稿{{ otherDrafts.length?'（'+otherDrafts.length+'）':'' }}</summary>
   <p>仅备份未确认的修改，明文保存在当前浏览器，不上传云端。请勿在公共设备开启；关闭保护不会删除已有草稿。</p>
   <label><input type="checkbox" :checked="draftEnabled" :disabled="props.role==='viewer'" @change="toggleDraftProtection(($event.target as HTMLInputElement).checked)" /> 启用本机协作草稿保护</label>
   <label v-if="view?.epoch&&props.role!=='viewer'"><input type="checkbox" :checked="view.offlineEnabled" :disabled="!draftEnabled||view.status==='stopped'" @change="toggleOffline(($event.target as HTMLInputElement).checked)" /> 允许重连期间离线编辑（需本机草稿保护）</label>
   <p v-if="view?.offlineEditable">离线修改尚未提交；仅在原协作版本和权限验证通过后同步。重连失败、存储失败或超限时暂停编辑。</p>
   <p v-if="draftNotice" role="status">{{ draftNotice }}</p>
   <p v-if="!otherDrafts.length">当前文件没有其他会话留下的协作草稿。</p>
   <div v-for="row in otherDrafts" :key="collabDraftKey(row)" class="papers-collab__draft">
    <button type="button" :aria-pressed="selectedDraftKey===collabDraftKey(row)" @click="selectedDraftKey=collabDraftKey(row)">{{ new Date(row.updatedAt).toLocaleString() }} · v{{row.payload.fileRevision}} · {{ compatible(row)?'可恢复':'需手动合并' }}</button>
   </div>
   <div v-if="selectedDraft" class="papers-collab__draft">
    <textarea readonly :value="selectedDraft.payload.source" aria-label="本机协作草稿源码" rows="5" spellcheck="false" />
    <p>{{ compatible(selectedDraft)?'已匹配原协作版本。恢复会合并未确认的增量，并等待服务器提交确认。':'服务器版本、权限或草稿状态不匹配。仅允许复制，不会直接覆盖服务器。' }}</p>
    <div class="papers-collab__draft-actions">
     <button type="button" :disabled="!compatible(selectedDraft)" @click="restoreDraft(selectedDraft)">恢复协作草稿</button>
     <button type="button" @click="copyDraft(selectedDraft)">复制协作草稿</button>
     <button type="button" :disabled="!!view?.pending" @click="discardDraft(selectedDraft)">删除协作草稿</button>
    </div>
   </div>
  </details>
  <div v-if="view?.connectionId" class="papers-collab__peers" aria-label="在线成员">
   <strong>在线 {{ onlineCount }} 人</strong>
   <span v-for="peer in view.peers" :key="peer.connection_id" class="papers-collab__peer" :title="peer.role==='viewer'?'阅读者':peer.role==='owner'?'所有者':'编辑者'">
    <span class="papers-collab__dot" :style="{backgroundColor:peerColor(peer.connection_id)}" />{{ peer.name }}{{peer.connection_id===view.connectionId?'（我）':''}}
   </span>
  </div>
  <p v-if="view?.text" class="papers-collab__hint">仅同步当前文件。协作期间暂停普通保存和项目结构修改；所有者可编译或创建已确认版本的项目快照；断线默认暂停编辑并尝试恢复原协作会话；可选择离线编辑和本机草稿保护。撤销仅影响当前编辑器中的本地操作。</p>
  <LatexEditor v-if="view?.text" :key="view.epoch" :model-value="view.source" :collaborative-text="view.text" :citations="citations" :readonly="!editable" :can-edit-collaboration="canEditNow" :remote-peers="remotePeers" @presence-selection="selectionChanged" />
  <p v-else class="papers-collab__empty">{{ message?'请退出协作，继续普通编辑。':'正在验证项目权限并读取服务端文档…' }}</p>
  <textarea v-if="copyFallback" readonly :value="view?.source||''" aria-label="可手动复制的协作源码" />
 </section>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,onUnmounted,ref,shallowRef} from 'vue'
import {getPaperCollaborationCapability,type PaperFile,type PaperProjectRole} from '@/api/papers'
import {useApiWebSocketUrl} from '@/composables/useApiUrl'
import {useAuthStore} from '@/stores/auth'
import LatexEditor from './LatexEditor.vue'
import {DurablePaperCollaboration,type CollaborationView} from './durableCollaboration'
import {peerColor,type LocalSelection} from './paperPresence'
import {collabDraftKey,collaborationDraftEnabled,setCollaborationDraftEnabled,listCollaborationDrafts,writeCollaborationDraft,sameCollaborationDraft,removeCollaborationDraft,type PaperCollaborationDraft} from './collaborationDrafts'

const props=defineProps<{projectId:string;file:PaperFile;role:PaperProjectRole;accountId:string;citations?:readonly string[];operationBusy?:boolean}>()
const emit=defineEmits<{exit:[];confirmed:[revision:number|null]}>()
const auth=useAuthStore()
const view=shallowRef<CollaborationView|null>(null)
const message=ref(''),copyFallback=ref(false)
let session:DurablePaperCollaboration|null=null
let disposed=false
const writerId=globalThis.crypto.randomUUID()
const capabilityChecked=ref(false),draftEnabled=ref(false),draftSaved=ref(false),draftNotice=ref('')
const draftRows=shallowRef<PaperCollaborationDraft[]>([]),selectedDraftKey=ref('')
let ownBackup:PaperCollaborationDraft|null=null,recoveringBackup:PaperCollaborationDraft|null=null
let suppressDraftSync=false
const otherDrafts=computed(()=>draftRows.value.filter(row=>row.writerId!==writerId))
const selectedDraft=computed(()=>otherDrafts.value.find(row=>collabDraftKey(row)===selectedDraftKey.value)||otherDrafts.value[0]||null)
const scope=()=>!disposed&&auth.isAuthenticated&&auth.user?.uuid===props.accountId
const editable=computed(()=>scope()&&view.value?.role!=='viewer'&&
 (view.value?.status==='ready'||view.value?.status==='saving'||(view.value?.offlineEditable&&draftEnabled.value)))
const canEditNow=()=>scope()&&!!session?.canEdit()&&(!session.view.offlineEditable||draftEnabled.value)
function toggleOffline(enabled:boolean){
 if(!scope()||!session)return
 if(enabled&&(!draftEnabled.value||!view.value?.epoch))return
 if(enabled){
  try{
   // Probe write access without writing manuscript content.
   const key='atoman.papers.collab-draft-probe:'+writerId
   localStorage.setItem(key,'1');localStorage.removeItem(key)
   if(view.value?.pending&&!draftSaved.value){
    draftNotice.value='当前修改尚未完整备份，不能开启离线编辑。';return
   }
  }catch{draftNotice.value='本机存储不可用，不能开启离线编辑。';return}
 }
 session.setOfflineEditing(enabled)
}
const remotePeers=computed(()=>view.value?.peers.filter(p=>p.connection_id!==view.value?.connectionId)||[])
const onlineCount=computed(()=>new Set(view.value?.peers.map(p=>p.user_id)||[]).size)
function selectionChanged(selection:LocalSelection|null){if(scope())session?.setSelection(selection)}
const statusLabel=computed(()=>{
 const state=view.value
 if(message.value&&!state)return '不可用'
 if(!state||state.status==='connecting')return '连接中'
 if(state.status==='reconnecting')return state.offlineEditable?'正在重连 · 离线编辑（未提交）':'正在重连 · 暂停编辑'
 if(state.status==='stopped')return state.pending?'已断开 · 未确认修改':'已断开'
 if(state.role==='viewer')return '在线 · 只读'
 return state.pending?'正在同步…':'服务器已保存 · 版本 '+state.fileRevision
})
function refreshDrafts(){
 if(!scope()||!capabilityChecked.value)return
 try{
  draftEnabled.value=collaborationDraftEnabled(localStorage,props.accountId)
  draftRows.value=listCollaborationDrafts(localStorage,props.accountId,props.projectId,props.file.id)
 }catch{draftSaved.value=false;draftNotice.value='无法访问本机协作草稿存储。'}
}
function sameScope(row:PaperCollaborationDraft){
 return scope()&&row.owner===props.accountId&&row.projectId===props.projectId&&row.fileId===props.file.id
}
function compatible(row:PaperCollaborationDraft){
 return sameScope(row)&&row.path===props.file.path&&props.role!=='viewer'&&!!view.value&&!view.value.pending&&
  view.value.status==='ready'&&!!session?.canRecoverDraft(row.payload)
}
function syncCollaborationDraft(next:CollaborationView){
 if(!scope()||!capabilityChecked.value||suppressDraftSync)return
 try{
  if(!next.pending){
   draftSaved.value=false
   // Only a live authoritative acknowledgement may clear an existing
   // backup. Never clear on connecting/stopped/destroy.
   if(next.status==='ready'&&next.epoch&&(ownBackup||recoveringBackup)){
    const recovered=!!recoveringBackup
    let unchanged=true
    if(ownBackup){unchanged=removeCollaborationDraft(localStorage,ownBackup)&&unchanged;ownBackup=null}
    if(recoveringBackup){unchanged=removeCollaborationDraft(localStorage,recoveringBackup)&&unchanged;recoveringBackup=null}
    refreshDrafts()
    if(recovered)draftNotice.value=unchanged?'草稿已由服务器确认并清除本机备份。':'草稿已由服务器确认；其他会话修改过的备份仍保留。'
   }
   return
  }
  draftEnabled.value=collaborationDraftEnabled(localStorage,props.accountId)
  if(!draftEnabled.value){draftSaved.value=false;session?.setOfflineEditing(false);return}
  const payload=session?.captureDraft()
  if(!payload){draftSaved.value=false;session?.setOfflineEditing(false);return}
  if(ownBackup&&JSON.stringify(ownBackup.payload)===JSON.stringify(payload)&&sameCollaborationDraft(localStorage,ownBackup)){
   draftSaved.value=true;return
  }
  const row:PaperCollaborationDraft={version:1,owner:props.accountId,projectId:props.projectId,fileId:props.file.id,
    writerId,path:props.file.path,updatedAt:Date.now(),payload}
  writeCollaborationDraft(localStorage,row)
  ownBackup=row;draftSaved.value=true;draftNotice.value=''
 }catch{
  draftSaved.value=false
  draftNotice.value='本机协作草稿备份失败（容量或浏览器限制）。离线编辑已暂停，请复制当前源码；已有备份不会自动删除。'
  session?.setOfflineEditing(false)
 }
}
function toggleDraftProtection(enabled:boolean){
 if(!scope()||props.role==='viewer')return
 try{
  setCollaborationDraftEnabled(localStorage,props.accountId,enabled)
  draftEnabled.value=enabled
  if(!enabled){draftSaved.value=false;session?.setOfflineEditing(false)}
  if(view.value)syncCollaborationDraft(view.value)
  if(!enabled||!view.value?.pending||draftSaved.value)draftNotice.value=enabled?'本机协作草稿保护已开启。':'保护已关闭，既有草稿保留。'
 }catch{draftNotice.value='无法更新本机保护设置。'}
}
function restoreDraft(row:PaperCollaborationDraft){
 if(!compatible(row)||!session||!window.confirm('将这份本机协作草稿合并到原协作会话？只有服务器确认后才会清除备份。'))return
 try{
  if(!sameCollaborationDraft(localStorage,row)){refreshDrafts();draftNotice.value='草稿已经变化，请重新选择。';return}
  recoveringBackup=row
  if(!session.recoverDraft(row.payload)){recoveringBackup=null;draftNotice.value='草稿无法安全合并。请复制后手动处理。';return}
  draftNotice.value='草稿已合并至编辑器，等待服务器确认。'
 }catch{recoveringBackup=null;draftNotice.value='恢复失败，原备份仍保留。'}
}
function discardDraft(row:PaperCollaborationDraft){
 if(!sameScope(row)||view.value?.pending||!window.confirm('删除该本机协作草稿？不会修改服务器文件。'))return
 try{if(!removeCollaborationDraft(localStorage,row))draftNotice.value='草稿已变化，请重新选择。';else draftNotice.value='本机草稿已删除。';refreshDrafts()}
 catch{draftNotice.value='无法删除本机草稿。'}
}
async function copyDraft(row:PaperCollaborationDraft){
 if(!sameScope(row))return
 try{await navigator.clipboard.writeText(row.payload.source);draftNotice.value='草稿已复制。'}
 catch{draftNotice.value='无法访问剪贴板，请手动复制上方源码。'}
}
function storageChanged(event:StorageEvent){
 if(!scope()||!capabilityChecked.value)return
 if(event.key===null||event.key.startsWith('atoman.papers.collab-draft')){
  refreshDrafts()
  if(view.value?.pending){
   // Do not recreate a draft that another tab explicitly deleted as a
   // side effect of publishing the new offline-edit permission.
   try{draftSaved.value=!!ownBackup&&draftEnabled.value&&sameCollaborationDraft(localStorage,ownBackup)}catch{draftSaved.value=false}
  }
  if(!draftEnabled.value||(view.value?.pending&&!draftSaved.value)){
   suppressDraftSync=true
   try{session?.setOfflineEditing(false)}finally{suppressDraftSync=false}
  }
 }
}
function confirmedRevision():number|null{
 const current=session?.view
 return scope()&&props.role==='owner'&&current?.role==='owner'&&current.status==='ready'&&!current.pending&&
  !!current.epoch&&Number.isSafeInteger(current.projectRevision)&&current.projectRevision>0?current.projectRevision:null
}
function hasUnconfirmed(){return !!session?.view.pending}
function requestExit(){
 if(props.operationBusy)return
 if(hasUnconfirmed()&&!window.confirm(draftSaved.value?'仍有未确认的修改，本机备份已保留。确定退出协作？':'仍有未确认且未完整备份的修改。请先复制源码，确定退出？'))return
 emit('exit')
}
async function copySource(){
 const source=view.value?.source
 if(source===undefined||!scope())return
 try{await navigator.clipboard.writeText(source);message.value='当前协作源码已复制。'}
 catch{copyFallback.value=true;message.value='请从下方文本框手动复制。'}
}
onMounted(async()=>{
 window.addEventListener('storage',storageChanged)
 try{
  const capability=await getPaperCollaborationCapability(props.projectId,props.file.id)
  if(!scope())return
  capabilityChecked.value=true;refreshDrafts()
  if(capability.enabled!==true||capability.protocol!=='papers-crdt-v1'||capability.role!==props.role){
   message.value='实时协作尚未开放，或项目权限发生变化。'
   return
  }
  const path='papers/projects/'+encodeURIComponent(props.projectId)+'/files/'+encodeURIComponent(props.file.id)+'/collaboration/ws'
  session=new DurablePaperCollaboration({
   url:useApiWebSocketUrl(path)+(capability.presence===true?'?presence=1':''),expectedRole:props.role,presence:capability.presence===true,reconnect:true,
   createSocket:url=>{
    if(!scope())throw Error('collaboration account changed')
    return auth.token?new WebSocket(url,[`atoman.api.${auth.token}`]):new WebSocket(url)
   },
   onChange:next=>{if(scope()){view.value=next;syncCollaborationDraft(next);emit('confirmed',confirmedRevision())}},
  })
  session.start()
 }catch{if(scope())message.value='无法读取协作能力，请检查网络或访问资格。'}
})
onBeforeUnmount(()=>{disposed=true;window.removeEventListener('storage',storageChanged);draftRows.value=[]})
onUnmounted(()=>{session?.destroy();session=null;view.value=null})
defineExpose({hasUnconfirmed,requestExit,confirmedRevision})
</script>
<style scoped>
.papers-collab{display:flex;flex:1;flex-direction:column;min-height:0;overflow:hidden}
.papers-collab__bar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:7px 10px;border-bottom:1px solid var(--a-color-border-soft,#ddd);font-size:12px}
.papers-collab__bar strong{overflow-wrap:anywhere}
.papers-collab__bar button{font:inherit;background:transparent;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;padding:4px 7px;color:inherit}
.papers-collab p{font-size:12px;margin:0;padding:6px 10px;overflow-wrap:anywhere}
.papers-collab__hint{color:var(--a-color-text-secondary,#64748b)}
.papers-collab__warning{font-weight:600}
.papers-collab__drafts{padding:6px 10px;max-height:40%;overflow:auto;border-bottom:1px solid var(--a-color-border-soft,#ddd);font-size:12px}
.papers-collab__drafts summary{cursor:pointer}
.papers-collab__draft{display:grid;gap:5px;margin-top:6px}
.papers-collab__draft-actions{display:flex;flex-wrap:wrap;gap:6px}
.papers-collab__drafts button{font:inherit;border:1px solid var(--a-color-border-soft,#ddd);background:transparent;color:inherit;border-radius:4px;padding:4px 7px}
.papers-collab__drafts button:disabled{opacity:.5}
.papers-collab__drafts textarea{max-height:120px;min-height:70px}
.papers-collab__peers{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:6px 10px;border-bottom:1px solid var(--a-color-border-soft,#ddd);font-size:12px}
.papers-collab__peer{display:inline-flex;align-items:center;gap:5px;overflow-wrap:anywhere;max-width:100%}
.papers-collab__dot{width:8px;height:8px;flex-shrink:0;border-radius:50%}
.papers-collab :deep(.papers-latex-editor){flex:1;min-height:0}
.papers-collab textarea{min-height:100px;max-height:25%;width:100%;font:12px monospace;box-sizing:border-box}
</style>
