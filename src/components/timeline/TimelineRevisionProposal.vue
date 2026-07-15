<template>
  <section class="timeline-proposals">
    <header class="timeline-proposals__header">
      <h2>修订提案</h2>
      <span>{{ proposals.length }} 条</span>
    </header>

    <div v-if="authStore.isAuthenticated" class="timeline-proposals__composer">
      <div class="timeline-proposals__change">
        <label>修改字段
          <select v-model="field" class="a-input" data-test="proposal-field">
            <option v-for="option in fieldOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label>新内容
          <input v-model="value" class="a-input" data-test="proposal-value" :placeholder="valuePlaceholder" />
        </label>
      </div>
      <label>来源依据
        <input v-model="evidence" class="a-input" data-test="proposal-evidence" placeholder="链接、书名或档案来源" />
      </label>
      <CommentComposer ref="composer" submit-label="提交提案" :submitting="submitting" @submit="createProposal" />
      <p v-if="mutationError" class="timeline-proposals__error" role="alert">{{ mutationError }}</p>
    </div>
    <p v-else class="timeline-proposals__state">登录后提交修订提案</p>

    <p v-if="loading" class="timeline-proposals__state">加载中...</p>
    <p v-else-if="!proposals.length" class="timeline-proposals__state">暂无修订提案</p>
    <div v-else class="timeline-proposals__list">
      <article v-for="proposal in proposals" :key="proposal.comment.id" class="timeline-proposals__item">
        <div class="timeline-proposals__meta">
          <span class="timeline-proposals__status" :data-status="proposal.status">{{ statusLabel(proposal.status) }}</span>
          <span v-for="(changed, key) in proposal.patch" :key="key"><strong>{{ fieldLabel(String(key)) }}</strong>：{{ displayValue(changed) }}</span>
          <span><strong>来源</strong>：{{ proposal.evidence }}</span>
        </div>
        <div v-if="canDecide && proposal.status === 'pending'" class="timeline-proposals__actions">
          <button type="button" data-test="accept-proposal" :disabled="decidingId === proposal.comment.id" @click="decide(proposal, 'accept')">接受</button>
          <button type="button" data-test="reject-proposal" :disabled="decidingId === proposal.comment.id" @click="decide(proposal, 'reject')">拒绝</button>
        </div>
        <CommentThread
          :root="proposal.comment"
          :replies="proposal.comment.replies"
          :expanded="expanded.has(proposal.comment.id)"
          :authenticated="authStore.isAuthenticated"
          :current-user-id="currentUserId"
          :can-delete="canDecide"
          :on-reply="reply"
          :on-edit="edit"
          @expand="expand"
          @more-replies="expand"
          @like="toggleLike"
          @delete="remove"
          @report="openReport"
        />
      </article>
    </div>
    <CommentReportDialog v-model="reportVisible" :on-submit="submitReport" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { commentApi, type CommentDTO, type CreateCommentInput, type ReportCommentInput } from '@/api/comments'
import { timelineRevisionProposalApi, type TimelineProposalDecision, type TimelineProposalStatus, type TimelineProposalTargetKind, type TimelineRevisionProposal } from '@/api/timelineRevisionProposals'
import CommentComposer from '@/components/comment/CommentComposer.vue'
import CommentReportDialog from '@/components/comment/CommentReportDialog.vue'
import CommentThread from '@/components/comment/CommentThread.vue'
import { useAuthStore } from '@/stores/auth'
import { isModeratorRole } from '@/utils/roles'

defineOptions({ name: 'TimelineRevisionProposal' })

const props = defineProps<{ targetKind: TimelineProposalTargetKind; targetId: string; targetOwnerId: string }>()
const emit = defineEmits<{ decided: [proposal: TimelineRevisionProposal] }>()
const authStore = useAuthStore()
const proposals = ref<TimelineRevisionProposal[]>([])
const loading = ref(false)
const submitting = ref(false)
const decidingId = ref('')
const mutationError = ref('')
const field = ref('')
const value = ref('')
const evidence = ref('')
const composer = ref<{ reset: () => void } | null>(null)
const expanded = ref(new Set<string>())
const reportVisible = ref(false)
const reportingCommentId = ref('')

const eventFields = [
  ['title', '标题'], ['description', '摘要'], ['content', '正文'], ['event_date', '发生日期'], ['end_date', '结束日期'],
  ['location', '地点'], ['latitude', '纬度'], ['longitude', '经度'], ['source', '来源'], ['category', '分类'], ['tags', '标签'], ['is_public', '公开状态'],
] as const
const personFields = [['name', '姓名'], ['bio', '简介'], ['birth_date', '出生日期'], ['death_date', '去世日期'], ['tags', '标签'], ['is_public', '公开状态']] as const
const fieldOptions = computed(() => (props.targetKind === 'event' ? eventFields : personFields).map(([value, label]) => ({ value, label })))
const currentUserId = computed(() => authStore.user?.uuid ?? '')
const canDecide = computed(() => authStore.isAuthenticated && (currentUserId.value === props.targetOwnerId || isModeratorRole(authStore.user?.role)))
const valuePlaceholder = computed(() => field.value === 'tags' ? '多个标签用逗号分隔' : field.value === 'is_public' ? 'true 或 false' : '输入修改后的内容')
const target = computed(() => ({ kind: props.targetKind === 'event' ? 'timeline_event' as const : 'timeline_person' as const, resourceId: props.targetId }))

watch(() => `${props.targetKind}:${props.targetId}`, async () => {
  field.value = fieldOptions.value[0]?.value ?? ''
  await load()
}, { immediate: true })

async function load() {
  loading.value = true
  mutationError.value = ''
  try { proposals.value = (await timelineRevisionProposalApi.list(props.targetKind, props.targetId)).items }
  catch { mutationError.value = '修订提案加载失败' }
  finally { loading.value = false }
}

function patchValue() {
  if (field.value === 'tags') return value.value.split(',').map((item) => item.trim()).filter(Boolean)
  if (field.value === 'latitude' || field.value === 'longitude') return Number(value.value)
  if (field.value === 'is_public') return value.value.trim().toLowerCase() === 'true'
  if ((field.value === 'end_date' || field.value === 'birth_date' || field.value === 'death_date') && !value.value.trim()) return null
  return value.value
}

async function createProposal(input: CreateCommentInput) {
  if (!field.value || !evidence.value.trim()) { mutationError.value = '请填写修改内容和来源依据'; return }
  submitting.value = true; mutationError.value = ''
  try {
    await timelineRevisionProposalApi.create(props.targetKind, props.targetId, { ...input, evidence: evidence.value.trim(), patch: { [field.value]: patchValue() } })
    value.value = ''; evidence.value = ''; composer.value?.reset(); await load()
  } catch { mutationError.value = '提案提交失败，请重试' }
  finally { submitting.value = false }
}

async function decide(proposal: TimelineRevisionProposal, decision: TimelineProposalDecision) {
  decidingId.value = proposal.comment.id; mutationError.value = ''
  try {
    const updated = await timelineRevisionProposalApi.decide(proposal.comment.id, decision)
    Object.assign(proposal, updated)
    emit('decided', proposal)
  } catch { mutationError.value = '处理失败，请重试' }
  finally { decidingId.value = '' }
}

async function reply(comment: CommentDTO, input: CreateCommentInput) { await commentApi.create(target.value, { ...input, reply_to_id: comment.id }); await load() }
async function edit(comment: CommentDTO, input: CreateCommentInput) { await commentApi.edit(comment.id, input); await load() }
async function remove(commentId: string) { await commentApi.delete(commentId); await load() }
async function toggleLike(commentId: string) {
  const item = proposals.value.flatMap(({ comment }) => [comment, ...comment.replies]).find(({ id }) => id === commentId)
  if (!item) return
  if (item.liked) await commentApi.unlike(commentId); else await commentApi.like(commentId)
  await load()
}
async function expand(rootId: string) {
  const proposal = proposals.value.find(({ comment }) => comment.id === rootId); if (!proposal) return
  proposal.comment.replies = (await commentApi.listReplies(rootId, { page: 1, page_size: 20 })).items
  expanded.value = new Set(expanded.value).add(rootId)
}
function openReport(commentId: string) { reportingCommentId.value = commentId; reportVisible.value = true }
async function submitReport(input: ReportCommentInput) { if (reportingCommentId.value) await commentApi.report(reportingCommentId.value, input); reportingCommentId.value = '' }
function statusLabel(status: TimelineProposalStatus) { return status === 'accepted' ? '已接受' : status === 'rejected' ? '已拒绝' : '待处理' }
function fieldLabel(key: string) { return [...eventFields, ...personFields].find(([value]) => value === key)?.[1] ?? key }
function displayValue(changed: unknown) { return Array.isArray(changed) ? changed.join('、') : changed === null ? '清空' : typeof changed === 'boolean' ? (changed ? '公开' : '不公开') : String(changed) }
</script>

<style scoped>
.timeline-proposals { display: grid; gap: 0.9rem; min-width: 0; padding-top: 1rem; border-top: 2px solid var(--a-color-ink); }
.timeline-proposals__header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.timeline-proposals__header h2 { margin: 0; font-size: 1.1rem; letter-spacing: 0; }
.timeline-proposals__header span, .timeline-proposals__state { color: var(--a-color-ink-muted); font-size: var(--a-text-sm); }
.timeline-proposals__composer, .timeline-proposals__list { display: grid; gap: 0.75rem; }
.timeline-proposals__change { display: grid; grid-template-columns: minmax(9rem, 0.4fr) minmax(0, 1fr); gap: 0.75rem; }
.timeline-proposals label { display: grid; gap: 0.35rem; font-size: var(--a-text-sm); font-weight: 700; }
.timeline-proposals__item { display: grid; gap: 0.55rem; }
.timeline-proposals__meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; padding: 0.65rem; border: 1px solid var(--a-color-line); background: var(--a-color-paper-soft); font-size: var(--a-text-sm); }
.timeline-proposals__status { font-weight: 800; }
.timeline-proposals__actions { display: flex; gap: 0.5rem; }
.timeline-proposals__actions button { min-height: 36px; padding: 0 0.8rem; border: 1px solid var(--a-color-ink); background: var(--a-color-paper); cursor: pointer; }
.timeline-proposals__error { margin: 0; color: var(--a-color-accent-destructive); }
@media (max-width: 560px) { .timeline-proposals__change { grid-template-columns: 1fr; } }
</style>
