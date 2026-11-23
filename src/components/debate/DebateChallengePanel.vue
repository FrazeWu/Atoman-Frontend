<template>
  <section class="challenge-panel" data-test="debate-challenge-panel" aria-label="社区质询">
    <div class="challenge-panel__toolbar">
      <div class="challenge-panel__filters" role="group" aria-label="质询状态筛选">
        <button
          v-for="filter in filterOptions"
          :key="filter.value || 'all'"
          type="button"
          class="challenge-panel__filter"
          :class="{ 'is-active': selectedStatus === filter.value }"
          :data-test="`challenge-filter-${filter.value || 'all'}`"
          :aria-pressed="selectedStatus === filter.value"
          @click="selectStatus(filter.value)"
        >
          {{ filter.label }}
        </button>
      </div>
      <span class="challenge-panel__note">纯社区投票裁决，达到法定人数与阈值后自动生效</span>
    </div>

    <div v-if="loading" class="challenge-panel__state" role="status">加载质询中...</div>
    <PEmpty
      v-else-if="filteredChallenges.length === 0"
      :title="emptyTitle"
      description="用户可在正文引用来源或结构化证据上发起质询，供社区核查裁决。"
    />

    <ul v-else class="challenge-panel__list" role="list">
      <li
        v-for="item in filteredChallenges"
        :key="item.id"
        class="challenge-card"
        :data-test="`challenge-card-${item.id}`"
      >
        <header class="challenge-card__header">
          <div class="challenge-card__badges">
            <span class="challenge-card__type">{{ targetTypeLabel(item.target_type) }}</span>
            <span class="challenge-card__reason">{{ reasonLabel(item.reason_code) }}</span>
            <span class="challenge-card__status" :class="`is-${item.status}`">
              {{ statusLabel(item.status) }}
            </span>
          </div>
          <div class="challenge-card__meta">
            <span>发起人 {{ item.creator?.username || '匿名' }}</span>
            <span aria-hidden="true">·</span>
            <time :datetime="item.created_at">{{ formatDate(item.created_at) }}</time>
          </div>
        </header>

        <div v-if="item.target_label || item.target_preview" class="challenge-card__target">
          <strong v-if="item.target_label" class="challenge-card__target-label">{{ item.target_label }}</strong>
          <p v-if="item.target_preview" class="challenge-card__target-preview">{{ item.target_preview }}</p>
        </div>

        <p class="challenge-card__rationale">{{ item.rationale }}</p>

        <PReferenceCardList
          v-if="item.references?.length"
          :references="item.references"
          :compact="true"
          heading="反证引用"
        />

        <footer class="challenge-card__footer">
          <div class="challenge-card__stats">
            <span>支持质询 {{ item.uphold_votes }}</span>
            <span aria-hidden="true">·</span>
            <span>驳回质询 {{ item.dismiss_votes }}</span>
            <span aria-hidden="true">·</span>
            <span>结案规则 ≥ {{ item.min_votes }} 票且 &gt; {{ item.threshold_percent }}%</span>
          </div>

          <div
            v-if="item.status === 'open' && !archived"
            class="challenge-card__actions"
            role="group"
            aria-label="质询投票"
          >
            <PButton
              type="button"
              size="sm"
              :variant="item.current_user_vote === 'uphold' ? 'primary' : 'secondary'"
              :disabled="votingChallengeId === item.id"
              :data-test="`challenge-vote-uphold-${item.id}`"
              :aria-pressed="item.current_user_vote === 'uphold'"
              @click="handleVote(item, 'uphold')"
            >
              支持质询（{{ item.uphold_votes }}）
            </PButton>
            <PButton
              type="button"
              size="sm"
              :variant="item.current_user_vote === 'dismiss' ? 'danger' : 'secondary'"
              :disabled="votingChallengeId === item.id"
              :data-test="`challenge-vote-dismiss-${item.id}`"
              :aria-pressed="item.current_user_vote === 'dismiss'"
              @click="handleVote(item, 'dismiss')"
            >
              驳回质询（{{ item.dismiss_votes }}）
            </PButton>
          </div>
        </footer>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PReferenceCardList from '@/components/shared/PReferenceCardList.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useAuthStore } from '@/stores/auth'
import type {
  DebateChallenge,
  DebateChallengeReasonCode,
  DebateChallengeTargetType,
  DebateChallengeVoteDecision,
} from '@/types'

const props = withDefaults(defineProps<{
  challenges: DebateChallenge[]
  loading?: boolean
  archived?: boolean
  votingChallengeId?: string
}>(), {
  loading: false,
  archived: false,
  votingChallengeId: '',
})

const emit = defineEmits<{
  vote: [challengeId: string, decision: DebateChallengeVoteDecision]
  'remove-vote': [challengeId: string]
  'filter-change': [status: '' | 'open' | 'resolved']
}>()

const authStore = useAuthStore()
const router = useRouter()
const selectedStatus = ref<'' | 'open' | 'resolved'>('open')

const filterOptions: ReadonlyArray<{ value: '' | 'open' | 'resolved'; label: string }> = [
  { value: 'open', label: '进行中' },
  { value: 'resolved', label: '已结案' },
  { value: '', label: '全部' },
]

const filteredChallenges = computed(() => {
  if (selectedStatus.value === 'open') {
    return props.challenges.filter((item) => item.status === 'open')
  }
  if (selectedStatus.value === 'resolved') {
    return props.challenges.filter((item) => item.status === 'upheld' || item.status === 'dismissed')
  }
  return props.challenges
})

const emptyTitle = computed(() => {
  if (selectedStatus.value === 'open') return '暂无进行中的质询'
  if (selectedStatus.value === 'resolved') return '暂无已结案质询'
  return '暂无质询记录'
})

function selectStatus(status: '' | 'open' | 'resolved') {
  selectedStatus.value = status
  emit('filter-change', status)
}

function targetTypeLabel(type: DebateChallengeTargetType) {
  if (type === 'relation') return '跨辩题关系'
  if (type === 'reference') return '引用来源'
  return '结构化证据'
}

function reasonLabel(code: DebateChallengeReasonCode) {
  switch (code) {
    case 'mismatch':
      return '证据与结论不匹配'
    case 'outdated':
      return '依据已过时'
    case 'low_reliability':
      return '可靠性存疑'
    case 'irrelevant':
      return '与论点无关'
  }
}

function statusLabel(status: DebateChallenge['status']) {
  if (status === 'upheld') return '质询成立 · 已驳回'
  if (status === 'dismissed') return '质询未通过 · 已保留'
  return '投票进行中'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

async function handleVote(item: DebateChallenge, decision: DebateChallengeVoteDecision) {
  if (!authStore.isAuthenticated && !(await authStore.restoreSession())) {
    await router.push('/login')
    return
  }
  if (item.current_user_vote === decision) {
    emit('remove-vote', item.id)
    return
  }
  emit('vote', item.id, decision)
}
</script>

<style scoped>
.challenge-panel {
  display: grid;
  gap: 16px;
  padding-top: 20px;
}

.challenge-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.challenge-panel__filters {
  display: inline-flex;
  gap: 6px;
}

.challenge-panel__filter {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.challenge-panel__filter.is-active {
  border-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-weight: 600;
}

.challenge-panel__note {
  color: var(--a-color-muted);
  font-size: 12px;
}

.challenge-panel__state {
  padding: 36px 0;
  color: var(--a-color-muted);
  text-align: center;
  font-size: 13px;
}

.challenge-panel__list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.challenge-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.challenge-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.challenge-card__badges,
.challenge-card__meta,
.challenge-card__stats,
.challenge-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.challenge-card__type,
.challenge-card__reason,
.challenge-card__status {
  padding: 2px 8px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  font-size: 12px;
}

.challenge-card__type {
  color: var(--a-color-text-secondary);
  background: var(--a-color-surface-muted);
}

.challenge-card__reason {
  color: var(--a-color-text);
}

.challenge-card__status.is-open {
  border-color: var(--a-color-warning);
  color: var(--a-color-warning);
}

.challenge-card__status.is-upheld {
  border-color: var(--a-color-danger);
  color: var(--a-color-danger);
}

.challenge-card__status.is-dismissed {
  color: var(--a-color-muted);
}

.challenge-card__meta,
.challenge-card__stats {
  color: var(--a-color-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.challenge-card__target {
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border-left: 2px solid var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.challenge-card__target-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text);
}

.challenge-card__target-preview {
  margin: 0;
  color: var(--a-color-text-secondary);
  font-size: 12px;
}

.challenge-card__rationale {
  margin: 0;
  color: var(--a-color-text);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.challenge-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--a-color-border-soft);
}
</style>
