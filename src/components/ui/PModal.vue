<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="p-modal-backdrop"
        :class="{ 'p-modal-backdrop--above-player': abovePlayer }"
        @click.self="handleClose"
      >
        <div
          ref="dialogRef"
          class="p-modal"
          :class="`p-modal-${size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="title || undefined"
          tabindex="-1"
          @keydown="handleKeydown"
        >
          <button v-if="closable" class="p-modal-close-floating" type="button" aria-label="关闭" title="关闭" @click="handleClose">✕</button>
          <div class="p-modal-body">
            <div v-if="title" class="p-modal-title-inline">{{ title }}</div>
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
  margin-bottom: 1.25rem;
  padding-right: 2.5rem; /* Avoid overlap with floating close button */
}
</style>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  title?: string
  modelValue?: boolean
  show?: boolean
  closable?: boolean
  abovePlayer?: boolean
}>(), {
  size: 'md',
  title: '',
  modelValue: undefined,
  show: undefined,
  closable: true,
  abovePlayer: false,
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

const handleClose = () => {
  emit('update:modelValue', false)
  emit('update:show', false)
  emit('close')
}

const { handleKeydown } = useDialogFocus(visible, dialogRef, handleClose)
</script>
