<template>
  <main class="a-page-md books-governance">
    <PSectionHeader :title="isReview ? '审核台' : '贡献中心'" kicker="BOOKS" rule />
    <nav class="books-governance__nav" aria-label="读书模块">
      <RouterLink to="/books">发现</RouterLink>
      <RouterLink to="/books/library">我的书库</RouterLink>
      <RouterLink to="/books/contributions" :class="{ 'is-active': !isReview }">贡献</RouterLink>
      <RouterLink to="/books/review" :class="{ 'is-active': isReview }">审核</RouterLink>
    </nav>

    <template v-if="!isReview">
      <section class="books-governance__section" aria-labelledby="new-edit-title">
        <h2 id="new-edit-title">提交公共作品</h2>
        <form class="books-governance__form" @submit.prevent="submitEdit">
          <label for="edit-title">标题</label>
          <input id="edit-title" v-model="editTitle" required maxlength="500" />
          <label for="edit-description">简介</label>
          <textarea id="edit-description" v-model="editDescription" maxlength="20000" rows="4" />
          <label for="edit-source">资料来源 URL</label>
          <input id="edit-source" v-model="editSource" type="url" required maxlength="4096" placeholder="https://" />
          <label for="edit-reason">提交理由</label>
          <input id="edit-reason" v-model="editReason" maxlength="2000" />
          <PButton type="submit" variant="secondary" :loading="saving">
            <Plus :size="16" aria-hidden="true" />
            <span>提交审核</span>
          </PButton>
        </form>
      </section>

      <section class="books-governance__section" aria-labelledby="my-edits-title">
        <h2 id="my-edits-title">我的书目申请</h2>
        <p v-if="loading" class="books-governance__muted">正在加载...</p>
        <p v-else-if="edits.length === 0" class="books-governance__muted">暂无申请</p>
        <ul v-else class="books-governance__list">
          <li v-for="edit in edits" :key="edit.id">
            <div>
              <strong>{{ editTitleLabel(edit) }}</strong>
              <span>{{ edit.entity_type }} · {{ editStatusLabel(edit.status) }}</span>
              <small v-if="edit.decision_note">{{ edit.decision_note }}</small>
            </div>
            <PButton v-if="edit.status === 'pending'" type="button" variant="ghost" @click="withdraw(edit.id)">
              <X :size="16" aria-hidden="true" />
              <span>撤回</span>
            </PButton>
          </li>
        </ul>
      </section>

      <section class="books-governance__section" aria-labelledby="my-publications-title">
        <h2 id="my-publications-title">我的公共正文申请</h2>
        <p v-if="loading" class="books-governance__muted">正在加载...</p>
        <p v-else-if="publicationRequests.length === 0" class="books-governance__muted">暂无申请</p>
        <ul v-else class="books-governance__list">
          <li v-for="request in publicationRequests" :key="request.id">
            <div>
              <strong>{{ request.status }}</strong>
              <span>{{ request.published_asset_status || '尚未生成公共资源' }}</span>
              <small v-if="request.decision_note">{{ request.decision_note }}</small>
            </div>
            <PButton v-if="request.published_asset_status === 'removed'" type="button" variant="secondary" @click="submitAppeal(request.id)">
              <RotateCcw :size="16" aria-hidden="true" />
              <span>提交申诉</span>
            </PButton>
          </li>
        </ul>
      </section>

      <p v-if="errorMessage" class="books-governance__feedback" role="alert">{{ errorMessage }}</p>
      <p v-if="loading" class="books-governance__muted">正在加载审核队列...</p>
      <section class="books-governance__section" aria-labelledby="review-edits-title">
        <h2 id="review-edits-title">书目申请</h2>
        <p v-if="!loading && edits.length === 0" class="books-governance__muted">暂无待审核申请</p>
        <ul v-else class="books-governance__list">
          <li v-for="edit in edits" :key="edit.id">
            <div>
              <strong>{{ editTitleLabel(edit) }}</strong>
              <span>{{ edit.entity_type }} · {{ edit.reason || '无理由' }}</span>
              <small>{{ edit.sources[0]?.title || edit.sources[0]?.url }}</small>
            </div>
            <div class="books-governance__actions">
              <PButton type="button" variant="secondary" :loading="decisionID === edit.id" @click="decideEdit(edit.id, 'approved')">
                <Check :size="16" aria-hidden="true" />
                <span>通过</span>
              </PButton>
              <PButton type="button" variant="ghost" :loading="decisionID === edit.id" @click="decideEdit(edit.id, 'rejected')">
                <X :size="16" aria-hidden="true" />
                <span>驳回</span>
              </PButton>
            </div>
          </li>
        </ul>
      </section>

      <section class="books-governance__section" aria-labelledby="review-publication-title">
        <h2 id="review-publication-title">公共正文申请</h2>
        <p v-if="!loading && publicationRequests.length === 0" class="books-governance__muted">暂无待审核申请</p>
        <ul v-else class="books-governance__list">
          <li v-for="request in publicationRequests" :key="request.id">
            <div>
              <strong>{{ request.license_type }}</strong>
              <span>{{ request.rights_holder || '未填写权利人' }}</span>
              <small>{{ request.source_url }}</small>
            </div>
            <div class="books-governance__actions">
              <PButton v-if="request.evidence_uploaded" type="button" variant="ghost" :loading="evidenceOpeningID === request.id" @click="viewEvidence(request.id)">
                <ExternalLink :size="16" aria-hidden="true" />
                <span>查看证据</span>
              </PButton>
              <PButton type="button" variant="secondary" :loading="decisionID === request.id" @click="decidePublication(request.id, 'published')">
                <Check :size="16" aria-hidden="true" />
                <span>发布</span>
              </PButton>
              <PButton type="button" variant="ghost" :loading="decisionID === request.id" @click="decidePublication(request.id, 'rejected')">
                <X :size="16" aria-hidden="true" />
                <span>驳回</span>
              </PButton>
            </div>
          </li>
        </ul>
      </section>

      <section class="books-governance__section" aria-labelledby="review-appeals-title">
        <h2 id="review-appeals-title">公共正文申诉</h2>
        <p v-if="!loading && publicationAppeals.length === 0" class="books-governance__muted">暂无待处理申诉</p>
        <ul v-else class="books-governance__list">
          <li v-for="appeal in publicationAppeals" :key="appeal.id">
            <div>
              <strong>{{ appeal.reason }}</strong>
              <span>申请 {{ appeal.publication_request_id }}</span>
            </div>
            <div class="books-governance__actions">
              <PButton type="button" variant="secondary" :loading="decisionID === appeal.id" @click="decideAppeal(appeal.id, 'approved')">
                <Check :size="16" aria-hidden="true" />
                <span>恢复公开</span>
              </PButton>
              <PButton type="button" variant="ghost" :loading="decisionID === appeal.id" @click="decideAppeal(appeal.id, 'rejected')">
                <X :size="16" aria-hidden="true" />
                <span>驳回</span>
              </PButton>
            </div>
          </li>
        </ul>
      </section>

      <section class="books-governance__section" aria-labelledby="review-reports-title">
        <h2 id="review-reports-title">公共正文举报</h2>
        <p v-if="!loading && reports.length === 0" class="books-governance__muted">暂无待处理举报</p>
        <ul v-else class="books-governance__list">
          <li v-for="report in reports" :key="report.id">
            <div>
              <strong>{{ report.reason }}</strong>
              <span>资源 {{ report.asset_id }}</span>
            </div>
            <div class="books-governance__actions">
              <PButton type="button" variant="secondary" :loading="decisionID === report.id" @click="decideReport(report.id, 'removed')">
                <Check :size="16" aria-hidden="true" />
                <span>下架</span>
              </PButton>
              <PButton type="button" variant="ghost" :loading="decisionID === report.id" @click="decideReport(report.id, 'rejected')">
                <X :size="16" aria-hidden="true" />
                <span>驳回</span>
              </PButton>
            </div>
          </li>
        </ul>
      </section>
    </template>
    <p v-if="message" class="books-governance__feedback" aria-live="polite">{{ message }}</p>
    <p v-if="errorMessage && !isReview" class="books-governance__feedback" role="alert">{{ errorMessage }}</p>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Check, ExternalLink, Plus, RotateCcw, X } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import {
  fetchPublicationEvidence,
  listBookEditReviewQueue,
  listPublicationAppealReviewQueue,
  listPublicationReports,
  listPublicationReviewQueue,
  listMyBookEdits,
  listMyPublicationRequests,
  reviewPublicationAppeal,
  reviewPublicationReport,
  type BookPublicationReport,
  reviewBookEdit,
  reviewPublicationRequest,
  submitBookEdit,
  submitPublicationAppeal,
  withdrawBookEdit,
  type BookEdit,
  type BookPublicationAppeal,
  type BookPublicationRequest,
} from '@/api/books'

const route = useRoute()
const isReview = computed(() => route.path === '/books/review')
const edits = ref<BookEdit[]>([])
const publicationRequests = ref<BookPublicationRequest[]>([])
const publicationAppeals = ref<BookPublicationAppeal[]>([])
const reports = ref<BookPublicationReport[]>([])
const loading = ref(true)
const saving = ref(false)
const decisionID = ref('')
const evidenceOpeningID = ref('')
const message = ref('')
const errorMessage = ref('')
const editTitle = ref('')
const editDescription = ref('')
const editSource = ref('')
const editReason = ref('')

function editStatusLabel(status: string): string {
  const labels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回', withdrawn: '已撤回' }
  return labels[status] || status
}

function editTitleLabel(edit: BookEdit): string {
  return edit.entity_type === 'work' ? `${edit.type === 'create' ? '新增' : '修订'}作品` : `${edit.type} ${edit.entity_type}`
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    if (isReview.value) {
      const [editResult, publicationResult, reportResult, appealResult] = await Promise.all([listBookEditReviewQueue(), listPublicationReviewQueue(), listPublicationReports(), listPublicationAppealReviewQueue()])
      edits.value = editResult.items
      publicationRequests.value = publicationResult.items
      reports.value = reportResult.items
      publicationAppeals.value = appealResult.items
    } else {
      edits.value = (await listMyBookEdits()).items
      try {
        publicationRequests.value = (await listMyPublicationRequests()).items
      } catch {
        publicationRequests.value = []
      }
    }
  } catch {
    errorMessage.value = '审核数据加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function submitEdit() {
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    await submitBookEdit({
      type: 'create',
      entity_type: 'work',
      payload: { title: editTitle.value.trim(), description: editDescription.value.trim() },
      reason: editReason.value.trim(),
      sources: [{ url: editSource.value.trim(), title: '资料来源' }],
    })
    editTitle.value = ''
    editDescription.value = ''
    editSource.value = ''
    editReason.value = ''
    message.value = '申请已提交'
    await load()
  } catch {
    errorMessage.value = '申请提交失败，请检查资料后重试'
  } finally {
    saving.value = false
  }
}

async function withdraw(editID: string) {
  try {
    await withdrawBookEdit(editID)
    message.value = '申请已撤回'
    await load()
  } catch {
    errorMessage.value = '申请撤回失败，请稍后重试'
  }
}

async function submitAppeal(requestID: string) {
  const reason = window.prompt('请输入申诉理由')?.trim()
  if (!reason) return
  try {
    await submitPublicationAppeal(requestID, reason)
    message.value = '申诉已提交'
    await load()
  } catch {
    errorMessage.value = '申诉提交失败，请稍后重试'
  }
}

async function decideAppeal(appealID: string, decision: 'approved' | 'rejected') {
  decisionID.value = appealID
  try {
    await reviewPublicationAppeal(appealID, decision)
    message.value = decision === 'approved' ? '公共正文已恢复' : '申诉已驳回'
    await load()
  } catch {
    errorMessage.value = '申诉审核失败，请稍后重试'
  } finally {
    decisionID.value = ''
  }
}

async function decideEdit(editID: string, decision: 'approved' | 'rejected') {
  decisionID.value = editID
  try {
    await reviewBookEdit(editID, decision)
    message.value = decision === 'approved' ? '申请已通过' : '申请已驳回'
    await load()
  } catch {
    errorMessage.value = '审核操作失败，请稍后重试'
  } finally {
    decisionID.value = ''
  }
}

async function decideReport(reportID: string, decision: 'removed' | 'rejected') {
  decisionID.value = reportID
  try {
    await reviewPublicationReport(reportID, decision)
    message.value = decision === 'removed' ? '公共正文已下架' : '举报已驳回'
    await load()
  } catch {
    errorMessage.value = '举报处理失败，请稍后重试'
  } finally {
    decisionID.value = ''
  }
}

async function viewEvidence(requestID: string) {
  evidenceOpeningID.value = requestID
  try {
    const blob = await fetchPublicationEvidence(requestID)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    errorMessage.value = '授权证据读取失败，请稍后重试'
  } finally {
    evidenceOpeningID.value = ''
  }
}

async function decidePublication(requestID: string, decision: 'published' | 'rejected') {
  decisionID.value = requestID
  try {
    await reviewPublicationRequest(requestID, decision)
    message.value = decision === 'published' ? '公共正文已发布' : '公共正文申请已驳回'
    await load()
  } catch {
    errorMessage.value = '公共正文审核失败，请稍后重试'
  } finally {
    decisionID.value = ''
  }
}

onMounted(load)
</script>

<style scoped>
.books-governance { display: grid; gap: 1.25rem; padding-top: var(--a-page-start-space); }
.books-governance__nav { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; border-bottom: 1px solid var(--a-color-border-soft); }
.books-governance__nav a { padding: 0.5rem 0 0.75rem; border-bottom: 2px solid transparent; color: var(--a-color-muted); text-decoration: none; }
.books-governance__nav a:hover, .books-governance__nav a:focus-visible, .books-governance__nav a.is-active { border-bottom-color: var(--a-color-fg); color: var(--a-color-fg); }
.books-governance__section { display: grid; gap: 0.75rem; }
.books-governance__section h2 { margin: 0; font-size: 1.05rem; }
.books-governance__form { display: grid; gap: 0.55rem; max-width: 42rem; }
.books-governance__form label { color: var(--a-color-muted); font-size: 0.88rem; }
.books-governance__form input, .books-governance__form textarea { width: 100%; border: 1px solid var(--a-color-border); background: var(--a-color-surface); color: var(--a-color-fg); padding: 0.65rem; font: inherit; }
.books-governance__form button { justify-self: start; }
.books-governance__list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--a-color-border-soft); }
.books-governance__list li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.books-governance__list li > div:first-child { display: grid; min-width: 0; gap: 0.2rem; }
.books-governance__list span, .books-governance__list small, .books-governance__muted { color: var(--a-color-muted); font-size: 0.85rem; }
.books-governance__list small { overflow-wrap: anywhere; }
.books-governance__actions { display: flex; flex-shrink: 0; gap: 0.4rem; }
.books-governance__feedback { margin: 0; color: var(--a-color-muted); }
.books-governance__feedback[role='alert'] { color: var(--a-color-danger); }
@media (max-width: 640px) { .books-governance__list li { align-items: flex-start; flex-direction: column; } .books-governance__actions { width: 100%; } }
</style>
