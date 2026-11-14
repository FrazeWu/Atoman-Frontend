<template>
  <PSheet
    :show="true"
    title="提醒与标签"
    mode="full"
    close-type="header"
    :side="side || (isMobile ? 'bottom' : 'right')"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-top-layer="isTopLayer"
    @close="emit('close')"
  >
    <section class="mail-organizer">
      <p class="mail-organizer__description">稍后处理只在 Atoman 收件箱列表中暂时隐藏邮件，到期自动重新显示；不会修改其他邮箱客户端中的邮件位置或已读状态。</p>
      <p v-if="error" class="mail-organizer__error" role="alert">{{ error }}</p>
      <template v-if="target">
        <div class="mail-organizer__section">
          <h2>{{ target.subject || '无主题' }}</h2>
          <p>对当前邮件设置提醒或标签。</p>
          <div class="mail-organizer__two-col">
            <form @submit.prevent="submitDue('snooze')">
              <PDatetimePicker v-model="snoozeValue" label="稍后重新显示" />
              <PButton type="submit" size="sm" :disabled="busy || !validDate(snoozeValue)">设置稍后处理</PButton>
              <PButton v-if="record?.snooze_until" variant="ghost" size="sm" :disabled="busy" @click="act('unsnooze')">取消稍后处理</PButton>
              <small v-if="record?.snooze_until">当前：{{ readable(record.snooze_until) }}</small>
            </form>
            <form @submit.prevent="submitDue('follow_up')">
              <PDatetimePicker v-model="followValue" label="跟进提醒时间" />
              <PButton type="submit" size="sm" :disabled="busy || !validDate(followValue)">设置跟进提醒</PButton>
              <PButton v-if="record?.follow_up_at" variant="ghost" size="sm" :disabled="busy" @click="act('clear_follow_up')">取消跟进提醒</PButton>
              <small v-if="record?.follow_up_at">当前：{{ readable(record.follow_up_at) }}</small>
            </form>
          </div>
        </div>
        <div class="mail-organizer__section">
          <h2>这封邮件的标签</h2>
          <div class="mail-organizer__labels">
            <label v-for="label in state.labels" :key="label.id" class="mail-organizer__label">
              <input type="checkbox" :checked="record?.label_ids.includes(label.id) || false" :disabled="busy" @change="act(record?.label_ids.includes(label.id) ? 'label_remove' : 'label_add', label.id)" />
              <span class="mail-organizer__dot" :style="{backgroundColor: labelColor(label.color)}" />
              {{ label.name }}
            </label>
            <p v-if="!state.labels.length">暂时没有标签。可在下面创建。</p>
          </div>
        </div>
      </template>
      <div class="mail-organizer__section">
        <h2>待跟进与稍后处理</h2>
        <p>到期的跟进提醒会在这里突出显示；邮件需要你自行决定是否回复。</p>
        <PEmpty v-if="!activeRecords.length" compact title="没有待处理事项" description="在打开的邮件中设置稍后处理或跟进提醒。" />
        <div v-for="item in activeRecords" :key="item.message_id" class="mail-organizer__reminder">
          <span>
            <strong>{{ subjectFor(item.message_id) }}</strong>
            <small v-if="item.follow_up_at">跟进：{{ readable(item.follow_up_at) }} <em v-if="isDue(item.follow_up_at)">· 已到期</em></small>
            <small v-if="item.snooze_until">稍后：{{ readable(item.snooze_until) }} <em v-if="isDue(item.snooze_until)">· 已到期</em></small>
          </span>
          <PButton v-if="item.snooze_until" variant="ghost" size="sm" :disabled="busy" @click="actFor(item, 'unsnooze')">恢复显示</PButton>
          <PButton v-if="item.follow_up_at" variant="ghost" size="sm" :disabled="busy" @click="actFor(item, 'clear_follow_up')">完成跟进</PButton>
        </div>
      </div>
      <div class="mail-organizer__section">
        <h2>管理标签</h2>
        <form class="mail-organizer__create-label" @submit.prevent="emit('create-label',{name:labelName.trim(),color:labelColorValue})">
          <PInput v-model="labelName" label="新标签名称" maxlength="40" />
          <label>颜色
            <select v-model="labelColorValue" class="mail-organizer__color" aria-label="标签颜色">
              <option v-for="color in colors" :key="color.id" :value="color.id">{{ color.label }}</option>
            </select>
          </label>
          <PButton type="submit" size="sm" :disabled="busy || !labelName.trim() || state.labels.length>=24">新增标签</PButton>
        </form>
        <div class="mail-organizer__labels">
          <span v-for="label in state.labels" :key="label.id" class="mail-organizer__label">
            <span class="mail-organizer__dot" :style="{backgroundColor: labelColor(label.color)}" />{{ label.name }}
            <button type="button" :disabled="busy" :aria-label="'重命名标签 '+label.name" @click="editLabel(label)">编辑</button>
            <button type="button" :disabled="busy" :aria-label="'删除标签 '+label.name" @click="emit('delete-label',label.id)">×</button>
          </span>
        </div>
        <form v-if="renaming" class="mail-organizer__rename" @submit.prevent="saveRename">
          <PInput v-model="renameValue" label="编辑标签名称" maxlength="40" />
          <PButton type="submit" size="sm" :disabled="busy || !renameValue.trim()">保存名称</PButton>
          <PButton variant="ghost" size="sm" @click="renaming=''">取消</PButton>
        </form>
        <small>标签最多 24 个。删除标签不会删除邮件，已有标签关联会在显示时清理。</small>
      </div>
    </section>
  </PSheet>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PDatetimePicker from '@/components/ui/PDatetimePicker.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { isStandaloneMobileApp } from '@/utils/appRuntime'
import type { MailSummary } from '@/api/mail'
import type { MailOrganizerColor, MailOrganizerLabel, MailOrganizerState, MailOrganizerAction, MailOrganizerMutation, MailOrganizerRecord } from '@/api/mailClient'

const isMobile = computed(isStandaloneMobileApp)

const props = withDefaults(
  defineProps<{
    state: MailOrganizerState
    target: MailSummary | null
    messages: MailSummary[]
    busy: boolean
    error: string
    now: number
    layerIndex?: number
    stackSize?: number
    isTopLayer?: boolean
    side?: 'right' | 'bottom'
  }>(),
  {
    layerIndex: undefined,
    stackSize: 1,
    isTopLayer: true,
    side: undefined,
  }
)
const emit = defineEmits<{
  close:[]
  action:[value:MailOrganizerMutation]
  'create-label':[value:{name:string;color:MailOrganizerColor}]
  'delete-label':[id:string]
  'update-label':[row:MailOrganizerLabel]
}>()
const colors: {id:MailOrganizerColor;label:string}[] = [
  {id:'slate',label:'灰色'},{id:'red',label:'红色'},{id:'orange',label:'橙色'},
  {id:'yellow',label:'黄色'},{id:'green',label:'绿色'},{id:'blue',label:'蓝色'},
  {id:'purple',label:'紫色'},{id:'pink',label:'粉色'}
]
const palette:Record<MailOrganizerColor,string>={slate:'#77808d',red:'#df5b65',orange:'#d58a43',yellow:'#c7a329',green:'#49a27a',blue:'#5795d4',purple:'#956bc6',pink:'#d17eaa'}
const labelColor=(color:MailOrganizerColor)=>palette[color] || palette.slate
function localDate(date:Date) {
  const pad=(n:number)=>String(n).padStart(2,'0')
  return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-')+'T'+pad(date.getHours())+':'+pad(date.getMinutes())
}
const defaultFuture=(hours:number)=>localDate(new Date(Date.now()+hours*3600_000))
const snoozeValue=ref(defaultFuture(24)),followValue=ref(defaultFuture(48))
const labelName=ref(''),labelColorValue=ref<MailOrganizerColor>('blue')
const renaming=ref(''),renameValue=ref('')
function editLabel(label:MailOrganizerLabel){renaming.value=label.id;renameValue.value=label.name}
function saveRename(){
  const item=props.state.labels.find(row=>row.id===renaming.value)
  if(item && renameValue.value.trim())emit('update-label',{...item,name:renameValue.value.trim()})
  renaming.value=''
}
const record=computed(()=>props.state.records.find(row=>row.message_id===props.target?.id))
const activeRecords=computed(()=>props.state.records.filter(row=>row.follow_up_at || (row.snooze_until && !isDue(row.snooze_until))).slice(0,200).sort((a,b)=>{
  const due=(x:MailOrganizerRecord)=>new Date(x.follow_up_at||x.snooze_until||0).getTime()
  return due(a)-due(b)
}))
watch(()=>props.target?.id,()=>{snoozeValue.value=defaultFuture(24);followValue.value=defaultFuture(48)})
watch(()=>props.state.labels.length,()=>{labelName.value=''})
function validDate(value:string) {
  const t=new Date(value).getTime()
  return Number.isFinite(t)&&t>Date.now()+4*60_000&&t<Date.now()+90*24*3600_000
}
const isDue=(date:string)=>new Date(date).getTime()<=props.now
const readable=(date:string)=>new Date(date).toLocaleString('zh-CN',{dateStyle:'short',timeStyle:'short'})
function subjectFor(id:string) {
  return props.messages.find(row=>row.id===id)?.subject || '邮件提醒（邮件不在当前列表）'
}
function act(action:MailOrganizerAction,labelId?:string) {
  if (!props.target)return
  emit('action',{message_id:props.target.id,action,label_id:labelId,revision:record.value?.revision||0})
}
function actFor(item:MailOrganizerRecord,action:MailOrganizerAction) {
  emit('action',{message_id:item.message_id,action,revision:item.revision})
}
function submitDue(action:'snooze'|'follow_up') {
  if(!props.target)return
  const selected=action==='snooze'?snoozeValue.value:followValue.value
  if(!validDate(selected))return
  const iso=new Date(selected).toISOString()
  emit('action',{message_id:props.target.id,action,due_at:iso,revision:record.value?.revision||0})
}
</script>
<style scoped>
.mail-organizer {max-width:850px; margin:auto; padding:24px clamp(18px,4vw,50px) 70px; display:grid; gap:22px;}
.mail-organizer__description,.mail-organizer p,.mail-organizer small {font-size:12px;line-height:1.7;color:var(--a-color-muted);margin:0;}
.mail-organizer__error{color:var(--a-color-danger,#c84747)!important;}
.mail-organizer__section{display:grid;gap:14px;padding:20px;border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-card);}
.mail-organizer__section h2{font-size:16px;font-weight:600;margin:0;overflow-wrap:anywhere;}
.mail-organizer__two-col{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:20px;}
.mail-organizer__two-col form,.mail-organizer__create-label{display:grid;gap:11px;}
.mail-organizer__labels{display:flex;gap:8px;flex-wrap:wrap;}
.mail-organizer__label{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-control);padding:8px 10px;font-size:12px;max-width:100%;overflow-wrap:anywhere;}
.mail-organizer__label button{border:none;background:none;color:var(--a-color-muted);cursor:pointer;font-size:16px;}
.mail-organizer__dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.mail-organizer__reminder{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--a-color-border-soft);padding:8px 0;}
.mail-organizer__reminder span{display:grid;gap:4px;flex:1;min-width:160px;}
.mail-organizer__reminder strong{font-size:13px;overflow-wrap:anywhere;}
.mail-organizer__reminder em{color:var(--a-color-danger,#c84747);font-style:normal;font-weight:600;}
.mail-organizer__create-label{grid-template-columns:minmax(100px,1fr) minmax(95px,135px) auto;align-items:end;}
.mail-organizer__create-label label{display:grid;gap:4px;color:var(--a-color-muted);font-size:12px;}
.mail-organizer__color{height:38px;padding:5px 7px;background:var(--a-color-surface);border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-control);color:var(--a-color-fg);}
@media(max-width:520px){.mail-organizer__create-label{grid-template-columns:1fr 1fr}.mail-organizer__create-label > :first-child{grid-column:1 / -1}}
</style>
