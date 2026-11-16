<template>
  <section class="book-reports" aria-labelledby="book-reports-title">
    <div class="book-reports__toolbar">
      <div>
        <h2 id="book-reports-title">书籍举报</h2>
        <p>待处理 · 共 {{ total }} 条</p>
      </div>
      <PButton variant="secondary" size="sm" :loading="loading" @click="loadReports">刷新</PButton>
    </div>

    <p v-if="error" class="book-reports__error" role="alert">{{ error }}</p>
    <div v-if="loading && !reports.length" class="book-reports__state">加载中...</div>
    <div v-else-if="!reports.length" class="book-reports__state">暂无待处理的书籍举报</div>
    <div v-else class="book-reports__list" :aria-busy="loading">
      <article v-for="report in reports" :key="report.id" class="book-reports__item">
        <header>
          <div class="book-reports__meta">
            <strong>{{ reasonLabel(report.reason) }}</strong>
            <time :datetime="report.created_at">{{ formatTime(report.created_at) }}</time>
          </div>
          <RouterLink :to="`/books/public-read/${report.asset_id}`">查看正文</RouterLink>
        </header>
        <p class="book-reports__reason">{{ reportNote(report.reason) || '未填写补充说明' }}</p>
        <p class="book-reports__asset">文件 {{ report.asset_id }}</p>
        <div class="book-reports__actions">
          <PButton size="sm" :loading="pendingId === report.id" :disabled="Boolean(pendingId)" @click="review(report.id, 'removed')">下架</PButton>
          <PButton variant="secondary" size="sm" :loading="pendingId === report.id" :disabled="Boolean(pendingId)" @click="review(report.id, 'rejected')">驳回</PButton>
        </div>
      </article>
    </div>

    <footer v-if="total > limit" class="book-reports__pagination">
      <span>第 {{ page }} 页</span>
      <div>
        <PButton variant="secondary" size="sm" :disabled="offset <= 0 || loading" @click="changePage(-1)">上一页</PButton>
        <PButton variant="secondary" size="sm" :disabled="offset + reports.length >= total || loading" @click="changePage(1)">下一页</PButton>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { listPublicationReports, reviewPublicationReport, type BookPublicationReport } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'

const reports = ref<BookPublicationReport[]>([])
const total = ref(0)
const limit = 20
const offset = ref(0)
const loading = ref(false)
const error = ref('')
const pendingId = ref('')
let requestSequence = 0

const page = computed(() => Math.floor(offset.value / limit) + 1)

const reasonNames: Record<string, string> = {
  spam: '垃圾信息',
  harassment: '骚扰或攻击',
  hate: '仇恨内容',
  sexual: '色情内容',
  violence: '暴力内容',
  misinformation: '内容不实',
  copyright: '版权或权利问题',
  illegal: '违法内容',
  other: '其他',
}

function reasonCode(reason: string) {
  return reason.split('\n')[0] || reason
}

function reasonLabel(reason: string) {
  const code = reasonCode(reason)
  return reasonNames[code] ?? code
}

function reportNote(reason: string) {
  return reason.split('\n').slice(1).join('\n').trim()
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

async function loadReports() {
  const sequence = ++requestSequence
  const requestedOffset = offset.value
  loading.value = true
  error.value = ''
  try {
    const result = await listPublicationReports({ limit, offset: requestedOffset })
    if (sequence !== requestSequence || requestedOffset !== offset.value) return
    reports.value = result.items
    total.value = result.total
  } catch {
    if (sequence === requestSequence && requestedOffset === offset.value) error.value = '加载举报失败，请重试'
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function changePage(direction: -1 | 1) {
  offset.value = Math.max(0, offset.value + direction * limit)
  void loadReports()
}

async function review(reportId: string, decision: 'removed' | 'rejected') {
  if (pendingId.value) return
  pendingId.value = reportId
  error.value = ''
  try {
    await reviewPublicationReport(reportId, { decision, note: decision === 'removed' ? '下架公共电子书' : '驳回举报' })
    reports.value = reports.value.filter(report => report.id !== reportId)
    total.value = Math.max(0, total.value - 1)
  } catch {
    error.value = '处理举报失败，请重试'
  } finally {
    pendingId.value = ''
  }
}

onMounted(() => { void loadReports() })
</script>

<style scoped>
.book-reports { display: grid; gap: 1rem; min-width: 0; }
.book-reports__toolbar, .book-reports__item header, .book-reports__pagination { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.book-reports__toolbar h2, .book-reports__toolbar p, .book-reports__reason, .book-reports__asset { margin: 0; }
.book-reports__toolbar h2 { font-size: 1.1rem; }
.book-reports__toolbar p, .book-reports__asset, .book-reports__meta time { color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.book-reports__list { display: grid; border-top: 1px solid var(--a-color-border-soft); }
.book-reports__item { display: grid; gap: 0.65rem; padding: 1rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.book-reports__meta, .book-reports__actions, .book-reports__pagination > div { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.book-reports__reason { overflow-wrap: anywhere; line-height: 1.6; }
.book-reports__error { margin: 0; color: var(--a-color-danger); }
.book-reports__state { padding: 2rem 0; color: var(--a-color-text-secondary); text-align: center; }
.book-reports__pagination { color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
</style>
