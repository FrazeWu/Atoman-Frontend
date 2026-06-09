<template>
  <AModal :show="show" size="sm" :title="title" @close="cancel" @update:show="(value) => { if (!value) cancel() }">
    <p class="a-confirm__message">{{ message }}</p>
    <template #footer>
      <ABtn variant="secondary" :label="cancelText" @click="cancel" />
      <ABtn :variant="danger ? 'danger' : 'primary'" :label="confirmText" @click="confirm" />
    </template>
  </AModal>
</template>

<script setup lang="ts">
import ABtn from './ABtn.vue'
import AModal from './AModal.vue'

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
.a-confirm__message {
  margin: 0;
  color: var(--a-color-ink-muted);
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
