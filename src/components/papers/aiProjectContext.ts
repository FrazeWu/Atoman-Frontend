import type {PaperFile} from '@/api/papers'
import {paperAIBytes} from './aiSuggestion'

export interface ContextCandidate {file:PaperFile;score:number;reasons:string[]}
export function literalTexReferences(text:string){
 // Comments, macro-generated paths and optional arguments are not interpreted.
 const result:{name:string;kind:'tex'|'bib'|'graphic'}[]=[]
 const re=/\\(input|include|bibliography|addbibresource|includegraphics)\*?(?:\s*\[[^\]\r\n]*\])?\s*\{([^{}\r\n]+)\}/g
 const cleaned=text.replace(/(^|[^\\])%[^\r\n]*/g,'$1')
 for(const m of cleaned.matchAll(re)){
  const kind=m[1]==='bibliography'||m[1]==='addbibresource'?'bib':m[1]==='includegraphics'?'graphic':'tex'
  for(const name of m[2]!.split(',').map(s=>s.trim())){
   if(name&&!/[\\{}#$~]/.test(name)&&!name.startsWith('/')&&!name.split('/').includes('..'))result.push({name,kind})
  }
  if(result.length>=500)break
 }
 return result
}
export function matchesTexReference(path:string,from:string,name:string,kind:'tex'|'bib'|'graphic'){
 const dir=from.includes('/')?from.slice(0,from.lastIndexOf('/')+1):''
 const normalized=name.replace(/^\.\//,'')
 const bases=[normalized,dir+normalized]
 const suffixes=kind==='tex'?['','.tex']:kind==='bib'?['','.bib']:['','.pdf','.png','.jpg','.jpeg','.eps']
 return bases.some(base=>suffixes.some(s=>path===base+s))
}
function terms(text:string){
 const normalized=text.toLowerCase()
 const words=normalized.match(/[a-z0-9_-]{3,40}/g)||[]
 const han=normalized.match(/\p{Script=Han}{2,}/gu)||[]
 const grams=han.flatMap(word=>Array.from(word).slice(0,40).map((c,i,a)=>i+1<a.length?c+a[i+1]:c)).filter(x=>x.length>=2)
 return [...new Set([...words.filter(w=>!['the','and','for','this','with','from','please','paper','file','text','change','using','into','that','your','latex'].includes(w)),...grams])].slice(0,32)
}
export function rankProjectContext(files:PaperFile[],current:PaperFile,instruction:string,diagnostics=''){
 const query=terms(instruction+' '+diagnostics)
 const activeRefs=literalTexReferences(current.content)
 const out:ContextCandidate[]=[]
 for(const f of files){
  if(f.id===current.id||f.kind!=='text')continue
  const reasons:string[]=[]
  let score=0
  const add=(n:number,label:string)=>{score+=n;reasons.push(label)}
  if(activeRefs.some(ref=>matchesTexReference(f.path,current.path,ref.name,ref.kind)))add(30,'当前文件直接引用')
  if(literalTexReferences(f.content).some(ref=>matchesTexReference(current.path,f.path,ref.name,ref.kind)))add(24,'引用当前文件的章节或主文件')
  if(diagnostics&&diagnostics.includes(f.path))add(45,'编译诊断涉及')
  if(instruction.toLowerCase().includes(f.path.toLowerCase()))add(35,'任务明确提到文件')
  const path=f.path.toLowerCase(),content=f.content.toLowerCase()
  const hits=query.filter(term=>path.includes(term))
  const contentHits=query.filter(term=>content.includes(term))
  if(hits.length)add(Math.min(24,hits.length*8),'文件名匹配 '+hits.slice(0,4).join('、'))
  if(contentHits.length)add(Math.min(18,contentHits.length*3),'源码匹配 '+contentHits.slice(0,4).join('、'))
  if(/(?:citation|reference|bibtex|bibliography|引用|文献)/i.test(instruction)&&/\.bib$/i.test(f.path))add(20,'参考文献文件')
  if(score>0)out.push({file:f,score,reasons})
 }
 return out.sort((a,b)=>b.score-a.score||a.file.path.localeCompare(b.file.path))
}
export function chooseProjectContext(candidates:ContextCandidate[],maxFiles:number,maxBytes:number){
 const selected:ContextCandidate[]=[]
 let bytes=0
 for(const c of candidates){
  if(selected.length>=Math.min(4,maxFiles))break
  const size=paperAIBytes(c.file.content)
  if(size>32768||bytes+size>maxBytes)continue
  selected.push(c);bytes+=size
 }
 return selected
}
