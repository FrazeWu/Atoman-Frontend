<template>
  <PInput
    :model-value="modelValue"
    :label="label"
    :type="showTime ? 'datetime-local' : 'date'"
    :disabled="disabled"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
    @input="emit('input', $event)"
  />
</template>

<script setup lang="ts">
import PInput from './PInput.vue'

withDefaults(defineProps<{
  modelValue?: string
  label?: string
  disabled?: boolean
  placeholder?: string
  showTime?: boolean
}>(), {
  modelValue: '',
  label: '',
  disabled: false,
  placeholder: '',
  showTime: true,
})

const emit = defineEmits<{
  'update:modelValue': [string]
  input: [Event]
}>()
</script>
