<template>
  <div class="p-field p-field--line" :class="{ 'p-field--error': error }">
    <label v-if="label" class="p-field-label">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    
    <div class="p-field-content">
      <slot />
    </div>
    
    <div v-if="error" class="p-field-error-msg">{{ error }}</div>
    <div v-if="hint" class="p-field-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label?: string
  required?: boolean
  error?: string
  hint?: string
}>()
</script>

<style scoped>
.p-field-error-msg {
  font-size: 0.75rem;
  color: var(--a-color-danger);
  margin-top: 0.25rem;
  font-weight: 700;
}
.p-field-hint {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
  margin-top: 0.25rem;
}
</style>
