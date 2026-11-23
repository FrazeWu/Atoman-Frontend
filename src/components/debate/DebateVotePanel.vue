<template>
  <section class="vote-panel" aria-label="投票" :aria-busy="loading">
    <div v-if="loading" class="vote-panel__state" aria-live="polite">投票加载中</div>
    <div v-else-if="unavailable || !summary" class="vote-panel__state" role="status">投票暂不可用</div>

    <template v-else>
      <div class="vote-panel__summary">
        <div>
          <span class="vote-panel__label">{{ copy.conclusion }}</span>
          <strong data-test="current-conclusion">{{ directionText(summary?.current_direction) }}</strong>
        </div>
        <div>
          <span class="vote-panel__label">{{ copy.participants }}</span>
          <strong>{{ totals.total_votes }}</strong>
        </div>
        <div>
          <span class="vote-panel__label">{{ copy.yourVote }}</span>
          <strong data-test="current-user-vote">{{ directionText(summary?.current_user_vote) }}</strong>
        </div>
      </div>

      <div class="vote-panel__choices" role="group" :aria-label="copy.vote">
        <button
          v-for="choice in choices"
          :key="choice.value"
          type="button"
          class="vote-panel__choice"
          :class="{ 'is-selected': summary.current_user_vote === choice.value }"
          :data-test="`vote-${choice.value}`"
          :aria-pressed="summary.current_user_vote === choice.value"
          @click="choose(choice.value)"
        >
          <span>{{ choice.label }}</span>
          <strong>{{ choice.value === 'yes' ? totals.yes_votes : totals.no_votes }}</strong>
        </button>
      </div>

      <p class="vote-panel__threshold">
        共识阈值：至少 {{ minVotes }} 人参与且任一方超过 {{ thresholdPercent }}%
      </p>

      <p
        v-if="summary.evidence_weak"
        class="vote-panel__weak-warning"
        data-test="evidence-weak-warning"
        role="status"
      >
        <span v-if="activeEvidenceCount === 0">暂无有效结构化证据，立场结论仍可独立形成，欢迎在论据区补充站内依据。</span>
        <span v-else>较多参与者认为当前证据尚不充分，立场结论仅供参考。</span>
      </p>

      <div class="vote-panel__evidence" aria-label="证据充分性评估">
        <div class="vote-panel__evidence-header">
          <span class="vote-panel__label">证据充分性评估</span>
          <span class="vote-panel__evidence-meta">现有有效证据 {{ activeEvidenceCount }} 条</span>
        </div>
        <div class="vote-panel__evidence-choices" role="group" aria-label="证据充分性投票">
          <button
            v-for="option in evidenceOptions"
            :key="option.value"
            type="button"
            class="vote-panel__evidence-btn"
            :class="{ 'is-selected': summary.current_user_evidence_vote === option.value }"
            :data-test="`evidence-vote-${option.value}`"
            :aria-pressed="summary.current_user_evidence_vote === option.value"
            @click="chooseEvidence(option.value)"
          >
            <span>{{ option.label }}</span>
            <strong>{{ evidenceCount(option.value) }}</strong>
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import type { DebateEvidenceRating, DebateVoteDirection, DebateVoteSummary } from '@/types'

const props = withDefaults(defineProps<{
  summary?: DebateVoteSummary | null
  loading?: boolean
  unavailable?: boolean
}>(), {
  summary: null,
  loading: false,
  unavailable: false,
})

const emit = defineEmits<{
  vote: [direction: DebateVoteDirection]
  remove: []
  'evidence-vote': [rating: DebateEvidenceRating]
  'evidence-remove': []
}>()

const copy = {
  conclusion: '当前结论',
  participants: '参与人数',
  yourVote: '你的选择',
  vote: '投票',
  undecided: '暂无',
} as const

const choices = [
  { value: 'yes' as const, label: '是' },
  { value: 'no' as const, label: '否' },
]

const evidenceOptions: ReadonlyArray<{ value: DebateEvidenceRating; label: string }> = [
  { value: 'sufficient', label: '充分' },
  { value: 'partial', label: '部分充分' },
  { value: 'insufficient', label: '不足' },
]

const authStore = useAuthStore()
const router = useRouter()
const totals = computed(() => ({
  yes_votes: props.summary?.yes_votes ?? 0,
  no_votes: props.summary?.no_votes ?? 0,
  total_votes: props.summary?.total_votes ?? 0,
}))
const minVotes = computed(() => props.summary?.conclusion_min_votes ?? 5)
const thresholdPercent = computed(() => props.summary?.conclusion_threshold_percent ?? 75)
const activeEvidenceCount = computed(() => props.summary?.active_evidence_count ?? 0)

function evidenceCount(rating: DebateEvidenceRating) {
  if (rating === 'sufficient') return props.summary?.evidence_sufficient ?? 0
  if (rating === 'partial') return props.summary?.evidence_partial ?? 0
  return props.summary?.evidence_insufficient ?? 0
}

function directionText(direction?: DebateVoteDirection | '') {
  if (direction === 'yes') return '是'
  if (direction === 'no') return '否'
  return copy.undecided
}

async function choose(direction: DebateVoteDirection) {
  if (!authStore.isAuthenticated && !await authStore.restoreSession()) {
    await router.push('/login')
    return
  }
  if (props.summary?.current_user_vote === direction) {
    emit('remove')
    return
  }
  emit('vote', direction)
}

async function chooseEvidence(rating: DebateEvidenceRating) {
  if (!authStore.isAuthenticated && !await authStore.restoreSession()) {
    await router.push('/login')
    return
  }
  if (props.summary?.current_user_evidence_vote === rating) {
    emit('evidence-remove')
    return
  }
  emit('evidence-vote', rating)
}
</script>

<style scoped>
.vote-panel {
  display: grid;
  gap: 16px;
  min-height: 168px;
  padding: 20px;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.vote-panel__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.vote-panel__state {
  display: grid;
  min-height: 126px;
  place-items: center;
  color: var(--a-color-muted);
  font-size: 13px;
}

.vote-panel__summary > div {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.vote-panel__label {
  color: var(--a-color-muted);
  font-size: 12px;
}

.vote-panel__summary strong,
.vote-panel__choice strong {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.vote-panel__choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.vote-panel__choice {
  display: flex;
  min-width: 0;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font: inherit;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.vote-panel__choice:hover:not(:disabled) {
  border-color: var(--a-color-primary);
}

.vote-panel__choice:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.vote-panel__choice.is-selected {
  border-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
  border-left-width: 3px;
}

.vote-panel__choice:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.vote-panel__threshold {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 12px;
}

.vote-panel__weak-warning {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--a-color-border-soft);
  border-left: 3px solid var(--a-color-warning);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.vote-panel__evidence {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--a-color-border-soft);
}

.vote-panel__evidence-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.vote-panel__evidence-meta {
  color: var(--a-color-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.vote-panel__evidence-choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.vote-panel__evidence-btn {
  display: flex;
  min-width: 0;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.vote-panel__evidence-btn:hover {
  border-color: var(--a-color-primary);
}

.vote-panel__evidence-btn.is-selected {
  border-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
  font-weight: 600;
}

.vote-panel__evidence-btn strong {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 480px) {
  .vote-panel__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .vote-panel__summary > div:last-child {
    grid-column: 1 / -1;
  }
}
</style>
