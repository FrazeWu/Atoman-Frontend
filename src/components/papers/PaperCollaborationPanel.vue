<template>
 <section class="papers-collab" aria-label="实时协作">
  <div class="papers-collab__bar">
   <strong>实时协作 · {{ file.path }}</strong>
   <span role="status">{{ statusLabel }}</span>
   <button v-if="view?.text" type="button" @click="copySource">复制协作源码</button>
   <button type="button" @click="requestExit">退出协作</button>
  </div>
  <p v-if="message" role="alert">{{ message }}</p>
  <p v-if="view?.message" role="alert">{{ view.message }}</p>
  <p v-if="view?.pending" class="papers-collab__warning">尚有服务器未确认的修改。请勿刷新或关闭网页；连接断开时可复制当前源码。</p>
  <div v-if="view?.connectionId" class="papers-collab__peers" aria-label="在线成员">
   <strong>在线 {{ onlineCount }} 人</strong>
   <span v-for="peer in view.peers" :key="peer.connection_id" class="papers-collab__peer" :title="peer.role==='viewer'?'阅读者':peer.role==='owner'?'所有者':'编辑者'">
    <span class="papers-collab__dot" :style="{backgroundColor:peerColor(peer.connection_id)}" />{{ peer.name }}{{peer.connection_id===view.connectionId?'（我）':''}}
   </span>
  </div>
  <p v-if="view?.text" class="papers-collab__hint">仅同步当前文件。协作期间暂停普通保存、编译和项目结构修改；协作撤销与断线恢复尚未开放。</p>
  <LatexEditor v-if="view?.text" :key="view.epoch" :model-value="view.source" :collaborative-text="view.text" :citations="citations" :readonly="!editable" :remote-peers="remotePeers" @presence-selection="selectionChanged" />
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

const props=defineProps<{projectId:string;file:PaperFile;role:PaperProjectRole;accountId:string;citations?:readonly string[]}>()
const emit=defineEmits<{exit:[]}>()
const auth=useAuthStore()
const view=shallowRef<CollaborationView|null>(null)
const message=ref(''),copyFallback=ref(false)
let session:DurablePaperCollaboration|null=null
let disposed=false
const scope=()=>!disposed&&auth.isAuthenticated&&auth.user?.uuid===props.accountId
const editable=computed(()=>scope()&&view.value?.role!=='viewer'&&(view.value?.status==='ready'||view.value?.status==='saving'))
const remotePeers=computed(()=>view.value?.peers.filter(p=>p.connection_id!==view.value?.connectionId)||[])
const onlineCount=computed(()=>new Set(view.value?.peers.map(p=>p.user_id)||[]).size)
function selectionChanged(selection:LocalSelection|null){if(scope())session?.setSelection(selection)}
const statusLabel=computed(()=>{
 const state=view.value
 if(message.value&&!state)return '不可用'
 if(!state||state.status==='connecting')return '连接中'
 if(state.status==='stopped')return state.pending?'已断开 · 未确认修改':'已断开'
 if(state.role==='viewer')return '在线 · 只读'
 return state.pending?'正在同步…':'服务器已保存 · 版本 '+state.fileRevision
})
function hasUnconfirmed(){return !!session?.view.pending}
function requestExit(){
 if(hasUnconfirmed()&&!window.confirm('仍有服务器未确认的修改。请先复制协作源码。确定退出并放弃本次会话中的未确认内容？'))return
 emit('exit')
}
async function copySource(){
 const source=view.value?.source
 if(source===undefined||!scope())return
 try{await navigator.clipboard.writeText(source);message.value='当前协作源码已复制。'}
 catch{copyFallback.value=true;message.value='请从下方文本框手动复制。'}
}
onMounted(async()=>{
 try{
  const capability=await getPaperCollaborationCapability(props.projectId,props.file.id)
  if(!scope())return
  if(capability.enabled!==true||capability.protocol!=='papers-crdt-v1'||capability.role!==props.role){
   message.value='实时协作尚未开放，或项目权限发生变化。'
   return
  }
  const path='papers/projects/'+encodeURIComponent(props.projectId)+'/files/'+encodeURIComponent(props.file.id)+'/collaboration/ws'
  session=new DurablePaperCollaboration({
   url:useApiWebSocketUrl(path)+(capability.presence===true?'?presence=1':''),expectedRole:props.role,presence:capability.presence===true,
   createSocket:url=>auth.token?new WebSocket(url,[`atoman.api.${auth.token}`]):new WebSocket(url),
   onChange:next=>{if(scope())view.value=next},
  })
  session.start()
 }catch{if(scope())message.value='无法读取协作能力，请检查网络或访问资格。'}
})
onBeforeUnmount(()=>{disposed=true})
onUnmounted(()=>{session?.destroy();session=null;view.value=null})
defineExpose({hasUnconfirmed,requestExit})
</script>
<style scoped>
.papers-collab{display:flex;flex:1;flex-direction:column;min-height:0;overflow:hidden}
.papers-collab__bar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:7px 10px;border-bottom:1px solid var(--a-color-border-soft,#ddd);font-size:12px}
.papers-collab__bar strong{overflow-wrap:anywhere}
.papers-collab__bar button{font:inherit;background:transparent;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;padding:4px 7px;color:inherit}
.papers-collab p{font-size:12px;margin:0;padding:6px 10px;overflow-wrap:anywhere}
.papers-collab__hint{color:var(--a-color-text-secondary,#64748b)}
.papers-collab__warning{font-weight:600}
.papers-collab__peers{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:6px 10px;border-bottom:1px solid var(--a-color-border-soft,#ddd);font-size:12px}
.papers-collab__peer{display:inline-flex;align-items:center;gap:5px;overflow-wrap:anywhere;max-width:100%}
.papers-collab__dot{width:8px;height:8px;flex-shrink:0;border-radius:50%}
.papers-collab :deep(.papers-latex-editor){flex:1;min-height:0}
.papers-collab textarea{min-height:100px;max-height:25%;width:100%;font:12px monospace;box-sizing:border-box}
</style>
