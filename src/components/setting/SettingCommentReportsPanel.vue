<template>
  <section class="comment-reports" aria-labelledby="comment-reports-title">
    <div class="comment-reports__toolbar">
      <div>
        <h2 id="comment-reports-title">评论举报</h2>
        <p>{{ statusLabel }} · 共 {{ total }} 条</p>
      </div>
      <div class="comment-reports__filters">
        <label for="comment-report-status">状态</label>
        <select id="comment-report-status" v-model="status" :disabled="loading" @change="loadReports">
          <option value="pending">待处理</option>
          <option value="upheld">已通过</option>
          <option value="rejected">已驳回</option>
        </select>
        <PButton variant="secondary" size="sm" :loading="loading" @click="loadReports">刷新</PButton>
      </div>
    </div>

    <p v-if="error" class="comment-reports__notice comment-reports__notice--error" role="alert">{{ error }}</p>
    <div v-if="loading && !reports.length" class="comment-reports__state">加载中...</div>
    <div v-else-if="!reports.length" class="comment-reports__state">暂无{{ statusLabel }}举报</div>
    <div v-else class="comment-reports__list" :aria-busy="loading">
      <article v-for="report in reports" :key="report.id" class="comment-reports__item">
        <header>
          <div class="comment-reports__meta">
            <strong>{{ reasonLabel(report.reason) }}</strong>
            <span>{{ targetLabel(report.target_kind) }}</span>
            <time :datetime="report.created_at">{{ formatTime(report.created_at) }}</time>
          </div>
          <span class="comment-reports__status">{{ reportStatusLabel(report.status) }}</span>
        </header>
        <p class="comment-reports__content">{{ report.content }}</p>
        <p v-if="report.note" class="comment-reports__note">补充：{{ report.note }}</p>
        <p class="comment-reports__reporter">举报人：@{{ report.username }}</p>
        <div v-if="report.status === 'pending'" class="comment-reports__actions">
          <PButton size="sm" :loading="isPending(report.id, 'uphold_report')" :disabled="hasPending(report.id)" @click="moderate(report, 'uphold_report')">通过举报</PButton>
          <PButton variant="secondary" size="sm" :loading="isPending(report.id, 'reject_report')" :disabled="hasPending(report.id)" @click="moderate(report, 'reject_report')">驳回举报</PButton>
          <PButton variant="secondary" size="sm" :loading="isPending(report.id, 'hide')" :disabled="hasPending(report.id)" @click="moderate(report, 'hide')">隐藏评论</PButton>
          <PButton variant="danger" size="sm" :loading="isPending(report.id, 'delete')" :disabled="hasPending(report.id)" @click="moderate(report, 'delete')">删除评论</PButton>
        </div>
        <div v-else class="comment-reports__actions">
          <PButton variant="secondary" size="sm" :loading="isPending(report.id, 'restore')" :disabled="hasPending(report.id)" @click="moderate(report, 'restore')">恢复评论</PButton>
          <PButton variant="danger" size="sm" :loading="isPending(report.id, 'delete')" :disabled="hasPending(report.id)" @click="moderate(report, 'delete')">删除评论</PButton>
        </div>
      </article>
    </div>

    <footer v-if="total > 0" class="comment-reports__pagination">
      <span>第 {{ page }} 页</span>
      <div>
        <PButton variant="secondary" size="sm" :disabled="page <= 1 || loading" @click="changePage(page - 1)">上一页</PButton>
        <PButton variant="secondary" size="sm" :disabled="!hasMore || loading" @click="changePage(page + 1)">下一页</PButton>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { commentApi, type CommentModerationAction, type CommentReportQueueItem } from '@/api/comments'
import PButton from '@/components/ui/PButton.vue'

const reports = ref<CommentReportQueueItem[]>([])
const status = ref<'pending' | 'upheld' | 'rejected'>('pending')
const page = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
const pendingActions = reactive(new Map<string, CommentModerationAction>())

const statusLabel = computed(() => ({ pending: '待处理', upheld: '已通过', rejected: '已驳回' })[status.value])

async function loadReports() {
  loading.value = true
  error.value = ''
  try {
    const result = await commentApi.listReports({ status: status.value, page: page.value, page_size: 20 })
    reports.value = result.items
    total.value = result.total
    hasMore.value = result.has_more
  } catch {
    error.value = '加载举报失败，请重试'
  } finally {
    loading.value = false
  }
}

function changePage(nextPage: number) {
  page.value = nextPage
  void loadReports()
}

async function moderate(report: CommentReportQueueItem, action: CommentModerationAction) {
  if (hasPending(report.id)) return
  pendingActions.set(report.id, action)
  error.value = ''
  try {
    await commentApi.moderate(report.comment_id, {
      action,
      report_id: action === 'uphold_report' || action === 'reject_report' ? report.id : undefined,
      reason: '评论举报处理',
    })
    await loadReports()
  } catch {
    error.value = '处理举报失败，请重试'
  } finally {
    pendingActions.delete(report.id)
  }
}

function hasPending(reportId: string) {
  return pendingActions.has(reportId)
}

function isPending(reportId: string, action: CommentModerationAction) {
  return pendingActions.get(reportId) === action
}

function reasonLabel(reason: string) {
  return ({ spam: '垃圾信息', harassment: '骚扰或攻击', hate: '仇恨内容', sexual: '色情内容', violence: '暴力内容', misinformation: '虚假信息', other: '其他' } as Record<string, string>)[reason] ?? reason
}

function targetLabel(kind: string) {
  return ({ blog_post: '文章', short_note: '短札', video: '视频', podcast_episode: '播客', feed_article: '订阅文章', music_artist: '艺人', music_album: '专辑', music_song: '歌曲', forum_topic: '论坛', debate: '辩题', timeline_event: '时间线事件', timeline_person: '时间线人物' } as Record<string, string>)[kind] ?? kind
}

function reportStatusLabel(value: string) {
  return ({ pending: '待处理', upheld: '已通过', rejected: '已驳回' } as Record<string, string>)[value] ?? value
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

onMounted(() => { void loadReports() })
</script>

<style scoped>
.comment-reports { display: grid; gap: 1rem; min-width: 0; }
.comment-reports__toolbar, .comment-reports__item header, .comment-reports__pagination { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.comment-reports__toolbar h2, .comment-reports__toolbar p, .comment-reports__content, .comment-reports__note, .comment-reports__reporter { margin: 0; }
.comment-reports__toolbar h2 { font-size: 1.1rem; }
.comment-reports__toolbar p, .comment-reports__reporter, .comment-reports__note, .comment-reports__meta span, .comment-reports__meta time { color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.comment-reports__filters, .comment-reports__actions, .comment-reports__pagination > div { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.comment-reports__filters label { color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.comment-reports__filters select { min-height: 2.75rem; padding: 0 0.65rem; border: 1px solid var(--a-color-border); background: var(--a-color-surface); color: var(--a-color-text); font: inherit; }
.comment-reports__list { display: grid; border-top: 1px solid var(--a-color-border-soft); }
.comment-reports__item { display: grid; gap: 0.65rem; padding: 1rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.comment-reports__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.65rem; }
.comment-reports__status { color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.comment-reports__content { overflow-wrap: anywhere; line-height: 1.6; }
.comment-reports__notice--error { color: var(--a-color-accent-destructive); }
.comment-reports__state { padding: 2rem 0; color: var(--a-color-text-secondary); text-align: center; }
.comment-reports__pagination { padding-top: 0.25rem; color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
@media (max-width: 640px) {
  .comment-reports__toolbar { align-items: stretch; flex-direction: column; }
  .comment-reports__filters { align-items: stretch; }
  .comment-reports__filters select { flex: 1; }
  .comment-reports__item header { align-items: flex-start; flex-direction: column; }
}
</style>
