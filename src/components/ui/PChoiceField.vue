<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type ChoiceOption = {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  label: string
  options: ChoiceOption[]
  placeholder?: string
  triggerTestId?: string
  optionPrefix?: string
  disabled?: boolean
}>(), {
  placeholder: '请选择',
  triggerTestId: 'p-choice-field-trigger',
  optionPrefix: 'p-choice-field-option-',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)

const selectedLabel = computed(() =>
  props.options.find((option) => option.value === props.modelValue)?.label || '',
)

function close() {
  open.value = false
}

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  close()
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) {
    close()
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div ref="rootRef" class="p-choice-field" :class="{ 'p-choice-field--open': open }">
    <label class="p-choice-field-label">{{ label }}</label>

    <button
      :data-test="triggerTestId"
      type="button"
      class="p-choice-field-trigger"
      :disabled="disabled"
      @click="toggle"
    >
      <span :class="{ 'p-choice-field-placeholder': !selectedLabel }">{{ selectedLabel || placeholder }}</span>
      <span class="p-choice-field-meta">{{ open ? '收起' : '选择' }}</span>
    </button>

    <div v-if="open" class="p-choice-field-panel">
      <button
        v-for="option in options"
        :key="option.value"
        :data-test="`${optionPrefix}${option.value}`"
        type="button"
        class="p-choice-field-option"
        :class="{ 'p-choice-field-option--active': option.value === modelValue }"
        @click="selectOption(option.value)"
      >
        <span class="p-choice-field-marker">{{ option.value === modelValue ? '•' : '' }}</span>
        <span>{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.p-choice-field {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.p-choice-field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-muted);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0;
}

.p-choice-field-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 44px;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.p-choice-field-trigger:focus-visible,
.p-choice-field--open .p-choice-field-trigger {
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent);
  outline-offset: 1px;
  border-color: var(--a-color-primary);
}

.p-choice-field-placeholder,
.p-choice-field-meta {
  color: var(--a-color-muted);
}

.p-choice-field-meta {
  font-family: inherit;
  font-size: 0.75rem;
  letter-spacing: 0;
}

.p-choice-field-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 0.25rem;
  border-radius: var(--a-radius-control);
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft);
  box-shadow: var(--a-shadow-dropdown);
}

.p-choice-field-option {
  display: grid;
  grid-template-columns: 1rem 1fr;
  gap: 0.45rem;
  padding: 0.55rem 0.75rem;
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
  font: inherit;
  border-radius: var(--a-radius-base);
  transition: background-color 0.15s ease;
}

.p-choice-field-option:hover {
  background-color: var(--a-color-surface);
}

.p-choice-field-option--active {
  color: var(--a-color-text);
}

.p-choice-field-marker {
  color: var(--a-color-text);
}
</style>
