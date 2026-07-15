<template>
  <PModal :model-value="modelValue" title="举报" size="sm" @update:model-value="$emit('update:modelValue', $event)">
    <form class="comment-report" @submit.prevent>
      <label>
        <span>原因</span>
        <select v-model="reason" required>
          <option value="spam">垃圾信息</option>
          <option value="harassment">骚扰或攻击</option>
          <option value="hate">仇恨内容</option>
          <option value="sexual">色情内容</option>
          <option value="violence">暴力内容</option>
          <option value="misinformation">虚假信息</option>
          <option value="other">其他</option>
        </select>
      </label>
      <PTextarea v-model="note" label="补充说明" :rows="3" placeholder="可选" />
      <p v-if="error" class="comment-report__error" role="alert">{{ error }}</p>
      <div class="comment-report__actions">
        <PButton type="button" size="sm" outline @click="$emit('update:modelValue', false)">取消</PButton>
        <button type="button" class="comment-report__submit" data-test="submit-report" :disabled="pending" @click="submit">
          {{ pending ? '提交中...' : '提交' }}
        </button>
      </div>
    </form>
  </PModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { CommentReportReason, ReportCommentInput } from '@/api/comments'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

defineOptions({ name: 'CommentReportDialog' })

const props = defineProps<{
  modelValue: boolean
  onSubmit?: (input: ReportCommentInput) => Promise<unknown>
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [input: ReportCommentInput]
}>()

const reason = ref<CommentReportReason>('spam')
const note = ref('')
const error = ref('')
const pending = ref(false)

function reset() {
  reason.value = 'spam'
  note.value = ''
  error.value = ''
}

watch(() => props.modelValue, (visible, previous) => {
  if (visible && !previous) reset()
})

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
  } catch {
    error.value = '举报失败，请重试'
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.comment-report { display: grid; gap: 1rem; }
.comment-report label { display: grid; gap: 0.45rem; color: var(--a-color-ink-soft); font-size: var(--a-text-sm); font-weight: 800; }
.comment-report select { min-height: 42px; padding: 0 0.65rem; border: 1px solid var(--a-color-line); background: var(--a-color-paper); color: var(--a-color-ink); font: inherit; }
.comment-report__actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.comment-report__submit { min-height: 32px; padding: 0 14px; border: 1px solid var(--a-color-ink); background: var(--a-color-ink); color: var(--a-color-paper); font: inherit; font-size: 0.72rem; font-weight: 800; cursor: pointer; }
.comment-report__error { margin: 0; color: var(--a-color-accent-destructive); font-size: var(--a-text-sm); }
</style>
