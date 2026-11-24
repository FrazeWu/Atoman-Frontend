import type {PaperFile,PaperUpload} from '@/api/papers'

export type FileTreeRow={kind:'folder';key:string;name:string;path:string;depth:number}|{kind:'file';key:string;name:string;path:string;depth:number;file:PaperFile}
export function paperFileTree(files:PaperFile[],closed:Set<string>):FileTreeRow[]{
 const rows:FileTreeRow[]=[];const seen=new Set<string>()
 for(const file of [...files].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)){
  const parts=file.path.split('/')
  let hidden=false
  for(let i=0;i<parts.length-1;i++){
   const path=parts.slice(0,i+1).join('/')
   if(!hidden&&!seen.has(path)){seen.add(path);rows.push({kind:'folder',key:'folder:'+path,name:parts[i]!,path,depth:i})}
   if(closed.has(path))hidden=true
  }
  if(!hidden)rows.push({kind:'file',key:'file:'+file.id,name:parts[parts.length-1]!,path:file.path,depth:parts.length-1,file})
 }
 return rows
}
const textTypes=/\.(tex|bib|sty|cls|txt|md|bst|bbl|cfg|def|clo|bbx|cbx|lbx|fd|dtx|ins)$/i
const binaryTypes=/\.(png|jpe?g|pdf)$/i
export async function preparePaperUploads(files:File[],directory:string):Promise<PaperUpload[]>{
 if(!files.length||files.length>64)throw new Error('一次最多上传 64 个文件')
 const dir=directory.trim().replace(/\/$/,'')
 if(dir&&(dir.startsWith('/')||dir.split('/').some(part=>!part||part==='.'||part==='..')))throw new Error('请使用项目内的相对目录')
 const out:PaperUpload[]=[]
 let used=0
 const limit=4*1024*1024
 for(const f of files){
  if(f.size>limit||used+f.size>limit)throw new Error('上传文件总大小超过项目容量限制')
  const path=(dir?dir+'/':'')+f.name
  const raw=new Uint8Array(await f.arrayBuffer())
  let content:string
  let kind:PaperUpload['kind']
  if(textTypes.test(path)){
   if(raw.length>1024*1024)throw new Error('文本文件超过 1 MiB：'+f.name)
   content=new TextDecoder('utf-8',{fatal:true}).decode(raw);kind='text'
  }else if(binaryTypes.test(path)){
   if(!raw.length)throw new Error('空资源文件：'+f.name)
   let value=''
   for(let i=0;i<raw.length;i+=16384)value+=String.fromCharCode(...raw.subarray(i,i+16384))
   content=btoa(value);kind='binary'
  }else throw new Error('不支持的文件类型：'+f.name)
  used+=kind==='binary'?content.length:new TextEncoder().encode(content).length
  if(used>limit)throw new Error('上传后编码大小超过 4 MiB')
  out.push({path,kind,content})
 }
 return out
}
export function paperResourceBlob(file:PaperFile):Blob|null{
 try{
  if(file.kind!=='binary'||file.content.length>4*1024*1024)return null
  const raw=Uint8Array.from(atob(file.content),c=>c.charCodeAt(0))
  const ext=file.path.split('.').pop()?.toLowerCase()
  let type=''
  if(ext==='pdf'&&String.fromCharCode(...raw.slice(0,5))==='%PDF-')type='application/pdf'
  if(ext==='png'&&raw.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i])&&raw.length>=8)type='image/png'
  if((ext==='jpg'||ext==='jpeg')&&raw[0]===255&&raw[1]===216&&raw[2]===255)type='image/jpeg'
  if(!type)return null
  return new Blob([raw],{type})
 }catch{return null}
}
