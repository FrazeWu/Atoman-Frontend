<template>
 <PModal :show="show" title="快速打开文件" size="md" initial-focus="first-input" @update:show="emit('update:show',$event)">
  <div class="paper-quick-open">
   <PInput v-model="query" aria-label="快速搜索文件" placeholder="输入文件名或路径" maxlength="250" autocomplete="off" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="choose(matches[cursor])"/>
   <small>{{query.trim()?'匹配文件':'最近打开的文件优先'}} · {{matches.length}} 个结果</small>
   <div ref="results" class="paper-quick-open__results" aria-label="快速打开结果">
    <PButton v-for="(file,index) in matches" :key="file.id" type="button" variant="ghost" size="sm" :disabled="disabled" :class="{highlight:index===cursor}" :title="file.path" @click="choose(file)">
     <FileCode2 v-if="file.kind==='text'" :size="17" aria-hidden="true"/><Image v-else :size="17" aria-hidden="true"/>
     <span><strong>{{file.path.split('/').at(-1)}}</strong><small>{{file.path}}</small></span>
     <small v-if="file.id===activeId">当前</small>
    </PButton>
    <p v-if="!matches.length">没有匹配的文件。试试其他关键词。</p>
   </div>
   <footer><span>↑ ↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span></footer>
  </div>
 </PModal>
</template>
<script setup lang="ts">
import {computed,nextTick,ref,watch} from 'vue'
import {FileCode2,Image} from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import type {PaperFile} from '@/api/papers'
import {rankPaperFiles} from './workbenchNavigation'
const props=defineProps<{show:boolean;files:PaperFile[];recent:string[];activeId?:string;disabled:boolean}>()
const emit=defineEmits<{'update:show':[show:boolean];choose:[file:PaperFile]}>()
const query=ref(''),cursor=ref(0),results=ref<HTMLElement|null>(null)
const matches=computed(()=>rankPaperFiles(props.files,query.value,props.recent))
watch(()=>props.show,show=>{if(show){query.value='';cursor.value=0}})
watch(query,()=>{cursor.value=0})
watch(matches,rows=>{cursor.value=Math.max(0,Math.min(cursor.value,rows.length-1))})
async function move(delta:number){
 if(!matches.value.length)return
 cursor.value=(cursor.value+delta+matches.value.length)%matches.value.length
 await nextTick()
 results.value?.children.item(cursor.value)?.scrollIntoView?.({block:'nearest'})
}
function choose(file:PaperFile|undefined){if(file&&!props.disabled&&props.show){emit('update:show',false);emit('choose',file)}}
</script>
<style scoped>
.paper-quick-open{display:grid;gap:10px;min-width:0}
.paper-quick-open>small,.paper-quick-open footer{font-size:12px;color:var(--a-color-text-secondary,#64748b)}
.paper-quick-open__results{max-height:min(48vh,350px);overflow:auto;min-width:0;display:grid;gap:3px;align-content:start}
.paper-quick-open__results button{display:flex;justify-content:flex-start;gap:10px;padding:8px 10px;text-align:left;min-width:0}
.paper-quick-open__results button.highlight{background:var(--a-color-bg-soft,#f1f3f5);color:var(--a-color-primary,#26784b)}
.paper-quick-open__results button svg{flex:none}
.paper-quick-open__results button span{display:grid;flex:1;min-width:0;gap:2px;text-align:left}
.paper-quick-open__results button strong,.paper-quick-open__results button small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.paper-quick-open__results button small{font-size:11px;color:var(--a-color-text-secondary,#64748b)}
.paper-quick-open__results p{color:var(--a-color-text-secondary,#64748b);padding:14px 6px;font-size:13px}
.paper-quick-open footer{display:flex;flex-wrap:wrap;gap:12px;padding-top:8px;border-top:1px solid var(--a-color-border-soft,#ddd)}
</style>
