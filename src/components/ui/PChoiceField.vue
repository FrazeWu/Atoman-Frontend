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
  triggerTestId: 'paper-choice-trigger',
  optionPrefix: 'paper-choice-option-',
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
  <div ref="rootRef" class="paper-choice" :class="{ 'paper-choice--open': open }">
    <label class="paper-choice-label">
      <span class="paper-choice-dot" aria-hidden="true" />
      <span>{{ label }}</span>
    </label>

    <button
      :data-test="triggerTestId"
      type="button"
      class="paper-choice-trigger"
      :disabled="disabled"
      @click="toggle"
    >
      <span :class="{ 'paper-choice-placeholder': !selectedLabel }">{{ selectedLabel || placeholder }}</span>
      <span class="paper-choice-meta">{{ open ? '收起' : '选择' }}</span>
    </button>

    <div v-if="open" class="paper-choice-panel">
      <button
        v-for="option in options"
        :key="option.value"
        :data-test="`${optionPrefix}${option.value}`"
        type="button"
        class="paper-choice-option"
        :class="{ 'paper-choice-option--active': option.value === modelValue }"
        @click="selectOption(option.value)"
      >
        <span class="paper-choice-marker">{{ option.value === modelValue ? '•' : '' }}</span>
        <span>{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.paper-choice {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.paper-choice-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.paper-choice-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 70%, transparent);
  opacity: 0.4;
}

.paper-choice-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0 0.7rem;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.paper-choice-trigger:focus-visible,
.paper-choice--open .paper-choice-trigger {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.paper-choice-placeholder,
.paper-choice-meta {
  color: var(--a-color-ink-soft);
}

.paper-choice-meta {
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
}

.paper-choice-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 0.4rem);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.65rem 1rem;
  border-radius: 0px;
  background: #ffffff; /* pure white */
  border: 1px solid var(--a-color-line-soft);
  box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.15);
}

.paper-choice-option {
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

.paper-choice-option:last-child {
  border-bottom: 0;
}

.paper-choice-option--active {
  color: var(--a-color-accent-confirm);
}

.paper-choice-marker {
  color: var(--a-color-accent-confirm);
}
</style>
