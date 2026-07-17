<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label">
      <span class="p-field-dot" aria-hidden="true" />
      {{ label }}
    </label>
    <div ref="rootRef" class="p-select-root">
      <button
        ref="triggerRef"
        type="button"
        class="p-select-trigger"
        :class="[
          open ? 'p-select-trigger--open' : '',
          error ? 'p-select-trigger--error' : '',
        ]"
        :disabled="disabled"
        :aria-label="label || placeholder"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="listboxId"
        @click="toggleOpen"
        @keydown.down.prevent="openFromKeyboard('first')"
        @keydown.up.prevent="openFromKeyboard('last')"
        @keydown.home.prevent="openFromKeyboard('first')"
        @keydown.end.prevent="openFromKeyboard('last')"
        @keydown.esc.prevent="closeAndFocusTrigger"
      >
        <span :class="selectedOption ? '' : 'p-select-value--placeholder'">
          {{ selectedOption ? selectedOption.label : placeholder }}
        </span>
        <span class="p-select-chevron">▾</span>
      </button>

      <div v-if="open" :id="listboxId" class="p-select-panel" role="listbox" :aria-label="label || placeholder">
        <button
          v-for="(option, index) in normalizedOptions"
          :key="String(option.value)"
          :ref="element => setOptionRef(index, element)"
          type="button"
          class="p-select-option"
          :disabled="option.disabled"
          role="option"
          :aria-selected="option.value === modelValue"
          :tabindex="focusedIndex === index ? 0 : -1"
          @click="selectOption(option)"
          @keydown="handleOptionKeydown($event, index, option)"
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
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

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

const instanceId = `p-select-${getCurrentInstance()?.uid ?? 0}`
const listboxId = `${instanceId}-listbox`
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const optionRefs = new Map<number, HTMLButtonElement>()
const focusedIndex = ref(-1)
const normalizedOptions = computed(() => props.options ?? [])
const selectedOption = computed(() => normalizedOptions.value.find(option => option.value === props.modelValue))

const setOptionRef = (index: number, element: unknown) => {
  if (element instanceof HTMLButtonElement) optionRefs.set(index, element)
  else optionRefs.delete(index)
}

const enabledIndexes = () => normalizedOptions.value
  .map((option, index) => option.disabled ? -1 : index)
  .filter(index => index >= 0)

const focusOption = async (index: number) => {
  focusedIndex.value = index
  await nextTick()
  optionRefs.get(index)?.focus()
}

const close = () => {
  open.value = false
  focusedIndex.value = -1
}

const closeAndFocusTrigger = async () => {
  close()
  await nextTick()
  triggerRef.value?.focus()
}

const openFromKeyboard = async (position: 'first' | 'last') => {
  if (props.disabled) return
  const indexes = enabledIndexes()
  if (indexes.length === 0) return
  open.value = true
  await focusOption(position === 'first' ? indexes[0] : indexes[indexes.length - 1])
}

const toggleOpen = () => {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    const selectedIndex = normalizedOptions.value.findIndex(option => option.value === props.modelValue && !option.disabled)
    focusedIndex.value = selectedIndex >= 0 ? selectedIndex : enabledIndexes()[0] ?? -1
  } else {
    focusedIndex.value = -1
  }
}

const selectOption = (option: SelectOption) => {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  void closeAndFocusTrigger()
}

const moveOptionFocus = (currentIndex: number, direction: 1 | -1) => {
  const indexes = enabledIndexes()
  const position = indexes.indexOf(currentIndex)
  if (position === -1) return
  const nextPosition = (position + direction + indexes.length) % indexes.length
  void focusOption(indexes[nextPosition])
}

const handleOptionKeydown = (event: KeyboardEvent, index: number, option: SelectOption) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveOptionFocus(index, 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveOptionFocus(index, -1)
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const indexes = enabledIndexes()
    const target = event.key === 'Home' ? indexes[0] : indexes[indexes.length - 1]
    if (target !== undefined) void focusOption(target)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectOption(option)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    void closeAndFocusTrigger()
  }
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
  padding: 0 0 0.6rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-line);
  background: transparent;
  color: var(--a-color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-bottom-color 0.15s ease;
}

.p-select-trigger:focus-visible,
.p-select-trigger--open {
  border-bottom-color: var(--a-color-accent-confirm);
}

.p-select-trigger:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: 2px;
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
  top: calc(100% + 4px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 0.25rem;
  border-radius: var(--a-radius-none, 4px);
  background: #ffffff;
  border: 1px solid var(--a-color-line);
  box-shadow: none;
}

.p-select-option {
  display: grid;
  grid-template-columns: 1rem 1fr;
  gap: 0.45rem;
  padding: 0.55rem 0.75rem;
  border: 0;
  background: transparent;
  color: var(--a-color-ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
  border-radius: calc(var(--a-radius-none, 4px) - 1px);
  transition: background-color 0.15s ease;
}

.p-select-option:hover {
  background-color: var(--a-color-paper-soft);
}

.p-select-option:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: -2px;
  background: var(--a-color-paper-wash);
}

.p-select-marker {
  color: var(--a-color-ink);
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

@media (max-width: 767px) {
  .p-select-trigger,
  .p-select-option {
    min-height: 44px;
  }
}
</style>
