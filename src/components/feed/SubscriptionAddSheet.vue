<template>
  <PSheet
    :show="show"
    title="ADD_SUBSCRIPTION"
    close-type="header"
    :top="top"
    @close="$emit('close')"
  >
    <div class="add-sub-form">
      <h2 class="a-title-sm mb-8">添加订阅</h2>

      <div class="form-fields">
        <PField label="来源地址" required>
          <input
            v-model="sourceInput"
            placeholder="输入网站、RSS 或 GitHub 仓库地址"
            class="a-input"
          />
        </PField>

        <div v-if="resolving" class="resolve-status resolve-status--muted">检测中...</div>
        <div v-else-if="resolveMessage" class="resolve-status" :class="resolveStatusClass">
          {{ resolveMessage }}
        </div>

        <div v-if="resolvedSourceTitle || resolvedSourceUrl" class="resolved-source">
          <div v-if="resolvedSourceTitle" class="resolved-source__title">{{ resolvedSourceTitle }}</div>
          <div v-if="resolvedSourceUrl" class="resolved-source__url">{{ resolvedSourceUrl }}</div>
        </div>

        <div v-if="resolved?.status === 'multiple_candidates'" class="candidate-list">
          <button
            v-for="candidate in resolved.candidates"
            :key="candidate.feed_url"
            type="button"
            class="candidate-option"
            :class="{ 'candidate-option--active': selectedCandidateUrl === candidate.feed_url }"
            @click="selectCandidate(candidate.feed_url)"
          >
            <div class="candidate-option__title-row">
              <span class="candidate-option__title">{{ candidate.title || candidate.feed_url }}</span>
              <span v-if="candidate.is_default" class="candidate-option__badge">默认</span>
            </div>
            <div class="candidate-option__meta">
              <span>{{ candidateStatusLabel(candidate) }}</span>
              <span>{{ candidate.feed_url }}</span>
            </div>
          </button>
        </div>

        <PField label="自定义名称（可选）">
          <input v-model="customTitle" placeholder="例如：GitHub Blog" class="a-input" />
        </PField>

        <PField v-if="groups.length" label="添加到分组（可选）">
          <PSelect
            v-model="selectedGroupId"
            :options="[
              { label: '默认分组', value: defaultGroupId || '' },
              ...nonDefaultGroups.map(group => ({ label: group.name, value: group.id }))
            ]"
          />
        </PField>
      </div>

      <div v-if="addError" class="a-error mb-6">{{ addError }}</div>

      <div class="form-actions">
        <PPress variant="secondary" label="取消" @click="$emit('close')" />
        <PPress
          :loading="submitting"
          loading-text="处理中..."
          label="确认订阅"
          :disabled="!canSubmit"
          @click="submitSubscription"
        />
      </div>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  AutoAddSubscriptionPayload,
  ResolvedSubscriptionCandidate,
  ResolvedSubscriptionInput,
  SubscriptionGroup,
} from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PField from '@/components/ui/PField.vue'
import PPress from '@/components/ui/PPress.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useFeedStore } from '@/stores/feed'

const props = defineProps<{
  show: boolean
  top?: string
  groups: SubscriptionGroup[]
  submitting: boolean
  error?: string
  resetKey?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: AutoAddSubscriptionPayload): void
}>()

const feedStore = useFeedStore()

const sourceInput = ref('')
const customTitle = ref('')
const selectedGroupId = ref('')
const resolved = ref<ResolvedSubscriptionInput | null>(null)
const selectedCandidateUrl = ref('')
const resolving = ref(false)
const localError = ref('')
let resolveTimer: ReturnType<typeof setTimeout> | null = null
let resolveSequence = 0

const defaultGroupId = computed(() => props.groups.find(g => g.name === '默认分组')?.id)
const nonDefaultGroups = computed(() => props.groups.filter(g => g.name !== '默认分组'))
const addError = computed(() => localError.value || props.error || '')
const selectedCandidate = computed(() => resolved.value?.candidates.find(
  (candidate) => candidate.feed_url === selectedCandidateUrl.value,
) || null)
const activeSource = computed(() => selectedCandidate.value?.source || resolved.value?.source || null)
const resolvedSourceTitle = computed(() => customTitle.value.trim() || activeSource.value?.title || selectedCandidate.value?.title || '')
const resolvedSourceUrl = computed(() => selectedCandidate.value?.feed_url || activeSource.value?.rss_url || '')
const resolveMessage = computed(() => resolved.value?.message || '')
const selectedCandidateBlocked = computed(() => selectedCandidate.value?.status === 'already_subscribed')
const canSubmit = computed(() => {
  if (resolving.value || !sourceInput.value.trim() || !resolved.value) return false
  if (resolved.value.status === 'already_subscribed' || resolved.value.status === 'invalid' || resolved.value.status === 'not_found') return false
  if (resolved.value.status === 'multiple_candidates') return Boolean(selectedCandidateUrl.value) && !selectedCandidateBlocked.value
  return true
})
const resolveStatusClass = computed(() => ({
  'resolve-status--ok': resolved.value?.status === 'existing_source' || resolved.value?.status === 'new_source',
  'resolve-status--blocked': resolved.value?.status === 'already_subscribed' || resolved.value?.status === 'invalid' || resolved.value?.status === 'not_found',
  'resolve-status--choice': resolved.value?.status === 'multiple_candidates',
}))

watch(defaultGroupId, (val) => {
  if (val && !selectedGroupId.value) {
    selectedGroupId.value = val
  }
}, { immediate: true })

watch(sourceInput, (value) => {
  localError.value = ''
  resolved.value = null
  selectedCandidateUrl.value = ''
  const currentSequence = ++resolveSequence
  if (resolveTimer) clearTimeout(resolveTimer)
  const trimmed = value.trim()
  if (!trimmed) {
    resolving.value = false
    return
  }
  resolving.value = true
  resolveTimer = setTimeout(async () => {
    const result = await feedStore.resolveSubscriptionInput(trimmed)
    if (currentSequence !== resolveSequence) return
    resolving.value = false
    resolved.value = result
    if (!result) {
      localError.value = feedStore.error || '检测失败，请稍后重试'
    }
  }, 500)
})

const resetForm = () => {
  sourceInput.value = ''
  customTitle.value = ''
  selectedGroupId.value = defaultGroupId.value || ''
  resolved.value = null
  selectedCandidateUrl.value = ''
  resolving.value = false
  localError.value = ''
  resolveSequence += 1
  if (resolveTimer) clearTimeout(resolveTimer)
}

const selectCandidate = (feedUrl: string) => {
  selectedCandidateUrl.value = feedUrl
  localError.value = ''
}

const candidateStatusLabel = (candidate: ResolvedSubscriptionCandidate) => {
  const statusLabels: Record<string, string> = {
    already_subscribed: '已订阅',
    existing_source: '已在库中',
    new_source: '可新增',
    not_found: '不可用',
    invalid: '无效',
  }
  const status = statusLabels[candidate.status] || candidate.status
  return candidate.kind ? `${status} · ${candidate.kind}` : status
}

const submitSubscription = () => {
  if (!canSubmit.value) {
    if (selectedCandidateBlocked.value) {
      localError.value = '你已订阅所选来源'
    } else {
      localError.value = resolved.value?.status === 'multiple_candidates' ? '请选择一个订阅源' : '请先输入可订阅来源'
    }
    return
  }

  const candidate = selectedCandidate.value as ResolvedSubscriptionCandidate | null
  emit('submit', {
    input: sourceInput.value.trim(),
    candidate_feed_url: candidate?.feed_url,
    title: customTitle.value.trim() || candidate?.title || activeSource.value?.title || '',
    group_id: selectedGroupId.value,
  })
}

watch(() => props.show, (val) => {
  if (val) localError.value = ''
})

watch(() => props.resetKey, () => {
  resetForm()
})
</script>

<style scoped>
.add-sub-form {
  display: flex;
  flex-direction: column;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.resolve-status {
  border: 1px solid var(--a-color-line-soft);
  padding: 0.85rem 1rem;
  font-size: 0.9rem;
  font-weight: 800;
}

.resolve-status--muted {
  color: var(--a-color-muted);
}

.resolve-status--ok {
  color: var(--a-color-success);
}

.resolve-status--blocked {
  color: var(--a-color-error, #b42318);
}

.resolve-status--choice {
  color: var(--a-color-ink);
}

.resolved-source {
  border: 1px solid var(--a-color-line-soft);
  padding: 0.9rem 1rem;
  background: var(--a-color-paper-soft, var(--a-color-paper-wash));
}

.resolved-source__title {
  font-weight: 900;
  line-height: 1.4;
}

.resolved-source__url {
  margin-top: 0.35rem;
  overflow-wrap: anywhere;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.candidate-option {
  width: 100%;
  text-align: left;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.candidate-option:hover {
  box-shadow: var(--a-shadow-paper-sm);
}

.candidate-option--active {
  border-color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-sm);
}

.candidate-option__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.candidate-option__title {
  font-weight: 800;
  line-height: 1.4;
}

.candidate-option__badge {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--a-color-muted);
  white-space: nowrap;
}

.candidate-option__meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--a-color-muted);
  font-size: 0.85rem;
  word-break: break-all;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.mb-8 { margin-bottom: 2rem; }
.mb-6 { margin-bottom: 1.5rem; }
</style>
