<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label" :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      class="p-input"
      :class="error ? 'p-input--error' : ''"
      v-bind="$attrs"
      :value="modelValue"
      :disabled="disabled"
      @input="handleInput"
    />
    <div v-if="error" class="p-field-error">{{ error }}</div>
    <div v-else-if="hint" class="p-field-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs() as Record<string, unknown>
const generatedId = `p-input-${Math.random().toString(36).slice(2, 10)}`

const props = withDefaults(defineProps<{
  modelValue?: string | number
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
}>(), {
  modelValue: '',
  label: '',
  hint: '',
  error: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [string]
  input: [Event]
}>()

const inputId = computed(() => (typeof attrs.id === 'string' && attrs.id.length > 0 ? attrs.id : generatedId))

const handleInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  emit('input', event)
}
</script>
