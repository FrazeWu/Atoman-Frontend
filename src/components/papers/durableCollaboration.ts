// Client for the durable Papers protocol, not the blog's peer relay.
// The authoritative seed always comes from the server; local updates
// are kept in Y.Doc until explicitly acknowledged after commit.
import * as Y from 'yjs'
import {encodeSelection,parsePresencePeers,type CollaborationPeer,type LocalSelection,type RelativeSelection} from './paperPresence'

export type CollaborationRole = 'owner'|'editor'|'viewer'
export type CollaborationStatus = 'connecting'|'ready'|'saving'|'stopped'
export interface CollaborationView {
 status: CollaborationStatus
 text: Y.Text|null
 source: string
 role: CollaborationRole|null
 pending: boolean
 epoch: string
 sequence: number
 fileRevision: number
 projectRevision: number
 message: string
 peers: readonly CollaborationPeer[]
 connectionId: string
}
const PROTOCOL='papers-crdt-v1'
const MAX_UPDATE=256*1024
const MAX_STATE=4*1024*1024
const MAX_VECTOR=64*1024
const MAX_TEXT=1024*1024
const MAX_FRAME=6*1024*1024
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const remoteOrigin=Symbol('papers-server-committed')
const roles=new Set(['owner','editor','viewer'])
const retryableCodes=new Set(['papers.collab_retry','papers.collab_unavailable','papers.collab_storage_failed'])
function validUUID(value:unknown):value is string {
 return typeof value==='string'&&UUID.test(value)&&value!=='00000000-0000-0000-0000-000000000000'
}
function counter(value:unknown):value is number {
 return Number.isSafeInteger(value)&&typeof value==='number'&&value>0
}
function decode64(value:unknown,max:number):Uint8Array {
 if(typeof value!=='string'||!value.length||value.length>4*Math.ceil(max/3)||value.length%4!==0)throw Error('invalid binary')
 const raw=atob(value)
 if(!raw.length||raw.length>max||btoa(raw)!==value)throw Error('invalid binary')
 return Uint8Array.from(raw,c=>c.charCodeAt(0))
}
function encode64(bytes:Uint8Array):string {
 let s=''
 for(let offset=0;offset<bytes.length;offset+=8192)s+=String.fromCharCode(...bytes.subarray(offset,offset+8192))
 return btoa(s)
}
function validSource(source:string) {
 return !source.includes(String.fromCharCode(0))&&new TextEncoder().encode(source).length<=MAX_TEXT
}
export type CollaborationStateFrame={
 type:'state'
 protocol:string
 epoch:string
 request_id?:string
 sequence:number
 file_revision:number
 project_revision:number
 role:CollaborationRole
 state:string
 vector:string
}
type PresenceFrame={type:'presence';protocol:string;epoch:string;connection_id:string;presence_version:number;peers:CollaborationPeer[]}
type ErrorFrame={type:'error';epoch:string;request_id:string;code:string;retryable?:boolean}
export function parseCollaborationFrame(raw:unknown):CollaborationStateFrame|ErrorFrame|PresenceFrame {
 if(typeof raw!=='string'||raw.length>MAX_FRAME)throw Error('invalid frame')
 const frame=JSON.parse(raw)
 if(!frame||typeof frame!=='object'||!validUUID(frame.epoch))throw Error('invalid epoch')
 if(frame.type==='presence'){
  if(raw.length>8192||frame.protocol!==PROTOCOL||!validUUID(frame.connection_id)||!counter(frame.presence_version))throw Error('invalid presence')
  const peers=parsePresencePeers(frame.peers)
  if(!peers.some(p=>p.connection_id===frame.connection_id))throw Error('missing self')
  return {...frame,peers}
 }
 if(frame.type==='error'){
  if(!validUUID(frame.request_id)||typeof frame.code!=='string'||frame.code.length>100||
    (frame.retryable!==undefined&&typeof frame.retryable!=='boolean'))throw Error('invalid error frame')
  return frame
 }
 if(frame.type!=='state'||frame.protocol!==PROTOCOL||!counter(frame.sequence)||!counter(frame.file_revision)||!counter(frame.project_revision)||
  !roles.has(frame.role)||(frame.request_id!==undefined&&!validUUID(frame.request_id)))throw Error('invalid state frame')
 // Decode and validate sizes before any document is touched.
 decode64(frame.state,MAX_STATE)
 decode64(frame.vector,MAX_VECTOR)
 return frame
}

interface SocketLike {
 readyState:number
 send(data:string):void
 close(code?:number):void
 onopen:((event:Event)=>void)|null
 onmessage:((event:MessageEvent)=>void)|null
 onerror:((event:Event)=>void)|null
 onclose:((event:CloseEvent)=>void)|null
}
interface PendingUpdate {id:string;update:Uint8Array;retries:number}
interface Options {
 url:string
 expectedRole:CollaborationRole
 presence?:boolean
 onChange:(view:CollaborationView)=>void
 createSocket:(url:string)=>SocketLike
}
export class DurablePaperCollaboration {
 private readonly doc=new Y.Doc()
 private readonly text=this.doc.getText('source')
 private socket:SocketLike|null=null
 private queued:Uint8Array|null=null
 private inFlight:PendingUpdate|null=null
 private timer:ReturnType<typeof setTimeout>|null=null
 private deadline:ReturnType<typeof setTimeout>|null=null
 private presenceTimer:ReturnType<typeof setTimeout>|null=null
 private presenceVersion=0
 private lastPresenceAt=0
 private selection:RelativeSelection|null=null
 private sentSelection:string|undefined='null'
 private destroyed=false
 private unconfirmed=false
 private state:CollaborationView={
  status:'connecting',text:null,source:'',role:null,pending:false,epoch:'',sequence:0,fileRevision:0,projectRevision:0,message:'',peers:[],connectionId:''
 }
 constructor(private readonly options:Options){
  this.doc.on('update',this.localUpdate)
 }
 get view():CollaborationView {return {...this.state}}
 private publish(){
  if(this.destroyed)return
  this.state.source=this.text.toString()
  this.state.pending=this.unconfirmed||!!this.inFlight||!!this.queued
  this.options.onChange(this.view)
 }
 start(){
  if(this.destroyed||this.socket||this.state.status==='stopped')return
  try{
   const s=this.options.createSocket(this.options.url)
   this.socket=s
   s.onmessage=e=>{if(this.socket===s&&!this.destroyed)this.receive(e.data)}
   s.onerror=()=>{if(this.socket===s)this.stop('协作连接失败，当前源码不会通过普通保存覆盖服务器。')}
   s.onclose=()=>{if(this.socket===s)this.stop('协作连接已断开。请复制未确认的源码，再退出协作模式。')}
   this.armDeadline()
   this.publish()
  }catch{this.stop('无法建立协作连接。')}
 }
 private clearTimers(){
  if(this.timer!==null)clearTimeout(this.timer)
  if(this.deadline!==null)clearTimeout(this.deadline)
  if(this.presenceTimer!==null)clearTimeout(this.presenceTimer)
  this.timer=null;this.deadline=null;this.presenceTimer=null
 }
 private armDeadline(){
  if(this.deadline!==null)clearTimeout(this.deadline)
  this.deadline=setTimeout(()=>this.stop('等待服务器确认超时。已保留当前协作源码。'),18000)
 }
 private clearDeadline(){if(this.deadline!==null)clearTimeout(this.deadline);this.deadline=null}
 private stop(message:string){
  if(this.destroyed||this.state.status==='stopped')return
  this.unconfirmed=this.unconfirmed||!!this.inFlight||!!this.queued
  this.clearTimers()
  const s=this.socket;this.socket=null
  if(s){s.onopen=null;s.onmessage=null;s.onerror=null;s.onclose=null;try{s.close()}catch{}}
  this.state.peers=[];this.state.connectionId=''
  this.state.status='stopped'
  this.state.message=message
  this.publish()
 }
 private localUpdate=(update:Uint8Array,origin:unknown)=>{
  if(this.destroyed||origin===remoteOrigin)return
  this.unconfirmed=true
  // Protect edits that slip in during a reactive read-only transition.
  // Never send them after a stop or role downgrade.
  if(!this.state.epoch||this.state.status==='connecting'||this.state.status==='stopped'||this.state.role==='viewer'){
   this.stop('当前协作会话不可写，未发送本地修改。')
   this.publish()
   return
  }
  try{
   if(!validSource(this.text.toString())||update.length>MAX_UPDATE)throw Error('source too large')
   const merged=this.queued?Y.mergeUpdates([this.queued,update]):update.slice()
   if(merged.length>MAX_UPDATE)throw Error('update too large')
   this.queued=merged
   this.state.status='saving'
   this.publish()
   this.scheduleSend()
  }catch{this.stop('本次协作修改超过容量限制。请复制当前源码后处理。')}
 }
 setSelection(selection:LocalSelection|null){
  if(!this.options.presence||!this.state.epoch||this.state.status==='stopped'||this.destroyed)return
  try{this.selection=encodeSelection(this.text,selection)}catch{this.selection=null}
  this.schedulePresence()
 }
 private schedulePresence(){
  if(!this.options.presence||!this.state.connectionId||this.destroyed||this.state.status!=='ready'||this.inFlight||this.queued||this.unconfirmed||this.presenceTimer!==null)return
  const encoded=JSON.stringify(this.selection)
  if(encoded===this.sentSelection)return
  this.presenceTimer=setTimeout(()=>{
   this.presenceTimer=null
   const socket=this.socket
   if(this.destroyed||this.state.status!=='ready'||this.inFlight||this.queued||this.unconfirmed||!socket||socket.readyState!==1)return
   const selected=JSON.stringify(this.selection)
   if(selected===this.sentSelection)return
   try{
    socket.send(JSON.stringify({type:'presence',epoch:this.state.epoch,request_id:globalThis.crypto.randomUUID(),...(this.selection?{selection:this.selection}:{})}))
    this.sentSelection=selected
    this.lastPresenceAt=Date.now()
   }catch{this.stop('协作连接不可用。')}
  },Math.max(180,450-(Date.now()-this.lastPresenceAt)))
 }
 private scheduleSend(delay=200){
  if(this.timer!==null||this.destroyed||this.state.status==='stopped'||this.inFlight||!this.queued)return
  this.timer=setTimeout(()=>{
   this.timer=null
   if(this.destroyed||this.state.status==='stopped'||this.inFlight||!this.queued)return
   try{
    const id=globalThis.crypto.randomUUID()
    this.inFlight={id,update:this.queued,retries:0}
    this.queued=null
    this.sendCurrent()
   }catch{this.stop('无法发送协作更新。当前源码已保留。')}
  },delay)
 }
 private sendCurrent(){
  const s=this.socket,item=this.inFlight
  if(!s||s.readyState!==1||!item){this.stop('协作连接不可用。');return}
  try{
   s.send(JSON.stringify({type:'update',request_id:item.id,epoch:this.state.epoch,update:encode64(item.update)}))
   this.armDeadline()
  }catch{this.stop('发送协作更新失败。')}
 }
 private receive(raw:unknown){
  if(this.destroyed||this.state.status==='stopped')return
  try{
   const frame=parseCollaborationFrame(raw)
   if(frame.type==='presence'){
    if(!this.options.presence||!this.state.epoch||frame.epoch!==this.state.epoch||
       (this.state.connectionId&&this.state.connectionId!==frame.connection_id)||frame.presence_version<this.presenceVersion)throw Error('presence scope changed')
    const self=frame.peers.find(p=>p.connection_id===frame.connection_id)
    if(self?.role!==this.options.expectedRole)throw Error('presence role changed')
    this.state.connectionId=frame.connection_id
    this.presenceVersion=frame.presence_version
    this.state.peers=frame.peers
    this.publish()
    this.schedulePresence()
    return
   }
   if(frame.type==='error'){
    if(frame.epoch!==this.state.epoch||!this.inFlight||frame.request_id!==this.inFlight.id)throw Error('unmatched error')
    this.clearDeadline()
    if(frame.retryable===true&&retryableCodes.has(frame.code)&&this.inFlight.retries<3){
     const retries=++this.inFlight.retries
     if(this.timer!==null)clearTimeout(this.timer)
     // Retry exactly the same binary delta and request ID, in the same
     // epoch. Never regenerate a whole-document overwrite.
     this.timer=setTimeout(()=>{this.timer=null;this.sendCurrent()},400*2**(retries-1))
     this.publish()
     return
    }
    this.stop('服务器未确认协作修改。请复制当前源码后退出协作模式。')
    return
   }
   const initial=!this.state.epoch
   if(frame.role!==this.options.expectedRole||(!initial&&(frame.epoch!==this.state.epoch||frame.role!==this.state.role)))throw Error('scope changed')
   if(initial&&frame.request_id!==undefined)throw Error('unexpected initial ack')
   if(!initial&&(frame.sequence<this.state.sequence||frame.file_revision<this.state.fileRevision||frame.project_revision<this.state.projectRevision))throw Error('stale state')
   if(frame.request_id!==undefined&&frame.request_id!==this.inFlight?.id)throw Error('unmatched ack')
   const full=decode64(frame.state,MAX_STATE)
   // Validate the committed state in a disposable document. In particular
   // a malformed/partial seed must never become the live CodeMirror model.
   const verified=new Y.Doc()
   try{
    const source=verified.getText('source')
    Y.applyUpdate(verified,full)
    if(verified.share.size!==1||verified.store.pendingStructs!=null||verified.store.pendingDs!=null||
       source.toDelta().some((part:{insert?:unknown;attributes?:unknown})=>typeof part.insert!=='string'||part.attributes!=null)||!validSource(source.toString())||
       encode64(Y.encodeStateVector(verified))!==frame.vector)throw Error('invalid committed document')
   }finally{verified.destroy()}
   Y.applyUpdate(this.doc,full,remoteOrigin)
   if(!validSource(this.text.toString()))throw Error('merged source exceeds limit')
   this.state.epoch=frame.epoch
   this.state.sequence=frame.sequence
   this.state.fileRevision=frame.file_revision
   this.state.projectRevision=frame.project_revision
   this.state.role=frame.role
   this.state.text=this.text
   if(initial||frame.request_id!==undefined){
    this.clearDeadline()
    if(frame.request_id!==undefined){
     if(this.timer!==null)clearTimeout(this.timer)
     this.timer=null
     this.inFlight=null
     this.unconfirmed=!!this.queued
    }
   }
   this.state.status=this.inFlight||this.queued?'saving':'ready'
   this.state.message=''
   this.publish()
   this.scheduleSend()
   this.schedulePresence()
  }catch{this.stop('协作状态无效或会话已变化。不会自动覆盖或重新初始化本地修改。')}
 }
 destroy(){
  if(this.destroyed)return
  this.stop('协作会话已结束。')
  this.destroyed=true
  this.doc.off('update',this.localUpdate)
  this.doc.destroy()
  this.state.text=null;this.state.source=''
  this.queued=null;this.inFlight=null
 }
}
