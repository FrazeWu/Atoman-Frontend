<template>
  <section v-if="isMobile && show" class="p-confirm p-confirm--inline" role="alertdialog" :aria-label="title">
    <h2 class="p-confirm__title">{{ title }}</h2>
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
  </section>
  <PModal v-else :show="show" size="sm" :title="title" :above-player="abovePlayer" :close-on-backdrop="false" @close="cancel" @update:show="(value) => { if (!value) cancel() }">
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
import { isStandaloneMobileApp } from '@/utils/appRuntime'

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

const isMobile = isStandaloneMobileApp()

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

.p-confirm__title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 650;
}

.p-confirm--inline {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 8px;
  background: var(--a-color-surface);
}

.p-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
