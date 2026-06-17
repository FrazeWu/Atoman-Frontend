<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label">{{ label }}</label>
    <textarea
      class="p-textarea"
      :class="error ? 'p-textarea--error' : ''"
      v-bind="$attrs"
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      @input="handleInput"
    />
    <div v-if="error" class="p-field-error">{{ error }}</div>
    <div v-else-if="hint" class="p-field-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
  rows?: number
}>(), {
  modelValue: '',
  label: '',
  hint: '',
  error: '',
  disabled: false,
  rows: 4,
})

const emit = defineEmits<{
  'update:modelValue': [string]
  input: [Event]
}>()

const handleInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  emit('input', event)
}
</script>
