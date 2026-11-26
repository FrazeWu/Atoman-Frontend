<template>
  <section class="papers-review" aria-label="Papers 申请审核">
    <div class="papers-review__heading">
      <h2>使用申请审核</h2>
      <PButton variant="secondary" size="sm" @click="refresh" :disabled="loading">刷新</PButton>
    </div>
    <p class="papers-review__intro">审核论文模块的使用申请。通过后系统自动开通权限，并向申请人发送邮件通知。</p>
    <div class="papers-review__filters">
      <PButton v-for="tab in tabs" :key="tab.value" size="sm" :variant="status === tab.value ? 'primary' : 'secondary'" @click="changeStatus(tab.value)">{{ tab.label }}</PButton>
    </div>
    <p v-if="loading" role="status">正在加载申请...</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="!loading && !rows.length && !error">暂无申请。</p>
    <article v-for="item in rows" :key="item.id" class="papers-review__row">
      <div class="papers-review__heading">
        <strong>{{ item.username || item.user_id }}</strong>
        <time :datetime="item.created_at">{{ new Date(item.created_at).toLocaleString() }}</time>
      </div>
      <p class="papers-review__reason">{{ item.reason }}</p>
      <template v-if="item.status === 'pending'">
        <label :for="'review-note-' + item.id">审核备注（拒绝时必填）</label>
        <PTextarea :id="'review-note-' + item.id" v-model="notes[item.id]" maxlength="1000" :rows="2" placeholder="填写审核说明" />
        <div class="papers-review__filters">
          <PButton size="sm" :disabled="!!busy" @click="review(item, 'approved')">通过并通知</PButton>
          <PButton size="sm" variant="secondary" :disabled="!!busy || !notes[item.id]?.trim()" @click="review(item, 'rejected')">拒绝</PButton>
        </div>
      </template>
      <template v-else>
        <p v-if="item.review_note">{{ item.review_note }}</p>
        <p v-if="item.status === 'approved'">邮件：{{ emailStatus[item.notification_status] || '未排队' }}</p>
      </template>
    </article>
    <div class="papers-review__filters">
      <PButton size="sm" variant="secondary" :disabled="page === 1 || loading" @click="move(-1)">上一页</PButton>
      <span>第 {{ page }} 页</span>
      <PButton size="sm" variant="secondary" :disabled="rows.length < 50 || loading" @click="move(1)">下一页</PButton>
    </div>
  </section>
</template>
<script setup lang="ts">
import PTextarea from '@/components/ui/PTextarea.vue'
import { onMounted, onBeforeUnmount, ref, reactive } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import { listPaperApplications, reviewPaperApplication, type PaperApplication } from '@/api/papers'

const tabs = [{value:'pending',label:'待审核'},{value:'approved',label:'已通过'},{value:'rejected',label:'已拒绝'}] as const
const emailStatus = { '': '未排队', pending:'待发送', sending:'发送中', sent:'已发送', failed:'发送失败' }
const rows = ref<PaperApplication[]>([])
const status = ref<PaperApplication['status']>('pending')
const page = ref(1)
const loading = ref(false)
const error = ref('')
const busy = ref('')
const notes = reactive<Record<string,string>>({})
let version = 0
async function refresh(){
  const current = ++version
  loading.value = true; error.value = ''
  try {
    const result = await listPaperApplications(status.value,page.value)
    if (current === version) rows.value = result
  } catch {
    if (current === version) {rows.value = []; error.value='无法加载审核列表，请检查管理员权限。'}
  } finally {if(current===version) loading.value=false}
}
function changeStatus(value:PaperApplication['status']){status.value=value;page.value=1;void refresh()}
function move(delta:number){page.value=Math.max(1,page.value+delta);void refresh()}
async function review(item:PaperApplication,decision:'approved'|'rejected'){
  if(busy.value)return
  busy.value=item.id;error.value=''
  try {
    await reviewPaperApplication(item.id,decision,notes[item.id] || '')
    delete notes[item.id]
    await refresh()
  } catch {error.value='审核未完成，请刷新后重试。'}
  finally {busy.value=''}
}
onMounted(refresh)
onBeforeUnmount(()=>{version++})
</script>
<style scoped>
.papers-review { display:grid; gap:1rem; border:1px solid var(--a-color-border-soft); border-radius:var(--a-radius-card); padding:1.25rem; background:var(--a-color-bg); }
.papers-review__heading {display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.papers-review__heading h2 {font-size:1rem;font-weight:600;margin:0}
.papers-review__intro {margin:0;font-size:.82rem;color:var(--a-color-text-secondary)}
.papers-review__row {display:grid;gap:10px;padding:14px 0;border-top:1px solid var(--a-color-border-soft)}
.papers-review__reason {white-space:pre-wrap;overflow-wrap:anywhere}
.papers-review__row textarea {width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--a-color-border-soft);border-radius:8px;background:var(--a-color-bg);color:inherit}
.papers-review__filters {display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.papers-review time,.papers-review label {font-size:.84rem;color:var(--a-color-text-secondary)}
</style>
