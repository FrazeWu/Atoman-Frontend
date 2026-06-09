<template>
  <div class="a-field a-field--line" :class="{ 'a-field--error': error }">
    <label v-if="label" class="a-field-label">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    
    <div class="a-field-content">
      <slot />
    </div>
    
    <div v-if="error" class="a-field-error-msg">{{ error }}</div>
    <div v-if="hint" class="a-field-hint">{{ hint }}</div>
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
.a-field-error-msg {
  font-size: 0.75rem;
  color: var(--a-color-danger);
  margin-top: 0.25rem;
  font-weight: 700;
}
.a-field-hint {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
  margin-top: 0.25rem;
}
</style>
