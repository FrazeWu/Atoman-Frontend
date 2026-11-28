<template>
  <section class="paper-pdf" aria-label="PDF 预览">
    <div class="paper-pdf__toolbar" aria-label="PDF 阅读工具"><div class="paper-pdf__toolbar-group" aria-label="页码导航">
      <PButton size="sm" variant="secondary" type="button" title="上一页" aria-label="上一页" :disabled="page <= 1 || !pageCount" @click="jump(page - 1)">‹</PButton>
      <div class="paper-pdf__page-control"><PInput v-model="pageInput" class="paper-pdf__page-input" aria-label="页码" inputmode="numeric" @focus="editingPageInput = true" @input="editingPageInput = true" @blur="commitPageInput" @keydown.enter.prevent="commitPageInput" /></div>
      <span class="paper-pdf__count">/ {{ pageCount || '—' }}</span>
      <PButton size="sm" variant="secondary" type="button" title="下一页" aria-label="下一页" :disabled="page >= pageCount || !pageCount" @click="jump(page + 1)">›</PButton>
      </div><div class="paper-pdf__toolbar-group" aria-label="阅读模式"><PButton size="sm" variant="secondary" type="button" class="paper-pdf__icon" aria-label="目录" title="PDF 目录" :disabled="!pageCount" :aria-expanded="outlineOpen" @click="toggleOutline"><List :size="15" aria-hidden="true" /><span class="paper-pdf__sr">目录</span></PButton>
      <PButton size="sm" variant="secondary" type="button" class="paper-pdf__icon" :aria-label="textMode?'选字中':'选择文字'" :disabled="!pageCount" :aria-pressed="textMode" title="切换文字选择；关闭后可双击定位源码" @click="toggleTextMode"><TextCursorInput :size="15" aria-hidden="true" /><span class="paper-pdf__sr">{{ textMode?'选字中':'选择文字' }}</span></PButton>
      </div><div class="paper-pdf__toolbar-group paper-pdf__zoom-group" aria-label="缩放">
      <PButton size="sm" variant="secondary" type="button" title="缩小" aria-label="缩小" :disabled="!pageCount" @click="adjustZoom(-1)">−</PButton>
      <PSelect :model-value="zoom" placeholder="PDF 缩放" size="sm" :options="[{value:'width',label:'适合宽度'},{value:'page',label:'适合页面'},...zoomLevels.map(n=>({value:String(n),label:n+'%'}))]" @update:model-value="zoom=String($event);resizePages(true)" />
      <PButton size="sm" variant="secondary" type="button" title="放大" aria-label="放大" :disabled="!pageCount" @click="adjustZoom(1)">+</PButton>
      </div><PButton size="sm" variant="secondary" type="button" class="paper-pdf__download paper-pdf__icon" :disabled="!documentBlob" aria-label="下载 PDF" title="下载 PDF" @click="download"><Download :size="15" aria-hidden="true" /><span class="paper-pdf__sr">下载 PDF</span></PButton>
    </div>
    <div v-if="outlineOpen" class="paper-pdf__outline" aria-label="PDF 目录">
      <p v-if="outlineLoading">正在读取 PDF 书签…</p>
      <p v-else-if="!outline.length">此 PDF 没有内嵌目录。</p>
      <PButton size="sm" variant="ghost" v-for="(entry,i) in outline" :key="i" type="button" :style="{paddingLeft:(entry.depth*12+8)+'px'}" @click="jump(entry.page);outlineOpen=false">{{ entry.title }} <small>{{ entry.page }}</small></PButton>
    </div>
    <div v-if="textMode" class="paper-pdf__text-note">可拖选和复制 PDF 文字；关闭选字模式后恢复双击定位。</div>
    <div v-if="error" class="paper-pdf__notice" role="alert">{{ error }} <PButton size="sm" variant="secondary" type="button" @click="load">重试</PButton></div>
    <div v-if="loading" class="paper-pdf__notice" role="status">{{ pageCount ? '正在更新预览，保留当前页面…' : '正在读取 PDF…' }}</div>
    <div ref="scroller" class="paper-pdf__scroll" tabindex="0" @scroll.passive="onScroll">
      <div v-if="!pageCount" class="paper-pdf__placeholder">{{ loading ? '正在加载编译结果' : '暂无可预览的 PDF' }}</div>
      <div v-for="item in pages" :key="displayedJob + ':' + item.number" :ref="el => registerPage(item.number, el as HTMLElement | null)" class="paper-pdf__sheet" :data-page="item.number" :data-rendered="item.ready ? 'true' : 'false'" @dblclick="onPDFDoubleClick($event,item)" :style="{width: item.width + 'px',height:item.height + 'px'}">
        <canvas width="1" height="1" :ref="el => registerCanvas(item.number, el as HTMLCanvasElement | null)" :aria-label="'PDF 第 ' + item.number + ' 页'" />
        <div v-if="textMode" class="textLayer paper-pdf__text-layer" aria-label="PDF 可选择文字"></div>
        <div v-if="item.error" class="paper-pdf__page-error">第 {{ item.number }} 页暂时无法渲染 <PButton size="sm" variant="secondary" type="button" @click="retryPage(item.number)">重试</PButton></div>
        <span v-else-if="!item.ready && !item.hasPixels" class="paper-pdf__page-loading">第 {{ item.number }} 页</span>
        <span v-if="marker?.page===item.number" class="paper-pdf__sync-marker" :style="{left:(marker.x/item.naturalWidth*100)+'%',top:(marker.y/item.naturalHeight*100)+'%'}" aria-hidden="true" />
      </div>
    </div>
    <div class="paper-pdf__footer"><span>{{ displayedAssetName || (documentBlob ? ('PDF 源码版本 ' + displayedRevision) : assetName || ('PDF 源码版本 ' + revision)) }}</span><span>{{ pageCount ? page + ' / ' + pageCount : '' }}</span></div>
  </section>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { List, TextCursorInput, Download } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask, TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { getPaperCompilePDF } from '@/api/papers'
import { loadPdfEngine } from '@/utils/bookReaderEngines'
import { firstPageAfter, pdfPageWindow } from './pdfPageWindow'

const props=defineProps<{projectId:string;jobId:string;revision:number;assetBlob?:Blob;assetName?:string}>()
const emit=defineEmits<{ 'pdf-position':[value:{jobId:string;page:number;x:number;y:number}]; 'displayed-job':[jobId:string] ; 'page-count':[meta:{jobId:string;revision:number;pages:number}] }>()
const textMode=ref(false)
const outlineOpen=ref(false),outlineLoading=ref(false)
const outline=ref<{title:string;page:number;depth:number}[]>([])
let outlineEpoch=0,outlineLoaded=false
let textEpoch=0
const textTasks=new Map<number,TextLayer>()
const textDone=new Set<number>()
let textBusy=false
function clearText(){
 textEpoch++
 for(const n of new Set([...textTasks.keys(),...textDone])){
  textTasks.get(n)?.cancel()
  elements.get(n)?.querySelector('.paper-pdf__text-layer')?.replaceChildren()
 }
 textTasks.clear();textDone.clear()
}
function toggleTextMode(){
 textMode.value=!textMode.value;clearText()
 if(textMode.value)void nextTick().then(()=>renderVisibleText())
}
async function renderVisibleText(){
 if(!textMode.value||textBusy||disposed||!doc)return
 const current=doc,epoch=textEpoch
 textBusy=true
 try{
  const engine=await loadPdfEngine()
  if(!engine.TextLayer){for(const n of wantedPages)textDone.add(n);return}
  for(const n of wantedPages){
   if(disposed||!textMode.value||epoch!==textEpoch||doc!==current)break
   const p=pages.value[n-1]
   const layer=elements.get(n)?.querySelector<HTMLElement>('.paper-pdf__text-layer')
   if(!p?.ready||!layer||textDone.has(n)||textTasks.has(n))continue
   try{
    const target=await current.getPage(n),content=await target.getTextContent()
    if(disposed||epoch!==textEpoch||doc!==current||!wantedPages.has(n)||!layer.isConnected)continue
    // Limit DOM nodes and text retained for hostile imported PDFs.
    if(content.items.length>12000){textDone.add(n);continue}
    const viewport=target.getViewport({scale:scaleFor(p)})
    layer.style.setProperty('--total-scale-factor',String(viewport.scale*(viewport.userUnit||1)))
    layer.style.setProperty('--scale-factor',String(viewport.scale))
    layer.replaceChildren()
    const task=new engine.TextLayer({textContentSource:content,container:layer,viewport})
    textTasks.set(n,task)
    await task.render()
    if(!disposed&&epoch===textEpoch&&current===doc&&wantedPages.has(n))textDone.add(n)
   }catch{if(epoch===textEpoch&&current===doc)textDone.add(n)}
   finally{if(epoch===textEpoch)textTasks.delete(n)}
  }
 }finally{
  textBusy=false
  if(!disposed&&textMode.value&&[...wantedPages].some(n=>pages.value[n-1]?.ready&&!textDone.has(n)&&!textTasks.has(n)&&!!elements.get(n)?.querySelector('.paper-pdf__text-layer')?.isConnected))void renderVisibleText()
 }
}
async function toggleOutline(){
 outlineOpen.value=!outlineOpen.value
 if(!outlineOpen.value||outlineLoaded||outlineLoading.value||!doc)return
 const current=doc,epoch=++outlineEpoch
 outlineLoading.value=true
 try{
  const items=await current.getOutline()
  const result:{title:string;page:number;depth:number}[]=[]
  type Item=NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>[number]
  const stack=(items||[]).slice(0,300).reverse().map(item=>({item,depth:0}))
  let visited=0
  while(stack.length&&visited++<300){
   if(disposed||epoch!==outlineEpoch||current!==doc)return
   const {item,depth}=stack.pop()!
   try{
    const dest=typeof item.dest==='string'?await current.getDestination(item.dest):item.dest
    if(Array.isArray(dest)&&dest.length){
     const target=dest[0]
     const index=typeof target==='number'?target:target&&typeof target==='object'?await current.getPageIndex(target):-1
     if(Number.isInteger(index)&&index>=0&&index<current.numPages)result.push({title:String(item.title||'第 '+(index+1)+' 页').slice(0,200),page:index+1,depth})
    }
   }catch{/* Unsupported/external destination: deliberately skip. */}
   if(depth<7&&item.items?.length)for(const child of (item.items as Item[]).slice(0,300).reverse())stack.push({item:child,depth:depth+1})
  }
  if(!disposed&&epoch===outlineEpoch&&current===doc){outline.value=result;outlineLoaded=true}
 }catch{/* Outline is optional; PDF rendering remains available. */}
 finally{if(epoch===outlineEpoch)outlineLoading.value=false}
}
const marker=ref<{page:number;x:number;y:number}|null>(null)
let markerTimer:ReturnType<typeof setTimeout>|undefined
const displayedJob=ref('')
type Page = {number:number; naturalWidth:number; naturalHeight:number; width:number;height:number;ready:boolean;error:boolean;hasPixels:boolean}
const scroller=ref<HTMLElement|null>(null)
const pages=ref<Page[]>([])
const pageCount=computed(()=>pages.value.length)
const page=ref(1), pageInput=ref('1')
const editingPageInput=ref(false)
let resizeTimer:ReturnType<typeof setTimeout>|undefined
let preferredPage=0
const zoom=ref('width')
const zoomLevels=[50,75,100,125,150,200]
const documentBlob=shallowRef<Blob>()
const displayedAssetName=ref('')
const displayedRevision=ref(0)
const loading=ref(false),error=ref('')
let task:PDFDocumentLoadingTask|undefined
let doc:PDFDocumentProxy|undefined
let pendingTask:PDFDocumentLoadingTask|undefined
let abort:AbortController|undefined
let loadSerial=0,renderSerial=0,disposed=false
let observer:ResizeObserver|undefined
let scheduled=0
const elements=new Map<number,HTMLElement>()
const canvases=new Map<number,HTMLCanvasElement>()
const rendering=new Map<number,RenderTask>()
let busy=false
const pending=new Set<number>()
let wantedPages=new Set<number>()
const pixelPages=new Set<number>()
const MAX_RENDER_PAGES=12
const MAX_CACHED_PIXELS=24_000_000

function registerPage(n:number,el:HTMLElement|null){if(el)elements.set(n,el);else elements.delete(n)}
function registerCanvas(n:number,el:HTMLCanvasElement|null){if(el)canvases.set(n,el);else canvases.delete(n)}
function anchor(){
 const box=scroller.value
 if(!box||box.clientWidth===0||box.clientHeight===0)return {page:page.value,offset:0}
 const top=box.getBoundingClientRect().top+8
 const chosenNumber=firstPageAfter(pageCount.value,top,n=>elements.get(n)?.getBoundingClientRect())??page.value
 const chosen=elements.get(chosenNumber)
 if(!chosen)return {page:page.value,offset:0}
 const y=top-chosen.getBoundingClientRect().top
 return {page:chosenNumber,offset:Math.max(0,Math.min(1,y/Math.max(1,chosen.clientHeight)))}
}
function restore(a:{page:number;offset:number}){
 const box=scroller.value,el=elements.get(Math.min(pageCount.value,Math.max(1,a.page)))
 if(!box||!el)return
 box.scrollTop+=el.getBoundingClientRect().top-box.getBoundingClientRect().top+a.offset*el.clientHeight-8
 onScroll()
}
function cancelRenders(){
 renderSerial++;clearText()
 for(const t of rendering.values())t.cancel()
 pending.clear()
}
function scaleFor(p:Page){
 // Match the compact scroller's 8px padding; reserve 4px for rounding.
 const w=Math.max(120,(scroller.value?.clientWidth||480)-20)
 const h=Math.max(140,(scroller.value?.clientHeight||650)-16)
 const scale=zoom.value==='width'? w/p.naturalWidth:zoom.value==='page'?Math.min(w/p.naturalWidth,h/p.naturalHeight):Number(zoom.value)/100
 return Math.max(.1,Math.min(3,scale||1))
}
async function resizePages(keep=true){
 const box=scroller.value
 if(!box||box.clientWidth===0||box.clientHeight===0)return
 const a=anchor()
 const dimensions=pages.value.map(p=>{const s=scaleFor(p);return [Math.max(1,Math.round(p.naturalWidth*s)),Math.max(1,Math.round(p.naturalHeight*s))] as const})
 if(dimensions.every(([w,h],i)=>pages.value[i]?.width===w&&pages.value[i]?.height===h)){schedule();return}
 cancelRenders()
 for(const [i,p] of pages.value.entries()){
  const size=dimensions[i]!
  p.width=size[0];p.height=size[1];p.ready=false;p.error=false
 }
 await nextTick()
 if(keep)restore(a)
 schedule()
}
function visiblePages(){
 const box=scroller.value
 if(!box||box.clientWidth===0||box.clientHeight===0)return []
 const r=box.getBoundingClientRect()
 const window=pdfPageWindow(pageCount.value,n=>elements.get(n)?.getBoundingClientRect(),r.top,r.bottom,page.value,preferredPage,MAX_RENDER_PAGES)
 if(window.pages.length){
  page.value=window.page
  if(!editingPageInput.value)pageInput.value=String(page.value)
 }
 preferredPage=0
 return window.pages
}
function schedule(){
 if(disposed||scheduled)return
 scheduled=requestAnimationFrame(()=>{
  scheduled=0
  const wanted=new Set(visiblePages());wantedPages=wanted
  for(const [n,t] of rendering)if(!wanted.has(n))t.cancel()
  for(const n of pending)if(!wanted.has(n))pending.delete(n)
  for(const n of pixelPages){
   if(wanted.has(n))continue
   const p=pages.value[n-1],c=canvases.get(n)
   if(c){c.width=1;c.height=1}
   if(p){p.ready=false;p.hasPixels=false}
   pixelPages.delete(n)
  }
  for(const n of new Set([...textTasks.keys(),...textDone])){
   if(wanted.has(n))continue
   textTasks.get(n)?.cancel();textTasks.delete(n);textDone.delete(n)
   elements.get(n)?.querySelector('.paper-pdf__text-layer')?.replaceChildren()
  }
  for(const n of wanted){const p=pages.value[n-1];if(p&&!p.ready&&!p.error&&!rendering.has(n))pending.add(n)}
  void pump();if(textMode.value)void renderVisibleText()
 })
}
function onScroll(){schedule()}
async function pump(){
 if(busy||disposed)return
 busy=true
 try{
  while(pending.size&&!disposed){
   const n=pending.values().next().value as number
   pending.delete(n)
   const p=pages.value[n-1], current=doc, serial=renderSerial,c=canvases.get(n)
   if(!p||!current||!c||p.ready)continue
   try{
    const target=await current.getPage(n)
    if(disposed||serial!==renderSerial||current!==doc||canvases.get(n)!==c||!wantedPages.has(n))continue
    const natural=target.getViewport({scale:1})
    if(!(Number.isFinite(natural.width)&&Number.isFinite(natural.height)&&natural.width>0&&natural.height>0))throw new Error('invalid page')
    const newDimensions=Math.abs(natural.width-p.naturalWidth)>.5||Math.abs(natural.height-p.naturalHeight)>.5
    if(newDimensions){
     p.naturalWidth=natural.width;p.naturalHeight=natural.height
     const s=scaleFor(p);p.width=Math.round(natural.width*s);p.height=Math.round(natural.height*s)
    }
    const displayScale=scaleFor(p)
    const dpr=Math.max(1,Math.min(window.devicePixelRatio||1,2))
    const scale=Math.min(displayScale*dpr,4096/natural.width,4096/natural.height,Math.sqrt(8_000_000/(natural.width*natural.height)))
    const viewport=target.getViewport({scale:Math.min(scale,Math.sqrt(MAX_CACHED_PIXELS/Math.max(3,wantedPages.size)/(natural.width*natural.height)))})
    if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height))throw new Error('invalid viewport')
    // Keep the last complete pixels visible until a fresh render succeeds.
    // Cancellation should never clear the canvas or expose partial pixels.
    const staging=document.createElement('canvas')
    const ctx=staging.getContext('2d',{alpha:false})
    if(!ctx)throw new Error('canvas unavailable')
    staging.width=Math.max(1,Math.floor(viewport.width));staging.height=Math.max(1,Math.floor(viewport.height))
    try{
     const t=target.render({canvas:staging,canvasContext:ctx,viewport,annotationMode:0})
     rendering.set(n,t)
     await t.promise
     if(disposed||serial!==renderSerial||current!==doc||canvases.get(n)!==c||!wantedPages.has(n))continue
     const output=c.getContext('2d',{alpha:false})
     if(!output)throw new Error('canvas unavailable')
     c.width=staging.width;c.height=staging.height;output.drawImage(staging,0,0)
     p.ready=true;p.hasPixels=true;pixelPages.add(n)
    }finally{staging.width=1;staging.height=1}
   }catch(e){
    if(!disposed&&serial===renderSerial&&current===doc&&(e as Error)?.name!=='RenderingCancelledException')p.error=true
   }finally{rendering.delete(n);if(!disposed&&!p.ready&&!p.error)schedule()}
  }
 }finally{busy=false;if(textMode.value)void renderVisibleText()}
}
async function load(){
 if(disposed)return
 const serial=++loadSerial
 const pid=props.projectId,jid=props.jobId,revision=props.revision,assetName=props.assetName
 abort?.abort();abort=new AbortController()
 void pendingTask?.destroy().catch(()=>{})
 pendingTask=undefined
 loading.value=true;error.value=''
 let next:PDFDocumentLoadingTask|undefined
 try{
  const blob=props.assetBlob??await getPaperCompilePDF(pid,jid,abort.signal)
  if(disposed||serial!==loadSerial)return
  const {getDocument}=await loadPdfEngine()
  const data=await blob.arrayBuffer()
  if(disposed||serial!==loadSerial)return
  next=getDocument({data,enableXfa:false,disableAutoFetch:true,stopAtErrors:false,useSystemFonts:true})
  pendingTask=next
  const incoming=await next.promise
  if(disposed||serial!==loadSerial){await next.destroy();return}
  if(incoming.numPages<1||incoming.numPages>1000)throw new Error('invalid page count')
  const first=await incoming.getPage(1)
  if(disposed||serial!==loadSerial){await next.destroy();return}
  const natural=first.getViewport({scale:1})
  if(!(Number.isFinite(natural.width)&&Number.isFinite(natural.height)&&natural.width>0&&natural.height>0))throw new Error('invalid viewport')
  const old=task
  const a=anchor()
  cancelRenders()
  await Promise.allSettled([...rendering.values()].map(t=>t.promise))
  if(disposed||serial!==loadSerial){await next.destroy();return}
  doc=incoming;task=next;pendingTask=undefined
  pixelPages.clear();wantedPages=new Set()
  if(old&&old!==task)void old.destroy().catch(()=>{})
  if(markerTimer)clearTimeout(markerTimer)
  markerTimer=undefined;marker.value=null
  outlineEpoch++;outlineLoaded=false;outline.value=[];outlineOpen.value=false;outlineLoading.value=false
  documentBlob.value=blob;displayedAssetName.value=assetName||'';displayedRevision.value=revision;displayedJob.value=jid
  pages.value=Array.from({length:incoming.numPages},(_,i)=>({number:i+1,naturalWidth:natural.width,naturalHeight:natural.height,width:1,height:1,ready:false,error:false,hasPixels:false}))
  page.value=Math.min(incoming.numPages,a.page);pageInput.value=String(page.value)
  editingPageInput.value=false
  await nextTick()
  if(disposed||serial!==loadSerial)return
  await resizePages(false)
  if(disposed||serial!==loadSerial)return
  emit('displayed-job',jid)
  emit('page-count',{jobId:jid,revision,pages:incoming.numPages})
  await nextTick()
  if(disposed||serial!==loadSerial)return
  restore(a);schedule()
 }catch{
  if(next&&next!==task)void next.destroy().catch(()=>{})
  if(!disposed&&serial===loadSerial)error.value='PDF 加载失败。请重试或下载上一次成功的结果。'
 }finally{if(!disposed&&serial===loadSerial){loading.value=false;pendingTask=undefined}}
}
function commitPageInput(){
 if(!editingPageInput.value)return
 editingPageInput.value=false
 const raw=pageInput.value.trim()
 jump(raw?Number(raw):page.value)
}
function jump(n:number){
 if(!pageCount.value)return
 const target=Number.isFinite(n)?Math.max(1,Math.min(pageCount.value,Math.trunc(n))):page.value
 preferredPage=target;page.value=target;pageInput.value=String(target);restore({page:target,offset:0})
}
function adjustZoom(direction:number){
 const p=pages.value[page.value-1];if(!p)return
 const current=Math.round(scaleFor(p)*100)
 const list=direction>0?zoomLevels:[...zoomLevels].reverse()
 const n=list.find(v=>direction>0?v>current:v<current)
 if(n){zoom.value=String(n);void resizePages(true)}
}
function retryPage(n:number){const p=pages.value[n-1];if(p){p.error=false;pending.add(n);void pump()}}
function download(){
 if(!documentBlob.value)return
 const url=URL.createObjectURL(documentBlob.value),a=document.createElement('a')
 a.href=url;a.download=displayedAssetName.value||'paper.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
watch(()=>[props.projectId,props.jobId,props.assetBlob],()=>void load())
onMounted(()=>{
 if(scroller.value&&typeof ResizeObserver!=='undefined'){
  observer=new ResizeObserver(()=>{
   if(resizeTimer)clearTimeout(resizeTimer)
   resizeTimer=setTimeout(()=>{if(!disposed&&pageCount.value)void resizePages(true)},100)
  })
  observer.observe(scroller.value)
 }
 void load()
})
onBeforeUnmount(()=>{
 disposed=true;loadSerial++;outlineEpoch++;abort?.abort();observer?.disconnect();cancelAnimationFrame(scheduled);cancelRenders();if(markerTimer)clearTimeout(markerTimer);if(resizeTimer)clearTimeout(resizeTimer)
 void pendingTask?.destroy().catch(()=>{});void task?.destroy().catch(()=>{})
 documentBlob.value=undefined
})
function onPDFDoubleClick(e:MouseEvent,p:Page){
 if(textMode.value||props.assetBlob||!p.ready||!displayedJob.value)return
 const r=(e.currentTarget as HTMLElement).getBoundingClientRect()
 if(r.width<=0||r.height<=0)return
 emit('pdf-position',{jobId:displayedJob.value,page:p.number,x:(e.clientX-r.left)/r.width*p.naturalWidth,y:(e.clientY-r.top)/r.height*p.naturalHeight})
}
async function showPosition(n:number,x:number,y:number,jobId:string){
 if(displayedJob.value!==jobId||loading.value)return false
 const p=pages.value[n-1]
 if(!p||!Number.isFinite(x)||!Number.isFinite(y))return false
 await nextTick()
 if(disposed||loading.value||displayedJob.value!==jobId||pages.value[n-1]!==p)return false
 const box=scroller.value,el=elements.get(n)
 if(!box||!el)return false
 preferredPage=n;page.value=n;pageInput.value=String(n)
 box.scrollTop+=el.getBoundingClientRect().top-box.getBoundingClientRect().top+y/p.naturalHeight*el.clientHeight-box.clientHeight*.4
 box.scrollLeft=Math.max(0,el.offsetLeft+x/p.naturalWidth*el.clientWidth-box.clientWidth*.5)
 marker.value={page:n,x,y}
 if(markerTimer)clearTimeout(markerTimer)
 markerTimer=setTimeout(()=>marker.value=null,2200)
 schedule()
 return true
}
function currentPosition(){
 const p=pages.value[page.value-1],el=elements.get(page.value),box=scroller.value
 if(!p||!el||!box)return null
 const r=el.getBoundingClientRect(),b=box.getBoundingClientRect()
 return {jobId:displayedJob.value,page:p.number,x:p.naturalWidth*.5,y:Math.max(0,Math.min(p.naturalHeight,(b.top+b.height*.4-r.top)/Math.max(1,r.height)*p.naturalHeight))}
}
defineExpose({jump,page,scroller,showPosition,currentPosition})
</script>
<style scoped>
.paper-pdf{display:flex;flex-direction:column;min-width:0;min-height:0;flex:1;overflow:hidden;container:papers-pdf / inline-size}
.paper-pdf__toolbar{--a-control-height-sm:28px;display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:3px 6px;border-bottom:1px solid var(--a-color-border-soft,#d8dde3);font-size:12px;background:var(--a-color-bg-elevated,var(--a-color-bg,#fff));flex-shrink:0}
.paper-pdf__toolbar :deep(.p-button){min-width:26px;padding:0 5px;font-size:13px;flex:none}
.paper-pdf__toolbar-group{display:flex;align-items:center;gap:3px;flex:none;white-space:nowrap}
.paper-pdf__toolbar-group+.paper-pdf__toolbar-group{border-left:1px solid var(--a-color-border-soft,#ddd);padding-left:4px}
.paper-pdf__page-control{width:38px;flex:none}
.paper-pdf__page-control :deep(.p-input){height:var(--a-control-height-sm);min-height:var(--a-control-height-sm);padding:0 3px;text-align:center;font-size:12px}
.paper-pdf__count{white-space:nowrap;font-size:11px;font-variant-numeric:tabular-nums}
.paper-pdf__zoom-group :deep(.p-select-trigger){min-width:76px;font-size:11px;padding-inline:5px;gap:3px}
.paper-pdf__download{margin-left:auto}
.paper-pdf__sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@container papers-pdf (max-width:410px){
 .paper-pdf__toolbar{gap:3px;padding-inline:4px}
 .paper-pdf__toolbar :deep(.p-button){min-width:24px;padding-inline:3px}
 .paper-pdf__toolbar-group{gap:2px}
 .paper-pdf__toolbar-group+.paper-pdf__toolbar-group{padding-left:2px}
 .paper-pdf__page-control{width:34px}
 .paper-pdf__zoom-group :deep(.p-field){width:72px;min-width:0}
 .paper-pdf__zoom-group :deep(.p-select-trigger){min-width:0;white-space:nowrap;padding-inline:4px;gap:2px}
}
@media(pointer:coarse){.paper-pdf__toolbar{--a-control-height-sm:32px}.paper-pdf__toolbar :deep(.p-button){min-width:30px}}
.paper-pdf__scroll{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;padding:8px;box-sizing:border-box;background:var(--a-color-bg-soft,#e4e8ed);scrollbar-gutter:stable}
.paper-pdf__sheet{position:relative;box-sizing:content-box;margin:0 auto 8px;background:white;box-shadow:0 2px 7px #0002;overflow:hidden;flex-shrink:0}
.paper-pdf__sheet canvas{display:block;width:100%;height:100%;background:white}
.paper-pdf__page-loading,.paper-pdf__page-error{position:absolute;top:12px;left:12px;font-size:12px;color:#64748b;background:#fff;padding:5px}
.paper-pdf__notice,.paper-pdf__footer{padding:6px 10px;font-size:12px;flex-shrink:0;color:var(--a-color-text-secondary,#64748b);border-bottom:1px solid var(--a-color-border-soft,#d8dde3)}
.paper-pdf__footer{display:flex;justify-content:space-between;padding:3px 7px;border-bottom:0;border-top:1px solid var(--a-color-border-soft,#d8dde3)}
.paper-pdf__placeholder{padding:32px 8px;text-align:center;color:#475569;font-size:13px}
.paper-pdf__sync-marker{position:absolute;pointer-events:none;transform:translate(-50%,-50%);width:76px;max-width:30%;height:17px;border:2px solid #278454;border-radius:3px;background:#64be8840;box-shadow:0 0 0 3px #69b48a25}
.paper-pdf__toolbar button[aria-pressed=true]{background:var(--a-color-bg-subtle,#e7edf3);font-weight:600}
.paper-pdf__outline{max-height:30%;overflow:auto;flex-shrink:0;border-bottom:1px solid var(--a-color-border-soft,#ddd);font-size:12px;padding:4px}
.paper-pdf__outline button{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:5px 8px;text-align:left;border:0;background:transparent;color:inherit;cursor:pointer;overflow-wrap:anywhere}
.paper-pdf__outline small{color:var(--a-color-text-secondary,#64748b)}
.paper-pdf__text-note{padding:4px 8px;font-size:11px;color:var(--a-color-text-secondary,#64748b)}
.paper-pdf__text-layer{position:absolute;inset:0;overflow:hidden;z-index:2;user-select:text;cursor:text}
.paper-pdf__text-layer :deep(span){user-select:text}
.paper-pdf__footer{font-size:11px}.paper-pdf__footer>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.paper-pdf__footer>span:last-child{white-space:nowrap;flex:none}
@media(max-width:480px){.paper-pdf__toolbar{gap:3px;padding:3px 4px}.paper-pdf__toolbar-group+.paper-pdf__toolbar-group{padding-left:3px}}
</style>
