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
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import type { DebateVoteDirection, DebateVoteSummary } from '@/types'

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

const authStore = useAuthStore()
const router = useRouter()
const totals = computed(() => ({
  yes_votes: props.summary?.yes_votes ?? 0,
  no_votes: props.summary?.no_votes ?? 0,
  total_votes: props.summary?.total_votes ?? 0,
}))

function directionText(direction?: DebateVoteDirection | '') {
  if (direction === 'yes') return '是'
  if (direction === 'no') return '否'
  return copy.undecided
}

function choose(direction: DebateVoteDirection) {
  if (!authStore.isAuthenticated) {
    void router.push('/login')
    return
  }
  if (props.summary?.current_user_vote === direction) {
    emit('remove')
    return
  }
  emit('vote', direction)
}
</script>

<style scoped>
.vote-panel {
  display: grid;
  gap: 16px;
  min-height: 168px;
  padding: 20px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
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
  box-shadow: inset 3px 0 0 var(--a-color-primary);
}

.vote-panel__choice:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
