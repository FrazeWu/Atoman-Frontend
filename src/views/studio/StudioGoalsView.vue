<template>
  <section class="studio-goals">
    <PPageHeader title="经营目标" sub="把当前频道的目标、行动和周期复盘放在一起">
      <template #action>
        <RouterLink class="studio-goals__back" to="/studio">回到概览</RouterLink>
      </template>
    </PPageHeader>

    <p v-if="loading" class="studio-goals__message">加载中...</p>
    <p v-else-if="error" class="studio-goals__message studio-goals__message--error" role="alert">{{ error }}</p>
    <template v-else>
      <p v-if="notice" class="studio-goals__notice" role="status">{{ notice }}</p>

      <section v-if="!cycles.length" class="studio-goals__empty" aria-labelledby="goals-empty-title">
        <h2 id="goals-empty-title">先建立一个周期</h2>
        <p>用一个明确的时间范围开始记录频道的经营重点。</p>
        <form class="studio-goals__cycle-form" @submit.prevent="createCycle">
          <PInput v-model="cycleDraft.start_date" type="date" label="开始日期" required />
          <PInput v-model="cycleDraft.end_date" type="date" label="结束日期" required />
          <PButton type="submit" :loading="saving" loading-text="创建中...">创建周期</PButton>
        </form>
      </section>

      <template v-else>
        <section class="studio-goals__toolbar" aria-label="周期选择">
          <PSelect v-model="selectedCycleID" label="周期" :options="cycleOptions" />
          <span v-if="selectedCycle" class="studio-goals__timezone">按 {{ selectedCycle.timezone }} 计算周期边界</span>
        </section>

        <form v-if="cycleFormVisible" class="studio-goals__cycle-form studio-goals__cycle-form--next" @submit.prevent="createCycle">
          <PInput v-model="cycleDraft.start_date" type="date" label="开始日期" required />
          <PInput v-model="cycleDraft.end_date" type="date" label="结束日期" required />
          <div class="studio-goals__cycle-actions">
            <PButton type="submit" :loading="saving" loading-text="创建中...">创建周期</PButton>
            <PButton type="button" variant="secondary" @click="cycleFormVisible = false">取消</PButton>
          </div>
        </form>

        <section v-if="selectedCycle" class="studio-goals__cycle" aria-labelledby="cycle-title">
          <header class="studio-goals__cycle-header">
            <div>
              <span class="studio-goals__eyebrow">{{ statusLabel(selectedCycle.status) }}</span>
              <h2 id="cycle-title">{{ selectedCycle.start_date }} 至 {{ selectedCycle.end_date }}</h2>
            </div>
            <PButton v-if="selectedCycle.status === 'active'" type="button" variant="secondary" @click="openCycleForm">新建下一周期</PButton>
          </header>

          <p v-if="selectedCycle.status === 'needs_review'" class="studio-goals__review-prompt">
            这个周期已经结束，记录结果后再开始下一轮调整。
          </p>
          <p v-else-if="selectedCycle.status === 'reviewed'" class="studio-goals__reviewed-note">
            已完成复盘，下面的数字是周期结束时保存的结果。
          </p>

          <div v-if="selectedCycle.goals.length" class="studio-goals__goal-list">
            <article v-for="goal in selectedCycle.goals" :key="goal.id" class="studio-goals__goal">
              <header class="studio-goals__goal-header">
                <div>
                  <span class="studio-goals__goal-label">{{ moduleLabel(goal.module) }} · {{ metricLabel(goal.module, goal.metric) }}</span>
                  <h3>{{ goal.name }}</h3>
                </div>
                <strong>{{ formatNumber(goal.current_value) }} / {{ formatNumber(goal.target_value) }}</strong>
              </header>
              <div class="studio-goals__progress" role="progressbar" :aria-valuenow="goal.progress" aria-valuemin="0" aria-valuemax="100" :aria-label="`${goal.name}完成度`">
                <span :style="{ width: `${goal.progress}%` }" />
              </div>
              <p class="studio-goals__progress-caption">完成 {{ goal.progress }}%，创建时基线 {{ formatNumber(goal.baseline_value) }}</p>

              <ul v-if="goal.actions.length" class="studio-goals__actions">
                <li v-for="action in goal.actions" :key="action.id">
                  <label>
                    <input type="checkbox" :checked="action.status === 'completed'" :disabled="selectedCycle.status === 'reviewed' || actionSaving === action.id" @change="toggleAction(action)">
                    <span :class="{ 'is-completed': action.status === 'completed' }">{{ action.title }}</span>
                  </label>
                  <time v-if="action.due_date" :datetime="action.due_date">{{ action.due_date }}</time>
                  <RouterLink v-if="action.content_id && action.content_module" :to="`/studio/${action.content_module}/${action.content_id}/edit`" title="打开关联内容" aria-label="打开关联内容">
                    <ExternalLink :size="15" aria-hidden="true" />
                  </RouterLink>
                  <button v-if="selectedCycle.status !== 'reviewed'" type="button" class="studio-goals__icon-button" title="删除行动" aria-label="删除行动" @click="deleteAction(action.id)">
                    <Trash2 :size="15" aria-hidden="true" />
                  </button>
                </li>
              </ul>
              <p v-else class="studio-goals__empty-inline">还没有行动</p>

              <form v-if="selectedCycle.status !== 'reviewed'" class="studio-goals__action-form" @submit.prevent="createAction(goal)">
                <PInput v-model="actionDraft(goal.id).title" label="新增行动" placeholder="例如：完成产品更新第 2 篇" required />
                <PInput v-model="actionDraft(goal.id).due_date" type="date" label="截止日期" />
                <PSelect v-model="actionDraft(goal.id).content_id" label="关联内容" :options="contentOptions(goal.module)" placeholder="不关联内容" />
                <PButton type="submit" size="sm" :loading="actionSaving === `new:${goal.id}`">添加</PButton>
              </form>
            </article>
          </div>
          <p v-else class="studio-goals__empty-inline">这个周期还没有目标。</p>

          <form v-if="selectedCycle.status !== 'reviewed'" class="studio-goals__goal-form" @submit.prevent="createGoal">
            <h3>添加目标</h3>
            <PInput v-model="goalDraft.name" label="目标名称" placeholder="例如：稳定发布产品观察" required />
            <PSelect v-model="goalDraft.module" label="内容模块" :options="moduleOptions" />
            <PSelect v-model="goalDraft.metric" label="衡量指标" :options="metricOptions" />
            <PInput v-model="goalDraft.target_value" type="number" min="1" label="目标值" required />
            <PButton type="submit" :loading="saving" loading-text="添加中...">添加目标</PButton>
          </form>
        </section>

        <section v-if="selectedCycle?.status === 'needs_review'" class="studio-goals__review" aria-labelledby="review-title">
          <header>
            <h2 id="review-title">周期复盘</h2>
            <p>记录结果和下一步，不要求为未完成目标找一个单一原因。</p>
          </header>
          <form @submit.prevent="submitReview">
            <PTextarea v-model="reviewDraft.result" label="实际结果" placeholder="这次周期最终完成了什么？" :rows="3" required />
            <PTextarea v-model="reviewDraft.learning" label="有效做法与原因" placeholder="哪些行动值得保留？" :rows="3" />
            <PTextarea v-model="reviewDraft.next_action" label="下一步调整" placeholder="下个周期准备改变什么？" :rows="3" />
            <PButton type="submit" :loading="saving" loading-text="提交中...">提交复盘</PButton>
          </form>
        </section>

        <section v-if="selectedCycle?.review" class="studio-goals__review studio-goals__review--readonly" aria-labelledby="review-result-title">
          <header>
            <h2 id="review-result-title">复盘记录</h2>
            <span>{{ selectedCycle.review.created_at.slice(0, 10) }}</span>
          </header>
          <dl>
            <div><dt>实际结果</dt><dd>{{ selectedCycle.review.result }}</dd></div>
            <div v-if="selectedCycle.review.learning"><dt>有效做法与原因</dt><dd>{{ selectedCycle.review.learning }}</dd></div>
            <div v-if="selectedCycle.review.next_action"><dt>下一步调整</dt><dd>{{ selectedCycle.review.next_action }}</dd></div>
          </dl>
        </section>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ExternalLink, Trash2 } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioGoalAction, StudioGoal, StudioModule } from '@/types'

const studio = useStudioStore()
const loading = ref(true)
const saving = ref(false)
const actionSaving = ref('')
const error = ref('')
const notice = ref('')
const selectedCycleID = ref('')
const cycleFormVisible = ref(false)
const cycleDraft = reactive({ start_date: monthStart(), end_date: monthEnd() })
const goalDraft = reactive<{ name: string; module: StudioModule; metric: string; target_value: string }>({
  name: '', module: 'blog', metric: 'published', target_value: '1',
})
const reviewDraft = reactive({ result: '', learning: '', next_action: '' })
const actionDrafts = reactive<Record<string, { title: string; due_date: string; content_id: string }>>({})
const moduleOptions = [
  { label: '博客', value: 'blog' },
  { label: '播客', value: 'podcast' },
  { label: '视频', value: 'video' },
]
const moduleLabels: Record<StudioModule, string> = { blog: '博客', podcast: '播客', video: '视频' }
const cycles = computed(() => {
  if (studio.goals?.cycles?.length) return studio.goals.cycles
  return studio.goals?.current_cycle ? [studio.goals.current_cycle] : []
})
const selectedCycle = computed(() => cycles.value.find(cycle => cycle.id === selectedCycleID.value) ?? studio.goals?.current_cycle ?? cycles.value[0])
const cycleOptions = computed(() => cycles.value.map(cycle => ({ label: `${cycle.start_date} 至 ${cycle.end_date} · ${statusLabel(cycle.status)}`, value: cycle.id })))
const metricOptions = computed(() => (studio.goals?.metrics ?? []).filter(option => option.module === goalDraft.module).map(option => ({ label: option.label, value: option.metric })))

function monthStart() {
  const date = new Date()
  return localDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

function monthEnd() {
  const date = new Date()
  return localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function statusLabel(status: string) {
  return { planned: '未开始', active: '进行中', needs_review: '待复盘', reviewed: '已复盘' }[status] ?? status
}

function moduleLabel(module: StudioModule) {
  return moduleLabels[module]
}

function metricLabel(module: StudioModule, metric: string) {
  return studio.goals?.metrics.find(option => option.module === module && option.metric === metric)?.label ?? metric
}

function contentOptions(module: StudioModule) {
  return [
    { label: '不关联内容', value: '' },
    ...studio.contents[module].map(content => ({ label: content.title || '未命名内容', value: content.id })),
  ]
}

function actionDraft(goalID: string) {
  if (!actionDrafts[goalID]) actionDrafts[goalID] = { title: '', due_date: '', content_id: '' }
  return actionDrafts[goalID]
}

function resetCycleDraft() {
  cycleDraft.start_date = monthStart()
  cycleDraft.end_date = monthEnd()
  selectedCycleID.value = ''
}

function openCycleForm() {
  resetCycleDraft()
  cycleFormVisible.value = true
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await studio.loadState()
    if (!studio.currentChannel) return
    await Promise.all([
      studio.loadGoals(),
      ...(['blog', 'podcast', 'video'] as StudioModule[]).map(module => studio.loadContents(module, { q: '', status: '', visibility: '', collection_id: '', issue: '', page: 1 }, false)),
    ])
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载经营目标失败'
  } finally {
    loading.value = false
  }
}

async function createCycle() {
  saving.value = true
  error.value = ''
  try {
    await studio.createGoalCycle({ ...cycleDraft, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
    cycleFormVisible.value = false
    notice.value = '周期已创建'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '创建周期失败'
  } finally {
    saving.value = false
  }
}

async function createGoal() {
  if (!selectedCycle.value) return
  saving.value = true
  error.value = ''
  try {
    await studio.createGoal(selectedCycle.value.id, {
      name: goalDraft.name,
      module: goalDraft.module,
      metric: goalDraft.metric,
      target_value: Number(goalDraft.target_value),
    })
    goalDraft.name = ''
    goalDraft.target_value = '1'
    notice.value = '目标已添加'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '添加目标失败'
  } finally {
    saving.value = false
  }
}

async function createAction(goal: StudioGoal) {
  const draft = actionDraft(goal.id)
  actionSaving.value = `new:${goal.id}`
  error.value = ''
  try {
    await studio.createGoalAction(goal.id, {
      title: draft.title,
      due_date: draft.due_date || undefined,
      content_id: draft.content_id || undefined,
      content_module: draft.content_id ? goal.module : undefined,
    })
    draft.title = ''
    draft.due_date = ''
    draft.content_id = ''
    notice.value = '行动已添加'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '添加行动失败'
  } finally {
    actionSaving.value = ''
  }
}

async function toggleAction(action: StudioGoalAction) {
  actionSaving.value = action.id
  try {
    await studio.updateGoalAction(action.id, action.status === 'completed' ? 'pending' : 'completed')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '更新行动失败'
  } finally {
    actionSaving.value = ''
  }
}

async function deleteAction(actionID: string) {
  actionSaving.value = actionID
  try {
    await studio.deleteGoalAction(actionID)
    notice.value = '行动已删除'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '删除行动失败'
  } finally {
    actionSaving.value = ''
  }
}

async function submitReview() {
  if (!selectedCycle.value) return
  saving.value = true
  error.value = ''
  try {
    await studio.reviewGoalCycle(selectedCycle.value.id, reviewDraft)
    reviewDraft.result = ''
    reviewDraft.learning = ''
    reviewDraft.next_action = ''
    notice.value = '复盘已保存'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '提交复盘失败'
  } finally {
    saving.value = false
  }
}

watch(() => goalDraft.module, () => {
  goalDraft.metric = studio.goals?.metrics.find(option => option.module === goalDraft.module)?.metric ?? 'published'
})
watch(cycles, values => {
  if (!selectedCycleID.value || !values.some(cycle => cycle.id === selectedCycleID.value)) {
    selectedCycleID.value = studio.goals?.current_cycle?.id ?? values[0]?.id ?? ''
  }
})

onMounted(() => { void load() })
</script>

<style scoped>
.studio-goals { display: grid; gap: 1.25rem; }
.studio-goals__back { color: var(--a-color-muted); font-size: 0.85rem; text-decoration: none; }
.studio-goals__back:hover { color: var(--a-color-text); }
.studio-goals__message { padding: 2rem 0; color: var(--a-color-muted); }
.studio-goals__message--error { color: var(--a-color-accent-destructive); }
.studio-goals__notice { margin: 0; padding: 0.75rem 1rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-surface-muted); }
.studio-goals__empty,
.studio-goals__cycle,
.studio-goals__review { display: grid; gap: 1rem; padding: 1.25rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); }
.studio-goals__empty h2,
.studio-goals__empty p,
.studio-goals__cycle h2,
.studio-goals__cycle h3,
.studio-goals__review h2,
.studio-goals__review p { margin: 0; }
.studio-goals__empty p,
.studio-goals__review header p { color: var(--a-color-muted); font-size: 0.85rem; }
.studio-goals__cycle-form,
.studio-goals__goal-form,
.studio-goals__action-form,
.studio-goals__review form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; gap: 0.75rem; }
.studio-goals__cycle-form :deep(.p-button),
.studio-goals__goal-form :deep(.p-button),
.studio-goals__action-form :deep(.p-button),
.studio-goals__review form :deep(.p-button) { width: max-content; }
.studio-goals__cycle-actions { display: flex; gap: 0.5rem; }
.studio-goals__cycle-form--next { padding: 1rem 1.25rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-surface-muted); }
.studio-goals__cycle-form--next :deep(.p-button) { width: max-content; }
.studio-goals__toolbar { display: flex; align-items: end; gap: 1rem; }
.studio-goals__toolbar :deep(.p-field) { min-width: min(28rem, 100%); }
.studio-goals__timezone { padding-bottom: 0.75rem; color: var(--a-color-muted); font-size: 0.75rem; }
.studio-goals__cycle-header,
.studio-goals__goal-header,
.studio-goals__review header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.studio-goals__eyebrow,
.studio-goals__goal-label { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-goals__cycle-header h2 { margin-top: 0.25rem; font-size: 1.25rem; }
.studio-goals__review-prompt,
.studio-goals__reviewed-note { margin: 0; padding: 0.75rem 1rem; background: var(--a-color-surface-muted); color: var(--a-color-muted); font-size: 0.85rem; }
.studio-goals__goal-list { display: grid; gap: 1rem; }
.studio-goals__goal { display: grid; gap: 0.75rem; padding: 1rem 0; border-top: 1px solid var(--a-color-border-soft); }
.studio-goals__goal h3 { margin-top: 0.2rem; font-size: 1rem; }
.studio-goals__goal-header > strong { white-space: nowrap; font-variant-numeric: tabular-nums; }
.studio-goals__progress { height: 0.5rem; overflow: hidden; background: var(--a-color-surface-muted); }
.studio-goals__progress span { display: block; height: 100%; background: var(--a-color-primary); transition: width 0.2s ease; }
.studio-goals__progress-caption { margin: 0; color: var(--a-color-muted); font-size: 0.75rem; }
.studio-goals__actions { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.studio-goals__actions li { display: flex; align-items: center; gap: 0.5rem; min-width: 0; padding: 0.45rem 0; }
.studio-goals__actions label { display: flex; align-items: center; gap: 0.5rem; min-width: 0; flex: 1; }
.studio-goals__actions label span { overflow: hidden; text-overflow: ellipsis; }
.studio-goals__actions .is-completed { color: var(--a-color-muted); text-decoration: line-through; }
.studio-goals__actions time { color: var(--a-color-muted); font-size: 0.75rem; white-space: nowrap; }
.studio-goals__actions a { display: inline-flex; color: var(--a-color-muted); }
.studio-goals__icon-button { display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border: 0; background: transparent; color: var(--a-color-muted); cursor: pointer; }
.studio-goals__icon-button:hover { color: var(--a-color-accent-destructive); }
.studio-goals__empty-inline { margin: 0; color: var(--a-color-muted); font-size: 0.8rem; }
.studio-goals__goal-form { grid-template-columns: minmax(12rem, 2fr) minmax(8rem, 1fr) minmax(8rem, 1fr) 7rem auto; padding-top: 1rem; border-top: 1px solid var(--a-color-border-soft); }
.studio-goals__action-form { grid-template-columns: minmax(12rem, 2fr) 10rem minmax(10rem, 1.25fr) auto; padding-top: 0.5rem; }
.studio-goals__review form { grid-template-columns: repeat(3, minmax(0, 1fr)) auto; }
.studio-goals__review--readonly dl { display: grid; gap: 0.85rem; margin: 0; }
.studio-goals__review--readonly dl div { display: grid; gap: 0.25rem; }
.studio-goals__review--readonly dt { color: var(--a-color-muted); font-size: 0.75rem; }
.studio-goals__review--readonly dd { margin: 0; line-height: 1.6; white-space: pre-wrap; }
@media (max-width: 800px) {
  .studio-goals__cycle-form,
  .studio-goals__goal-form,
  .studio-goals__action-form,
  .studio-goals__review form { grid-template-columns: 1fr; }
  .studio-goals__toolbar { align-items: stretch; flex-direction: column; gap: 0.5rem; }
  .studio-goals__timezone { padding: 0; }
  .studio-goals__cycle-header,
  .studio-goals__goal-header,
  .studio-goals__review header { flex-direction: column; }
}
</style>
