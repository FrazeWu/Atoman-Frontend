import type {PaperFile} from '@/api/papers'
import {paperAIBytes} from './aiSuggestion'

export const PROJECT_READ_LIMIT=4*1024*1024
export function projectFileFence(files:readonly PaperFile[]){
 return JSON.stringify(files.map(f=>[f.id,f.path,f.kind,f.revision,f.sha256]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))
}
/** Read only saved, project-scoped text. Never forward it to a model here. */
export async function readProjectText(files:readonly PaperFile[],revision:number,read:(id:string)=>Promise<PaperFile>,valid:()=>boolean){
 if(files.length>100||!Number.isSafeInteger(revision)||revision<=0)throw Error('Invalid project')
 const targets=files.filter(f=>f.kind==='text')
 const out:PaperFile[]=[]
 let bytes=0
 for(let i=0;i<targets.length;i+=4){
  if(!valid())throw Error('Project changed')
  const batch=targets.slice(i,i+4)
  const loaded=await Promise.all(batch.map(f=>read(f.id)))
  if(!valid())throw Error('Project changed')
  for(const [index,file] of loaded.entries()){
   const expected=batch[index]!
   if(!file||file.id!==expected.id||file.path!==expected.path||file.kind!=='text'||file.revision!==expected.revision||(expected.sha256&&file.sha256!==expected.sha256)||(file.project_head_revision!==undefined&&file.project_head_revision!==revision)||typeof file.content!=='string')throw Error('Project changed')
   const size=paperAIBytes(file.content)
   if(size>1024*1024||(bytes+=size)>PROJECT_READ_LIMIT)throw Error('Project exceeds local scan limit')
   out.push(file)
  }
 }
 return out
}
