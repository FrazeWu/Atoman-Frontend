<template>
  <main class="debate-page">
    <div v-if="loading && !debate" class="debate-page__state">加载中...</div>
    <div v-else-if="!debate" class="debate-page__state">辩题不存在</div>

    <template v-else>
      <RouterLink to="/debate" class="debate-page__back">
        <ChevronLeft :size="16" aria-hidden="true" />
        辩论
      </RouterLink>

      <header class="debate-header">
        <div class="debate-header__content">
          <div class="debate-header__status">
            <span class="debate-header__status-dot" :class="`debate-header__status-dot--${debate.status}`" />
            {{ statusLabels[debate.status] }}
            <template v-if="debate.tags?.[0]"> · {{ debate.tags[0] }}</template>
          </div>
          <h1>{{ debate.title }}</h1>
          <p v-if="debate.description" class="debate-header__description">{{ debate.description }}</p>
          <div class="debate-header__meta">
            <span>{{ debate.user?.display_name || debate.user?.username || '匿名' }}</span>
            <span>{{ formatDate(debate.created_at) }}</span>
            <span>{{ relationCount }} 引用</span>
          </div>
        </div>

        <div class="debate-header__actions">
          <PButton v-if="canEdit" variant="secondary" @click="openEditModal">
            <Pencil :size="15" aria-hidden="true" />
            编辑
          </PButton>
          <PButton v-if="canConclude" variant="secondary" @click="showConcludeModal = true">
            <CircleCheck :size="15" aria-hidden="true" />
            结题
          </PButton>
          <PButton
            v-else-if="showVoteToConclude"
            variant="secondary"
            :loading="concludeVoting"
            @click="handleVoteToConclude"
          >
            申请结题
          </PButton>
          <PButton v-if="canReopen" variant="secondary" :loading="reopening" @click="handleReopen">
            <RotateCcw :size="15" aria-hidden="true" />
            重开
          </PButton>
          <PButton @click="openRelationModal">
            <Link2 :size="15" aria-hidden="true" />
            引用
          </PButton>
        </div>
      </header>

      <section
        v-if="debate.status === 'concluded' && (debate.conclusion_type === 'yes' || debate.conclusion_type === 'no')"
        class="debate-conclusion"
      >
        <span class="debate-conclusion__stamp" :class="`debate-conclusion__stamp--${debate.conclusion_type}`">
          结论 · {{ debate.conclusion_type === 'yes' ? '是' : '否' }}
        </span>
        <p v-if="debate.conclusion_summary">{{ debate.conclusion_summary }}</p>
      </section>

      <section v-if="debate.content" class="debate-background">
        <div class="prose max-w-none" v-html="renderMarkdown(debate.content)" />
      </section>

      <section class="debate-relations" aria-label="辩论关系">
        <div class="debate-relations__toolbar">
          <PSegmentedControl v-model="viewMode" :options="viewOptions" />
          <div class="debate-relations__legend" aria-label="关系图例">
            <span><i class="debate-relations__line debate-relations__line--support" />支撑</span>
            <span><i class="debate-relations__line debate-relations__line--oppose" />反驳</span>
          </div>
        </div>
        <DebateRelationGraph
          data-test="relation-graph"
          :graph="debateStore.relationGraph"
          :loading="debateStore.relationLoading"
        />
      </section>

      <section class="debate-discussion">
        <CommentSection
          data-test="debate-discussion"
          :target="{ kind: 'debate', resourceId: debate.id }"
          noun="讨论"
          :can-delete="canEdit"
        />
      </section>
    </template>

    <PModal v-if="showRelationModal" title="引用辩题" size="lg" @close="closeRelationModal">
      <form class="relation-form" @submit.prevent="handleCreateRelation">
        <div class="relation-form__search">
          <PInput
            v-model="relationQuery"
            label="搜索已结题辩题"
            placeholder="输入标题"
            @keydown.enter.prevent="searchReferences"
          />
          <PButton type="button" variant="secondary" :loading="relationSearching" @click="searchReferences">
            <Search :size="16" aria-hidden="true" />
            搜索
          </PButton>
        </div>

        <div v-if="relationResults.length" class="relation-form__results" role="radiogroup" aria-label="可引用辩题">
          <button
            v-for="candidate in relationResults"
            :key="candidate.id"
            type="button"
            class="relation-form__result"
            :class="{ 'relation-form__result--selected': selectedSourceId === candidate.id }"
            :aria-pressed="selectedSourceId === candidate.id"
            @click="selectedSourceId = candidate.id"
          >
            <span>{{ candidate.title }}</span>
            <small>结论 · {{ candidate.conclusion_type === 'yes' ? '是' : '否' }}</small>
          </button>
        </div>
        <p v-else-if="relationSearched && !relationSearching" class="relation-form__empty">没有可引用的辩题</p>

        <div class="relation-form__stance">
          <span>关系</span>
          <PSegmentedControl v-model="relationStance" :options="stanceOptions" />
        </div>
        <p v-if="relationError" class="relation-form__error" role="alert">{{ relationError }}</p>

        <div class="relation-form__actions">
          <PButton type="button" variant="secondary" @click="closeRelationModal">取消</PButton>
          <PButton type="submit" :loading="relationSaving" :disabled="!selectedSourceId">确认引用</PButton>
        </div>
      </form>
    </PModal>

    <PModal v-if="showEditModal" title="编辑辩题" @close="showEditModal = false">
      <form class="debate-form" @submit.prevent="handleUpdate">
        <PInput v-model="editForm.title" label="标题" required />
        <PInput v-model="editForm.description" label="描述" />
        <PTextarea v-model="editForm.content" label="内容" :rows="5" />
        <PInput v-model="tagsInput" label="标签" />
        <div class="debate-form__actions">
          <PButton type="button" variant="secondary" @click="showEditModal = false">取消</PButton>
          <PButton type="submit">保存</PButton>
        </div>
      </form>
    </PModal>

    <DebateConcludeModal
      :show="showConcludeModal"
      v-model="concludeForm"
      :concluding="concluding"
      :conclusion-options="conclusionOptions"
      @close="showConcludeModal = false"
      @submit="handleConcludeSubmit"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, CircleCheck, Link2, Pencil, RotateCcw, Search } from 'lucide-vue-next'

import CommentSection from '@/components/comment/CommentSection.vue'
import DebateConcludeModal from '@/components/debate/DebateConcludeModal.vue'
import DebateRelationGraph from '@/components/debate/DebateRelationGraph.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'
import type { Debate, DebateRelationStance } from '@/types'
import { isAdminRole } from '@/utils/roles'

const route = useRoute()
const router = useRouter()
const debateStore = useDebateStore()
const authStore = useAuthStore()
const { renderMarkdown } = useMarkdownRenderer()

const debate = computed(() => debateStore.currentDebate)
const loading = computed(() => debateStore.loading)
const relationCount = computed(() => debateStore.relationGraph?.relations.length ?? 0)
const authUserID = computed(() => authStore.user?.uuid ?? authStore.user?.id)
const viewMode = ref<'tree' | 'graph'>('tree')
const viewOptions = [
  { label: '辩论树', value: 'tree' as const },
  { label: '关系图谱', value: 'graph' as const },
]
const stanceOptions = [
  { label: '支撑', value: 'support' as const },
  { label: '反驳', value: 'oppose' as const },
]

const statusLabels: Record<string, string> = {
  open: '讨论中',
  concluded: '已结题',
  archived: '已归档',
}

const canEdit = computed(() => {
  if (!authStore.isAuthenticated) return false
  return isAdminRole(authStore.user?.role) || String(debate.value?.user_id) === String(authUserID.value)
})
const canConclude = computed(() => canEdit.value && debate.value?.status === 'open')
const canReopen = computed(() => debate.value?.status !== 'open' && isAdminRole(authStore.user?.role))
const showVoteToConclude = computed(() => (
  debate.value?.status === 'open' && authStore.isAuthenticated && !canConclude.value
))

const showRelationModal = ref(false)
const relationQuery = ref('')
const relationResults = ref<Debate[]>([])
const relationSearching = ref(false)
const relationSearched = ref(false)
const selectedSourceId = ref('')
const relationStance = ref<DebateRelationStance>('support')
const relationSaving = ref(false)
const relationError = ref('')

const showEditModal = ref(false)
const editForm = ref({ title: '', description: '', content: '' })
const tagsInput = ref('')

const showConcludeModal = ref(false)
const concluding = ref(false)
const concludeForm = ref<{ conclusion_type: 'yes' | 'no' | ''; conclusion_summary: string }>({
  conclusion_type: '',
  conclusion_summary: '',
})
const conclusionOptions = [
  { value: 'yes' as const, label: '是', style: { color: 'var(--a-color-primary)', borderColor: 'var(--a-color-primary)' } },
  { value: 'no' as const, label: '否', style: { color: 'var(--a-color-text-secondary)', borderColor: 'var(--a-color-border)' } },
]
const concludeVoting = ref(false)
const reopening = ref(false)

watch(() => String(route.params.id || ''), async (id) => {
  if (!id) return
  viewMode.value = 'tree'
  await Promise.all([
    debateStore.fetchDebate(id),
    debateStore.fetchRelationGraph(id, 'tree'),
  ])
}, { immediate: true })

watch(viewMode, async (mode) => {
  const id = String(route.params.id || '')
  if (id) await debateStore.fetchRelationGraph(id, mode)
})

function openRelationModal() {
  if (!authStore.isAuthenticated) {
    router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
    return
  }
  showRelationModal.value = true
  searchReferences()
}

function closeRelationModal() {
  showRelationModal.value = false
  relationQuery.value = ''
  relationResults.value = []
  relationSearched.value = false
  selectedSourceId.value = ''
  relationStance.value = 'support'
  relationError.value = ''
}

async function searchReferences() {
  if (!debate.value) return
  relationSearching.value = true
  relationSearched.value = true
  relationResults.value = await debateStore.searchCitableDebates(relationQuery.value, debate.value.id)
  relationSearching.value = false
}

async function handleCreateRelation() {
  if (!debate.value || !selectedSourceId.value) return
  relationSaving.value = true
  relationError.value = ''
  const created = await debateStore.createRelation(selectedSourceId.value, debate.value.id, relationStance.value)
  relationSaving.value = false
  if (!created) {
    relationError.value = '引用失败'
    return
  }
  closeRelationModal()
  await debateStore.fetchRelationGraph(debate.value.id, viewMode.value)
}

function openEditModal() {
  if (!debate.value) return
  editForm.value = {
    title: debate.value.title,
    description: debate.value.description,
    content: debate.value.content,
  }
  tagsInput.value = (debate.value.tags ?? []).join(', ')
  showEditModal.value = true
}

async function handleUpdate() {
  if (!debate.value) return
  const updated = await debateStore.updateDebate(debate.value.id, {
    ...editForm.value,
    tags: tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean),
  })
  if (!updated) return
  debateStore.currentDebate = updated
  showEditModal.value = false
}

async function handleConcludeSubmit() {
  if (!debate.value || !concludeForm.value.conclusion_type) return
  concluding.value = true
  const updated = await debateStore.concludeDebate(debate.value.id, {
    conclusion_type: concludeForm.value.conclusion_type,
    conclusion_summary: concludeForm.value.conclusion_summary || undefined,
  })
  concluding.value = false
  if (!updated) return
  debateStore.currentDebate = updated
  concludeForm.value = { conclusion_type: '', conclusion_summary: '' }
  showConcludeModal.value = false
  await debateStore.fetchRelationGraph(updated.id, viewMode.value)
}

async function handleVoteToConclude() {
  if (!debate.value) return
  concludeVoting.value = true
  await debateStore.voteToConclude(debate.value.id)
  concludeVoting.value = false
  await debateStore.fetchDebate(debate.value.id)
}

async function handleReopen() {
  if (!debate.value || !window.confirm('确定重开这个辩题吗？')) return
  reopening.value = true
  const updated = await debateStore.reopenDebate(debate.value.id)
  reopening.value = false
  if (updated) debateStore.currentDebate = updated
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<style scoped>
.debate-page {
  width: min(100%, 1280px);
  margin: 0 auto;
  padding: 40px 32px 80px;
  color: var(--a-color-text);
}

.debate-page__state { display: grid; min-height: 50vh; place-items: center; color: var(--a-color-muted); }
.debate-page__back { display: inline-flex; min-height: 44px; align-items: center; gap: 4px; margin-bottom: 12px; color: var(--a-color-muted); font-size: 13px; text-decoration: none; }
.debate-page__back:hover { color: var(--a-color-text); }
.debate-page__back:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }

.debate-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.debate-header__content { min-width: 0; }
.debate-header__status { display: flex; align-items: center; margin-bottom: 10px; color: var(--a-color-muted); font-size: 12px; }
.debate-header__status-dot { width: 7px; height: 7px; margin-right: 7px; border-radius: 999px; background: var(--a-color-muted-soft); }
.debate-header__status-dot--open { background: var(--a-color-success); }
.debate-header__status-dot--concluded { background: var(--a-color-primary); }
.debate-header h1 { max-width: 880px; margin: 0; overflow-wrap: anywhere; font-size: 38px; font-weight: 650; line-height: 1.2; letter-spacing: 0; }
.debate-header__description { max-width: 760px; margin: 12px 0 0; color: var(--a-color-text-secondary); line-height: 1.6; }
.debate-header__meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 14px; color: var(--a-color-muted); font-size: 12px; }
.debate-header__actions { display: flex; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }

.debate-conclusion { display: flex; align-items: flex-start; gap: 16px; padding: 20px 0; border-bottom: 1px solid var(--a-color-border-soft); }
.debate-conclusion__stamp { flex-shrink: 0; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 600; }
.debate-conclusion__stamp--yes { background: #eff6ff; color: #2563eb; }
.debate-conclusion__stamp--no { border: 1px solid var(--a-color-border); background: var(--a-color-surface-muted); color: #475569; }
.debate-conclusion p { margin: 1px 0 0; color: var(--a-color-text-secondary); line-height: 1.6; }

.debate-background { padding: 24px 0; border-bottom: 1px solid var(--a-color-border-soft); }
.debate-relations { padding-top: 0; }
.debate-relations__toolbar { display: flex; min-height: 78px; align-items: center; justify-content: space-between; gap: 16px; }
.debate-relations__legend { display: flex; flex-wrap: wrap; gap: 16px; color: var(--a-color-muted); font-size: 12px; }
.debate-relations__legend span { display: flex; align-items: center; gap: 6px; }
.debate-relations__line { width: 24px; border-top: 2px solid; }
.debate-relations__line--support { border-color: var(--a-color-success); }
.debate-relations__line--oppose { border-color: var(--a-color-danger); border-top-style: dashed; }
.debate-discussion { margin-top: 56px; padding-top: 32px; border-top: 1px solid var(--a-color-border-soft); }
.debate-discussion :deep(.comment-section__kicker) { display: none; }

.relation-form,
.debate-form { display: grid; gap: 20px; }
.relation-form__search { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 8px; }
.relation-form__results { display: grid; max-height: 320px; overflow-y: auto; border-block: 1px solid var(--a-color-border-soft); }
.relation-form__result { display: flex; min-height: 64px; align-items: center; justify-content: space-between; gap: 16px; padding: 12px; border: 0; border-bottom: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-text); text-align: left; cursor: pointer; }
.relation-form__result:last-child { border-bottom: 0; }
.relation-form__result:hover { background: var(--a-color-surface); }
.relation-form__result--selected { box-shadow: inset 3px 0 0 var(--a-color-primary); background: #eff6ff; }
.relation-form__result span { overflow-wrap: anywhere; line-height: 1.45; }
.relation-form__result small { flex-shrink: 0; color: var(--a-color-muted); }
.relation-form__stance { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.relation-form__stance > span { color: var(--a-color-muted); font-size: 13px; font-weight: 600; }
.relation-form__empty { margin: 0; padding: 24px; color: var(--a-color-muted); text-align: center; }
.relation-form__error { margin: 0; color: var(--a-color-danger); font-size: 13px; }
.relation-form__actions,
.debate-form__actions { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 760px) {
  .debate-page { padding: 24px 14px 64px; }
  .debate-header { display: block; }
  .debate-header h1 { font-size: 28px; }
  .debate-header__actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 20px; }
  .debate-header__actions :deep(.p-button) { width: 100%; min-height: 44px; }
  .debate-relations__toolbar { align-items: stretch; flex-direction: column; justify-content: center; padding: 20px 0; }
  .debate-relations__toolbar :deep(.p-segmented-control) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .debate-conclusion { flex-direction: column; gap: 10px; }
  .relation-form__search { grid-template-columns: 1fr; }
  .relation-form__search :deep(.p-button) { min-height: 44px; }
  .relation-form__result { align-items: flex-start; flex-direction: column; gap: 6px; }
  .relation-form__stance { align-items: stretch; flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .relation-form__result { scroll-behavior: auto; }
}
</style>
