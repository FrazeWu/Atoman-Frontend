<template>
  <PModal :model-value="modelValue" title="举报公共电子书" size="sm" :above-player="abovePlayer" @update:model-value="$emit('update:modelValue', $event)">
    <form class="book-report" @submit.prevent>
      <label>
        <span>原因</span>
        <select v-model="reason" data-testid="book-report-reason" required>
          <option value="spam">垃圾信息</option>
          <option value="harassment">骚扰或攻击</option>
          <option value="hate">仇恨内容</option>
          <option value="sexual">色情内容</option>
          <option value="violence">暴力内容</option>
          <option value="misinformation">内容不实</option>
          <option value="copyright">版权或权利问题</option>
          <option value="illegal">违法内容</option>
          <option value="other">其他</option>
        </select>
      </label>
      <PTextarea v-model="note" label="补充说明" :rows="3" placeholder="选择其他时请填写说明" />
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
.book-report { display: grid; gap: 1rem; }
.book-report label { display: grid; gap: 0.45rem; color: var(--a-color-muted); font-size: var(--a-text-sm); font-weight: 500; }
.book-report select { min-height: 42px; padding: 0 0.65rem; border: 1px solid var(--a-color-border); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-text); font: inherit; }
.book-report__actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.book-report__submit { min-height: 32px; padding: 0 14px; border: 1px solid var(--a-color-text); border-radius: var(--a-radius-control); background: var(--a-color-text); color: var(--a-color-bg); font: inherit; font-size: 0.72rem; font-weight: 600; cursor: pointer; }
.book-report__submit:disabled { cursor: default; opacity: 0.6; }
.book-report__error { margin: 0; color: var(--a-color-danger); font-size: var(--a-text-sm); }
</style>
