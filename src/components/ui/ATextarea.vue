<template>
  <div class="a-field">
    <label v-if="label" class="a-field-label">{{ label }}</label>
    <textarea
      class="a-textarea"
      :class="error ? 'a-textarea--error' : ''"
      v-bind="$attrs"
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      @input="handleInput"
    />
    <div v-if="error" class="a-field-error">{{ error }}</div>
    <div v-else-if="hint" class="a-field-hint">{{ hint }}</div>
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
