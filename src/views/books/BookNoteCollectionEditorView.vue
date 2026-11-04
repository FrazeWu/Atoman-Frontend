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
          <PButton v-if="nextVisibility!=='private'" :disabled="busy||!draft.title.trim()||!draft.items.length" @click="action='publish'">主动发布快照</PButton>
          <PButton v-if="nextVisibility==='private'&&currentVisibility!=='private'" variant="secondary" :disabled="busy" @click="action='revoke'">撤销分享</PButton>
          <RouterLink v-if="sharePath" :to="sharePath">查看已发布内容</RouterLink>
          <PButton v-if="sharePath" variant="ghost" @click="copyLink">复制链接</PButton>
        </div>
        <p>更新私人草稿不会自动改变已发布内容；重新发布仍使用同一个分享链接。</p>
      </section>
      <p v-if="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    </template>
    <PConfirm :show="!!action" :title="action==='publish'?'确认发布快照？':'确认撤销分享？'" :message="action==='publish'?`仅公开选中的 ${draft.items.length} 条笔记及你的说明，${nextVisibility==='public'?'所有人都能访问':'拥有链接的人可以访问'}；不公开其他私人笔记。`:'撤销后旧链接立即不可访问，私人草稿和历史版本保留。'" :loading="busy" @confirm="confirm" @cancel="action=''" />
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { listWorkNotes, type WorkNoteItem } from '@/api/bookReading'
import { getNoteCollection, publishNoteCollection, revokeNoteCollection, saveNoteCollection, type NoteCollection, type NoteCollectionDraft, type NoteCollectionReference, type NoteShareVisibility } from '@/api/bookNoteCollections'
const route=useRoute(),router=useRouter()
const workId=computed(()=>String(route.params.workId||''))
const newCollection=computed(()=>!route.params.collectionId||route.params.collectionId==='new')
const id=String(newCollection.value?crypto.randomUUID():route.params.collectionId)
const draft=reactive<NoteCollectionDraft>({title:'',description:'',items:[]})
const available=ref<WorkNoteItem[]>([]),availableTotal=ref(0),notesBusy=ref(false),notesError=ref('')
const loading=ref(false),loadError=ref(''),busy=ref(false),error=ref(''),notice=ref('')
const version=ref(0),publishedVersion=ref(0),currentVisibility=ref<NoteShareVisibility>('private'),nextVisibility=ref<NoteShareVisibility>('private'),sharePath=ref('')
const baseline=ref(JSON.stringify(draft)),changed=computed(()=>JSON.stringify(draft)!==baseline.value)
const action=ref<''|'publish'|'revoke'>('')
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
async function confirm(){const requested=action.value;action.value='';if(!requested||busy.value)return;const confirmedVisibility=nextVisibility.value;if(requested==='publish'&&changed.value&&!(await save()))return;busy.value=true;error.value='';notice.value='';try{
 if(requested==='publish'){requestID||=crypto.randomUUID();const result=await publishNoteCollection(id,version.value,confirmedVisibility==='public'?'public':'link',requestID);requestID='';apply(result);notice.value='新快照已发布。已有分享链接保持不变。'}
 else{const result=await revokeNoteCollection(id,version.value);apply(result);notice.value='分享已撤销，私人草稿已保留。'}
}catch{error.value='操作失败，若网络未确认请使用原请求重试。'}finally{busy.value=false}}
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
</style>
