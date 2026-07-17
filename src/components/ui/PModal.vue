<template>
  <Teleport to="body">
    <div v-if="visible" class="p-modal-backdrop" @click.self="handleClose">
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
        <div v-if="title || closable" class="p-modal-header">
          <span class="p-modal-title">{{ title }}</span>
          <button v-if="closable" class="p-modal-close" type="button" aria-label="关闭" title="关闭" @click="handleClose">✕</button>
        </div>
        <div class="p-modal-body">
          <slot />
        </div>
        <div v-if="hasFooter" class="p-modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  title?: string
  modelValue?: boolean
  show?: boolean
  closable?: boolean
}>(), {
  size: 'md',
  title: '',
  modelValue: undefined,
  show: undefined,
  closable: true,
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
