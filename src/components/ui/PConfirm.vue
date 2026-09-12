<template>
  <PModal
    v-if="side !== 'right'"
    :show="show"
    size="sm"
    :title="title"
    :aria-label="title"
    role="alertdialog"
    :above-player="abovePlayer"
    :close-on-backdrop="false"
    @update:show="(value) => { if (!value) cancel() }"
  >
    <p class="p-confirm__message">{{ message }}</p>
    <template #footer>
      <PButton variant="secondary" :label="cancelText" :disabled="loading" @click="cancel" />
      <PButton
        :variant="danger ? 'danger' : 'primary'"
        :label="confirmText"
        :disabled="loading"
        :loading="loading"
        :loading-text="loadingText"
        @click="confirm"
      />
      <PActionFeedback class="p-confirm__feedback" :message="error" />
    </template>
  </PModal>

  <PSheet
    v-else
    :show="show"
    :title="title"
    side="right"
    mode="partial"
    partial-width="var(--a-comment-sheet-width)"
    close-type="header"
    :above-player="abovePlayer"
    @close="cancel"
  >
    <p class="p-confirm__message">{{ message }}</p>
    <div class="p-confirm__actions">
      <PButton variant="secondary" :label="cancelText" :disabled="loading" @click="cancel" />
      <PButton
        :variant="danger ? 'danger' : 'primary'"
        :label="confirmText"
        :disabled="loading"
        :loading="loading"
        :loading-text="loadingText"
        @click="confirm"
      />
    </div>
    <PActionFeedback :message="error" />
  </PSheet>
</template>

<script setup lang="ts">
import PButton from './PButton.vue'
import PActionFeedback from './PActionFeedback.vue'
import PModal from './PModal.vue'
import PSheet from './PSheet.vue'

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  loadingText?: string
  abovePlayer?: boolean
  side?: 'right'
  error?: string
}>(), {
  title: '请确认操作',
  message: '该操作不可撤销，是否继续？',
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
  loading: false,
  loadingText: '处理中...',
  abovePlayer: false,
  side: undefined,
  error: '',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const confirm = () => {
  if (!props.loading) emit('confirm')
}
const cancel = () => {
  if (!props.loading) emit('cancel')
}
</script>

<style scoped>
.p-confirm__message {
  margin: 0;
  color: var(--a-color-text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
}

.p-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.p-confirm__feedback { flex-basis: 100%; text-align: right; }
</style>
