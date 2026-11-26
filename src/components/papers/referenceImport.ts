import {paperAIBytes} from './aiSuggestion'
import type {CatalogWork} from '@/api/book/catalog'

const keyPattern=/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,127}$/
export function importBibtexKeys(raw:string):string[]{
 if(!raw.trim()||paperAIBytes(raw)>32768)throw Error('请提供不超过 32 KiB 的 BibTeX 条目')
 let i=0
 const keys:string[]=[]
 while(i<raw.length){
  const ws=/^(?:\s+|%[^\r\n]*(?:\r?\n|$))+/.exec(raw.slice(i))
  if(ws)i+=ws[0].length
  if(i>=raw.length)break
  const start=/^@([A-Za-z]+)\s*([({])\s*([^,{}()\s%]+)\s*,/.exec(raw.slice(i))
  if(!start||/^(?:string|preamble|comment)$/i.test(start[1]!)||!keyPattern.test(start[3]!))throw Error('存在不支持或格式不完整的 BibTeX 条目')
  const key=start[3]!
  if(keys.includes(key)||keys.length>=20)throw Error('条目键重复或超过 20 条导入上限')
  const brace=start[2]==='{'
  i+=start[0].length
  let depth=brace?1:0,quote=false,closed=false
  for(;i<raw.length;i++){
   const c=raw[i]!
   if(c==='\\'){i++;continue}
   if(c==='"'&&depth===(brace?1:0)){quote=!quote;continue}
   if(quote)continue
   if(c==='{')depth++
   if(c==='}'){
    depth--
    if(brace&&depth===0){i++;closed=true;break}
    if(depth<0)throw Error('BibTeX 大括号不匹配')
   }
   if(!brace&&c===')'&&depth===0){i++;closed=true;break}
  }
  if(!closed||quote)throw Error('BibTeX 条目未完整闭合')
  keys.push(key)
 }
 if(!keys.length)throw Error('未识别到 BibTeX 条目')
 return keys
}
export function existingBibtexKeys(text:string){
 const keys:string[]=[]
 for(const entry of text.matchAll(/@([A-Za-z]+)\s*[({]\s*([^,{}()\s%]+)\s*,/g)){
  if(!/^(?:string|comment|preamble)$/i.test(entry[1]!)&&keyPattern.test(entry[2]!))keys.push(entry[2]!)
 }
 return keys
}
export function planBibtexAppend(current:string,raw:string,existingKeys:readonly string[]){
 const keys=importBibtexKeys(raw)
 const set=new Set(existingKeys)
 for(const k of keys)if(set.has(k))throw Error('项目已有引用键：'+k)
 const content=(current?current.replace(/\s*$/,'')+'\n\n':'')+raw.trim()+'\n'
 if(paperAIBytes(content)>1024*1024)throw Error('目标参考文献文件超过 1 MiB')
 return {keys,content}
}
type ReferenceMetadata={type:'article'|'book'|'misc';title:string;authors:string[];year?:string;publisher?:string;journal?:string;doi?:string;isbn?:string;arxiv?:string}
function plain(v:unknown,max=600){
 return typeof v==='string'?v.replace(/<[^>]{0,100}>/g,'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''
}
function tex(v:string){return v.replace(/[\\{}%&#_$^~]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','&':'\\&','#':'\\#','_':'\\_','$':'\\$','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[c]||c))}
export function referenceToBibtex(m:ReferenceMetadata){
 const title=plain(m.title)
 if(!title)throw Error('元数据没有可验证的标题')
 const author=m.authors.map(a=>plain(a,150)).filter(Boolean).slice(0,40)
 const keyBase=(author[0]||title).toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,26)||'reference'
 const year=/^\d{4}$/.test(m.year||'')?m.year:''
 const identifier=(m.doi||m.isbn||m.arxiv||title)
 let hash=2166136261
 for(const c of identifier)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0
 const key=keyBase+year+'-'+hash.toString(36)
 const fields:[string,string][]=[['title',title],['author',author.join(' and ')],['year',year||''],['journal',plain(m.journal)],['publisher',plain(m.publisher)],['isbn',plain(m.isbn)],['doi',plain(m.doi)],['eprint',plain(m.arxiv)],['archivePrefix',m.arxiv?'arXiv':'']]
 return '@'+m.type+'{'+key+',\n'+fields.filter(([,v])=>v).map(([k,v])=>'  '+k+' = {'+tex(v)+'}').join(',\n')+'\n}\n'
}
const DOI=/^10\.\d{4,9}\/[A-Za-z0-9._;()/:-]{1,200}$/i
const ARXIV=/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i
export function normalizeReferenceID(input:string,kind:'doi'|'arxiv'){
 const raw=input.trim()
 if(kind==='doi'){
  const doi=raw.replace(/^https:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'')
  if(!DOI.test(doi))throw Error('请输入完整 DOI')
  return doi
 }
 const id=raw.replace(/^https:\/\/arxiv\.org\/(?:abs|pdf)\//i,'').replace(/^arxiv:\s*/i,'').replace(/\.pdf$/i,'')
 if(!ARXIV.test(id))throw Error('请输入 arXiv 论文编号')
 return id.replace(/v\d+$/i,'')
}
export function crossrefMetadata(payload:unknown,requested:string):ReferenceMetadata{
 const m=(payload as {message?:Record<string,unknown>})?.message
 if(!m||typeof m.DOI!=='string'||m.DOI.toLowerCase()!==requested.toLowerCase())throw Error('返回 DOI 与查询不一致')
 const title=Array.isArray(m.title)?plain(m.title[0]):''
 const authors=Array.isArray(m.author)?m.author.slice(0,40).map(a=>plain(a?.name)||[plain(a?.given),plain(a?.family)].filter(Boolean).join(' ')).filter(Boolean):[]
 const date=(m.issued||m.published) as {'date-parts'?:number[][]}|undefined
 const year=date?.['date-parts']?.[0]?.[0]
 return {type:m.type==='journal-article'?'article':m.type==='book'?'book':'misc',title,authors,year:Number.isInteger(year)?String(year):undefined,publisher:plain(m.publisher),journal:Array.isArray(m['container-title'])?plain(m['container-title'][0]):'',doi:m.DOI}
}
export function dataciteMetadata(payload:unknown,arxiv:string):ReferenceMetadata{
 const a=(payload as {data?:{attributes?:Record<string,unknown>}})?.data?.attributes
 const expected='10.48550/arxiv.'+arxiv.toLowerCase()
 if(!a||typeof a.doi!=='string'||a.doi.toLowerCase()!==expected)throw Error('返回 DOI 与 arXiv 编号不一致')
 const title=Array.isArray(a.titles)?plain(a.titles[0]?.title):''
 const authors=Array.isArray(a.creators)?a.creators.slice(0,40).map(x=>plain(x?.name)||[plain(x?.givenName),plain(x?.familyName)].filter(Boolean).join(' ')).filter(Boolean):[]
 return {type:'misc',title,authors,year:Number.isInteger(a.publicationYear)?String(a.publicationYear):undefined,doi:a.doi,arxiv}
}
export async function lookupReference(input:string,kind:'doi'|'arxiv',signal:AbortSignal){
 const id=normalizeReferenceID(input,kind)
 const url=kind==='doi'?'https://api.crossref.org/works/'+encodeURIComponent(id):'https://api.datacite.org/dois/'+encodeURIComponent('10.48550/arXiv.'+id)
 const res=await fetch(url,{signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',headers:{Accept:'application/json'}})
 if(!res.ok||!res.body)throw Error('文献服务未返回记录')
 const reader=res.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text=''
 try{
  while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>512*1024)throw Error('文献元数据过大');text+=decoder.decode(next.value,{stream:true})}
  text+=decoder.decode()
 }finally{await reader.cancel().catch(()=>{})}
 return referenceToBibtex(kind==='doi'?crossrefMetadata(JSON.parse(text),id):dataciteMetadata(JSON.parse(text),id))
}
export function bookReference(work:CatalogWork,editionId:string){
 const edition=work.editions.find(e=>e.id===editionId)
 return referenceToBibtex({type:'book',title:edition?.title||work.title,authors:(work.authors||[]).map(a=>a.name),year:edition?.published_date?.match(/^\d{4}/)?.[0],publisher:edition?.publisher_info?.name||edition?.publisher,isbn:edition?.isbn13||edition?.isbn10})
}
