<template>
  <Teleport to="body" :disabled="teleportDisabled">
    <Transition name="modal-fade" appear>
      <div
        v-if="visible"
        class="p-modal-backdrop"
        :class="[{ 'p-modal-backdrop--above-player': abovePlayer }, backdropClass]"
        @click.self="handleBackdropClick"
      >
        <div
          ref="dialogRef"
          class="p-modal"
          :class="[`p-modal-${size}`, modalClass]"
          :role="role"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          :aria-label="title ? undefined : dialogLabel"
          tabindex="-1"
          v-bind="$attrs"
          @keydown="handleKeydown"
        >
          <button v-if="closable" class="p-modal-close-floating" :class="closeClass" type="button" aria-label="关闭" title="关闭" @click="handleClose">
            <X :size="18" aria-hidden="true" />
          </button>
          <div class="p-modal-body">
            <h2 v-if="title" :id="titleId" class="p-modal-title-inline">{{ title }}</h2>
            <slot />
          </div>
          <div v-if="hasFooter" class="p-modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.p-modal {
  position: relative;
  box-shadow: none !important;
  border-radius: var(--a-radius-card, 4px);
}
.p-modal-close-floating {
  position: absolute;
  top: 1rem;
  right: 1.25rem;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  color: var(--a-color-muted);
  cursor: pointer;
  font-size: 1.15rem;
  line-height: 1;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, opacity 0.15s ease;
  opacity: 0.6;
  z-index: 10;
}
.p-modal-close-floating:hover {
  opacity: 1;
  color: var(--a-color-fg);
}
.p-modal-title-inline {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--a-color-fg);
  margin: 0 0 1.25rem;
  padding-right: 2.5rem; /* Avoid overlap with floating close button */
}
</style>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import { X } from 'lucide-vue-next'
import { useDialogFocus } from '@/composables/useDialogFocus'

defineOptions({
  inheritAttrs: false,
})

let modalIdCounter = 0
const useId = () => `${++modalIdCounter}`

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  title?: string
  ariaLabel?: string
  role?: 'dialog' | 'alertdialog'
  modelValue?: boolean
  show?: boolean
  closable?: boolean
  closeOnBackdrop?: boolean
  abovePlayer?: boolean
  teleportDisabled?: boolean
  backdropClass?: any
  modalClass?: any
  closeClass?: any
  initialFocus?: 'auto' | 'first-input' | 'close-button' | HTMLElement | (() => HTMLElement | null)
  lockScroll?: boolean
}>(), {
  size: 'md',
  title: '',
  ariaLabel: '',
  role: 'dialog',
  modelValue: undefined,
  show: undefined,
  closable: true,
  closeOnBackdrop: true,
  abovePlayer: false,
  teleportDisabled: false,
  backdropClass: undefined,
  modalClass: undefined,
  closeClass: undefined,
  initialFocus: 'auto',
  lockScroll: true,
})

const emit = defineEmits<{
  close: []
  'update:modelValue': [value: boolean]
  'update:show': [value: boolean]
}>()

const slots = useSlots()
const dialogRef = ref<HTMLElement | null>(null)
const visible = computed(() => props.modelValue ?? props.show ?? true)
const hasFooter = computed(() => Boolean(slots.footer))
const dialogLabel = computed(() => props.ariaLabel || props.title || '对话框')
const titleId = `modal-title-${useId()}`

const handleClose = () => {
  emit('update:modelValue', false)
  emit('update:show', false)
  emit('close')
}

const handleBackdropClick = () => {
  if (!props.closeOnBackdrop) return
  handleClose()
}

const { handleKeydown } = useDialogFocus(visible, dialogRef, handleClose, {
  get initialFocus() {
    return props.initialFocus
  },
  get lockScroll() {
    return props.lockScroll
  },
})
</script>
