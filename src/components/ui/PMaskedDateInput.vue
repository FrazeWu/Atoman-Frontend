<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { CalendarDays } from 'lucide-vue-next'
import { getBirthDateDigits, formatBirthDateInput, getBirthDateCursorIndex } from '@/components/music/birthDateMask'

const props = defineProps<{
  modelValue: { year: string; month: string; day: string }
  label?: string
  required?: boolean
  testId?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: { year: string; month: string; day: string }): void
}>()

const datePickerRef = ref<HTMLInputElement | null>(null)
const internalDigits = ref('')

function normalizeDatePart(value: string, length: number) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.padStart(length, '0')
}

function parseDateToParts(value: string) {
  const [year = '', month = '', day = ''] = value.trim().split(/[-/]/)
  return { year, month, day }
}

function formatDateParts(parts?: { year: string; month: string; day: string }) {
  if (!parts) return ''
  const year = parts.year.trim()
  const month = normalizeDatePart(parts.month, 2)
  const day = normalizeDatePart(parts.day, 2)
  if (!year || !month || !day) return ''
  return `${year}-${month}-${day}`
}

watch(
  () => props.modelValue,
  (newVal) => {
    const formatted = formatDateParts(newVal) || ''
    // Only update if external value changed significantly to avoid cursor jumping
    const newDigits = getBirthDateDigits(formatted)
    if (newDigits !== internalDigits.value && formatted) {
      internalDigits.value = newDigits
    }
  },
  { immediate: true, deep: true }
)

const displayModel = computed({
  get: () => {
    return formatBirthDateInput(internalDigits.value)
  },
  set: (value: string) => {
    const newDigits = value.replace(/\D/g, '').slice(0, 8)
    internalDigits.value = newDigits
    const formatted = formatBirthDateInput(newDigits)
    emit('update:modelValue', parseDateToParts(formatted))
  }
})

const nativeValue = computed(() => formatDateParts(props.modelValue))

function openDatePicker() {
  datePickerRef.value?.showPicker?.()
  datePickerRef.value?.focus()
}

function onDatePickerChange(event: Event) {
  const input = event.target as HTMLInputElement
  displayModel.value = input.value.replaceAll('-', '/')
}

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  const selectionStart = input.selectionStart ?? input.value.length
  const digitCountBeforeCursor = getBirthDateDigits(input.value.slice(0, selectionStart)).length

  displayModel.value = input.value

  void nextTick(() => {
    const cursorIndex = getBirthDateCursorIndex(digitCountBeforeCursor)
    input.setSelectionRange(cursorIndex, cursorIndex)
  })
}
</script>

<template>
  <div class="field-group">
    <label v-if="label" class="field-label">
      {{ label }}{{ required ? '*' : '' }}
    </label>
    <div class="birth-date-field">
      <input
        :value="displayModel"
        :data-testid="testId"
        type="text"
        inputmode="numeric"
        class="birth-date-input"
        :placeholder="placeholder || 'yyyy/mm/dd'"
        @input="handleInput"
      >
      <button
        type="button"
        class="birth-date-trigger"
        :data-testid="testId ? `${testId}-picker-btn` : undefined"
        aria-label="选择日期"
        @click="openDatePicker"
      >
        <CalendarDays :size="18" />
      </button>
      <input
        ref="datePickerRef"
        :value="nativeValue"
        type="date"
        class="birth-date-native"
        tabindex="-1"
        aria-hidden="true"
        @change="onDatePickerChange"
      >
    </div>
  </div>
</template>

<style scoped>
.field-group { display: grid; gap: 0.45rem; }
.field-label {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.birth-date-field {
  display: flex;
  position: relative;
  align-items: center;
}

.birth-date-input {
  flex: 1;
  width: 100%;
  padding: 0.85rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-family: monospace;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  padding-right: 3rem;
  border-radius: 4px;
}
.birth-date-input:focus {
  outline: none;
  border-color: var(--a-color-text);
  background: var(--a-color-bg);
}

.birth-date-trigger {
  position: absolute;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s ease;
}
.birth-date-trigger:hover {
  color: var(--a-color-text);
}

.birth-date-native {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
