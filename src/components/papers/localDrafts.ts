/** Opt-in, plaintext browser backup of unsaved source only. No network I/O. */
const namespace='atoman.papers.local-draft.v1:'
const preferences='atoman.papers.local-draft-enabled.v1:'
const maxBytes=1024*1024
const maxRecords=20
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value)
export interface PaperLocalDraft {
 version:1
 owner:string
 projectId:string
 fileId:string
 writerId:string
 path:string
 baseRevision:number
 baseSHA:string
 content:string
 updatedAt:number
}
const prefix=(owner:string,projectId:string)=>namespace+owner+':'+projectId+':'
export const draftKey=(d:PaperLocalDraft)=>prefix(d.owner,d.projectId)+d.fileId+':'+d.writerId
const validScope=(owner:string,pid:string)=>validId(owner)&&validId(pid)
function validDraft(value:unknown):value is PaperLocalDraft{
 if(!value||typeof value!=='object')return false
 const d=value as Partial<PaperLocalDraft>
 return d.version===1&&validId(d.owner)&&validId(d.projectId)&&validId(d.fileId)&&validId(d.writerId)&&
  typeof d.path==='string'&&d.path.length>0&&d.path.length<=512&&Number.isSafeInteger(d.baseRevision)&&d.baseRevision!>0&&
  typeof d.baseSHA==='string'&&d.baseSHA.length<=64&&typeof d.content==='string'&&d.content.length<=maxBytes&&
  !d.content.includes('\0')&&new TextEncoder().encode(d.content).byteLength<=maxBytes&&
  typeof d.updatedAt==='number'&&Number.isFinite(d.updatedAt)&&d.updatedAt>0
}
function parse(value:string|null):PaperLocalDraft|null{
 if(!value||value.length>maxBytes*6+4096)return null
 try{const d:unknown=JSON.parse(value);return validDraft(d)?d:null}catch{return null}
}
export function localDraftEnabled(storage:Storage,owner:string):boolean{
 return validId(owner)&&storage.getItem(preferences+owner)==='1'
}
export function setLocalDraftEnabled(storage:Storage,owner:string,enabled:boolean){
 if(!validId(owner))throw new Error('Missing verified account')
 if(enabled)storage.setItem(preferences+owner,'1')
 else storage.removeItem(preferences+owner)
}
export function listLocalDrafts(storage:Storage,owner:string,pid:string):PaperLocalDraft[]{
 if(!validScope(owner,pid))return []
 const rows:PaperLocalDraft[]=[]
 const start=prefix(owner,pid)
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i)
  if(!key?.startsWith(start))continue
  const row=parse(storage.getItem(key))
  if(row&&row.owner===owner&&row.projectId===pid&&draftKey(row)===key)rows.push(row)
 }
 return rows.sort((a,b)=>b.updatedAt-a.updatedAt||draftKey(a).localeCompare(draftKey(b)))
}
export function writeLocalDraft(storage:Storage,row:PaperLocalDraft){
 if(!validDraft(row))throw new Error('Draft exceeds local limits or is invalid')
 const key=draftKey(row)
 if(!storage.getItem(key)&&listLocalDrafts(storage,row.owner,row.projectId).length>=maxRecords)
  throw new Error('Local draft limit reached')
 // Independent writer IDs prevent one editing window replacing another's copy.
 storage.setItem(key,JSON.stringify(row))
}
export function readLocalDraft(storage:Storage,row:PaperLocalDraft):PaperLocalDraft|null{
 const saved=parse(storage.getItem(draftKey(row)))
 return saved&&draftKey(saved)===draftKey(row)?saved:null
}
export function sameLocalDraft(a:PaperLocalDraft|null,b:PaperLocalDraft):boolean{
 return !!a&&draftKey(a)===draftKey(b)&&a.path===b.path&&a.baseRevision===b.baseRevision&&a.baseSHA===b.baseSHA&&a.content===b.content&&a.updatedAt===b.updatedAt
}
export function removeLocalDraft(storage:Storage,row:PaperLocalDraft):boolean{
 if(!sameLocalDraft(readLocalDraft(storage,row),row))return false
 storage.removeItem(draftKey(row));return true
}
export function matchesLocalDraftBase(row:PaperLocalDraft,file:{id:string;path:string;revision:number;sha256:string;kind:string}):boolean{
 return file.kind==='text'&&file.id===row.fileId&&file.path===row.path&&file.revision===row.baseRevision&&file.sha256===row.baseSHA
}
