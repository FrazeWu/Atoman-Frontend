<template>
 <details class="paper-reference-import">
  <summary>导入参考文献与阅读笔记</summary>
  <p>支持粘贴 Zotero 或其他文献管理器导出的 BibTeX，也可以按 DOI / arXiv 查询公开元数据。导入前预览并确认；不自动生成缺失字段。</p>
  <PSelect v-model="kind" label="文献来源" :options="[{value:'doi',label:'DOI（Crossref）'},{value:'arxiv',label:'arXiv（DataCite DOI）'}]" size="sm" :disabled="disabled||loading||writing" />
  <PInput v-model.trim="identifier" label="文献编号" maxlength="250" :placeholder="kind==='doi'?'10.xxxx/xxxxx':'1706.03762'" :disabled="disabled||loading||writing" />
  <PButton type="button" size="sm" variant="secondary" :disabled="disabled||loading||writing||!identifier" @click="lookup">查询并生成 BibTeX</PButton>
  <small>查询会直接向公开元数据服务发送该编号，不发送论文、书架内容或 API Key。若服务不可用，可手动粘贴 BibTeX。</small>
  <details class="paper-reference-import__books">
   <summary>从 AToMAN 个人书架选择</summary>
   <PButton type="button" size="sm" variant="secondary" :disabled="disabled||loading||writing" @click="loadShelf(0)">读取我的书架</PButton>
   <PInput v-if="shelf.length" v-model.trim="query" label="筛选当前书架页" maxlength="120" />
   <PSelect v-if="filteredShelf.length" :model-value="workId" label="书架作品" size="sm" :options="filteredShelf.map(row=>({value:row.work_id,label:row.work_title}))" :disabled="disabled||loading||writing" @update:model-value="selectWork(String($event))" />
   <div class="paper-reference-import__row" v-if="total">
    <PButton type="button" size="sm" variant="secondary" :disabled="loading||offset===0||disabled" @click="loadShelf(Math.max(0,offset-100))">上一页</PButton>
    <small>{{offset+1}}–{{Math.min(total,offset+shelf.length)}} / {{total}}</small>
    <PButton type="button" size="sm" variant="secondary" :disabled="loading||offset+100>=total||disabled" @click="loadShelf(offset+100)">下一页</PButton>
   </div>
   <template v-if="work">
    <strong>{{work.title}}</strong>
    <PSelect v-if="work.editions.length" :model-value="edition" label="引用版本" size="sm" :options="work.editions.map(e=>({value:e.id,label:[e.title||work!.title,e.publisher,e.published_date].filter(Boolean).join(' · ')}))" @update:model-value="edition=String($event)" />
    <div class="paper-reference-import__row">
     <PButton type="button" size="sm" variant="secondary" :disabled="disabled||loading||writing" @click="fromBook">生成书籍 BibTeX</PButton>
     <PButton type="button" size="sm" variant="secondary" :disabled="disabled||loading" @click="loadNotes(0)">查看我的划线与笔记</PButton>
    </div>
    <p v-if="notesLoaded">读取了 {{notes.length}} / {{notesTotal}} 条私人阅读记录；它们不会自动进入论文或模型请求。</p>
    <div v-for="note in notes" :key="note.id" class="paper-reference-import__note">
     <strong>{{note.title||'阅读划线'}}</strong><small>{{note.source?.edition_label||note.source?.file_name||''}}</small>
     <pre v-if="note.quote">{{note.quote}}</pre><pre v-if="note.note">{{note.note}}</pre>
     <PButton type="button" size="sm" variant="ghost" @click="copyNote(note)">复制该条阅读记录</PButton>
    </div>
    <PButton v-if="notesTotal>notesOffset+notes.length" type="button" size="sm" variant="secondary" :disabled="loading||disabled" @click="loadNotes(notesOffset+notes.length)">下一页笔记</PButton>
   </template>
  </details>
  <PTextarea v-model="bib" label="BibTeX 导入预览" aria-label="BibTeX 导入预览" :rows="6" maxlength="32768" :disabled="disabled||writing" placeholder="粘贴 @article、@book 等完整条目" />
  <PSelect :model-value="targetId" label="导入目标 .bib" size="sm" :options="targets" :disabled="disabled||writing" @update:model-value="targetId=String($event)" />
  <p v-if="importError" role="status">{{importError}}</p>
  <PButton type="button" size="sm" :disabled="disabled||writing||loading||!keys.length||!targetId" @click="append">确认导入 {{keys.length}} 条文献</PButton>
  <p v-if="message" role="status">{{message}}</p>
 </details>
</template>
<script setup lang="ts">
import {computed,ref,shallowRef,watch,onBeforeUnmount} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type {PaperFile} from '@/api/papers'
import {listLibrary,type LibraryEntry} from '@/api/book/private'
import {getCatalogWork,type CatalogWork} from '@/api/book/catalog'
import {listWorkNotes,type WorkNoteItem} from '@/api/book/reading'
import {lookupReference,bookReference,importBibtexKeys} from './referenceImport'
const props=defineProps<{projectId:string;accountId:string;files:PaperFile[];disabled:boolean;append:(target:string,bib:string)=>Promise<boolean>}>()
const kind=ref<'doi'|'arxiv'>('doi'),identifier=ref(''),bib=ref(''),targetId=ref(''),message=ref('')
const loading=ref(false),writing=ref(false),shelf=shallowRef<LibraryEntry[]>([]),offset=ref(0),total=ref(0),query=ref(''),workId=ref(''),work=shallowRef<CatalogWork|null>(null),edition=ref('')
const notes=shallowRef<WorkNoteItem[]>([]),notesTotal=ref(0),notesOffset=ref(0),notesLoaded=ref(false)
const filteredShelf=computed(()=>shelf.value.filter(row=>row.work_title.toLowerCase().includes(query.value.toLowerCase())))
const targets=computed(()=>{const items=props.files.filter(f=>f.kind==='text'&&/\.bib$/i.test(f.path)).map(f=>({value:f.id,label:f.path}));return items.length?items:[{value:'new',label:'新建 references.bib'}]})
const keys=computed(()=>{try{return importBibtexKeys(bib.value)}catch{return []}})
const importError=computed(()=>{if(!bib.value.trim())return '';try{importBibtexKeys(bib.value);return ''}catch(e){return e instanceof Error?e.message:'BibTeX 无效'}})
let serial=0,disposed=false,abort:AbortController|null=null
const scope=()=>props.accountId+':'+props.projectId
function start(){
 if(disposed||loading.value||writing.value||props.disabled)return null
 const n=++serial,initial=scope()
 loading.value=true;message.value=''
 return {valid:()=>!disposed&&n===serial&&scope()===initial,done:()=>{if(!disposed&&n===serial&&scope()===initial)loading.value=false}}
}
async function lookup(){
 const state=start();if(!state)return
 const id=identifier.value,mode=kind.value,ctrl=new AbortController();abort=ctrl
 const timeout=setTimeout(()=>ctrl.abort(),12000)
 try{
  const value=await lookupReference(id,mode,ctrl.signal)
  if(state.valid()&&identifier.value===id&&kind.value===mode){bib.value=value;message.value='已读取公开元数据，请核对后导入。'}
 }catch{if(state.valid())message.value='查询失败或文献服务未返回匹配记录，请核对编号，或粘贴导出的 BibTeX。'}
 finally{clearTimeout(timeout);if(abort===ctrl)abort=null;state.done()}
}
async function loadShelf(page:number){
 const state=start();if(!state)return
 try{
  const result=await listLibrary(page)
  if(!state.valid())return
  if(!Array.isArray(result.items)||result.items.length>100)throw Error('Invalid library')
  shelf.value=result.items;offset.value=page;total.value=result.total;query.value='';workId.value='';work.value=null;notes.value=[];notesLoaded.value=false
  message.value=result.items.length?'已读取个人书架。':'本页暂无作品。'
 }catch{if(state.valid())message.value='无法读取个人书架，请检查图书模块权限。'}
 finally{state.done()}
}
async function selectWork(id:string){
 if(!shelf.value.some(row=>row.work_id===id))return
 const state=start();if(!state)return
 workId.value=id;work.value=null;notes.value=[];notesLoaded.value=false
 try{const result=await getCatalogWork(id);if(state.valid()&&workId.value===id){if(result.id!==id||!Array.isArray(result.editions))throw Error('Invalid work');work.value=result;edition.value=result.editions[0]?.id||''}}
 catch{if(state.valid())message.value='无法读取作品元数据。'}
 finally{state.done()}
}
function fromBook(){if(!work.value||props.disabled||loading.value||writing.value)return;try{bib.value=bookReference(work.value,edition.value);message.value='已生成书籍元数据，缺失字段不会自动补造。'}catch{message.value='该书籍缺少可用元数据。'}}
async function loadNotes(page:number){
 const id=work.value?.id;if(!id)return
 const state=start();if(!state)return
 try{
  const result=await listWorkNotes(id,{limit:30,offset:page})
  if(!state.valid()||work.value?.id!==id)return
  if(result.work_id!==id||!Array.isArray(result.items)||result.items.length>30)throw Error('Invalid notes')
  notes.value=result.items;notesTotal.value=result.total;notesOffset.value=page;notesLoaded.value=true
 }catch{if(state.valid())message.value='无法读取你的阅读笔记。'}
 finally{state.done()}
}
async function copyNote(note:WorkNoteItem){
 if(disposed||!notes.value.some(n=>n.id===note.id))return
 const initial=scope()
 try{await navigator.clipboard.writeText([work.value?.title,note.source?.edition_label,note.quote,note.note].filter(Boolean).join('\n'));if(!disposed&&scope()===initial)message.value='已复制，未写入论文或发送给模型。'}catch{if(!disposed&&scope()===initial)message.value='剪贴板不可用，请手动复制。'}
}
async function append(){
 if(disposed||props.disabled||writing.value||loading.value||!keys.value.length||!targets.value.some(t=>t.value===targetId.value))return
 const initial=scope(),raw=bib.value,dest=targetId.value
 writing.value=true;message.value=''
 try{const done=await props.append(dest,raw);if(!disposed&&scope()===initial){message.value=done?'已导入参考文献；请在正文插入相应引用键。':'未确认导入，请检查项目版本或重复键。';if(done&&bib.value===raw)bib.value=''}}
 catch{if(!disposed&&scope()===initial)message.value='未确认导入，请刷新项目后再操作。'}
 finally{if(!disposed&&scope()===initial)writing.value=false}
}
watch(targets,items=>{if(!items.some(t=>t.value===targetId.value))targetId.value=items[0]?.value||''},{immediate:true})
watch(scope,()=>{serial++;abort?.abort();abort=null;loading.value=false;writing.value=false;bib.value='';identifier.value='';shelf.value=[];total.value=0;work.value=null;notes.value=[];notesLoaded.value=false;message.value=''})
onBeforeUnmount(()=>{disposed=true;serial++;abort?.abort();work.value=null;notes.value=[];bib.value=''})
</script>
<style scoped>
.paper-reference-import,.paper-reference-import__books{display:grid;gap:7px;padding:8px;border:1px solid var(--a-color-border-soft);border-radius:6px;min-width:0}
.paper-reference-import summary{cursor:pointer;font-weight:600}
.paper-reference-import p,.paper-reference-import small{margin:4px 0;overflow-wrap:anywhere}
.paper-reference-import__row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.paper-reference-import__note{border-top:1px solid var(--a-color-border-soft);padding-top:6px;display:grid;gap:3px;min-width:0}
.paper-reference-import__note pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;margin:0}
</style>
