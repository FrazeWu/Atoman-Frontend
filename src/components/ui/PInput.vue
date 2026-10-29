<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label" :for="inputId">
      {{ label }}
    </label>
    <div class="p-input-wrapper" :class="{ 'p-input-wrapper--with-suffix': $slots.suffix }">
      <input
        :id="inputId"
        class="p-input"
        :class="error ? 'p-input--error' : ''"
        v-bind="$attrs"
        :value="modelValue"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        :aria-errormessage="errorId"
        @input="handleInput"
      />
      <div v-if="$slots.suffix" class="p-input-suffix">
        <slot name="suffix" />
      </div>
    </div>
    <div v-if="error" :id="errorId" class="p-field-error" role="alert" aria-live="polite">{{ error }}</div>
    <div v-else-if="hint" :id="hintId" class="p-field-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs() as Record<string, unknown>
const defaultId = useId()

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

const inputId = computed(() => (typeof attrs.id === 'string' && attrs.id.length > 0 ? attrs.id : defaultId))
const errorId = computed(() => (props.error ? `${inputId.value}-error` : undefined))
const hintId = computed(() => (props.hint && !props.error ? `${inputId.value}-hint` : undefined))
const describedBy = computed(() => errorId.value || hintId.value || undefined)

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
  color: var(--a-color-muted);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0;
}

.p-input-wrapper {
  position: relative;
  width: 100%;
}

.p-input {
  width: 100%;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  min-height: 44px;
  padding: 0.7rem 0.85rem;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
  box-shadow: none !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.p-input-wrapper--with-suffix .p-input {
  padding-right: 3.6rem;
}

.p-input-suffix {
  position: absolute;
  inset: 0 0 0 auto;
  display: grid;
  place-items: center;
}

.p-input:focus {
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent);
  outline-offset: 1px;
  border-color: var(--a-color-primary);
}

.p-input--error {
  border-color: var(--a-color-danger) !important;
  box-shadow: none !important;
}

.p-input--error:focus {
  outline: 2px solid color-mix(in srgb, var(--a-color-danger) 24%, transparent) !important;
  outline-offset: 1px;
  border-color: var(--a-color-danger) !important;
}

.p-field-error {
  color: var(--a-color-danger);
  font-size: 0.75rem;
}

.p-field-hint {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}
</style>
