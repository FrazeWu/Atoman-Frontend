import type {PaperFile} from '@/api/papers'
import {paperAIBytes} from './aiSuggestion'

const ROOT='https://api.github.com',MAX_TOTAL=4*1024*1024,MAX_FILES=64
const shaPattern=/^[0-9a-f]{40}$/
const binaryPath=/\.(png|jpe?g|pdf)$/i
const textPath=/\.(tex|bib|sty|cls|txt|md|bst|bbl|cfg|def|clo|bbx|cbx|lbx|fd|dtx|ins)$/i
export interface GitHubTarget {repository:string;branch:string;token:string}
interface TreeItem {path:string;mode:string;type:string;sha:string;size?:number}
export interface GitHubPlan {repository:string;branch:string;private:boolean;commit:string;tree:string;entries:TreeItem[];included:TreeItem[];excluded:string[]}
export interface GitPaperSource {path:string;data:Uint8Array<ArrayBuffer>}
export function validGitHubRepo(repo:string){return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repo)&&!repo.endsWith('.git')&&!repo.split('/').some(p=>p==='.'||p==='..')}
export function validGitHubBranch(branch:string){return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(branch)&&!branch.includes('..')&&!branch.split('/').some(p=>!p||p.startsWith('.')||p.endsWith('.')||p.endsWith('.lock'))}
export function validGitPaperPath(path:string){
 const parts=path.split('/')
 return paperAIBytes(path)<=512&&(binaryPath.test(path)||textPath.test(path))&&parts.every(p=>p&&paperAIBytes(p)<=255&&!p.startsWith('.')&&!p.endsWith('.')&&p.trim()===p&&/^[\p{L}\p{N}\p{M}_.() -]+$/u.test(p))
}
function sha(value:unknown):string{if(typeof value!=='string'||!shaPattern.test(value))throw Error('Invalid Git object');return value}
const repoPath=(repo:string)=>'/repos/'+repo.split('/').map(encodeURIComponent).join('/')
const branchPath=(branch:string)=>branch.split('/').map(encodeURIComponent).join('/')
async function gh(target:GitHubTarget,path:string,signal:AbortSignal,body?:unknown,max=2*1024*1024){
 if(!validGitHubRepo(target.repository)||!validGitHubBranch(target.branch)||target.token.length>2048||/[\r\n\s]/.test(target.token))throw Error('Invalid repository or credential')
 if(signal.aborted)throw Error('Canceled')
 const response=await fetch(ROOT+repoPath(target.repository)+path,{method:body===undefined?'GET':'POST',signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(target.token?{Authorization:'Bearer '+target.token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})
 if(!response.ok||!response.body)throw Error('GitHub rejected the request')
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let total=0,raw=''
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>max)throw Error('GitHub response too large');raw+=decoder.decode(chunk.value,{stream:true})};raw+=decoder.decode()}
 finally{await reader.cancel().catch(()=>{})}
 return JSON.parse(raw)
}
async function branchCommit(target:GitHubTarget,signal:AbortSignal){
 const ref=await gh(target,'/git/ref/heads/'+branchPath(target.branch),signal)
 if(ref.ref!=='refs/heads/'+target.branch||ref.object?.type!=='commit')throw Error('Invalid branch')
 return sha(ref.object.sha)
}
function validateTree(entries:unknown):TreeItem[]{
 if(!Array.isArray(entries)||entries.length>3000)throw Error('Repository tree exceeds limit')
 const paths=new Set<string>()
 return entries.map(row=>{
  if(!row||typeof row.path!=='string'||row.path.length>1024||paths.has(row.path)||typeof row.type!=='string'||typeof row.mode!=='string')throw Error('Invalid tree entry')
  paths.add(row.path)
  return {path:row.path,type:row.type,mode:row.mode,sha:sha(row.sha),size:Number.isSafeInteger(row.size)&&row.size>=0?row.size:undefined}
 })
}
export async function inspectGitHub(target:GitHubTarget,signal:AbortSignal):Promise<GitHubPlan>{
 const info=await gh(target,'',signal)
 if(typeof info.full_name!=='string'||info.full_name.toLowerCase()!==target.repository.toLowerCase()||typeof info.private!=='boolean')throw Error('Repository mismatch')
 const commit=await branchCommit(target,signal)
 const obj=await gh(target,'/git/commits/'+commit,signal)
 if(sha(obj.sha)!==commit)throw Error('Commit mismatch')
 const tree=sha(obj.tree?.sha)
 const data=await gh(target,'/git/trees/'+tree+'?recursive=1',signal)
 if(data.truncated!==false||sha(data.sha)!==tree)throw Error('Incomplete repository tree')
 const entries=validateTree(data.tree)
 const included=entries.filter(f=>f.type==='blob'&&['100644','100755'].includes(f.mode)&&validGitPaperPath(f.path)&&f.size!==undefined)
 return {repository:target.repository,branch:target.branch,private:info.private,commit,tree,entries,included,excluded:entries.filter(f=>f.type!=='tree'&&!included.includes(f)).map(f=>f.path)}
}
function decode(raw:string,size:number):Uint8Array<ArrayBuffer>{
 if(typeof raw!=='string'||raw.length>Math.ceil(size/3)*4+Math.ceil(size/50)+16)throw Error('Invalid blob')
 const value=atob(raw.replace(/[\r\n]/g,''))
 if(value.length!==size)throw Error('Blob size mismatch')
 return Uint8Array.from(value,c=>c.charCodeAt(0))
}
function b64(data:Uint8Array){
 let out=''
 for(let i=0;i<data.length;i+=8192)out+=String.fromCharCode(...data.subarray(i,i+8192))
 return btoa(out)
}
function hex(data:ArrayBuffer){return Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('')}
async function gitHash(data:Uint8Array<ArrayBuffer>){
 const header=new TextEncoder().encode('blob '+data.length+String.fromCharCode(0)),all=new Uint8Array(header.length+data.length)
 all.set(header);all.set(data,header.length)
 return hex(await crypto.subtle.digest('SHA-1',all))
}
export function validateGitSources(files:GitPaperSource[]){
 if(!files.length||files.length>MAX_FILES||!files.some(f=>/^[^/]+\.tex$/i.test(f.path)))throw Error('项目需要 1–64 个文件，并包含根目录 TeX 主文件')
 let size=0;const names=new Set<string>()
 for(const f of files){
  const name=f.path.toLowerCase()
  if(!validGitPaperPath(f.path)||names.has(name))throw Error('文件路径不兼容或重复')
  if(!binaryPath.test(f.path)){const content=new TextDecoder('utf-8',{fatal:true}).decode(f.data);if(content.includes(String.fromCharCode(0)))throw Error('无效文本')}
  size+=binaryPath.test(f.path)?Math.ceil(f.data.length/3)*4:f.data.length
  if(size>MAX_TOTAL)throw Error('项目超过 4 MiB 编码容量')
  names.add(name)
 }
 for(const name of names)if(name.split('/').slice(0,-1).some((_,i)=>names.has(name.split('/').slice(0,i+1).join('/'))))throw Error('文件目录冲突')
}
export function assertGitPlan(target:GitHubTarget,plan:GitHubPlan){
 if(plan.repository!==target.repository||plan.branch!==target.branch)throw Error('Repository scope changed')
}
export async function importGitHubZIP(target:GitHubTarget,plan:GitHubPlan,signal:AbortSignal,valid:()=>boolean){
 assertGitPlan(target,plan)
 if(!plan.included.length||plan.included.length>MAX_FILES)throw Error('Repository file limit')
 const bytes=plan.included.reduce((n,f)=>n+(binaryPath.test(f.path)?Math.ceil(f.size!/3)*4:f.size!),0)
 if(bytes>MAX_TOTAL)throw Error('Repository size limit')
 const sources:GitPaperSource[]=[]
 for(const f of plan.included){
  if(!valid()||signal.aborted)throw Error('Scope changed')
  const result=await gh(target,'/git/blobs/'+f.sha,signal,undefined,Math.ceil(f.size!/3)*4+65536)
  if(result.sha!==f.sha||result.encoding!=='base64'||result.size!==f.size)throw Error('Blob mismatch')
  const data=decode(result.content,f.size!)
  if(await gitHash(data)!==f.sha)throw Error('Blob hash mismatch')
  sources.push({path:f.path,data})
 }
 validateGitSources(sources)
 if(!valid()||signal.aborted)throw Error('Scope changed')
 const {default:JSZip}=await import('jszip'),zip=new JSZip()
 for(const file of sources)zip.file(file.path,file.data,{createFolders:false})
 return zip.generateAsync({type:'blob',compression:'DEFLATE'})
}
export function projectFileToGitSource(file:PaperFile):GitPaperSource{
 if(!validGitPaperPath(file.path)||file.kind!==(binaryPath.test(file.path)?'binary':'text'))throw Error('Unsupported file')
 if(file.kind==='text')return {path:file.path,data:new TextEncoder().encode(file.content)}
 const data=atob(file.content)
 return {path:file.path,data:Uint8Array.from(data,c=>c.charCodeAt(0))}
}
export function checkGitOverlay(plan:GitHubPlan,files:GitPaperSource[]){
 validateGitSources(files)
 const tree=new Map(plan.entries.map(e=>[e.path.toLowerCase(),e]))
 if(tree.size!==plan.entries.length)throw Error('Git 路径大小写冲突')
 for(const f of files){
  const path=f.path.toLowerCase(),existing=tree.get(path)
  if(existing&&(existing.path!==f.path||existing.type!=='blob'||!['100644','100755'].includes(existing.mode)))throw Error('Git 路径或文件类型冲突')
  const parts=path.split('/')
  for(let i=1;i<parts.length;i++){const parent=tree.get(parts.slice(0,i).join('/'));if(parent&&(parent.type!=='tree'||parent.path!==f.path.split('/').slice(0,i).join('/')))throw Error('Git 目录冲突')}
  if(plan.entries.some(e=>e.path.toLowerCase().startsWith(path+'/')))throw Error('Git 文件目录冲突')
 }
 return files.filter(f=>tree.has(f.path.toLowerCase())).map(f=>f.path)
}
export async function publishGitHubBranch(target:GitHubTarget,plan:GitHubPlan,files:GitPaperSource[],branch:string,signal:AbortSignal,valid:()=>boolean){
 assertGitPlan(target,plan)
 if(!target.token||!validGitHubBranch(branch)||!branch.startsWith('papers-export-')||branch===target.branch||!valid())throw Error('Invalid export')
 checkGitOverlay(plan,files)
 const guard=()=>{if(!valid()||signal.aborted)throw Error('Scope changed')}
 async function verifyDestination(){
  guard()
  const info=await gh(target,'',signal)
  if(typeof info.full_name!=='string'||info.full_name.toLowerCase()!==target.repository.toLowerCase()||info.private!==plan.private)throw Error('Repository visibility changed')
  guard()
 }
 await verifyDestination()
 if(await branchCommit(target,signal)!==plan.commit)throw Error('Base branch changed')
 const tree=[]
 for(const f of files){
  guard()
  const expected=await gitHash(f.data)
  guard()
  const existing=plan.entries.find(e=>e.path===f.path&&e.type==='blob'&&e.sha===expected)
  if(existing){tree.push({path:f.path,mode:existing.mode,type:'blob',sha:expected});continue}
  await verifyDestination()
  const blob=await gh(target,'/git/blobs',signal,{content:b64(f.data),encoding:'base64'})
  if(sha(blob.sha)!==expected)throw Error('Blob verification failed')
  tree.push({path:f.path,mode:'100644',type:'blob',sha:expected})
 }
 guard()
 await verifyDestination()
 const newTree=sha((await gh(target,'/git/trees',signal,{base_tree:plan.tree,tree})).sha)
 await verifyDestination()
 const commit=await gh(target,'/git/commits',signal,{message:'AToMAN Papers reviewed project export',tree:newTree,parents:[plan.commit]})
 const commitSha=sha(commit.sha)
 guard()
 if(await branchCommit(target,signal)!==plan.commit)throw Error('Base branch changed')
 await verifyDestination()
 guard()
 // Never update or force-push an existing ref. This creates only a fresh ref.
 const ref=await gh(target,'/git/refs',signal,{ref:'refs/heads/'+branch,sha:commitSha})
 if(ref.ref!=='refs/heads/'+branch||ref.object?.sha!==commitSha)throw Error('Branch creation not confirmed')
 return {branch,commit:commitSha}
}
