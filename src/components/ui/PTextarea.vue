<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label">
      <span class="p-field-dot" aria-hidden="true" />
      {{ label }}
    </label>
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

.p-textarea {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  padding: 0 0 0.72rem;
  font: inherit;
  resize: vertical;
  line-height: 1.6;
  box-sizing: border-box;
}

.p-textarea:focus {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.p-textarea--error {
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
