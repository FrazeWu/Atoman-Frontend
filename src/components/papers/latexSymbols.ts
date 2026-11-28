import type {PaperFile} from '@/api/papers'

export type LatexSymbolKind='label'|'command'|'environment'|'citation'
export interface LatexSymbol {kind:LatexSymbolKind;name:string;path:string}
export type LatexFile=Pick<PaperFile,'id'|'path'|'kind'|'revision'|'sha256'>
export const MAX_LATEX_SYMBOLS=4000
const MAX_INDEX_SYMBOLS=16000
const MAX_FILE_BYTES=1024*1024
const MAX_PROJECT_BYTES=4*MAX_FILE_BYTES
const sourcePath=/\.(tex|sty|cls|ltx|dtx|ins|def|cfg)$/i
const literalEnvironment=/^(verbatim\*?|Verbatim\*?|lstlisting|minted|comment)$/
const keyPattern=/^[^\\{}\s,%#$&^~\u0000-\u001f\u007f]+$/u
const commandPattern=/^[A-Za-z@]+$/
const environmentPattern=/^[A-Za-z@][A-Za-z0-9@*_-]*$/

// Mask comments and literal text while preserving offsets and line breaks.
// This is a bounded static scanner, not a TeX interpreter.
export function latexCode(source:string,preserveLiteralBoundaries=false):string{
 const parts:string[]=[]
 const token=/\\(?:[A-Za-z@]+\*?|[^\r\n])|%/g
 let cursor=0
 let match:RegExpExecArray|null
 while((match=token.exec(source))){
  const start=match.index,word=match[0]
  let end=token.lastIndex
  if(word==='%'){
   const newline=source.indexOf('\n',end)
   end=newline<0?source.length:newline
  }else if(word==='\\verb'||word==='\\verb*'){
   const delimiter=source[end]
   if(!delimiter||/\s/.test(delimiter))continue
   const newline=source.indexOf('\n',end+1)
   const limit=newline<0?source.length:newline
   const offset=source.slice(end+1,limit).indexOf(delimiter)
   end=offset>=0?end+1+offset+1:limit
  }else if(word==='\\begin'){
   const begin=/^\s*\{([^{}\r\n]+)\}/.exec(source.slice(end,end+100))
   if(!begin||!literalEnvironment.test(begin[1]!))continue
   const marker='\\end{'+begin[1]+'}'
   const bodyStart=end+begin[0].length
   const close=source.indexOf(marker,bodyStart)
   end=close<0?source.length:close+marker.length
   if(preserveLiteralBoundaries){
    parts.push(source.slice(cursor,bodyStart),source.slice(bodyStart,close<0?source.length:close).replace(/[^\r\n]/g,' '))
    if(close>=0)parts.push(source.slice(close,end))
    cursor=end;token.lastIndex=end
    continue
   }
  }else continue
  parts.push(source.slice(cursor,start),source.slice(start,end).replace(/[^\r\n]/g,' '))
  cursor=end
  token.lastIndex=end
 }
 parts.push(source.slice(cursor))
 return parts.join('')
}

export function latexSymbols(source:string,path:string):LatexSymbol[]{
 return source.length<=MAX_FILE_BYTES?latexSymbolsFromCode(latexCode(source),path):[]
}

export function latexSymbolsFromCode(text:string,path:string):LatexSymbol[]{
 if(text.length>MAX_FILE_BYTES)return []
 const out:LatexSymbol[]=[],seen=new Set<string>()
 const add=(kind:LatexSymbolKind,name:string|undefined,valid:RegExp)=>{
  if(!name||name.length>180||!valid.test(name)||out.length>=MAX_LATEX_SYMBOLS)return
  const key=kind+':'+name
  if(seen.has(key))return
  seen.add(key);out.push({kind,name,path})
 }
 const definitions=/\\(label|bibitem|(?:new|renew|provide)command|DeclareRobustCommand|DeclareMathOperator|(?:New|Renew|Provide|Declare)DocumentCommand|(?:new|renew)environment|newtheorem|(?:New|Renew|Provide|Declare)DocumentEnvironment)\*?\s*(?:\[[^\]\r\n]{0,512}\]\s*)?(?:\{\s*(\\?[A-Za-z@][A-Za-z0-9@*_:./+?=-]*|[^{}\r\n]{1,180})\s*\}|(\\[A-Za-z@]+))/g
 // Tokenize the leading backslash too so an escaped backslash cannot start
 // a declaration. Only literal names are accepted; expansion is not attempted.
 const escaped=(at:number)=>{let n=0;while(at>0&&text[--at]==='\\')n++;return n%2!==0}
 for(const m of text.matchAll(definitions)){
  if(out.length>=MAX_LATEX_SYMBOLS)break
  if(escaped(m.index))continue
  const type=m[1]!,name=(m[2]||m[3]||'').trim()
  if(type==='label')add('label',name,keyPattern)
  else if(type==='bibitem')add('citation',name,keyPattern)
  else if(/environment|theorem/i.test(type))add('environment',name,environmentPattern)
  else if(name.startsWith('\\'))add('command',name.slice(1),commandPattern)
 }
 for(const m of text.matchAll(/\\(?:gdef|edef|xdef|def)\s*\\([A-Za-z@]+)/g)){
  if(out.length>=MAX_LATEX_SYMBOLS)break
  if(!escaped(m.index))add('command',m[1],commandPattern)
 }
 return out
}

const signature=(f:LatexFile)=>JSON.stringify([f.id,f.path,f.kind,f.revision,f.sha256])
export function isLatexSymbolFile(file:LatexFile){return file.kind==='text'&&sourcePath.test(file.path)}

// Project-local, metadata-fenced index. Retain symbols only, not source
// bodies. Read at most four files concurrently and coalesce repeated queries.
export class ProjectLatexIndex{
 private rows=new Map<string,{signature:string;symbols:LatexSymbol[]}>()
 private pending=new Map<string,Promise<readonly LatexSymbol[]>>()
 private generation=0
 clear(){this.generation++;this.rows.clear();this.pending.clear()}
 remember(file:PaperFile){
  if(!isLatexSymbolFile(file)||typeof file.content!=='string'||file.content.length>MAX_FILE_BYTES)return
  const key=signature(file)
  if(this.rows.get(file.id)?.signature===key)return
  const symbols=latexSymbols(file.content,file.path)
  this.rows.delete(file.id)
  let total=0
  for(const row of this.rows.values())total+=row.symbols.length
  this.rows.set(file.id,{signature:key,symbols:symbols.slice(0,Math.max(0,MAX_INDEX_SYMBOLS-total))})
 }
 available(files:readonly LatexFile[],activeId?:string):readonly LatexSymbol[]{
  const current=new Map(files.map(f=>[f.id,signature(f)])),out:LatexSymbol[]=[]
  for(const [id,row] of this.rows)if(current.get(id)!==row.signature)this.rows.delete(id)
  for(const [id,row] of this.rows){
   if(id===activeId)continue
   for(const symbol of row.symbols){if(out.length>=MAX_INDEX_SYMBOLS)return out;out.push(symbol)}
  }
  return out
 }
 async ensure(files:readonly LatexFile[],activeId:string|undefined,read:(id:string)=>Promise<PaperFile>,valid:()=>boolean):Promise<readonly LatexSymbol[]>{
  if(!valid()||files.length>100)return []
  this.available(files,activeId)
  const targets=files.filter(f=>isLatexSymbolFile(f)&&f.id!==activeId&&this.rows.get(f.id)?.signature!==signature(f))
  if(!targets.length)return this.available(files,activeId)
  const key=JSON.stringify(targets.map(signature)),existing=this.pending.get(key)
  if(existing)return existing
  const generation=this.generation,stillValid=()=>generation===this.generation&&valid()
  const load=(async()=>{
   let bytes=0
   const encoder=new TextEncoder()
   for(let i=0;i<targets.length;i+=4){
    if(!stillValid())return []
    const batch=targets.slice(i,i+4),results=await Promise.allSettled(batch.map(f=>read(f.id)))
    if(!stillValid())return []
    for(const [j,result] of results.entries()){
     if(result.status!=='fulfilled')continue
     const file=result.value,expected=batch[j]!
     if(!file||signature(file)!==signature(expected)||typeof file.content!=='string'||file.content.length>MAX_FILE_BYTES)continue
     const size=encoder.encode(file.content).byteLength
     if(size>MAX_FILE_BYTES)continue
     if(bytes+size>MAX_PROJECT_BYTES)return this.available(files,activeId)
     bytes+=size
     this.remember(file)
    }
   }
   return stillValid()?this.available(files,activeId):[]
  })()
  this.pending.set(key,load)
  try{return await load}finally{if(this.pending.get(key)===load)this.pending.delete(key)}
 }
}
