<template>
  <PModal :show="show" size="sm" :title="title" @close="cancel" @update:show="(value) => { if (!value) cancel() }">
    <p class="p-confirm__message">{{ message }}</p>
    <template #footer>
      <PButton variant="secondary" :label="cancelText" @click="cancel" />
      <PButton :variant="danger ? 'danger' : 'primary'" :label="confirmText" @click="confirm" />
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
}>(), {
  title: '请确认操作',
  message: '该操作不可撤销，是否继续？',
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const confirm = () => emit('confirm')
const cancel = () => emit('cancel')
</script>

<style scoped>
.p-confirm__message {
  margin: 0;
  color: var(--a-color-ink-muted);
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
