import {afterEach,describe,expect,it,vi} from 'vitest'
import * as Y from 'yjs'
import {DurablePaperCollaboration,parseCollaborationFrame,type CollaborationStateFrame} from '@/components/papers/durableCollaboration'
const epoch='550e8400-e29b-41d4-a716-446655440001',another='550e8400-e29b-41d4-a716-446655440002'
const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value))
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0))
class Socket {
 readyState=1
 onopen:((event:Event)=>void)|null=null
 onmessage:((event:MessageEvent)=>void)|null=null
 onerror:((event:Event)=>void)|null=null
 onclose:((event:CloseEvent)=>void)|null=null
 sent:string[]=[]
 send(raw:string){this.sent.push(raw)}
 close(){this.readyState=3}
 push(value:unknown){this.onmessage?.({data:JSON.stringify(value)} as MessageEvent)}
 disconnect(code=1006){this.readyState=3;this.onclose?.({code} as CloseEvent)}
}
function fixture(role:'owner'|'editor'|'viewer'='owner'){
 vi.useFakeTimers()
 const server=new Y.Doc(),source=server.getText('source')
 source.insert(0,'server original '+String.fromCodePoint(0x4e2d,0x1f600))
 const socket=new Socket()
 const session=new DurablePaperCollaboration({url:'ws://localhost/fixture',expectedRole:role,createSocket:()=>socket,onChange:vi.fn()})
 session.start()
 const frame=(sequence=1,request_id?:string):CollaborationStateFrame=>({
  type:'state',protocol:'papers-crdt-v1',epoch,sequence,file_revision:sequence,project_revision:sequence,
  role,state:encode(Y.encodeStateAsUpdate(server)),vector:encode(Y.encodeStateVector(server)),...(request_id?{request_id}:{})
 })
 return {server,source,socket,session,frame,cleanup:()=>{session.destroy();server.destroy()}}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
describe('Durable Papers collaboration',()=>{
 it('seeds from server, merges remote and queued local edits, and waits for committed ack',()=>{
  const f=fixture()
  try{
   expect(f.session.view.text).toBeNull();expect(f.socket.sent).toHaveLength(0)
   f.socket.push(f.frame())
   const local=f.session.view.text!
   expect(local.toString()).toBe(f.source.toString())
   local.insert(0,'local ');vi.advanceTimersByTime(200)
   expect(f.socket.sent).toHaveLength(1)
   const first=JSON.parse(f.socket.sent[0]!)
   expect(f.session.view.pending).toBe(true)
   f.source.insert(f.source.length,' remote');f.socket.push(f.frame(2))
   expect(local.toString()).toContain('local ');expect(local.toString()).toContain(' remote')
   expect(f.session.view.pending).toBe(true)
   local.insert(local.length,' queued')
   Y.applyUpdate(f.server,decode(first.update));f.socket.push(f.frame(3,first.request_id))
   expect(f.session.view.pending).toBe(true)
   vi.advanceTimersByTime(200)
   const second=JSON.parse(f.socket.sent[1]!)
   Y.applyUpdate(f.server,decode(second.update));f.socket.push(f.frame(4,second.request_id))
   expect(local.toString()).toBe(f.source.toString())
   expect(f.session.view.pending).toBe(false);expect(f.session.view.status).toBe('ready')
  }finally{f.cleanup()}
 })
 it('retries the exact same deletion delta, preserving the ack fence',()=>{
  const f=fixture()
  try{
   f.socket.push(f.frame());f.session.view.text!.delete(0,1);vi.advanceTimersByTime(200)
   const first=f.socket.sent[0]!,m=JSON.parse(first)
   f.socket.push({type:'error',epoch,request_id:m.request_id,code:'papers.collab_retry',retryable:true})
   vi.advanceTimersByTime(400);expect(f.socket.sent[1]).toBe(first)
   Y.applyUpdate(f.server,decode(m.update));f.socket.push(f.frame(2,m.request_id))
   expect(f.session.view.source).toBe(f.source.toString());expect(f.session.view.pending).toBe(false)
  }finally{f.cleanup()}
 })
 it('freezes and retains unconfirmed text on disconnect without cross-epoch replay',()=>{
  const f=fixture()
  try{
   f.socket.push(f.frame());f.session.view.text!.insert(0,'unsaved ');vi.advanceTimersByTime(200)
   f.socket.disconnect();expect(f.session.view.status).toBe('stopped')
   expect(f.session.view.pending).toBe(true);expect(f.session.view.source).toContain('unsaved ')
   f.socket.push({...f.frame(2),epoch:another});vi.advanceTimersByTime(20000);f.session.start()
   expect(f.socket.sent).toHaveLength(1);expect(f.session.view.epoch).toBe(epoch)
  }finally{f.cleanup()}
 })
 it('rejects changed epochs and roles, unmatched acks, and viewer writes',()=>{
  for(const modify of [(f:CollaborationStateFrame)=>({...f,epoch:another}),(f:CollaborationStateFrame)=>({...f,role:'viewer'}),(f:CollaborationStateFrame)=>({...f,request_id:another})]){
   const f=fixture()
   try{
    f.socket.push(f.frame());f.session.view.text!.insert(0,'preserved ');f.socket.push(modify(f.frame(2)))
    expect(f.session.view.status).toBe('stopped');expect(f.session.view.source).toContain('preserved ')
    vi.advanceTimersByTime(200);expect(f.socket.sent).toHaveLength(0)
   }finally{f.cleanup()}
  }
  const v=fixture('viewer')
  try{v.socket.push(v.frame());v.session.view.text!.insert(0,'not allowed ');vi.advanceTimersByTime(200)
   expect(v.session.view.status).toBe('stopped');expect(v.socket.sent).toHaveLength(0)
  }finally{v.cleanup()}
 })
 it('rejects malformed state and protects pending text after confirmation timeout',()=>{
  const a=fixture()
  try{a.socket.push({...a.frame(),vector:'AAAA'});expect(a.session.view.status).toBe('stopped');expect(a.session.view.text).toBeNull()}finally{a.cleanup()}
  const b=fixture()
  try{b.socket.push(b.frame());b.session.view.text!.insert(0,'waiting ');vi.advanceTimersByTime(18200)
   expect(b.session.view.status).toBe('stopped');expect(b.session.view.pending).toBe(true);expect(b.session.view.source).toContain('waiting ')
  }finally{b.cleanup()}
  expect(()=>parseCollaborationFrame('x'.repeat(6*1024*1024+1))).toThrow()
 })
})

describe('Negotiated presence',()=>{
 it('sends only bounded local relative selections after server identity, independently of durable updates',()=>{
  vi.useFakeTimers()
  const server=new Y.Doc(),source=server.getText('source')
  source.insert(0,'abc def')
  const socket=new Socket()
  const session=new DurablePaperCollaboration({url:'ws://localhost/fixture',expectedRole:'editor',presence:true,createSocket:()=>socket,onChange:vi.fn()})
  const member={connection_id:another,user_id:another,name:'self',role:'editor'}
  const frame=(revision:number,request_id?:string)=>({type:'state',protocol:'papers-crdt-v1',epoch,sequence:revision,file_revision:revision,project_revision:revision,role:'editor',state:encode(Y.encodeStateAsUpdate(server)),vector:encode(Y.encodeStateVector(server)),...(request_id?{request_id}:{})})
  try{
   session.start()
   socket.push(frame(1))
   session.setSelection({anchor:0,head:2})
   vi.advanceTimersByTime(1000)
   expect(socket.sent).toHaveLength(0)
   socket.push({type:'presence',protocol:'papers-crdt-v1',epoch,connection_id:another,presence_version:1,peers:[member]})
   vi.advanceTimersByTime(450)
   expect(socket.sent).toHaveLength(1)
   expect(JSON.parse(socket.sent[0]!)).toMatchObject({type:'presence',epoch})
   session.view.text!.insert(0,'X')
   session.setSelection({anchor:1,head:1})
   vi.advanceTimersByTime(200)
   const update=JSON.parse(socket.sent[1]!)
   expect(update.type).toBe('update')
   vi.advanceTimersByTime(500)
   expect(socket.sent).toHaveLength(2)
   Y.applyUpdate(server,decode(update.update))
   socket.push(frame(2,update.request_id))
   vi.advanceTimersByTime(450)
   expect(JSON.parse(socket.sent[2]!).type).toBe('presence')
   expect(session.view.pending).toBe(false)
   socket.disconnect()
   expect(session.view.peers).toEqual([])
  }finally{session.destroy();server.destroy()}
 })
})

describe('Same-epoch reconnect',()=>{
 function reconnectFixture(){
  vi.useFakeTimers()
  const server=new Y.Doc(),source=server.getText('source')
  source.insert(0,'abcdef')
  const sockets:Socket[]=[],urls:string[]=[]
  const session=new DurablePaperCollaboration({
   url:'ws://localhost/fixture?presence=1',expectedRole:'editor',presence:true,reconnect:true,
   createSocket:url=>{urls.push(url);const socket=new Socket();sockets.push(socket);return socket},onChange:vi.fn(),
  })
  const frame=(sequence:number,request_id?:string):CollaborationStateFrame=>({
   type:'state',protocol:'papers-crdt-v1',epoch,sequence,file_revision:sequence,project_revision:sequence,
   role:'editor',state:encode(Y.encodeStateAsUpdate(server)),vector:encode(Y.encodeStateVector(server)),...(request_id?{request_id}:{})
  })
  session.start()
  sockets[0]!.push(frame(1))
  return {server,source,sockets,urls,session,frame,cleanup:()=>{session.destroy();server.destroy()}}
 }
 it('replays a lost acknowledged deletion exactly once in the original epoch and preserves queued edits',()=>{
  const f=reconnectFixture()
  try{
   const a=f.sockets[0]!
   f.session.view.text!.delete(0,1)
   vi.advanceTimersByTime(200)
   const original=a.sent[0]!,m=JSON.parse(original)
   f.session.view.text!.insert(0,'queued ')
   Y.applyUpdate(f.server,decode(m.update)) // server committed; ack lost
   const late=a.onmessage
   a.disconnect(1006)
   expect(f.session.view.status).toBe('reconnecting')
   expect(f.session.view.pending).toBe(true)
   expect(f.session.view.source).toBe('queued bcdef')
   expect(f.session.view.peers).toEqual([])
   vi.advanceTimersByTime(750)
   const b=f.sockets[1]!
   expect(new URL(f.urls[1]!).searchParams.get('epoch')).toBe(epoch)
   expect(new URL(f.urls[1]!).searchParams.get('presence')).toBe('1')
   expect(b.sent).toHaveLength(0)
   // Old-connection callbacks must not process stale responses.
   late?.({data:JSON.stringify(f.frame(2,m.request_id))} as MessageEvent)
   expect(f.session.view.status).toBe('reconnecting')
   expect(f.session.view.pending).toBe(true)
   const committed=encode(Y.encodeStateAsUpdate(f.server))
   b.push(f.frame(2))
   vi.advanceTimersByTime(200)
   expect(b.sent[0]).toBe(original)
   Y.applyUpdate(f.server,decode(JSON.parse(b.sent[0]!).update))
   expect(encode(Y.encodeStateAsUpdate(f.server))).toBe(committed)
   b.push(f.frame(2,m.request_id))
   expect(f.session.view.pending).toBe(true)
   vi.advanceTimersByTime(200)
   const queued=JSON.parse(b.sent[1]!)
   Y.applyUpdate(f.server,decode(queued.update))
   b.push(f.frame(3,queued.request_id))
   expect(f.source.toString()).toBe('queued bcdef')
   expect(f.session.view.source).toBe(f.source.toString())
   expect(f.session.view.pending).toBe(false)
   expect(f.session.view.status).toBe('ready')
  }finally{f.cleanup()}
 })
 it('merges a newer authoritative state before resending a not-yet-accepted update',()=>{
  const f=reconnectFixture()
  try{
   const a=f.sockets[0]!
   f.session.view.text!.insert(0,'local ')
   vi.advanceTimersByTime(200)
   const first=a.sent[0]!,m=JSON.parse(first)
   a.disconnect()
   f.source.insert(f.source.length,' remote')
   vi.advanceTimersByTime(750)
   const b=f.sockets[1]!
   b.push(f.frame(2))
   expect(f.session.view.source).toBe('local abcdef remote')
   vi.advanceTimersByTime(200)
   expect(b.sent[0]).toBe(first)
   Y.applyUpdate(f.server,decode(m.update))
   b.push(f.frame(3,m.request_id))
   expect(f.session.view.source).toBe(f.source.toString())
   expect(f.session.view.pending).toBe(false)
  }finally{f.cleanup()}
 })
 it('stops on stale epoch, role mismatch, revision regression, or policy close without sending any pending delta',()=>{
  for(const change of [
   (f:CollaborationStateFrame)=>({...f,epoch:another}),
   (f:CollaborationStateFrame)=>({...f,role:'viewer'}),
   (f:CollaborationStateFrame)=>({...f,sequence:1,file_revision:1,project_revision:1}),
  ]){
   const f=reconnectFixture()
   try{
    f.sockets[0]!.push(f.frame(2))
    f.session.view.text!.insert(0,'pending ')
    vi.advanceTimersByTime(200)
    f.sockets[0]!.disconnect()
    vi.advanceTimersByTime(750)
    const b=f.sockets[1]!
    b.push(change(f.frame(3)))
    vi.advanceTimersByTime(50000)
    expect(f.session.view.status).toBe('stopped')
    expect(f.session.view.source).toBe('pending abcdef')
    expect(f.session.view.pending).toBe(true)
    expect(b.sent).toHaveLength(0)
    expect(f.sockets).toHaveLength(2)
   }finally{f.cleanup()}
  }
  const f=reconnectFixture()
  try{
   f.session.view.text!.insert(0,'pending ')
   vi.advanceTimersByTime(200)
   f.sockets[0]!.onerror?.({} as Event)
   f.sockets[0]!.disconnect(1008)
   vi.advanceTimersByTime(50000)
   expect(f.session.view.status).toBe('stopped')
   expect(f.session.view.pending).toBe(true)
   expect(f.sockets).toHaveLength(1)
  }finally{f.cleanup()}
 })
 it('bounds reconnect attempts and clears timers on destruction',()=>{
  const f=reconnectFixture()
  try{
   f.session.view.text!.insert(0,'pending ')
   vi.advanceTimersByTime(200)
   for(let attempt=0;attempt<5;attempt++){
    f.sockets.at(-1)!.disconnect()
    expect(f.session.view.status).toBe('reconnecting')
    vi.advanceTimersByTime(Math.min(750*2**attempt,6000))
   }
   f.sockets.at(-1)!.disconnect()
   vi.advanceTimersByTime(60000)
   expect(f.sockets).toHaveLength(6)
   expect(f.session.view.status).toBe('stopped')
   expect(f.session.view.pending).toBe(true)
  }finally{f.cleanup()}
  const g=reconnectFixture()
  try{
   g.sockets[0]!.disconnect()
   g.session.destroy()
   vi.advanceTimersByTime(60000)
   expect(g.sockets).toHaveLength(1)
  }finally{g.cleanup()}
 })
 it('resets connection-scoped presence after reconnect, including a restarted gateway sequence',()=>{
  const f=reconnectFixture()
  try{
   const peer={connection_id:another,user_id:another,name:'self',role:'editor'}
   f.sockets[0]!.push({type:'presence',protocol:'papers-crdt-v1',epoch,connection_id:another,presence_version:90,peers:[peer]})
   expect(f.session.view.connectionId).toBe(another)
   f.sockets[0]!.disconnect()
   expect(f.session.view.connectionId).toBe('')
   vi.advanceTimersByTime(750)
   f.sockets[1]!.push(f.frame(1))
   const id='550e8400-e29b-41d4-a716-446655440003'
   f.sockets[1]!.push({type:'presence',protocol:'papers-crdt-v1',epoch,connection_id:id,presence_version:1,peers:[{...peer,connection_id:id}]})
   expect(f.session.view.connectionId).toBe(id)
   expect(f.session.view.status).toBe('ready')
  }finally{f.cleanup()}
 })
})

describe('Persisted collaboration draft recovery',()=>{
 it('restores only explicit, validated pending deltas and preserves an in-flight request across a reopened panel',()=>{
  vi.useFakeTimers()
  const server=new Y.Doc(),source=server.getText('source')
  source.insert(0,'abc def')
  const a=new Socket(),b=new Socket()
  const make=(socket:Socket)=>new DurablePaperCollaboration({url:'ws://localhost/fixture',expectedRole:'editor',createSocket:()=>socket,onChange:vi.fn()})
  const first=make(a),second=make(b)
  const frame=(seq:number,request_id?:string):CollaborationStateFrame=>({type:'state',protocol:'papers-crdt-v1',epoch,sequence:seq,file_revision:seq,project_revision:seq,role:'editor',state:encode(Y.encodeStateAsUpdate(server)),vector:encode(Y.encodeStateVector(server)),...(request_id?{request_id}:{})})
  try{
   first.start();a.push(frame(1))
   first.view.text!.delete(0,1);vi.advanceTimersByTime(200)
   const raw=a.sent[0]!,m=JSON.parse(raw)
   first.view.text!.insert(0,'local ')
   const draft=first.captureDraft()!
   expect(draft.source).toBe('local bc def')
   expect(draft.inFlight?.id).toBe(m.request_id)
   expect(draft.queued).toBeTruthy()
   first.destroy()
   Y.applyUpdate(server,decode(m.update)) // committed, ack was lost
   source.insert(source.length,' remote')
   second.start();b.push(frame(2))
   expect(second.view.source).toBe('bc def remote')
   expect(second.canRecoverDraft(draft)).toBe(true)
   expect(b.sent).toHaveLength(0)
   expect(second.recoverDraft(draft)).toBe(true)
   expect(second.view.source).toBe('local bc def remote')
   vi.advanceTimersByTime(200);expect(b.sent[0]).toBe(raw)
   b.push(frame(2,m.request_id))
   expect(second.view.pending).toBe(true)
   vi.advanceTimersByTime(200)
   const queued=JSON.parse(b.sent[1]!)
   Y.applyUpdate(server,decode(queued.update))
   b.push(frame(3,queued.request_id))
   expect(second.view.source).toBe(source.toString())
   expect(second.captureDraft()).toBeNull()
   expect(second.view.pending).toBe(false)
  }finally{first.destroy();second.destroy();server.destroy()}
 })
 it('rejects stale epoch, role, version and corrupt deltas before touching the live source',()=>{
  const f=fixture()
  try{
   f.socket.push(f.frame())
   const source=f.session.view.source
   const foreign=new Y.Doc()
   foreign.getText('other').insert(0,'invalid')
   const update=encode(Y.encodeStateAsUpdate(foreign));foreign.destroy()
   const draft={epoch,role:'owner' as const,sequence:1,fileRevision:1,projectRevision:1,source:'different',replayable:true,queued:update}
   for(const row of [draft,{...draft,epoch:another},{...draft,role:'editor' as const},{...draft,sequence:2},{...draft,replayable:false}]){
    expect(f.session.recoverDraft(row)).toBe(false)
    expect(f.session.view.source).toBe(source)
    expect(f.session.view.pending).toBe(false)
   }
   vi.advanceTimersByTime(1000)
   expect(f.socket.sent).toHaveLength(0)
  }finally{f.cleanup()}
 })
})

it('publishes the original request ID to the backup callback before sending bytes',()=>{
 vi.useFakeTimers()
 const server=new Y.Doc(),source=server.getText('source')
 source.insert(0,'abc')
 const socket=new Socket()
 const send=socket.send.bind(socket)
 let persisted:ReturnType<DurablePaperCollaboration['captureDraft']>=null
 const session=new DurablePaperCollaboration({url:'ws://localhost/fixture',expectedRole:'editor',createSocket:()=>socket,onChange:()=>{persisted=session.captureDraft()}})
 try{
  socket.send=raw=>{
   const frame=JSON.parse(raw)
   expect(persisted?.inFlight?.id).toBe(frame.request_id)
   expect(persisted?.inFlight?.update).toBe(frame.update)
   send(raw)
  }
  session.start()
  socket.push({type:'state',protocol:'papers-crdt-v1',epoch,sequence:1,file_revision:1,project_revision:1,role:'editor',state:encode(Y.encodeStateAsUpdate(server)),vector:encode(Y.encodeStateVector(server))})
  session.view.text!.insert(0,'local ')
  expect(session.captureDraft()?.queued).toBeTruthy()
  vi.advanceTimersByTime(200)
  expect(socket.sent).toHaveLength(1)
 }finally{session.destroy();server.destroy()}
})

describe('Explicitly opted-in offline editing',()=>{
 function setup(role:'owner'|'editor'|'viewer'='editor'){
  vi.useFakeTimers()
  const server=new Y.Doc(),source=server.getText('source')
  source.insert(0,'abcdef')
  const sockets:Socket[]=[]
  const session=new DurablePaperCollaboration({
   url:'ws://localhost/fixture',expectedRole:role,reconnect:true,
   createSocket:()=>{const socket=new Socket();sockets.push(socket);return socket},onChange:vi.fn(),
  })
  const frame=(sequence:number,request_id?:string):CollaborationStateFrame=>({
   type:'state',protocol:'papers-crdt-v1',epoch,sequence,file_revision:sequence,project_revision:sequence,role,
   state:encode(Y.encodeStateAsUpdate(server)),vector:encode(Y.encodeStateVector(server)),...(request_id?{request_id}:{})
  })
  session.start();sockets[0]!.push(frame(1))
  return {session,server,source,sockets,frame,cleanup:()=>{session.destroy();server.destroy()}}
 }
 it('queues offline edits without sending until a fresh same-epoch checkpoint, then merges both authors',()=>{
  const f=setup()
  try{
   expect(f.session.view.offlineEnabled).toBe(false)
   f.session.setOfflineEditing(true)
   const first=f.sockets[0]!
   f.session.view.text!.insert(0,'online ')
   vi.advanceTimersByTime(200)
   const sent=first.sent[0]!,m=JSON.parse(sent)
   first.disconnect()
   expect(f.session.view.offlineEditable).toBe(true)
   expect(f.session.canEdit()).toBe(true)
   f.session.view.text!.insert(f.session.view.text!.length,' offline')
   expect(f.session.view.status).toBe('reconnecting')
   expect(f.session.view.pending).toBe(true)
   expect(f.session.captureDraft()?.queued).toBeTruthy()
   vi.advanceTimersByTime(750)
   const second=f.sockets[1]!
   expect(second.sent).toHaveLength(0)
   f.session.view.text!.insert(f.session.view.text!.length,' edits')
   vi.advanceTimersByTime(200)
   expect(second.sent).toHaveLength(0)
   f.source.insert(f.source.length,' remote')
   second.push(f.frame(2))
   vi.advanceTimersByTime(200)
   expect(second.sent[0]).toBe(sent)
   Y.applyUpdate(f.server,decode(m.update));second.push(f.frame(3,m.request_id))
   vi.advanceTimersByTime(200)
   const queued=JSON.parse(second.sent[1]!)
   Y.applyUpdate(f.server,decode(queued.update));second.push(f.frame(4,queued.request_id))
   expect(f.session.view.source).toBe(f.source.toString())
   expect(f.source.toString()).toContain('offline edits')
   expect(f.source.toString()).toContain(' remote')
   expect(f.session.view.pending).toBe(false)
  }finally{f.cleanup()}
 })
 it('disables editing after explicit policy rejection, wrong epoch or exhausted reconnect attempts',()=>{
  const f=setup()
  try{
   f.session.setOfflineEditing(true);f.sockets[0]!.disconnect()
   f.session.view.text!.insert(0,'offline ')
   vi.advanceTimersByTime(750)
   f.sockets[1]!.push({...f.frame(2),epoch:another})
   expect(f.session.canEdit()).toBe(false)
   expect(f.session.view.offlineEditable).toBe(false)
   expect(f.session.captureDraft()?.source).toBe('offline abcdef')
   vi.advanceTimersByTime(2000)
   expect(f.sockets[1]!.sent).toHaveLength(0)
  }finally{f.cleanup()}
  const p=setup()
  try{
   p.session.setOfflineEditing(true);p.sockets[0]!.disconnect(1008)
   expect(p.session.canEdit()).toBe(false)
   vi.advanceTimersByTime(60000);expect(p.sockets).toHaveLength(1)
  }finally{p.cleanup()}
  const g=setup()
  try{
   g.session.setOfflineEditing(true)
   for(let i=0;i<5;i++){
    g.sockets.at(-1)!.disconnect()
    vi.advanceTimersByTime(Math.min(750*2**i,6000))
   }
   g.sockets.at(-1)!.disconnect()
   expect(g.session.view.status).toBe('stopped')
   expect(g.session.canEdit()).toBe(false)
  }finally{g.cleanup()}
 })
 it('stays read-only by default, rejects viewer opt-in and honors disabling while disconnected',()=>{
  const f=setup()
  try{
   f.sockets[0]!.disconnect()
   expect(f.session.canEdit()).toBe(false)
   f.session.setOfflineEditing(true);expect(f.session.canEdit()).toBe(true)
   f.session.setOfflineEditing(false);expect(f.session.canEdit()).toBe(false)
  }finally{f.cleanup()}
  const v=setup('viewer')
  try{
   v.session.setOfflineEditing(true)
   v.sockets[0]!.disconnect()
   expect(v.session.view.offlineEnabled).toBe(false)
   expect(v.session.canEdit()).toBe(false)
  }finally{v.cleanup()}
 })
})
