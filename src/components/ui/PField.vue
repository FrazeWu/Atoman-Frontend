<template>
  <div class="p-field p-field--line" :class="{ 'p-field--error': error }">
    <label v-if="label" class="p-field-label">
      {{ label }}
      <span v-if="required" class="p-field-required">*</span>
    </label>
    
    <div class="p-field-content">
      <slot />
    </div>
    
    <div v-if="error" :id="errorId" class="p-field-error-msg" role="alert" aria-live="polite">{{ error }}</div>
    <div v-if="hint" :id="hintId" class="p-field-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label?: string
  required?: boolean
  error?: string
  hint?: string
}>()

const fieldId = useId()
const errorId = computed(() => (props.error ? `${fieldId}-error` : undefined))
const hintId = computed(() => (props.hint && !props.error ? `${fieldId}-hint` : undefined))
</script>

<style scoped>
.p-field-required {
  color: var(--a-color-danger);
}
.p-field-error-msg {
  font-size: 0.75rem;
  color: var(--a-color-danger);
  margin-top: 0.25rem;
  font-weight: 500;
}
.p-field-hint {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
  margin-top: 0.25rem;
}
</style>
