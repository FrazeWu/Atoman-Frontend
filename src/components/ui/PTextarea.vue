<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label">{{ label }}</label>
    <div class="p-textarea-wrapper">
      <textarea
        class="p-textarea"
        :class="error ? 'p-textarea--error' : ''"
        v-bind="$attrs"
        :value="modelValue"
        :rows="rows"
        :disabled="disabled"
        @input="handleInput"
      />
    </div>
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

<style scoped>
.p-field {
  display: grid;
  gap: 0.5rem;
}

.p-field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-muted);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0;
}

.p-textarea-wrapper {
  position: relative;
  width: 100%;
}

.p-textarea {
  width: 100%;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font: inherit;
  line-height: 1.6;
  padding: 0.75rem 0.85rem;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.p-textarea:focus {
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent);
  outline-offset: 1px;
  border-color: var(--a-color-primary);
}

.p-textarea--error {
  border-color: var(--a-color-accent-destructive);
}

.p-field-error {
  color: var(--a-color-accent-destructive);
  font-size: 0.75rem;
}

.p-field-hint {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}
</style>
