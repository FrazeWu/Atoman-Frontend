<template>
  <PModal :show="true" title="高级搜索" size="md" @close="emit('close')">
    <form class="mail-advanced" @submit.prevent="apply">
      <PInput v-model="form.from" label="发件人" placeholder="姓名或邮箱" />
      <PInput v-model="form.to" label="收件人" placeholder="姓名或邮箱" />
      <PInput v-model="form.subject" label="主题包含" placeholder="关键词" />
      <div class="mail-advanced__dates">
        <PDatetimePicker v-model="startDate" label="起始日期" :show-time="false" />
        <PDatetimePicker v-model="endDate" label="结束日期（包含当日）" :show-time="false" />
      </div>
      <div class="mail-advanced__options">
        <PSelect v-model="unread" label="已读状态" :options="[{label:'全部',value:'all'},{label:'未读',value:'yes'},{label:'已读',value:'no'}]" />
        <PSelect v-model="starred" label="星标" :options="[{label:'全部',value:'all'},{label:'有星标',value:'yes'},{label:'无星标',value:'no'}]" />
        <PSelect v-model="attachment" label="附件" :options="[{label:'全部',value:'all'},{label:'包含附件',value:'yes'},{label:'无附件',value:'no'}]" />
      </div>
      <label class="mail-advanced__scope"><input v-model="allFolders" type="checkbox" />搜索所有文件夹</label>
      <p v-if="error" role="alert" class="mail-advanced__error">{{ error }}</p>
      <div class="mail-advanced__actions">
        <PButton type="button" variant="ghost" @click="clear">清空筛选</PButton>
        <PButton type="button" variant="secondary" @click="emit('close')">取消</PButton>
        <PButton type="submit">搜索邮件</PButton>
      </div>
    </form>
  </PModal>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import PModal from '@/components/ui/PModal.vue'
import PInput from '@/components/ui/PInput.vue'
import PDatetimePicker from '@/components/ui/PDatetimePicker.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PButton from '@/components/ui/PButton.vue'
import type { MailAdvancedFilters } from '@/api/mailClient'
const props=defineProps<{filters:MailAdvancedFilters;everywhere:boolean}>()
const emit=defineEmits<{close:[];apply:[filters:MailAdvancedFilters,everywhere:boolean]}>()
const form=ref({from:props.filters.from||'',to:props.filters.to||'',subject:props.filters.subject||''})
const startDate=ref(props.filters.after?new Date(props.filters.after).toLocaleDateString('en-CA'):'')
const endDate=ref(props.filters.before?'':'')
const unread=ref(props.filters.unread==null?'all':props.filters.unread?'yes':'no')
const starred=ref(props.filters.starred==null?'all':props.filters.starred?'yes':'no')
const attachment=ref(props.filters.attachment==null?'all':props.filters.attachment?'yes':'no')
const allFolders=ref(props.everywhere), error=ref('')
function flag(value:string){return value==='all'?undefined:value==='yes'}
function midnight(raw:string){const d=new Date(raw+'T00:00:00');return d}
function apply(){
 error.value=''
 if(startDate.value && !Number.isFinite(midnight(startDate.value).getTime())){error.value='起始日期无效';return}
 if(endDate.value && !Number.isFinite(midnight(endDate.value).getTime())){error.value='结束日期无效';return}
 const start=startDate.value?midnight(startDate.value):undefined
 const end=endDate.value?midnight(endDate.value):undefined
 if(end)end.setDate(end.getDate()+1)
 if(start && end && start>=end){error.value='起始日期必须早于结束日期';return}
 emit('apply',{
  ...(form.value.from.trim()?{from:form.value.from.trim()}:{}),
  ...(form.value.to.trim()?{to:form.value.to.trim()}:{}),
  ...(form.value.subject.trim()?{subject:form.value.subject.trim()}:{}),
  ...(start?{after:start.toISOString()}:{}),
  ...(end?{before:end.toISOString()}:{}),
  unread:flag(unread.value),starred:flag(starred.value),attachment:flag(attachment.value)
 },allFolders.value)
}
function clear(){form.value={from:'',to:'',subject:''};startDate.value='';endDate.value='';unread.value='all';starred.value='all';attachment.value='all';allFolders.value=false}
</script>
<style scoped>
.mail-advanced {display:grid;gap:17px;padding-top:18px;}
.mail-advanced__dates,.mail-advanced__options {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
.mail-advanced__options {grid-template-columns:repeat(3,minmax(0,1fr));}
.mail-advanced__scope {display:flex;align-items:center;gap:9px;font-size:13px;cursor:pointer;}
.mail-advanced__scope input {width:17px;height:17px;accent-color:var(--a-color-primary);}
.mail-advanced__error {color:var(--a-color-danger);font-size:12px;}
.mail-advanced__actions {display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:5px;}
.mail-advanced__actions .p-button:first-child {margin-right:auto;}
@media(max-width:520px) { .mail-advanced__dates,.mail-advanced__options {grid-template-columns:1fr;} }
</style>
