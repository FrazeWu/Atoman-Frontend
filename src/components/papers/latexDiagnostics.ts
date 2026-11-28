import type {Diagnostic} from '@codemirror/lint'
import type {PaperFile} from '@/api/papers'
import {latexCode,latexSymbolsFromCode,MAX_LATEX_SYMBOLS,isLatexSymbolFile,type LatexFile} from './latexSymbols'
import {bibtexReferences} from './projectTools'

export const MAX_LINT_SOURCE=1024*1024
export const MAX_LINT_ISSUES=80
const MAX_CATALOG_KEYS=24000
export type LatexIssue=Diagnostic&{code:string}
export interface ReferenceCatalog{
 labels:readonly string[]
 citations:readonly string[]
 truncated:boolean
}
export interface LatexLintResult{issues:LatexIssue[];skipped:boolean;truncated:boolean}
export interface LatexLintOptions{path?:string;files?:readonly LatexFile[];catalog?:ReferenceCatalog|null}

export function lintSupported(path:string|undefined){return !path||/\.(tex|ltx)$/i.test(path)}
const literalKey=/^[^\\{}\s,%#$&^~\u0000-\u001f\u007f]{1,180}$/u
const referenceCommand=/^(?:ref|eqref|pageref|autoref|nameref|cref|Cref|vref|Vref)$/
const citationCommand=/^(?:cite[A-Za-z]*|Cite[A-Za-z]*|parencite|textcite|autocite|nocite|footcite|smartcite)$/
const fileCommand=/^(?:input|include|subfile|bibliography|addbibresource)$/
const arg=/^\s*(?:\[[^\]\r\n]{0,512}\]\s*){0,2}\{([^{}\r\n]{0,512})\}/
const environmentArg=/^\s*\{([A-Za-z@][A-Za-z0-9@*_-]{0,99})\}/

/** Catalog of literal symbols in other verified project files. It is not a TeX
 * expansion engine: missing static definitions are advisory, never fatal. */
export function buildReferenceCatalog(files:readonly PaperFile[]):ReferenceCatalog{
 const labels=new Set<string>(),citations=new Set<string>()
 let truncated=false
 for(const file of files){
  if(!isLatexSymbolFile(file))continue
  if(file.content.length>MAX_LINT_SOURCE){truncated=true;continue}
  const symbols=latexSymbolsFromCode(latexCode(file.content),file.path)
  if(symbols.length>=MAX_LATEX_SYMBOLS)truncated=true
  for(const row of symbols){
   if(labels.size+citations.size>=MAX_CATALOG_KEYS){truncated=true;break}
   if(row.kind==='label')labels.add(row.name)
   if(row.kind==='citation')citations.add(row.name)
  }
 }
 const refs=bibtexReferences(files)
 if(refs.length>=2000)truncated=true
 for(const row of refs){
  if(labels.size+citations.size>=MAX_CATALOG_KEYS){truncated=true;break}
  citations.add(row.key)
 }
 return {labels:[...labels],citations:[...citations],truncated}
}

export function lintLatex(source:string,options:LatexLintOptions={}):LatexLintResult{
 if(!lintSupported(options.path)||source.length>MAX_LINT_SOURCE)return {issues:[],skipped:true,truncated:false}
 const clean=latexCode(source,true)
 const issues:LatexIssue[]=[]
 let truncated=false
 const add=(code:string,from:number,to:number,message:string,severity:'warning'|'error'='warning')=>{
  if(issues.length>=MAX_LINT_ISSUES){truncated=true;return}
  issues.push({code,from,to:Math.min(source.length,Math.max(from+1,to)),message,severity,source:'源码静态检查'})
 }
 const braces:number[]=[],environments:{name:string;from:number;to:number}[]=[]
 const labels=new Set<string>(),citations=new Set<string>()
 const refs:{kind:'label'|'citation';key:string;from:number;to:number}[]=[]
 const files=options.files?.length?new Set(options.files.map(f=>f.path)):null
 const directory=options.path?.includes('/')?options.path.slice(0,options.path.lastIndexOf('/')+1):''
 const token=/\\(?:[A-Za-z@]+\*?|[^\r\n])|[{}]/g
 let m:RegExpExecArray|null
 while((m=token.exec(clean))){
  const word=m[0],from=m.index,end=token.lastIndex
  if(word==='{'){braces.push(from);continue}
  if(word==='}'){
   if(braces.length)braces.pop()
   else add('extra-brace',from,end,'右花括号没有匹配的左花括号。','error')
   continue
  }
  if(word[0]!=='\\')continue
  const name=word.slice(1).replace(/\*$/,'')
  if(name==='begin'||name==='end'){
   const match=environmentArg.exec(clean.slice(end,end+640))
   if(!match)continue
   const env=match[1]!,to=end+match[0].length
   token.lastIndex=to
   if(name==='begin')environments.push({name:env,from,to})
   else{
    const opening=environments.pop()
    if(!opening)add('extra-environment-end',from,to,'环境 '+env+' 没有在此文件中找到开始标记。')
    else if(opening.name!==env){
     add('mismatched-environment',from,to,'环境结束标记不匹配：预期 '+opening.name+'，实际 '+env+'。','error')
     // Recover from a missing inner end without producing a cascade.
     for(let i=environments.length-1;i>=Math.max(0,environments.length-64);i--){
      if(environments[i]!.name===env){environments.splice(i);break}
     }
    }
   }
   continue
  }
  const kind=name==='label'||referenceCommand.test(name)?'label':name==='bibitem'||citationCommand.test(name)?'citation':null
  if(!kind&&!fileCommand.test(name))continue
  const match=arg.exec(clean.slice(end,end+1800))
  if(!match)continue
  const raw=match[1]!,start=end+match[0].lastIndexOf('{')+1
  // Masked comments can occupy spaces inside an argument. Do not diagnose
  // dynamic or multiline arguments that require TeX token expansion.
  if(clean.slice(start,start+raw.length)!==source.slice(start,start+raw.length))continue
  if(kind){
   if(!raw.trim()){add('empty-reference',from,end+match[0].length,'引用或定义的键为空。');continue}
   let cursor=0
   for(const part of (name==='label'||name==='bibitem'?[raw]:raw.split(','))){
    const key=part.trim(),at=start+cursor+part.length-part.trimStart().length
    cursor+=part.length+1
    if(!literalKey.test(key)||key==='*')continue
    if(name==='label'){
     if(labels.has(key))add('duplicate-label',at,at+key.length,'当前文件重复定义标签 '+key+'。')
     labels.add(key)
    }else if(name==='bibitem'){
     if(citations.has(key))add('duplicate-bibitem',at,at+key.length,'当前文件重复定义文献键 '+key+'。')
     citations.add(key)
    }else if(refs.length<MAX_CATALOG_KEYS)refs.push({kind,key,from:at,to:at+key.length})
    else truncated=true
   }
  }else if(files&&raw.trim()){
   let cursor=0
   for(const part of raw.split(',')){
    const key=part.trim(),at=start+cursor+part.length-part.trimStart().length
    cursor+=part.length+1
    if(!key||key.length>256||key.startsWith('/')||key.split('/').includes('..')||/[\\{}%#$&^~\r\n]/.test(key))continue
    const relative=key.replace(/^\.\//,'')
    const names=[relative,directory+relative]
    const ext=name==='bibliography'||name==='addbibresource'?'.bib':'.tex'
    if(!/\.[^/]+$/.test(relative))names.push(relative+ext,directory+relative+ext)
    if(!names.some(candidate=>files.has(candidate)))add('missing-project-file',at,at+key.length,'项目文件列表中未找到 '+key+'；请检查路径、大小写或外部资源设置。')
   }
  }
 }
 // Opening tokens may be completed by an included file or a macro, hence
 // unfinished constructs are warnings rather than definitive compile errors.
 for(const from of braces){
  if(issues.length>=MAX_LINT_ISSUES){truncated=true;break}
  add('unclosed-brace',from,from+1,'左花括号在此文件中尚未找到匹配的右花括号。')
 }
 for(const row of environments){
  if(issues.length>=MAX_LINT_ISSUES){truncated=true;break}
  add('unclosed-environment',row.from,row.to,'环境 '+row.name+' 在此文件中尚未找到结束标记。')
 }
 if(options.catalog&&!options.catalog.truncated){
  const externalLabels=new Set(options.catalog.labels),externalCitations=new Set(options.catalog.citations)
  for(const row of refs){
   if(issues.length>=MAX_LINT_ISSUES){truncated=true;break}
   const known=row.kind==='label'?labels.has(row.key)||externalLabels.has(row.key):citations.has(row.key)||externalCitations.has(row.key)
   if(!known)add(row.kind==='label'?'unknown-label':'unknown-citation',row.from,row.to,'项目静态索引中未找到'+(row.kind==='label'?'标签 ':'文献键 ')+row.key+'；可能由宏、外部文件或编译过程生成。')
  }
 }
 return {issues:issues.sort((a,b)=>a.from-b.from||a.to-b.to),skipped:false,truncated}
}
