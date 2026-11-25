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
 disconnect(){this.readyState=3;this.onclose?.({} as CloseEvent)}
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
