<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label">
      <span class="p-field-dot" aria-hidden="true" />
      {{ label }}
    </label>
    <div ref="rootRef" class="p-select-root">
      <button
        type="button"
        class="p-select-trigger"
        :class="[
          open ? 'p-select-trigger--open' : '',
          error ? 'p-select-trigger--error' : '',
        ]"
        :disabled="disabled"
        @click="toggleOpen"
      >
        <span :class="selectedOption ? '' : 'p-select-value--placeholder'">
          {{ selectedOption ? selectedOption.label : placeholder }}
        </span>
        <span class="p-select-chevron">▾</span>
      </button>

      <div v-if="open" class="p-select-panel">
        <button
          v-for="option in normalizedOptions"
          :key="String(option.value)"
          type="button"
          class="p-select-option"
          :disabled="option.disabled"
          @click="selectOption(option)"
        >
          <span class="p-select-marker">{{ option.value === modelValue ? '•' : '' }}</span>
          <span>{{ option.label }}</span>
        </button>
        <div v-if="normalizedOptions.length === 0" class="p-select-empty">暂无选项</div>
      </div>
    </div>
    <div v-if="error" class="p-field-error">{{ error }}</div>
    <div v-else-if="hint" class="p-field-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  options?: SelectOption[]
  placeholder?: string
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
}>(), {
  modelValue: null,
  options: () => [],
  placeholder: '请选择',
  label: '',
  hint: '',
  error: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const normalizedOptions = computed(() => props.options ?? [])
const selectedOption = computed(() => normalizedOptions.value.find(option => option.value === props.modelValue))

const close = () => {
  open.value = false
}

const toggleOpen = () => {
  if (props.disabled) return
  open.value = !open.value
}

const selectOption = (option: SelectOption) => {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  close()
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) {
    close()
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
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

.p-select-root {
  position: relative;
}

.p-select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0 0.72rem;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.p-select-trigger:focus-visible,
.p-select-trigger--open {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.p-select-trigger--error {
  border-bottom-color: var(--a-color-accent-destructive);
}

.p-select-value--placeholder,
.p-select-chevron {
  color: var(--a-color-ink-soft);
}

.p-select-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 0.4rem);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.65rem 1rem;
  border-radius: 0px; /* Straight corner */
  background: #ffffff; /* Pure white */
  border: 1px solid var(--a-color-line-soft); /* 1px border */
  box-shadow: none; /* No shadow */
}

.p-select-option {
  display: grid;
  grid-template-columns: 1rem 1fr;
  gap: 0.45rem;
  padding: 0.65rem 0;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.p-select-option:last-child {
  border-bottom: 0;
}

.p-select-marker {
  color: var(--a-color-accent-confirm);
}

.p-select-empty,
.p-field-error,
.p-field-hint {
  font-size: 0.75rem;
}

.p-field-error {
  color: var(--a-color-accent-destructive);
}

.p-field-hint,
.p-select-empty {
  color: var(--a-color-ink-soft);
}
</style>
