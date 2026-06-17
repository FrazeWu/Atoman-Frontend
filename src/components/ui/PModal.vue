<template>
  <Teleport to="body">
    <div v-if="visible" class="p-modal-backdrop" @click.self="handleClose">
      <div class="p-modal" :class="`p-modal-${size}`" role="dialog" aria-modal="true" :aria-label="title || undefined">
        <div v-if="title || closable" class="p-modal-header">
          <span class="p-modal-title">{{ title }}</span>
          <button v-if="closable" class="p-modal-close" type="button" @click="handleClose">✕</button>
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
import { computed, useSlots } from 'vue'

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
const visible = computed(() => props.modelValue ?? props.show ?? true)
const hasFooter = computed(() => Boolean(slots.footer))

const handleClose = () => {
  emit('update:modelValue', false)
  emit('update:show', false)
  emit('close')
}
</script>
