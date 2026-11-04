<template>
  <section class="note-editor a-content-frame" aria-label="编辑笔记合集">
    <PPageHeader :title="newCollection?'创建笔记合集':'编辑笔记合集'" sub="私人草稿与发布快照分离；只有主动发布才会更新分享内容。" />
    <nav><RouterLink :to="`/books/work/${workId}/collections`">返回我的合集</RouterLink> · <RouterLink :to="`/books/work/${workId}/notes`">作品笔记</RouterLink></nav>
    <p v-if="loading">正在读取草稿…</p><p v-else-if="loadError" role="alert">{{ loadError }}</p>
    <template v-else>
      <label>合集标题<input v-model="draft.title" aria-label="合集标题" maxlength="120" placeholder="例如：重要的读书发现" /></label>
      <label>介绍（选填）<textarea v-model="draft.description" aria-label="合集介绍" rows="3" maxlength="3000" /></label>
      <section class="note-editor__panel" aria-label="挑选笔记">
        <h2>挑选笔记（{{ draft.items.length }}/40）</h2>
        <p>可从同一作品的多个电子书版本挑选记录。</p>
        <p v-if="notesError" role="alert">{{ notesError }}</p>
        <ul><li v-for="item in available" :key="item.id">
          <label class="note-editor__choice"><input type="checkbox" :checked="selected(item)" :disabled="draft.items.length>=40&&!selected(item)" @change="toggle(item)" />
            <span>{{ item.type==='highlight'?'划线':'独立笔记' }} · {{ item.title||item.quote?.slice(0,80)||item.note?.slice(0,80)||'未命名笔记' }}<small v-if="item.source">{{ item.source.file_name }}</small></span>
          </label>
        </li></ul>
        <button v-if="available.length<availableTotal" :disabled="notesBusy" @click="fetchNotes">加载更多</button>
      </section>
      <section class="note-editor__panel" aria-label="合集顺序">
        <h2>合集内容顺序</h2>
        <p v-if="!draft.items.length">尚未选择笔记。允许保存空草稿，但发布时需要至少一条记录。</p>
        <ol v-else><li v-for="(item,index) in draft.items" :key="item.id">
          <span>{{ summary(item) }}</span><span class="note-editor__item-actions">
          <button :disabled="index===0" @click="move(index,-1)">上移</button><button :disabled="index===draft.items.length-1" @click="move(index,1)">下移</button><button @click="draft.items.splice(index,1)">移除</button></span>
        </li></ol>
      </section>
      <div class="note-editor__actions"><PButton variant="secondary" :disabled="busy||!draft.title.trim()" @click="save">保存私人草稿</PButton><span v-if="version">草稿版本 {{ version }}{{ changed?' · 尚未保存':'' }}</span></div>
      <section class="note-editor__panel" aria-label="发布权限">
        <h2>访问权限</h2><p>当前：{{ visibilityName(currentVisibility) }}。已发布 {{ publishedVersion }} 个快照版本。</p>
        <label>选择权限<select v-model="nextVisibility" aria-label="选择分享权限"><option value="private">私有（撤销公开分享）</option><option value="link">通过链接访问</option><option value="public">完全公开</option></select></label>
        <div class="note-editor__actions">
          <PButton v-if="nextVisibility!=='private'" :disabled="busy||previewBusy||!draft.title.trim()||!draft.items.length" @click="openPreview">{{ previewBusy?'生成公开内容预览…':'预览并发布' }}</PButton>
          <PButton v-if="nextVisibility==='private'&&currentVisibility!=='private'" variant="secondary" :disabled="busy" @click="action='revoke'">撤销分享</PButton>
          <RouterLink v-if="sharePath" :to="sharePath">查看已发布内容</RouterLink>
          <PButton v-if="sharePath" variant="ghost" @click="copyLink">复制链接</PButton>
        </div>
        <p>更新私人草稿不会自动改变已发布内容；重新发布仍使用同一个分享链接。</p>
      </section>
      <section v-if="publishedVersion" class="note-editor__panel" aria-label="分享历史版本">
        <h2>发布历史与修订</h2>
        <p>历史快照只供作者查看，不能直接修改或用旧链接访问；重新发布会创建一个新版本。</p>
        <PButton variant="ghost" :disabled="historyLoading" @click="toggleHistory">{{ historyOpen?'收起历史':'查看历史版本' }}</PButton>
        <template v-if="historyOpen">
          <p v-if="historyError" role="alert">{{ historyError }}</p>
          <ul v-else class="note-editor__history">
            <li v-for="entry in history" :key="entry.version">
              <span>版本 {{ entry.version }} · {{ dateLabel(entry.published_at) }} · {{ entry.note_count }} 条{{ entry.active?' · 当前公开':'' }}</span>
              <PButton size="sm" variant="secondary" @click="openHistoryVersion(entry.version)">查看冻结内容</PButton>
            </li>
          </ul>
          <PButton v-if="history.length<historyTotal" variant="ghost" :disabled="historyLoading" @click="loadHistory(true)">更多历史版本</PButton>
        </template>
      </section>
      <p v-if="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    </template>
    <PConfirm :show="action==='revoke'" title="确认撤销分享？" message="撤销后旧链接不可访问，私人草稿和历史冻结版本保留。" :loading="busy" @confirm="confirmRevoke" @cancel="action=''" />
    <PSheet :show="!!previewContent" title="发布前预览：将向他人展示的全部内容" mode="full" @close="previewContent=undefined">
      <div v-if="previewContent" class="note-editor__preview">
        <p><strong>访问权限：{{ visibilityName(previewVisibility) }}</strong>。请核对下方的所有条目。</p>
        <h2>{{ previewContent.title }}</h2><p v-if="previewContent.description">{{ previewContent.description }}</p>
        <ol><li v-for="(entry,index) in previewContent.items" :key="index">
          <h3 v-if="entry.title">{{ entry.title }}</h3>
          <blockquote v-if="entry.quote">{{ entry.quote }}</blockquote>
          <p v-if="entry.note" class="note-editor__preview-text">{{ entry.note }}</p>
          <small v-if="entry.chapter">{{ entry.chapter }}</small>
        </li></ol>
        <p class="note-editor__privacy">只会公开这里显示的文本。其他私人笔记、电子书文件、阅读位置、文件路径均不会公开。</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <div class="note-editor__actions">
          <PButton variant="secondary" :disabled="busy" @click="previewContent=undefined">取消</PButton>
          <PButton :disabled="busy" @click="publishFromPreview">确认按预览发布</PButton>
        </div>
      </div>
    </PSheet>
    <PSheet :show="!!selectedHistory" title="只读历史快照" mode="full" @close="selectedHistory=undefined">
      <div v-if="selectedHistory" class="note-editor__preview">
        <p>版本 {{ selectedHistory.version }} · {{ dateLabel(selectedHistory.published_at) }} {{ selectedHistory.active?'（当前发布）':'（历史，仅本人可见）' }}</p>
        <h2>{{ selectedHistory.title }}</h2>
        <p v-if="selectedHistory.description">{{ selectedHistory.description }}</p>
        <ol><li v-for="(entry,index) in selectedHistory.items" :key="index">
          <h3 v-if="entry.title">{{ entry.title }}</h3>
          <blockquote v-if="entry.quote">{{ entry.quote }}</blockquote>
          <p v-if="entry.note" class="note-editor__preview-text">{{ entry.note }}</p>
        </li></ol>
        <PButton variant="secondary" @click="selectedHistory=undefined">关闭</PButton>
      </div>
    </PSheet>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { listWorkNotes, type WorkNoteItem } from '@/api/bookReading'
import { getNoteCollection, publishNoteCollection, revokeNoteCollection, saveNoteCollection, previewNoteCollection, listNoteShareHistory, getNoteShareHistoryVersion, type NotePreviewResult, type NoteShareHistoryItem, type NoteShareHistoryDetail, type NoteCollection, type NoteCollectionDraft, type NoteCollectionReference, type NoteShareVisibility } from '@/api/bookNoteCollections'
const route=useRoute(),router=useRouter()
const workId=computed(()=>String(route.params.workId||''))
const newCollection=computed(()=>!route.params.collectionId||route.params.collectionId==='new')
const id=String(newCollection.value?crypto.randomUUID():route.params.collectionId)
const draft=reactive<NoteCollectionDraft>({title:'',description:'',items:[]})
const available=ref<WorkNoteItem[]>([]),availableTotal=ref(0),notesBusy=ref(false),notesError=ref('')
const loading=ref(false),loadError=ref(''),busy=ref(false),error=ref(''),notice=ref('')
const version=ref(0),publishedVersion=ref(0),currentVisibility=ref<NoteShareVisibility>('private'),nextVisibility=ref<NoteShareVisibility>('private'),sharePath=ref('')
const baseline=ref(JSON.stringify(draft)),changed=computed(()=>JSON.stringify(draft)!==baseline.value)
const action=ref<''|'revoke'>('')
const previewContent=ref<NotePreviewResult>()
const previewBusy=ref(false)
const previewSignature=ref('')
const previewVisibility=ref<NoteShareVisibility>('private')
const historyOpen=ref(false),historyLoading=ref(false),historyError=ref('')
const history=ref<NoteShareHistoryItem[]>([]),historyTotal=ref(0)
const selectedHistory=ref<NoteShareHistoryDetail>()
let requestID=''
function visibilityName(value:NoteShareVisibility){return {private:'私有',link:'通过链接访问',public:'完全公开'}[value]}
function apply(value:NoteCollection){Object.assign(draft,{title:value.title,description:value.description,items:value.items.map(x=>({...x}))});version.value=value.version;publishedVersion.value=value.published_version;currentVisibility.value=value.visibility;nextVisibility.value=value.visibility;sharePath.value=value.share_path||'';baseline.value=JSON.stringify(draft)}
async function load(){if(newCollection.value)return;loading.value=true;loadError.value='';try{apply(await getNoteCollection(id))}catch{loadError.value='合集不存在、无权访问或加载失败。'}finally{loading.value=false}}
async function fetchNotes(){if(notesBusy.value)return;notesBusy.value=true;notesError.value='';try{const result=await listWorkNotes(workId.value,{limit:100,offset:available.value.length});available.value.push(...result.items);availableTotal.value=result.total}catch{notesError.value='未能加载可选笔记。'}finally{notesBusy.value=false}}
function selected(item:WorkNoteItem){return draft.items.some(ref=>ref.id===item.id&&ref.kind===item.type)}
function toggle(item:WorkNoteItem){const index=draft.items.findIndex(ref=>ref.id===item.id&&ref.kind===item.type);if(index>=0)draft.items.splice(index,1);else if(draft.items.length<40)draft.items.push({kind:item.type,id:item.id})}
function move(index:number,delta:number){const target=index+delta;if(target<0||target>=draft.items.length)return;[draft.items[index],draft.items[target]]=[draft.items[target]!,draft.items[index]! ]}
function summary(ref:NoteCollectionReference){const note=available.value.find(x=>x.id===ref.id&&x.type===ref.kind);return note?.title||note?.quote?.slice(0,75)||note?.note?.slice(0,75)||`原笔记 ${ref.id.slice(0,8)}`}
async function save():Promise<boolean>{if(!draft.title.trim())return false;busy.value=true;error.value='';notice.value='';try{const saved=await saveNoteCollection(id,workId.value,version.value,{title:draft.title,description:draft.description,items:draft.items.map(x=>({...x}))});apply(saved);notice.value='私人草稿已保存。';if(newCollection.value)void router.replace(`/books/work/${workId.value}/collections/${id}`);return true}catch{error.value='保存失败或版本发生冲突，请重新打开后再编辑。';return false}finally{busy.value=false}}
async function openPreview(){
 if(previewBusy.value||busy.value||!draft.title.trim()||!draft.items.length)return
 previewBusy.value=true;error.value=''
 const signature=JSON.stringify({draft,visibility:nextVisibility.value,workId:workId.value})
 const requestedVisibility=nextVisibility.value
 try {
  const response=await previewNoteCollection(workId.value,{title:draft.title,description:draft.description,items:draft.items.map(item=>({...item}))})
  if(signature!==JSON.stringify({draft,visibility:nextVisibility.value,workId:workId.value})) {error.value='预览时草稿已改变，请重新预览。';return}
  if(previewSignature.value!==signature)requestID=''
  previewSignature.value=signature
  previewVisibility.value=requestedVisibility
  previewContent.value=response
 }catch{error.value='生成预览失败。请检查是否包含已删除的笔记、过长的引文或访问权限。'}finally{previewBusy.value=false}
}
async function publishFromPreview(){
 const snapshot=previewContent.value
 if(!snapshot||busy.value)return
 if(previewSignature.value!==JSON.stringify({draft,visibility:nextVisibility.value,workId:workId.value})){
  previewContent.value=undefined;error.value='内容或访问权限已修改，请重新预览后发布。';return
 }
 const visibility=previewVisibility.value==='public'?'public':'link'
 previewContent.value=undefined
 if((changed.value||version.value===0)&&!(await save()))return
 busy.value=true;error.value='';notice.value=''
 try{
  requestID||=crypto.randomUUID()
  const published=await publishNoteCollection(id,version.value,visibility,requestID,snapshot.digest)
  requestID='';apply(published);notice.value='已按预览发布新的冻结快照，分享链接保持不变。'
  if(historyOpen.value){history.value=[];await loadHistory()}
 }catch{error.value='发布失败：私人来源可能在预览后被修改，请重新预览；网络未确认时可重试。'}finally{busy.value=false}
}
async function confirmRevoke(){action.value='';if(busy.value)return;busy.value=true;error.value='';notice.value='';try{
 const result=await revokeNoteCollection(id,version.value)
 apply(result);notice.value='分享已撤销，私人草稿及历史版本仍保留。'
 if(historyOpen.value){history.value=[];await loadHistory()}
}catch{error.value='撤销失败，请刷新后重试。'}finally{busy.value=false}}
function dateLabel(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('zh-CN')}
async function toggleHistory(){historyOpen.value=!historyOpen.value;if(historyOpen.value){history.value=[];await loadHistory()}}
async function loadHistory(append=false){if(historyLoading.value||!publishedVersion.value)return;historyLoading.value=true;historyError.value='';try{
 const result=await listNoteShareHistory(id,append?history.value.length:0)
 history.value=append?[...history.value,...result.items]:result.items;historyTotal.value=result.total
}catch{historyError.value='历史快照加载失败，只有合集作者可以查看。'}finally{historyLoading.value=false}}
async function openHistoryVersion(target:number){historyError.value='';try{selectedHistory.value=await getNoteShareHistoryVersion(id,target)}catch{historyError.value='无法读取此历史版本，可能不存在或已无权访问。'}}
async function copyLink(){if(!sharePath.value)return;try{await navigator.clipboard.writeText(`${location.origin}${sharePath.value}`);notice.value='分享链接已复制。'}catch{notice.value=`复制失败，请手动打开：${sharePath.value}`}}
onMounted(async()=>{if(newCollection.value&&['highlight','chapter_note'].includes(String(route.query.kind||''))&&typeof route.query.note_id==='string')draft.items=[{kind:route.query.kind as 'highlight'|'chapter_note',id:route.query.note_id}];await Promise.all([load(),fetchNotes()])})
</script>
<style scoped>
.note-editor{display:grid;gap:1rem;max-width:62rem;padding:1.25rem 1.5rem 3rem;margin-inline:auto}
.note-editor>label,.note-editor__panel>label{display:grid;gap:.45rem}
.note-editor input:not([type=checkbox]),.note-editor textarea,.note-editor select{width:100%;background:var(--a-color-surface,transparent);color:inherit;border:1px solid var(--a-color-border-soft);border-radius:.5rem;padding:.7rem}
.note-editor__panel{border:1px solid var(--a-color-border-soft);border-radius:.75rem;padding:1rem}
.note-editor__panel h2{font-size:1.04rem;margin:.3rem 0}
.note-editor__panel p,.note-editor__actions span{font-size:.86rem;color:var(--a-color-text-secondary)}
.note-editor__panel ul{list-style:none;max-height:18rem;overflow:auto;margin:.5rem 0;padding:0}
.note-editor__panel li{padding:.5rem 0;border-bottom:1px solid var(--a-color-border-soft)}
.note-editor__choice{display:flex;gap:.5rem;align-items:flex-start}
.note-editor__choice small{display:block;color:var(--a-color-text-secondary);font-size:.75rem}
.note-editor__panel ol{padding-left:1.5rem}
.note-editor__panel ol li{display:flex;gap:.8rem;justify-content:space-between}
.note-editor__item-actions,.note-editor__actions{display:flex;gap:.65rem;align-items:center;flex-wrap:wrap}
.note-editor__item-actions button{border:0;background:transparent;color:var(--a-color-primary,#3764a6);cursor:pointer}
 .note-editor__preview { max-width:50rem; margin-inline:auto; padding:1.5rem; display:grid; gap:1rem; }
 .note-editor__preview h2 {font-size:1.45rem;margin:0}
 .note-editor__preview ol{display:grid;gap:1rem;padding-left:1.5rem}
 .note-editor__preview li{border-bottom:1px solid var(--a-color-border-soft);padding:.5rem 0}
 .note-editor__preview blockquote{margin:.5rem 0;border-left:3px solid #c4a151;padding:.35rem .8rem;white-space:pre-wrap}
 .note-editor__preview-text{white-space:pre-wrap;line-height:1.7}
 .note-editor__privacy{font-size:.85rem;color:var(--a-color-text-secondary)}
 .note-editor__history{list-style:none;padding:0;margin:.5rem 0;display:grid;gap:.55rem}
 .note-editor__history li{display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap}
</style>
