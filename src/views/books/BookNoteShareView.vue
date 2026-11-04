<template>
  <article class="shared-notes a-content-frame" aria-label="已发布的读书笔记">
    <p v-if="loading" role="status">正在打开分享的笔记…</p>
    <div v-else-if="error" role="alert"><h2>分享已不可访问</h2><p>{{ error }}</p><RouterLink to="/books">返回图书</RouterLink></div>
    <template v-else-if="share">
      <header class="shared-notes__heading">
        <p class="shared-notes__eyebrow">读书笔记 · {{ share.visibility==='public'?'完全公开':'通过链接分享' }}</p>
        <h1>{{ share.title }}</h1>
        <p v-if="share.description" class="shared-notes__description">{{ share.description }}</p>
        <small>发布版本 {{ share.version }} · {{ date(share.published_at) }}</small>
      </header>
      <ol class="shared-notes__entries">
        <li v-for="(item,index) in share.items" :key="index">
          <article>
            <span class="shared-notes__kind">{{ item.kind==='highlight'?'摘录与批注':'独立阅读笔记' }}</span>
            <h2 v-if="item.title">{{ item.title }}</h2>
            <blockquote v-if="item.quote" :data-color="item.color||'yellow'">{{ item.quote }}</blockquote>
            <p v-if="item.note" class="shared-notes__body">{{ item.note }}</p>
            <p v-if="item.chapter" class="shared-notes__chapter">{{ item.chapter }}</p>
          </article>
        </li>
      </ol>
      <p class="shared-notes__footnote">这是主动发布时保存的内容快照。私有笔记、完整电子书与阅读进度不会随分享公开。</p>
    </template>
  </article>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getSharedNoteCollection, type SharedNoteCollection } from '@/api/bookNoteCollections'
const route=useRoute()
const share=ref<SharedNoteCollection>()
const loading=ref(true)
const error=ref('')
function date(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('zh-CN')}
let managedMeta:HTMLMetaElement|undefined
let insertedMeta=false
let oldRobots=''
function protectUnlistedLink(){
 let node=document.querySelector('meta[name="robots"]') as HTMLMetaElement|null
 if(!node){node=document.createElement('meta');node.name='robots';document.head.appendChild(node);insertedMeta=true}
 else oldRobots=node.content
 node.content='noindex,nofollow'
 managedMeta=node
}
onMounted(async()=>{
 try{
  share.value=await getSharedNoteCollection(String(route.params.shareKey||''))
  if(share.value.visibility==='link')protectUnlistedLink()
 }catch{error.value='分享可能已撤销、改为私有，或链接不正确。'}finally{loading.value=false}
})
onBeforeUnmount(()=>{
 if(managedMeta){if(insertedMeta)managedMeta.remove();else managedMeta.content=oldRobots}
})
</script>
<style scoped>
.shared-notes{max-width:48rem;margin-inline:auto;padding:2.25rem 1.25rem 4rem}
.shared-notes__heading{border-bottom:1px solid var(--a-color-border-soft);padding-bottom:1.3rem;margin-bottom:2rem}
.shared-notes__eyebrow,.shared-notes__kind,.shared-notes__chapter,.shared-notes__footnote{font-size:.82rem;color:var(--a-color-text-secondary)}
.shared-notes__heading h1{font-size:1.8rem;line-height:1.3}
.shared-notes__description,.shared-notes__body{white-space:pre-wrap;line-height:1.75}
.shared-notes__entries{list-style:none;counter-reset:note;padding:0;display:grid;gap:1.2rem}
.shared-notes__entries>li{border:1px solid var(--a-color-border-soft);border-radius:.7rem;padding:1.25rem}
.shared-notes__entries h2{font-size:1.15rem}
.shared-notes__entries blockquote{margin:1rem 0;padding:.3rem 1rem;border-left:3px solid #d4ac37;line-height:1.75}
.shared-notes__entries blockquote[data-color=blue]{border-color:#6097d9}
.shared-notes__entries blockquote[data-color=green]{border-color:#64a979}
.shared-notes__entries blockquote[data-color=pink]{border-color:#da79ae}
.shared-notes__footnote{padding-top:1.3rem;border-top:1px solid var(--a-color-border-soft)}
</style>
