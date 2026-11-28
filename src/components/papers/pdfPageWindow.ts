export interface PageBounds {top:number;bottom:number}
type ReadBounds=(page:number)=>PageBounds|undefined

// The PDF sheets are in document order and have nonnegative heights.
// Look up the first intersecting sheet without forcing layout reads for
// every off-screen page. Missing DOM refs mean the new document is not
// mounted yet; callers can safely retry on the next animation frame.
export function firstPageAfter(count:number,edge:number,read:ReadBounds,inclusive=false):number|null{
 let low=1,high=count+1
 while(low<high){
  const mid=low+Math.floor((high-low)/2)
  const bounds=read(mid)
  if(!bounds)return null
  if(inclusive?bounds.bottom<edge:bounds.bottom<=edge)low=mid+1
  else high=mid
 }
 return low<=count?low:null
}

export function pdfPageWindow(count:number,read:ReadBounds,top:number,bottom:number,current:number,preferred:number,limit:number){
 const empty={pages:[] as number[],page:current}
 if(count<1||bottom<=top||limit<1)return empty
 const cache=new Map<number,PageBounds|undefined>()
 const bounds=(n:number)=>{if(!cache.has(n))cache.set(n,read(n));return cache.get(n)}
 const margin=(bottom-top)*.65
 const first=firstPageAfter(count,top-margin,bounds,true)
 if(first===null)return empty
 let nearest=current,distance=Infinity
 const list:number[]=[]
 for(let n=first;n<=count;n++){
  const r=bounds(n)
  if(!r)return empty
  if(r.top>bottom+margin)break
  list.push(n)
  if(r.bottom>top&&r.top<bottom){
   const d=Math.abs((r.top+r.bottom)/2-(top+bottom)/2)
   if(d<distance){distance=d;nearest=n}
  }
 }
 const page=distance===Infinity?current:preferred&&list.includes(preferred)?preferred:nearest
 return {pages:list.sort((a,b)=>Math.abs(a-page)-Math.abs(b-page)).slice(0,limit),page}
}
