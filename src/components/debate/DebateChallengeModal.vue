<template>
  <PModal
    :show="show"
    size="md"
    title="发起社区引用质询"
    :close-on-backdrop="!submitting"
    @close="$emit('close')"
  >
    <div class="challenge-modal" data-test="debate-challenge-modal">
      <div class="challenge-modal__target">
        <span class="challenge-modal__target-type">{{ targetTypeText }}</span>
        <strong class="challenge-modal__target-label">{{ targetLabel || targetId }}</strong>
      </div>

      <div class="challenge-modal__field">
        <span class="challenge-modal__label">质询原因</span>
        <div class="challenge-modal__reasons" role="radiogroup" aria-label="质询原因">
          <button
            v-for="option in reasonOptions"
            :key="option.value"
            type="button"
            class="challenge-modal__reason"
            :class="{ 'is-selected': reasonCode === option.value }"
            :data-test="`challenge-reason-${option.value}`"
            :aria-pressed="reasonCode === option.value"
            @click="reasonCode = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="challenge-modal__field">
        <div class="challenge-modal__rationale-head">
          <span class="challenge-modal__label">质询理由与说明</span>
          <button
            type="button"
            class="challenge-modal__picker-toggle"
            data-test="challenge-toggle-picker"
            @click="showPicker = !showPicker"
          >
            {{ showPicker ? '收起站内引用搜索' : '插入站内反证引用' }}
          </button>
        </div>

        <DebateReferencePicker
          v-if="showPicker"
          :exclude-debate-id="debateId"
          @select="appendReferenceToken"
        />

        <PReferenceField
          v-model="rationale"
          data-test="challenge-rationale"
          variant="textarea"
          :rows="4"
          placeholder="说明该引用或证据为何不成立，可用 @类型:ID 附带站内反证资料..."
        />
      </div>

      <p v-if="localError || error" class="challenge-modal__error" data-test="challenge-error" role="alert">
        {{ localError || error }}
      </p>
    </div>

    <template #footer>
      <PButton type="button" variant="secondary" :disabled="submitting" @click="$emit('close')">
        取消
      </PButton>
      <PButton
        type="button"
        data-test="submit-challenge"
        :loading="submitting"
        :disabled="submitting || !rationale.trim()"
        @click="handleSubmit"
      >
        提交质询
      </PButton>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DebateReferencePicker from '@/components/debate/DebateReferencePicker.vue'
import PReferenceField from '@/components/shared/PReferenceField.vue'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import type {
  DebateChallengeReasonCode,
  DebateChallengeTargetType,
} from '@/types'
import { hasInvalidDebateReferenceSyntax } from '@/utils/resourceReferences'

const props = withDefaults(defineProps<{
  show: boolean
  debateId: string
  targetType: DebateChallengeTargetType
  targetId: string
  targetLabel?: string
  submitting?: boolean
  error?: string
}>(), {
  targetLabel: '',
  submitting: false,
  error: '',
})

const emit = defineEmits<{
  close: []
  submit: [payload: {
    target_type: DebateChallengeTargetType
    target_id: string
    reason_code: DebateChallengeReasonCode
    rationale: string
  }]
}>()

const reasonOptions: ReadonlyArray<{ value: DebateChallengeReasonCode; label: string }> = [
  { value: 'mismatch', label: '证据与结论不匹配' },
  { value: 'outdated', label: '依据已过时或修订' },
  { value: 'low_reliability', label: '来源可靠性存疑' },
  { value: 'irrelevant', label: '与当前论点无关' },
]

const reasonCode = ref<DebateChallengeReasonCode>('mismatch')
const rationale = ref('')
const showPicker = ref(false)
const localError = ref('')

const targetTypeText = computed(() => {
  if (props.targetType === 'relation') return '跨辩题关系'
  if (props.targetType === 'reference') return '引用来源'
  return '结构化证据'
})

watch(
  () => [props.show, props.targetType, props.targetId] as const,
  ([visible]) => {
    if (!visible) return
    reasonCode.value = 'mismatch'
    rationale.value = ''
    showPicker.value = false
    localError.value = ''
  },
)

function appendReferenceToken(token: string) {
  const current = rationale.value.trimEnd()
  rationale.value = current ? `${current} ${token}` : token
  localError.value = ''
}

function handleSubmit() {
  const trimmed = rationale.value.trim()
  if (!trimmed) {
    localError.value = '请填写质询理由'
    return
  }
  if (hasInvalidDebateReferenceSyntax(trimmed)) {
    localError.value = '包含无效的站内资源引用格式'
    return
  }
  localError.value = ''
  emit('submit', {
    target_type: props.targetType,
    target_id: props.targetId,
    reason_code: reasonCode.value,
    rationale: trimmed,
  })
}
</script>

<style scoped>
.challenge-modal {
  display: grid;
  gap: 16px;
}

.challenge-modal__target {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
}

.challenge-modal__target-type {
  color: var(--a-color-muted);
  font-size: 12px;
}

.challenge-modal__target-label {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--a-color-text);
  font-size: 13px;
  font-weight: 500;
}

.challenge-modal__field {
  display: grid;
  gap: 8px;
}

.challenge-modal__label {
  color: var(--a-color-text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.challenge-modal__reasons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.challenge-modal__reason {
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

.challenge-modal__reason.is-selected {
  border-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-weight: 600;
}

.challenge-modal__rationale-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.challenge-modal__picker-toggle {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.challenge-modal__error {
  margin: 0;
  color: var(--a-color-danger);
  font-size: 13px;
}

@media (max-width: 480px) {
  .challenge-modal__reasons {
    grid-template-columns: 1fr;
  }
}
</style>
