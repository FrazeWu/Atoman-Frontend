<template>
  <section class="moderation-panel">
    <div class="moderation-panel__toolbar">
      <label>状态
        <select v-model="status" @change="loadReports"><option value="open">待处理</option><option value="resolved">已处理</option></select>
      </label>
      <span>{{ total }} 条</span>
    </div>
    <p v-if="error" role="alert" class="moderation-panel__error">{{ error }}</p>
    <div v-if="reports.length" class="moderation-panel__list">
      <article v-for="report in reports" :key="report.id" class="moderation-panel__item">
        <header><strong>{{ report.target_type === 'topic' ? '帖子' : '回复' }}</strong><time>{{ formatTime(report.created_at) }}</time></header>
        <p>{{ reasonLabel(report.reason) }}<span v-if="report.note"> · {{ report.note }}</span></p>
        <RouterLink v-if="reportLink(report)" :to="reportLink(report)!">查看帖子</RouterLink>
        <div v-if="report.status === 'open'" class="moderation-panel__resolve">
          <label :for="`note-${report.id}`">处理备注</label>
          <input :id="`note-${report.id}`" v-model="notes[report.id]" :data-test="`report-note-${report.id}`" placeholder="输入处理备注" />
          <PButton :data-test="`report-resolve-${report.id}`" size="sm" :disabled="resolvingId === report.id" @click="resolve(report.id)">解决</PButton>
        </div>
        <p v-else-if="report.review_note">{{ report.review_note }}</p>
      </article>
    </div>
    <p v-else-if="!loading" class="moderation-panel__empty">暂无举报</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

type Report = { id: string; target_type: 'topic' | 'reply'; target_id: string; topic_id?: string; reason: string; note: string; status: string; review_note?: string; created_at: string }
const api = useApi()
const auth = useAuthStore()
const reports = ref<Report[]>([])
const status = ref('open')
const total = ref(0)
const loading = ref(false)
const resolvingId = ref('')
const error = ref('')
const notes = reactive<Record<string, string>>({})
let loadGeneration = 0
const headers = (json = false): HeadersInit => ({ ...(json ? { 'Content-Type': 'application/json' } : {}), ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) })

async function payload<T>(response: Response, fallback: string): Promise<{ data: T; meta?: { total?: number } }> {
  const body = await response.json().catch(() => ({})) as { data?: T; meta?: { total?: number }; error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message || fallback)
  return { data: body.data as T, meta: body.meta }
}
async function loadReports() {
  const generation = ++loadGeneration
  loading.value = true; error.value = ''
  try {
    const result = await payload<Report[]>(await fetch(`${api.v1.forum.reports}?status=${status.value}&page=1&page_size=50`, { headers: headers() }), '加载举报失败')
    if (generation === loadGeneration) { reports.value = result.data || []; total.value = result.meta?.total || 0 }
  } catch (cause) { if (generation === loadGeneration) error.value = cause instanceof Error ? cause.message : '加载举报失败' } finally { if (generation === loadGeneration) loading.value = false }
}
async function resolve(id: string) {
  resolvingId.value = id; error.value = ''
  try {
    const result = await payload<Report>(await fetch(api.v1.forum.resolveReport(id), { method: 'POST', headers: headers(true), body: JSON.stringify({ review_note: notes[id] || '' }) }), '处理举报失败')
    reports.value = reports.value.filter(item => item.id !== result.data.id); total.value = Math.max(0, total.value - 1)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '处理举报失败' } finally { resolvingId.value = '' }
}
function reasonLabel(reason: string) { return ({ spam: '垃圾内容', 'off-topic': '偏离主题', harassment: '骚扰', other: '其他' } as Record<string, string>)[reason] || reason }
function reportLink(report: Report) {
  if (report.target_type === 'topic') return `/forum/topic/${report.target_id}`
  return report.topic_id ? `/forum/topic/${report.topic_id}#reply-${report.target_id}` : ''
}
function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN') }
onMounted(loadReports)
</script>

<style scoped>
.moderation-panel,.moderation-panel__list,.moderation-panel__item{display:grid;gap:1rem}.moderation-panel__toolbar,.moderation-panel__item header,.moderation-panel__resolve{display:flex;align-items:center;gap:.75rem;justify-content:space-between}.moderation-panel__item{padding:1rem 0;border-bottom:1px solid var(--a-color-border)}.moderation-panel__item p{margin:0}.moderation-panel__resolve{justify-content:flex-start;flex-wrap:wrap}.moderation-panel__resolve input,.moderation-panel__toolbar select{min-height:2.75rem;border:1px solid var(--a-color-border);background:var(--a-color-surface);color:var(--a-color-text);padding:.5rem}.moderation-panel__resolve input{flex:1;min-width:12rem}.moderation-panel__error{color:var(--a-color-danger)}.moderation-panel__empty{color:var(--a-color-text-secondary)}time{color:var(--a-color-text-secondary);font-size:.875rem}
</style>
