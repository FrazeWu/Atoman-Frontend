<template>
  <PModal :model-value="modelValue" title="举报公共电子书" size="md" :above-player="abovePlayer" @update:model-value="$emit('update:modelValue', $event)">
    <form class="book-report" @submit.prevent>
      <div class="book-report__field">
        <label for="book-report-reason" class="book-report__label">举报原因</label>
        <div class="book-report__select-wrapper">
          <select
            id="book-report-reason"
            v-model="reason"
            class="book-report__select"
            data-testid="book-report-reason"
            required
          >
            <option value="copyright">版权或权利问题</option>
            <option value="spam">垃圾信息</option>
            <option value="harassment">骚扰或攻击</option>
            <option value="hate">仇恨内容</option>
            <option value="sexual">色情内容</option>
            <option value="violence">暴力内容</option>
            <option value="misinformation">内容不实</option>
            <option value="illegal">违法内容</option>
            <option value="other">其他</option>
          </select>
          <ChevronDown class="book-report__select-arrow" :size="16" aria-hidden="true" />
        </div>
      </div>
      <div class="book-report__field">
        <PTextarea v-model="note" label="补充说明" :rows="3" placeholder="选择其他时请填写详细说明" />
      </div>
      <p v-if="error" class="book-report__error" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <PButton type="button" size="sm" variant="secondary" @click="$emit('update:modelValue', false)">取消</PButton>
      <PButton
        type="button"
        size="sm"
        data-testid="book-report-submit"
        :disabled="pending"
        :loading="pending"
        loading-text="提交中…"
        @click="submit"
      >
        提交举报
      </PButton>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

import { ApiErrorResponseError } from '@/api/client'
import type { ReportPublishedBookInput } from '@/api/books'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

defineOptions({ name: 'BookPublicationReportDialog' })

const props = withDefaults(defineProps<{
  modelValue: boolean
  onSubmit?: (input: ReportPublishedBookInput) => Promise<unknown>
  abovePlayer?: boolean
}>(), {
  abovePlayer: false,
})
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [input: ReportPublishedBookInput]
}>()

const reason = ref('copyright')
const note = ref('')
const error = ref('')
const pending = ref(false)

function reset() {
  reason.value = 'copyright'
  note.value = ''
  error.value = ''
}

watch(() => props.modelValue, (visible, previous) => {
  if (visible && !previous) reset()
})

function failureMessage(cause: unknown) {
  if (cause instanceof ApiErrorResponseError) {
    if (cause.status === 409) return '您已举报过这本公共电子书'
    if (cause.status === 429) return '举报过于频繁，请稍后再试'
  }
  return '举报失败，请重试'
}

async function submit() {
  if (pending.value) return
  if (reason.value === 'other' && !note.value.trim()) {
    error.value = '请填写补充说明'
    return
  }
  error.value = ''
  const input = { reason: reason.value, note: note.value.trim() }
  if (!props.onSubmit) {
    emit('submit', input)
    return
  }
  pending.value = true
  try {
    await props.onSubmit(input)
    reset()
    emit('update:modelValue', false)
  } catch (cause) {
    error.value = failureMessage(cause)
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.book-report {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.25rem 0;
}

.book-report__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.book-report__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
}

.book-report__select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.book-report__select {
  width: 100%;
  height: 40px;
  padding: 0 2.25rem 0 0.75rem;
  border: 1px solid var(--a-color-border-soft, #cbd5e1);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text, #0f172a);
  font-size: 14px;
  line-height: 1.4;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.book-report__select:hover {
  border-color: var(--a-color-border, #94a3b8);
}

.book-report__select:focus {
  border-color: var(--a-color-primary, #007aff);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.15);
}

.book-report__select-arrow {
  position: absolute;
  right: 0.75rem;
  pointer-events: none;
  color: var(--a-color-text-tertiary, #94a3b8);
}

.book-report__error {
  margin: 0;
  color: var(--a-color-danger, #ef4444);
  font-size: 13px;
  line-height: 1.4;
}
</style>
