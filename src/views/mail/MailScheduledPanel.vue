<template>
  <PSheet :show="true" title="定时发送与发件状态" mode="full" close-type="header" @close="emit('close')">
    <section class="mail-scheduled">
      <header><h2>发件队列</h2><PButton variant="secondary" size="sm" @click="emit('refresh')"><RefreshCw :size="15" /> 刷新状态</PButton></header>
      <p>定时邮件会在预定时刻由服务器提交，不需要保持浏览器打开。发送前可以取消；状态未知时请勿重复发送。</p>
      <PEmpty v-if="!items.length" compact title="暂无待发送邮件" description="定时发送和最近的发件结果会显示在这里。" />
      <div v-for="item in items" :key="item.id" class="mail-scheduled__item">
        <Clock :size="19" aria-hidden="true" />
        <div>
          <strong>{{ item.scheduled ? '定时发送' : '发件任务' }} · {{ status(item.status) }}</strong>
          <small>{{ item.scheduled ? '计划时间' : '下一步时间' }}：{{ mailTime(item.send_after,true) }}</small>
          <small v-if="item.status==='uncertain'">结果尚未确认，请勿再次提交相同邮件。</small>
        </div>
        <PButton v-if="item.status==='queued'" size="sm" variant="secondary" :disabled="busyId === item.id || new Date(item.send_after).getTime()<=Date.now()" @click="emit('cancel',item)">取消</PButton>
      </div>
    </section>
  </PSheet>
</template>
<script setup lang="ts">
import { Clock, RefreshCw } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSheet from '@/components/ui/PSheet.vue'
import type { MailOutbox } from '@/api/mailClient'
import { mailTime } from './mail-helpers'
defineProps<{items:MailOutbox[];busyId:string}>()
const emit=defineEmits<{close:[];refresh:[];cancel:[item:MailOutbox]}>()
function status(value:string) {
 const values:{[key:string]:string}={queued:'等待发送',dispatching:'正在提交',sending:'正在提交',sent:'已发送',submitted:'已提交',cancelled:'已取消',failed:'发送失败',uncertain:'结果待确认',blocked:'已阻止'}
 return values[value] || '正在确认'
}
</script>
<style scoped>
.mail-scheduled {display:grid;gap:18px;max-width:760px;margin:auto;padding:24px clamp(16px,4vw,50px) 60px;}
.mail-scheduled header {display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;}
.mail-scheduled h2 {font-size:19px;font-weight:600;margin:0;}
.mail-scheduled header .p-button {display:inline-flex;align-items:center;gap:7px;}
.mail-scheduled p {font-size:13px;line-height:1.75;color:var(--a-color-muted);margin:0;}
.mail-scheduled__item {display:flex;gap:14px;align-items:center;padding:16px;border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-card);}
.mail-scheduled__item > svg {color:var(--a-color-muted);flex-shrink:0;}
.mail-scheduled__item > div {display:grid;gap:6px;flex:1;min-width:0;}
.mail-scheduled__item strong {font-size:13px;overflow-wrap:anywhere;}
.mail-scheduled__item small {font-size:12px;color:var(--a-color-muted);}
</style>
