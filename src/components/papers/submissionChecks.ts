import type {PaperFile,PaperSnapshotEntry} from '@/api/papers'
import {bibtexReferences} from './projectTools'
import {literalTexReferences,matchesTexReference} from './aiProjectContext'

export interface SubmissionFinding {kind:'warning'|'review';code:string;path:string;line?:number;message:string}
export function checkSubmissionSource(sources:PaperFile[],manifest:PaperFile[],anonymous:boolean){
 const findings:SubmissionFinding[]=[]
 const add=(code:string,path:string,line:number|undefined,message:string,kind:'warning'|'review'='warning')=>{
  if(findings.length<200)findings.push({code,path,line,message,kind})
 }
 const bib=bibtexReferences(sources),keys=new Set<string>(),labels=new Set<string>()
 for(const entry of bib){
  if(keys.has(entry.key))add('duplicate_citation',entry.path,entry.line,'重复 BibTeX 键：'+entry.key)
  keys.add(entry.key)
 }
 const tex=sources.filter(f=>/\.tex$/i.test(f.path))
 const cleaned=tex.map(f=>({file:f,text:f.content.replace(/(^|[^\\])%[^\r\n]*/g,'$1')}))
 const line=(text:string,index:number)=>text.slice(0,index).split('\n').length
 for(const {file,text} of cleaned){
  for(const match of text.matchAll(/\\label\s*\{([^{}\s\\]+)\}/g)){
   const key=match[1]!
   if(labels.has(key))add('duplicate_label',file.path,line(text,match.index),'重复标签：'+key)
   labels.add(key)
  }
 }
 for(const {file,text} of cleaned){
  for(const match of text.matchAll(/\\(?:cite|citep|citet|parencite|textcite|autocite|nocite|citeauthor|citeyear)\*?(?:\s*\[[^\]\r\n]*\]){0,2}\s*\{([^{}\r\n]+)\}/g)){
   for(const key of match[1]!.split(',').map(s=>s.trim())){
    if(key&&key!=='*'&&!/[\\#$]/.test(key)&&!keys.has(key))add('citation_not_found',file.path,line(text,match.index),'未在项目 .bib 中找到引用键：'+key+'（需核对内嵌文献或宏）','review')
   }
  }
  for(const match of text.matchAll(/\\(?:ref|eqref|pageref|autoref|cref|Cref)\*?\s*\{([^{}\r\n]+)\}/g)){
   for(const key of match[1]!.split(',').map(s=>s.trim())){
    if(key&&!/[\\#$]/.test(key)&&!labels.has(key))add('label_not_found',file.path,line(text,match.index),'未找到静态标签：'+key+'（需核对宏生成标签）','review')
   }
  }
  for(const ref of literalTexReferences(text)){
   if(!manifest.some(f=>matchesTexReference(f.path,file.path,ref.name,ref.kind))){
    add('reference_path',file.path,undefined,'未找到直接引用的 '+ref.kind+' 路径：'+ref.name+'（可能由搜索路径或外部宏解析）','review')
   }
  }
  for(const match of text.matchAll(/\b(?:TODO|FIXME|TBD)\b|待补充|待修改|Your Paper Title|Replace this paragraph/g)){
   add('placeholder',file.path,line(text,match.index),'发现可能未完成的占位内容：'+match[0],'review')
  }
  if(anonymous){
   for(const match of text.matchAll(/\\(?:author|affiliation|institute|thanks|email)\s*(?:\[[^\]\r\n]*\])?\s*\{([^{}\r\n]+)\}/g)){
    if(!/^(anonymous(?: authors?)?|匿名作者|匿名)$/i.test(match[1]!.trim()))add('author_field',file.path,line(text,match.index),'存在作者、单位、致谢或邮箱字段，请检查匿名性。','review')
   }
   for(const match of text.matchAll(/\\(?:section\*?\s*\{(?:Acknowledg(?:e)?ments?|致谢)\}|begin\s*\{acknowledgments?\})/gi)){
    add('acknowledgments',file.path,line(text,match.index),'存在致谢区域，请确认匿名投稿是否允许。','review')
   }
  }
 }
 return {findings,texCount:tex.length,bibCount:bib.length,truncated:findings.length>=200}
}
export interface SnapshotDifference {path:string;kind:'added'|'removed'|'renamed'|'changed';oldPath?:string;before?:number;after?:number;contentChanged?:boolean}
export function compareSnapshotManifests(before:readonly PaperSnapshotEntry[],after:readonly PaperSnapshotEntry[]){
 const left=new Map(before.map(f=>[f.file_id,f])),right=new Map(after.map(f=>[f.file_id,f]))
 const changes:SnapshotDifference[]=[]
 for(const f of before){
  const next=right.get(f.file_id)
  if(!next)changes.push({kind:'removed',path:f.path,before:f.revision})
  else if(next.path!==f.path)changes.push({kind:'renamed',path:next.path,oldPath:f.path,before:f.revision,after:next.revision,contentChanged:next.sha256!==f.sha256})
  else if(next.sha256!==f.sha256||next.kind!==f.kind)changes.push({kind:'changed',path:f.path,before:f.revision,after:next.revision,contentChanged:true})
 }
 for(const f of after)if(!left.has(f.file_id))changes.push({kind:'added',path:f.path,after:f.revision})
 return changes.sort((a,b)=>a.path.localeCompare(b.path)||a.kind.localeCompare(b.kind))
}
