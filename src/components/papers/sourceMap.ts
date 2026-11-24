export type SourcePoint = [number, number, number, number, number]
export interface PaperSourceMap { version: 1; files: string[]; points: SourcePoint[]; truncated?: boolean }
export function decodeSourceMap(value:unknown):PaperSourceMap|null {
 if(!value||typeof value!=='object')return null
 const m=value as PaperSourceMap
 if(m.version!==1||!Array.isArray(m.files)||!m.files.length||m.files.length>64||!Array.isArray(m.points)||!m.points.length||m.points.length>12000)return null
 if(m.files.some(f=>typeof f!=='string'||!f||f.length>512||f.startsWith('/')||f.includes('\\')||f.split('/').some(p=>!p||p==='.'||p==='..')))return null
 if(m.points.some(p=>!Array.isArray(p)||p.length!==5||p.some(n=>!Number.isSafeInteger(n))||p[0]<0||p[0]>=m.files.length||p[1]<1||p[1]>1048576||p[2]<1||p[2]>1000||p[3]<0||p[3]>200000||p[4]<0||p[4]>200000))return null
 return m
}
export function sourceToPDF(map:PaperSourceMap,path:string,line:number,preferredPage=1):SourcePoint|undefined {
 const file=map.files.indexOf(path)
 if(file<0||!Number.isInteger(line)||line<1)return
 let best:SourcePoint|undefined,score=Infinity
 for(const p of map.points){
  if(p[0]!==file)continue
  const distance=Math.abs(p[1]-line)
  if(distance>12)continue
  const d=distance*10000+Math.abs(p[2]-preferredPage)*10+p[4]/200000
  if(d<score){best=p;score=d}
 }
 return best
}
export function pdfToSource(map:PaperSourceMap,page:number,x:number,y:number):SourcePoint|undefined{
 let best:SourcePoint|undefined,score=Infinity
 for(const p of map.points){
  if(p[2]!==page)continue
  const dx=Math.abs(p[3]/10-x),dy=Math.abs(p[4]/10-y)
  if(dy>72||dx>180)continue
  const d=Math.hypot(dx*.3,dy)
  if(d<score){best=p;score=d}
 }
 return best
}
