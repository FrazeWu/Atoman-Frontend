<template>
 <div class="paper-members">
  <strong>已加入的成员</strong>
  <p>编辑者可保存已有文本文件并参与实时协作；阅读者只能查看项目文件和最新成功编译的 PDF。直接添加或更新账号权限是备用方式。</p>
  <form class="paper-members__form" @submit.prevent="submit">
   <label>成员账号 UUID
    <PInput v-model.trim="userId" aria-label="成员账号 UUID" maxlength="36" autocomplete="off" :disabled="busy||disabled" placeholder="输入协作者的账号 UUID" />
   </label>
   <PSelect :model-value="role" label="成员权限" size="sm" :options="[{value:'editor',label:'编辑者'},{value:'viewer',label:'阅读者'}]" :disabled="busy||disabled" @update:model-value="role=$event as PaperMemberRole" />
   <PButton type="submit" size="sm" :disabled="!valid||busy||disabled">添加 / 更新成员</PButton>
  </form>
  <p v-if="rows.length===0&&!busy">暂无共享成员。</p>
  <div v-for="member in rows" :key="member.user_id" class="paper-members__row">
   <div class="paper-members__identity"><strong>{{ member.user_id }}</strong><small>{{ member.role==='editor'?'编辑者':'阅读者' }}</small></div>
   <PButton size="sm" type="button" variant="secondary" :disabled="disabled||busy" @click="$emit('set',member.user_id,member.role==='editor'?'viewer':'editor')">{{ member.role==='editor'?'改为阅读者':'改为编辑者' }}</PButton>
   <PButton size="sm" type="button" variant="ghost" :disabled="disabled||busy" @click="$emit('remove',member.user_id)">移除</PButton>
  </div>
  <p>只有项目所有者可以管理成员、文件结构、快照、编译和 ZIP 导出。删除项目时清除共享授权。移除成员不能撤回此前已经读取或复制的内容。</p>
  <p v-if="accountId">我的账号 UUID：<code class="paper-members__uuid">{{ accountId }}</code> <PButton size="sm" variant="ghost" type="button" class="paper-members__copy" @click="copyId">复制</PButton></p>
  <p v-if="message||copyMessage" role="status">{{ message||copyMessage }}</p>
 </div>
</template>
<script setup lang="ts">
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import {computed,ref} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import type {PaperMemberRole,PaperProjectMember} from '@/api/papers'
const props=defineProps<{rows:PaperProjectMember[];accountId:string;busy:boolean;disabled:boolean;message:string}>()
const emit=defineEmits<{set:[userId:string,role:PaperMemberRole];remove:[userId:string]}>()
const userId=ref(''),role=ref<PaperMemberRole>('editor'),copyMessage=ref('')
const valid=computed(()=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId.value)&&userId.value.toLowerCase()!==props.accountId.toLowerCase())
function submit(){if(valid.value&&!props.busy&&!props.disabled)emit('set',userId.value.toLowerCase(),role.value)}
async function copyId(){try{await navigator.clipboard.writeText(props.accountId);copyMessage.value='账号 UUID 已复制。'}catch{copyMessage.value='请手动复制上方账号 UUID。'}}
</script>
<style scoped>
.paper-members,.paper-members__form{display:grid;gap:8px;min-width:0}
.paper-members p{margin:0;line-height:1.6;overflow-wrap:anywhere}
.paper-members__form label{display:grid;gap:4px}
.paper-members__row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;border:1px solid var(--a-color-border-soft,#ddd);border-radius:5px;padding:7px}
.paper-members__identity{flex:1;min-width:120px;display:grid;gap:3px;overflow-wrap:anywhere}
.paper-members__identity small{color:var(--a-color-text-secondary,#64748b)}
.paper-members__uuid{overflow-wrap:anywhere}
</style>
