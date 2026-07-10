<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label" :for="inputId">
      <span class="p-field-dot" aria-hidden="true" />
      {{ label }}
    </label>
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

<style scoped>
.p-field {
  display: grid;
  gap: 0.5rem;
}

.p-field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.p-field-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
  flex-shrink: 0;
}

.p-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--a-color-line);
  background: transparent;
  color: var(--a-color-ink);
  padding: 0 0 0.6rem;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-bottom-color 0.15s ease;
}

.p-input:focus {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.p-input--error {
  border-bottom-color: var(--a-color-accent-destructive);
}

.p-field-error {
  color: var(--a-color-accent-destructive);
  font-size: 0.75rem;
}

.p-field-hint {
  color: var(--a-color-ink-soft);
  font-size: 0.75rem;
}
</style>
