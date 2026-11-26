import type {PaperFile} from '@/api/papers'
const TAB_LIMIT=8
export function rememberPaperTab(ids:readonly string[],id:string){
 if(ids.includes(id))return [...ids]
 return [...ids.slice(-(TAB_LIMIT-1)),id]
}
export function rankPaperFiles(files:readonly PaperFile[],query:string,recent:readonly string[]){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean)
 const raw=terms.join(' ')
 return files.filter(f=>terms.every(term=>f.path.toLowerCase().includes(term))).map(file=>{
  const path=file.path.toLowerCase(),name=path.split('/').at(-1)||path,i=recent.indexOf(file.id)
  const score=raw?(path===raw||name===raw?400:name.startsWith(raw)?300:path.startsWith(raw)?200:100):0
  return {file,score,recent:i===-1?Number.MAX_SAFE_INTEGER:i}
 }).sort((a,b)=>b.score-a.score||a.recent-b.recent||a.file.path.localeCompare(b.file.path)).map(row=>row.file).slice(0,64)
}
