import {describe,expect,it} from 'vitest'
import {draftKey,listLocalDrafts,localDraftEnabled,setLocalDraftEnabled,writeLocalDraft,removeLocalDraft,matchesLocalDraftBase,type PaperLocalDraft} from '@/components/papers/localDrafts'
function memoryStorage():Storage{
 const rows=new Map<string,string>()
 return {get length(){return rows.size},key:i=>Array.from(rows.keys())[i]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>{rows.set(key,value)},removeItem:key=>{rows.delete(key)},clear:()=>rows.clear()}
}
const base:PaperLocalDraft={version:1,owner:'owner',projectId:'project',fileId:'file',writerId:'tab-a',path:'main.tex',baseRevision:1,baseSHA:'a'.repeat(64),content:'source',updatedAt:10}
describe('Papers private browser draft vault',()=>{
 it('isolates projects, owners and editing windows, with protection off by default',()=>{
  const storage=memoryStorage()
  expect(localDraftEnabled(storage,'owner')).toBe(false)
  setLocalDraftEnabled(storage,'owner',true)
  expect(localDraftEnabled(storage,'owner')).toBe(true)
  expect(localDraftEnabled(storage,'other')).toBe(false)
  for(const row of [base,{...base,writerId:'tab-b',content:'other window'},{...base,owner:'other'},{...base,projectId:'other'}])writeLocalDraft(storage,row)
  expect(listLocalDrafts(storage,'owner','project').map(r=>r.content).sort()).toEqual(['other window','source'])
  expect(listLocalDrafts(storage,'other','project')).toHaveLength(1)
  setLocalDraftEnabled(storage,'owner',false)
  expect(listLocalDrafts(storage,'owner','project')).toHaveLength(2)
 })
 it('removes only the exact acknowledged draft and checks base revision and digest',()=>{
  const storage=memoryStorage()
  writeLocalDraft(storage,base)
  const changed={...base,content:'newest',updatedAt:11}
  writeLocalDraft(storage,changed)
  expect(removeLocalDraft(storage,base)).toBe(false)
  expect(listLocalDrafts(storage,'owner','project')[0]!.content).toBe('newest')
  expect(matchesLocalDraftBase(changed,{id:'file',path:'main.tex',kind:'text',revision:1,sha256:base.baseSHA})).toBe(true)
  expect(matchesLocalDraftBase(changed,{id:'file',path:'main.tex',kind:'text',revision:2,sha256:base.baseSHA})).toBe(false)
  expect(removeLocalDraft(storage,changed)).toBe(true)
 })
 it('rejects forged cross-owner records, oversized drafts and excessive backups without evicting old edits',()=>{
  const storage=memoryStorage()
  storage.setItem(draftKey(base),JSON.stringify({...base,owner:'other'}))
  expect(listLocalDrafts(storage,'owner','project')).toEqual([])
  expect(()=>writeLocalDraft(storage,{...base,content:'x'.repeat(1024*1024+1)})).toThrow()
  for(let i=0;i<20;i++)writeLocalDraft(storage,{...base,writerId:'writer-'+i})
  expect(()=>writeLocalDraft(storage,{...base,writerId:'overflow'})).toThrow()
  expect(listLocalDrafts(storage,'owner','project')).toHaveLength(20)
 })
})
