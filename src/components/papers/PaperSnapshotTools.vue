<template>
 <div class="paper-recovery">
  <p>命名快照包含整个项目的文件、图片、参考文献和主文件设置。每个项目最多保留 30 个；恢复会创建新的版本，并自动保存回滚前的状态。</p>
  <form class="paper-recovery__create" @submit.prevent="submit">
   <label>快照名称<input v-model.trim="name" maxlength="100" placeholder="例如：投稿前版本" aria-label="快照名称" :disabled="disabled||busy" /></label>
   <PButton type="submit" size="sm" :disabled="disabled||busy||!name||rows.length>=30">创建快照</PButton>
  </form>
  <p v-if="message" role="status">{{ message }}</p>
  <p v-if="rows.length>=30" role="status">快照已达上限，请先删除不需要的快照，给自动安全备份预留空间。</p>
  <p v-if="!rows.length&&!busy">暂无项目快照。</p>
  <div v-for="row in rows" :key="row.id" class="paper-recovery__row">
   <button type="button" class="paper-recovery__select" :aria-pressed="detail?.id===row.id" :disabled="disabled||busy" @click="$emit('preview',row.id)">
    <strong>{{ row.name }}</strong>
    <small>{{ row.automatic?'回滚前备份 · ':'' }}项目版本 {{ row.source_revision }} · {{ row.file_count }} 个文件 · {{ formatDate(row.created_at) }}</small>
   </button>
   <button type="button" class="paper-recovery__secondary" :disabled="disabled||busy" @click="$emit('remove',row)">删除快照</button>
  </div>
  <div v-if="detail" class="paper-recovery__detail">
   <strong>{{ detail.name }} · 文件清单</strong>
   <p>恢复将替换当前项目文件集合、路径和主文件设置。快照创建后的新增文件将移出当前项目，但仍可通过自动备份恢复。</p>
   <ul><li v-for="file in detail.files" :key="file.file_id">{{ file.path }} · v{{ file.revision }}{{ file.file_id===detail.main_file_id?'（主文件）':'' }}</li></ul>
   <PButton size="sm" type="button" :disabled="disabled||busy||rows.length>=30" @click="$emit('restore',detail)">恢复整个项目</PButton>
  </div>
 </div>
</template>
<script setup lang="ts">
import {ref} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import type {PaperProjectSnapshot,PaperSnapshotDetail} from '@/api/papers'
defineProps<{rows:PaperProjectSnapshot[];detail:PaperSnapshotDetail|null;busy:boolean;disabled:boolean;message:string}>()
const emit=defineEmits<{create:[name:string];preview:[id:string];remove:[snapshot:PaperProjectSnapshot];restore:[snapshot:PaperSnapshotDetail]}>()
const name=ref('')
function submit(){if(name.value)emit('create',name.value)}
function formatDate(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString()}
</script>
<style scoped>
.paper-recovery,.paper-recovery__create,.paper-recovery__detail{display:grid;gap:8px;min-width:0}
.paper-recovery p{margin:0;line-height:1.6;overflow-wrap:anywhere}
.paper-recovery__row{display:flex;gap:6px;align-items:center;border:1px solid var(--a-color-border-soft,#ddd);border-radius:5px;padding:4px}
.paper-recovery__select{display:grid;gap:4px;text-align:left;min-width:0;flex:1;background:transparent;border:0;color:inherit;padding:5px;cursor:pointer;overflow-wrap:anywhere}
.paper-recovery__select[aria-pressed=true]{background:var(--a-color-bg-subtle,#e7edf3)}
.paper-recovery__select small{color:var(--a-color-text-secondary,#64748b)}
.paper-recovery__secondary{font:inherit;font-size:11px;white-space:nowrap;background:transparent;border:1px solid var(--a-color-border-soft,#ddd);border-radius:4px;padding:4px;color:inherit;cursor:pointer}
.paper-recovery__create label{display:grid;gap:4px}
.paper-recovery__create input{font:inherit;box-sizing:border-box;width:100%;padding:6px;border-radius:4px;border:1px solid var(--a-color-border-soft,#ddd);background:var(--a-color-bg,#fff);color:inherit}
.paper-recovery__detail{border-top:1px solid var(--a-color-border-soft,#ddd);padding-top:8px}
.paper-recovery__detail ul{max-height:155px;overflow:auto;padding-left:20px;margin:0;overflow-wrap:anywhere}
</style>
