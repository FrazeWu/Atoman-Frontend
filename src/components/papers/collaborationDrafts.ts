// Optional plaintext backup of unacknowledged collaboration updates.
// This vault is separate from the ordinary full-text draft/save pipeline.
const namespace='atoman.papers.collab-draft.v1:'
const preferences='atoman.papers.collab-draft-enabled.v1:'
const maxText=1024*1024
const maxUpdate=256*1024
const maxRecords=10
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v)
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)&&v!=='00000000-0000-0000-0000-000000000000'
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0

export interface CollaborationDraftPayload{
 epoch:string
 role:'owner'|'editor'
 sequence:number
 fileRevision:number
 projectRevision:number
 source:string
 replayable:boolean
 inFlight?:{id:string;update:string}
 queued?:string
}
export interface PaperCollaborationDraft{
 version:1
 owner:string
 projectId:string
 fileId:string
 writerId:string
 path:string
 updatedAt:number
 payload:CollaborationDraftPayload
}
export function encodeDraftUpdate(value:Uint8Array):string{
 if(!value.length||value.length>maxUpdate)throw Error('invalid draft update length')
 let s=''
 for(let i=0;i<value.length;i+=8192)s+=String.fromCharCode(...value.subarray(i,i+8192))
 return btoa(s)
}
export function decodeDraftUpdate(value:unknown):Uint8Array{
 if(typeof value!=='string'||!value.length||value.length>4*Math.ceil(maxUpdate/3)||value.length%4)throw Error('invalid draft update')
 const raw=atob(value)
 if(!raw.length||raw.length>maxUpdate||btoa(raw)!==value)throw Error('invalid draft update')
 return Uint8Array.from(raw,c=>c.charCodeAt(0))
}
export function validCollaborationDraftPayload(value:unknown):value is CollaborationDraftPayload{
 if(!value||typeof value!=='object')return false
 const d=value as Partial<CollaborationDraftPayload>
 if(!uuid(d.epoch)||(d.role!=='owner'&&d.role!=='editor')||!positive(d.sequence)||
  !positive(d.fileRevision)||!positive(d.projectRevision)||typeof d.source!=='string'||
  d.source.length>maxText||d.source.includes(String.fromCharCode(0))||new TextEncoder().encode(d.source).byteLength>maxText||
  typeof d.replayable!=='boolean')return false
 try{
  if(d.inFlight!==undefined){
   if(!d.inFlight||!uuid(d.inFlight.id))return false
   decodeDraftUpdate(d.inFlight.update)
  }
  if(d.queued!==undefined)decodeDraftUpdate(d.queued)
  if(d.replayable&&!d.inFlight&&!d.queued)return false
  return true
 }catch{return false}
}
function validDraft(value:unknown):value is PaperCollaborationDraft{
 if(!value||typeof value!=='object')return false
 const d=value as Partial<PaperCollaborationDraft>
 return d.version===1&&validId(d.owner)&&validId(d.projectId)&&validId(d.fileId)&&uuid(d.writerId)&&
  typeof d.path==='string'&&d.path.length>0&&d.path.length<=512&&positive(d.updatedAt)&&validCollaborationDraftPayload(d.payload)
}
function parse(raw:string|null):PaperCollaborationDraft|null{
 if(!raw||raw.length>maxText*6+maxUpdate*3+8192)return null
 try{const row:unknown=JSON.parse(raw);return validDraft(row)?row:null}catch{return null}
}
const prefix=(owner:string,projectId:string)=>namespace+owner+':'+projectId+':'
export const collabDraftKey=(row:PaperCollaborationDraft)=>prefix(row.owner,row.projectId)+row.fileId+':'+row.writerId
export function collaborationDraftEnabled(storage:Storage,owner:string):boolean{
 return validId(owner)&&storage.getItem(preferences+owner)==='1'
}
export function setCollaborationDraftEnabled(storage:Storage,owner:string,enabled:boolean){
 if(!validId(owner))throw Error('missing authenticated account')
 if(enabled)storage.setItem(preferences+owner,'1')
 else storage.removeItem(preferences+owner)
}
export function listCollaborationDrafts(storage:Storage,owner:string,projectId:string,fileId:string):PaperCollaborationDraft[]{
 if(!validId(owner)||!validId(projectId)||!validId(fileId))return []
 const start=prefix(owner,projectId)+fileId+':'
 const rows:PaperCollaborationDraft[]=[]
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i)
  if(!key?.startsWith(start))continue
  const row=parse(storage.getItem(key))
  if(row&&row.owner===owner&&row.projectId===projectId&&row.fileId===fileId&&collabDraftKey(row)===key)rows.push(row)
 }
 return rows.sort((a,b)=>b.updatedAt-a.updatedAt||collabDraftKey(a).localeCompare(collabDraftKey(b)))
}
export function writeCollaborationDraft(storage:Storage,row:PaperCollaborationDraft){
 if(!validDraft(row))throw Error('invalid or oversized collaboration draft')
 const key=collabDraftKey(row)
 if(!storage.getItem(key)){
  let count=0
  const start=prefix(row.owner,row.projectId)
  for(let i=0;i<storage.length;i++)if(storage.key(i)?.startsWith(start))count++
  if(count>=maxRecords)throw Error('collaboration draft limit reached')
 }
 storage.setItem(key,JSON.stringify(row))
}
export function sameCollaborationDraft(storage:Storage,row:PaperCollaborationDraft):boolean{
 return validDraft(row)&&storage.getItem(collabDraftKey(row))===JSON.stringify(row)
}
export function removeCollaborationDraft(storage:Storage,row:PaperCollaborationDraft):boolean{
 if(!sameCollaborationDraft(storage,row))return false
 storage.removeItem(collabDraftKey(row))
 return true
}
