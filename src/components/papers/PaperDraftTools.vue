<template>
 <div class="paper-drafts">
  <p>本机草稿保护仅保存尚未提交的源码，刷新或关闭浏览器后仍可恢复。数据以明文留在当前浏览器，非云端备份；请勿在公共设备开启。清理浏览器数据会删除这些草稿。</p>
  <PCheckbox class="paper-drafts__check" :model-value="enabled" :disabled="!available||disabled" @update:model-value="$emit('toggle',$event)">启用本机草稿保护</PCheckbox>
  <p v-if="!available">需要已验证的登录账号和可用的浏览器存储。</p>
  <p v-if="message" role="status">{{ message }}</p>
  <p v-if="!rows.length">当前项目没有可恢复的本机草稿。</p>
  <p v-else>已备份 {{ rows.length }} 份草稿。关闭保护不会删除既有草稿，可在下方逐条删除。</p>
  <div v-for="row in rows" :key="draftKey(row)" class="paper-drafts__row">
   <PButton size="sm" variant="ghost" type="button" class="paper-drafts__select" :aria-pressed="selectedKey===draftKey(row)" @click="selectedKey=draftKey(row)">
    <strong>{{ row.path }}</strong>
    <small>基于 v{{ row.baseRevision }} · {{ new Date(row.updatedAt).toLocaleString() }} · {{ label(row) }}</small>
   </PButton>
  </div>
  <div v-if="selected" class="paper-drafts__detail">
   <p>{{ compatible(selected)?'服务器版本与草稿基础版本一致，可恢复至编辑器。恢复后按常规自动保存流程提交。':'服务器文件已变化或被删除。请复制草稿并手动合并，不会直接覆盖服务器版本。' }}</p>
   <PTextarea readonly :model-value="selected.content" aria-label="本机草稿源码" :rows="8" spellcheck="false"/>
   <div class="paper-drafts__actions">
    <PButton type="button" size="sm" :disabled="disabled||!compatible(selected)||!canRecover" @click="$emit('recover',selected)">恢复到编辑器</PButton>
    <PButton type="button" size="sm" variant="secondary" @click="copy(selected)">复制草稿</PButton>
    <PButton type="button" size="sm" variant="ghost" :disabled="disabled" @click="$emit('remove',selected)">删除草稿</PButton>
   </div>
   <p v-if="copyMessage" role="status">{{ copyMessage }}</p>
  </div>
 </div>
</template>
<script setup lang="ts">
import PTextarea from '@/components/ui/PTextarea.vue'
import PCheckbox from '@/components/ui/PCheckbox.vue'
import {computed,ref} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import type {PaperFile} from '@/api/papers'
import {draftKey,matchesLocalDraftBase,type PaperLocalDraft} from './localDrafts'
const props=defineProps<{available:boolean;enabled:boolean;rows:PaperLocalDraft[];files:PaperFile[];disabled:boolean;canRecover:boolean;message:string}>()
defineEmits<{toggle:[enabled:boolean];recover:[row:PaperLocalDraft];remove:[row:PaperLocalDraft]}>()
const selectedKey=ref(''),copyMessage=ref('')
const selected=computed(()=>props.rows.find(row=>draftKey(row)===selectedKey.value)||props.rows[0]||null)
function compatible(row:PaperLocalDraft){const file=props.files.find(f=>f.id===row.fileId);return !!file&&matchesLocalDraftBase(row,file)}
function label(row:PaperLocalDraft){return compatible(row)?'可恢复':props.files.some(f=>f.id===row.fileId)?'需手动合并':'文件已删除'}
async function copy(row:PaperLocalDraft){try{await navigator.clipboard.writeText(row.content);copyMessage.value='已复制草稿。'}catch{copyMessage.value='无法访问剪贴板，请手动复制上方源码。'}}
</script>
<style scoped>
.paper-drafts,.paper-drafts__detail{display:grid;gap:8px;min-width:0}
.paper-drafts p{margin:0;line-height:1.6;overflow-wrap:anywhere}
.paper-drafts__check,.paper-drafts__actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.paper-drafts__row{border:1px solid var(--a-color-border-soft,#ddd);border-radius:5px;padding:4px}
.paper-drafts__select{display:grid;gap:4px;text-align:left;width:100%;background:transparent;border:0;color:inherit;padding:5px;cursor:pointer;overflow-wrap:anywhere}
.paper-drafts__select[aria-pressed=true]{background:var(--a-color-bg-subtle,#e7edf3)}
.paper-drafts__select small{color:var(--a-color-text-secondary,#64748b)}
.paper-drafts textarea{font:12px 'SFMono-Regular',Consolas,monospace;color:inherit;background:var(--a-color-bg,#fff);border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;width:100%;box-sizing:border-box;resize:vertical}
</style>
