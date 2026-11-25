import {describe,expect,it} from 'vitest'
import {collabDraftKey,collaborationDraftEnabled,setCollaborationDraftEnabled,listCollaborationDrafts,writeCollaborationDraft,sameCollaborationDraft,removeCollaborationDraft,encodeDraftUpdate,decodeDraftUpdate,validCollaborationDraftPayload,type PaperCollaborationDraft} from '@/components/papers/collaborationDrafts'
function memoryStorage():Storage{
 const rows=new Map<string,string>()
 return {get length(){return rows.size},key:i=>Array.from(rows.keys())[i]??null,getItem:k=>rows.get(k)??null,setItem:(k,v)=>{rows.set(k,v)},removeItem:k=>{rows.delete(k)},clear:()=>rows.clear()}
}
const id=(i:number)=>'550e8400-e29b-41d4-a716-'+String(i).padStart(12,'0')
const base:PaperCollaborationDraft={version:1,owner:'owner',projectId:'project',fileId:'file',writerId:id(1),path:'main.tex',updatedAt:1,
 payload:{epoch:id(2),role:'editor',sequence:1,fileRevision:1,projectRevision:1,source:'pending manuscript',replayable:true,inFlight:{id:id(3),update:'AQI='}}}
describe('Opt-in collaboration draft vault',()=>{
 it('isolates accounts, projects, files and independent writers and preserves old drafts on opt-out',()=>{
  const s=memoryStorage()
  expect(collaborationDraftEnabled(s,'owner')).toBe(false)
  setCollaborationDraftEnabled(s,'owner',true)
  expect(collaborationDraftEnabled(s,'owner')).toBe(true)
  expect(collaborationDraftEnabled(s,'other')).toBe(false)
  for(const row of [base,{...base,writerId:id(4)},{...base,owner:'other'},{...base,projectId:'other'},{...base,fileId:'other'}])writeCollaborationDraft(s,row)
  expect(listCollaborationDrafts(s,'owner','project','file')).toHaveLength(2)
  expect(listCollaborationDrafts(s,'other','project','file')).toHaveLength(1)
  expect(listCollaborationDrafts(s,'owner','project','other')).toHaveLength(1)
  setCollaborationDraftEnabled(s,'owner',false)
  expect(listCollaborationDrafts(s,'owner','project','file')).toHaveLength(2)
 })
 it('removes only an exact unchanged record after durable acknowledgement',()=>{
  const s=memoryStorage()
  writeCollaborationDraft(s,base)
  const changed={...base,updatedAt:2,payload:{...base.payload,source:'new local edit'}}
  writeCollaborationDraft(s,changed)
  expect(sameCollaborationDraft(s,base)).toBe(false)
  expect(removeCollaborationDraft(s,base)).toBe(false)
  expect(listCollaborationDrafts(s,'owner','project','file')).toEqual([changed])
  expect(removeCollaborationDraft(s,changed)).toBe(true)
 })
 it('rejects forged scope, malformed bytes, oversized data and exhausted capacity without eviction',()=>{
  const s=memoryStorage()
  s.setItem(collabDraftKey(base),JSON.stringify({...base,owner:'other'}))
  expect(listCollaborationDrafts(s,'owner','project','file')).toEqual([])
  expect(validCollaborationDraftPayload({...base.payload,inFlight:{id:id(3),update:'invalid'}})).toBe(false)
  expect(validCollaborationDraftPayload({...base.payload,source:'x'.repeat(1024*1024+1)})).toBe(false)
  expect(validCollaborationDraftPayload({...base.payload,role:'viewer'})).toBe(false)
  expect(validCollaborationDraftPayload({...base.payload,inFlight:undefined})).toBe(false)
  expect(validCollaborationDraftPayload({...base.payload,replayable:false,inFlight:undefined})).toBe(true)
  expect(()=>encodeDraftUpdate(new Uint8Array(256*1024+1))).toThrow()
  expect(decodeDraftUpdate(encodeDraftUpdate(Uint8Array.from([0,1,255])))).toEqual(Uint8Array.from([0,1,255]))
  for(let i=1;i<=10;i++)writeCollaborationDraft(s,{...base,writerId:id(i)})
  expect(()=>writeCollaborationDraft(s,{...base,writerId:id(11)})).toThrow()
  expect(listCollaborationDrafts(s,'owner','project','file')).toHaveLength(10)
 })
})
