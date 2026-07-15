<template>
  <section class="comment-moderation">
    <header class="comment-moderation__header">
      <div>
        <span>03 / COMMENTS</span>
        <h2>评论审核</h2>
      </div>
      <PButton size="sm" outline :loading="loading" @click="load">刷新</PButton>
    </header>

    <p v-if="error" class="comment-moderation__error" role="alert">{{ error }}</p>
    <div v-if="loading && !reports.length" class="comment-moderation__empty">加载中...</div>
    <div v-else-if="!reports.length" class="comment-moderation__empty">没有待处理举报</div>
    <div v-else class="comment-moderation__queue">
      <article v-for="report in reports" :key="report.id" class="comment-moderation__row">
        <div class="comment-moderation__meta">
          <strong>{{ reasonLabel(report.reason) }}</strong>
          <span>@{{ report.username }}</span>
          <time :datetime="report.created_at">{{ formatDate(report.created_at) }}</time>
          <small>{{ targetLabel(report.target_kind) }} · {{ report.resource_id }}</small>
        </div>
        <p>{{ report.content }}</p>
        <blockquote v-if="report.note">{{ report.note }}</blockquote>
        <div class="comment-moderation__actions">
          <button
            v-for="action in actions"
            :key="action.value"
            type="button"
            :data-action="action.value"
            :disabled="processing === report.id"
            @click="moderate(report, action.apiAction)"
          >
            <component :is="action.icon" :size="14" aria-hidden="true" />
            {{ action.label }}
          </button>
        </div>
      </article>
    </div>

    <PButton v-if="hasMore" block outline :loading="loading" @click="loadMore">加载更多</PButton>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Check, Eye, EyeOff, ShieldCheck, Trash2, X } from 'lucide-vue-next'

import { commentApi, type CommentReportQueueItem, type CommentTargetKind } from '@/api/comments'
import PButton from '@/components/ui/PButton.vue'

const reports = ref<CommentReportQueueItem[]>([])
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const processing = ref('')
const error = ref('')

const actions = [
  { value: 'restore', apiAction: 'restore', label: '恢复', icon: Eye },
  { value: 'hide', apiAction: 'hide', label: '隐藏', icon: EyeOff },
  { value: 'delete', apiAction: 'delete', label: '删除', icon: Trash2 },
  { value: 'uphold', apiAction: 'uphold_report', label: '维持举报', icon: ShieldCheck },
  { value: 'reject', apiAction: 'reject_report', label: '驳回举报', icon: X },
] as const

onMounted(() => load())

async function load(append = false) {
  loading.value = true
  error.value = ''
  const requestedPage = append ? page.value + 1 : 1
  try {
    const result = await commentApi.listReports({ status: 'pending', page: requestedPage, page_size: 20 })
    reports.value = append ? [...reports.value, ...result.items] : result.items
    page.value = result.page
    hasMore.value = result.has_more
  } catch {
    error.value = '审核队列加载失败'
  } finally {
    loading.value = false
  }
}

function loadMore() { return load(true) }

async function moderate(report: CommentReportQueueItem, action: string) {
  processing.value = report.id
  error.value = ''
  try {
    await commentApi.moderate(report.comment_id, { action, report_id: report.id, reason: '' })
    await load()
  } catch {
    error.value = '处理失败，请重试'
  } finally {
    processing.value = ''
  }
}

function reasonLabel(reason: string) {
  return ({ spam: '垃圾信息', harassment: '骚扰或攻击', misinformation: '虚假信息', other: '其他' } as Record<string, string>)[reason] ?? reason
}

function targetLabel(kind: CommentTargetKind) {
  return ({
    blog_post: '博客', video: '视频', podcast_episode: '播客', feed_article: 'RSS', music_artist: '音乐人',
    music_album: '专辑', music_song: '歌曲', forum_topic: '论坛', debate: '辩题', timeline_event: '事件', timeline_person: '人物',
  } satisfies Record<CommentTargetKind, string>)[kind]
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<style scoped>
.comment-moderation { display: grid; gap: 1rem; }
.comment-moderation__header { display: flex; align-items: end; justify-content: space-between; gap: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid var(--a-color-ink); }
.comment-moderation__header span { color: var(--a-color-ink-muted); font-family: var(--a-font-meta); font-size: 0.7rem; font-weight: 900; letter-spacing: 0.12em; }
.comment-moderation__header h2 { margin: 0.2rem 0 0; font-size: 1.35rem; letter-spacing: 0; }
.comment-moderation__queue { display: grid; border: 1px solid var(--a-color-ink); }
.comment-moderation__row { display: grid; grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.6fr) minmax(250px, auto); gap: 1rem; align-items: center; min-height: 84px; padding: 0.75rem; border-bottom: 1px solid var(--a-color-line-soft); background: var(--a-color-paper); }
.comment-moderation__row:last-child { border-bottom: 0; }
.comment-moderation__row p, .comment-moderation__row blockquote { margin: 0; overflow-wrap: anywhere; line-height: 1.5; }
.comment-moderation__meta { display: grid; gap: 0.15rem; min-width: 0; }
.comment-moderation__meta span, .comment-moderation__meta time, .comment-moderation__meta small { overflow: hidden; color: var(--a-color-ink-muted); font-size: 0.72rem; text-overflow: ellipsis; white-space: nowrap; }
.comment-moderation__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.3rem; }
.comment-moderation__actions button { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 34px; padding: 0 0.55rem; border: 1px solid var(--a-color-line-soft); background: transparent; color: var(--a-color-ink); font-size: 0.72rem; cursor: pointer; }
.comment-moderation__actions button:hover { border-color: var(--a-color-ink); }
.comment-moderation__empty { display: grid; place-items: center; min-height: 120px; border: 1px solid var(--a-color-line-soft); color: var(--a-color-ink-muted); }
.comment-moderation__error { margin: 0; color: var(--a-color-accent-destructive); }
@media (max-width: 880px) { .comment-moderation__row { grid-template-columns: 1fr; } .comment-moderation__actions { justify-content: flex-start; } }
</style>
