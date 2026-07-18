<template>
  <PModal :show="show" size="sm" :title="title" :above-player="abovePlayer" @close="cancel" @update:show="(value) => { if (!value) cancel() }">
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
    </template>
  </PModal>
</template>

<script setup lang="ts">
import PButton from './PButton.vue'
import PModal from './PModal.vue'

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
}>(), {
  title: '请确认操作',
  message: '该操作不可撤销，是否继续？',
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
  loading: false,
  loadingText: '处理中...',
  abovePlayer: false,
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
</style>
