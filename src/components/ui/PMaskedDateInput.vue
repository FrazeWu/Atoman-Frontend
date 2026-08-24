<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import PHelpTooltip from '@/components/ui/PHelpTooltip.vue'
import {
  BIRTH_DATE_SLOT_POSITIONS,
  formatPartialDateInput,
  isPartialDateValid,
  normalizePartialDateParts,
  parsePartialDateParts,
  type PartialDateParts,
} from '@/components/music/birthDateMask'

const props = defineProps<{
  modelValue: PartialDateParts
  label?: string
  required?: boolean
  testId?: string
  placeholder?: string
  helpText?: string
  presentWhenEmpty?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: PartialDateParts): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const internalValue = ref('yyyy/mm/dd')
const showPopover = ref(false)

const defaultHelpText = computed(() => props.helpText || (
  props.presentWhenEmpty
    ? '日期不确定时可输入 --，完全未知可填 ----/--/--；不填表示至今。'
    : '日期不确定时可输入 --，完全未知可填 ----/--/--。'
))
const normalizedModel = computed(() => normalizePartialDateParts(props.modelValue))
const hasInvalidDate = computed(() => !isPartialDateValid(normalizedModel.value))

const now = new Date()
const currentYear = now.getFullYear()
const popoverYear = ref(currentYear)
const popoverMonth = ref(now.getMonth() + 1)
const yearOptions = Array.from({ length: 96 }, (_, index) => 2035 - index)
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1}月`,
  value: index + 1,
}))

const dateSegments = [
  { key: 'year', start: 0, length: 4 },
  { key: 'month', start: 5, length: 2 },
  { key: 'day', start: 8, length: 2 },
] as const

type DatePartKey = (typeof dateSegments)[number]['key']

function syncPopoverFromParts(parts: PartialDateParts) {
  if (/^\d{1,4}$/.test(parts.year)) popoverYear.value = Number(parts.year)
  if (/^\d{1,2}$/.test(parts.month)) {
    const month = Number(parts.month)
    if (month >= 1 && month <= 12) popoverMonth.value = month
  }
}

function syncFromModel(value: PartialDateParts) {
  const parts = normalizePartialDateParts(value)
  internalValue.value = formatPartialDateInput(parts)
  syncPopoverFromParts(parts)
}

watch(
  () => props.modelValue,
  (value) => syncFromModel(value),
  { immediate: true, deep: true },
)

function partAtPosition(position: number) {
  return dateSegments.find(
    (segment) => position >= segment.start && position < segment.start + segment.length,
  )
}

function nextEditablePosition(position: number) {
  return BIRTH_DATE_SLOT_POSITIONS.find((slot) => slot >= position) ?? internalValue.value.length
}

function previousEditablePosition(position: number) {
  return [...BIRTH_DATE_SLOT_POSITIONS].reverse().find((slot) => slot <= position) ?? null
}

function setCaret(input: HTMLInputElement, position: number) {
  input.setSelectionRange(position, position)
}

function cursorAfterParts(parts: PartialDateParts) {
  if (parts.year === '----') return internalValue.value.length
  if (parts.year.length < 4) return parts.year.length
  if (!parts.month) return 5
  if (parts.month !== '--' && parts.month.length < 2) return 5 + parts.month.length
  if (!parts.day) return 8
  if (parts.day !== '--' && parts.day.length < 2) return 8 + parts.day.length
  return internalValue.value.length
}

function commitParts(parts: PartialDateParts) {
  const normalized = normalizePartialDateParts(parts)
  internalValue.value = formatPartialDateInput(normalized)
  emit('update:modelValue', normalized)
  syncPopoverFromParts(normalized)
  return normalized
}

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  const parts = commitParts(parsePartialDateParts(input.value))
  input.value = internalValue.value
  setCaret(input, cursorAfterParts(parts))
}

function handleDigit(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? start
  const display = internalValue.value
  const nextValue = start === 0 && end >= display.length
    ? event.key
    : `${display.slice(0, start)}${event.key}${display.slice(end)}`

  event.preventDefault()
  commitParts(parsePartialDateParts(nextValue))
  input.value = internalValue.value
  const nextPosition = nextEditablePosition(start + 1)
  setCaret(input, nextPosition)
}

function clearPart(parts: PartialDateParts, key: DatePartKey) {
  parts[key] = ''
  if (key === 'year') {
    parts.month = ''
    parts.day = ''
  } else if (key === 'month') {
    parts.day = ''
  }
}

function removeDigit(parts: PartialDateParts, key: DatePartKey, offset: number) {
  const value = parts[key]
  if (!value || /^-+$/.test(value)) {
    clearPart(parts, key)
    return
  }

  const digits = value.replace(/\D/g, '').split('')
  if (offset < digits.length) digits.splice(offset, 1)
  parts[key] = digits.join('')
  if (key === 'year' && parts.year.length < 4) {
    parts.month = ''
    parts.day = ''
  } else if (key === 'month' && !parts.month) {
    parts.day = ''
  }
}

function clearSelectedParts(parts: PartialDateParts, start: number, end: number) {
  for (const segment of dateSegments) {
    const segmentEnd = segment.start + segment.length
    if (start < segmentEnd && end > segment.start) clearPart(parts, segment.key)
  }
}

function handleErase(event: KeyboardEvent, backward: boolean) {
  const input = event.target as HTMLInputElement
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? start
  const target = end > start
    ? null
    : backward
      ? previousEditablePosition(start - 1)
      : nextEditablePosition(start)

  if (target === null && end <= start) return
  event.preventDefault()

  const parts = normalizePartialDateParts(parsePartialDateParts(internalValue.value))
  if (target === null) {
    clearSelectedParts(parts, start, end)
    commitParts(parts)
    input.value = internalValue.value
    setCaret(input, start)
    return
  }

  const segment = partAtPosition(target)
  if (!segment) return
  removeDigit(parts, segment.key, target - segment.start)
  commitParts(parts)
  input.value = internalValue.value
  setCaret(input, backward ? target : nextEditablePosition(target + 1))
}

function handleKeydown(event: KeyboardEvent) {
  if (/^[0-9]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
    handleDigit(event)
    return
  }
  if (event.key === 'Backspace') {
    handleErase(event, true)
    return
  }
  if (event.key === 'Delete') handleErase(event, false)
}

function handleSelect() {
  if (internalValue.value === 'yyyy/mm/dd') inputRef.value?.select()
}

function togglePopover() {
  showPopover.value = !showPopover.value
}

function closePopover() {
  showPopover.value = false
}

function changeMonth(delta: number) {
  let month = popoverMonth.value + delta
  let year = popoverYear.value
  if (month < 1) {
    month = 12
    year -= 1
  } else if (month > 12) {
    month = 1
    year += 1
  }
  popoverMonth.value = month
  popoverYear.value = year
}

function selectCalendarDay(day: number) {
  const parts = {
    year: String(popoverYear.value),
    month: String(popoverMonth.value).padStart(2, '0'),
    day: String(day).padStart(2, '0'),
  }
  commitParts(parts)
  showPopover.value = false
}

function selectToday() {
  const today = new Date()
  commitParts({
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1).padStart(2, '0'),
    day: String(today.getDate()).padStart(2, '0'),
  })
  showPopover.value = false
}

const calendarDays = computed(() => {
  const year = popoverYear.value
  const month = popoverMonth.value - 1
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: Array<{ day: number | null; isSelected?: boolean; key: string }> = []

  for (let index = 0; index < firstDayOfWeek; index += 1) {
    days.push({ day: null, key: `empty-${index}` })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const isSelected =
      Number(normalizedModel.value.year) === year &&
      Number(normalizedModel.value.month) === popoverMonth.value &&
      Number(normalizedModel.value.day) === day
    days.push({ day, isSelected, key: `day-${day}` })
  }
  return days
})

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    showPopover.value = false
  }
}

onMounted(() => window.addEventListener('click', handleClickOutside))
onUnmounted(() => window.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div ref="containerRef" class="field-group p-date-input-container">
    <div v-if="label" class="field-label-row">
      <label class="field-label">
        {{ label }}{{ required ? '*' : '' }}
      </label>
      <PHelpTooltip
        :text="defaultHelpText"
        :aria-label="`${label}填写说明`"
        :trigger-test-id="testId ? `${testId}-help-btn` : undefined"
        trigger="both"
        placement="bottom-start"
        size="sm"
        @open="closePopover"
      />
    </div>

    <div class="birth-date-field">
      <input
        ref="inputRef"
        :value="internalValue"
        :data-testid="testId"
		:data-test="testId"
        type="text"
        inputmode="text"
        class="birth-date-input"
        :class="{ 'birth-date-input--invalid': hasInvalidDate }"
        :placeholder="placeholder || 'yyyy/mm/dd'"
        :aria-label="label"
        :aria-invalid="hasInvalidDate"
        :aria-required="required || undefined"
        autocomplete="off"
        @input="handleInput"
        @keydown="handleKeydown"
        @click="handleSelect"
        @focus="handleSelect"
      >
      <button
        type="button"
        class="birth-date-trigger"
        :data-testid="testId ? `${testId}-picker-btn` : undefined"
		:data-test="testId ? `${testId}-picker-btn` : undefined"
        aria-label="选择日期"
        :aria-expanded="showPopover"
        @click="togglePopover"
      >
        <CalendarDays :size="16" />
      </button>

      <!-- 快速年份与月份 Popover 面板 -->
      <div v-if="showPopover" class="date-popover" @click.stop>
        <!-- Popover 顶部：快捷年份与月份下拉菜单 -->
        <div class="date-popover__header">
          <button type="button" class="popover-nav-btn" title="上一个月" @click="changeMonth(-1)">
            <ChevronLeft :size="16" />
          </button>

          <div class="popover-selectors">
            <select v-model="popoverYear" class="popover-select year-select">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
            </select>
            <select v-model="popoverMonth" class="popover-select month-select">
              <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>

          <button type="button" class="popover-nav-btn" title="下一个月" @click="changeMonth(1)">
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- 星期列表 -->
        <div class="date-popover__weekdays">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>

        <!-- 日期网格 -->
        <div class="date-popover__grid">
          <template v-for="item in calendarDays" :key="item.key">
            <button
              v-if="item.day"
              type="button"
              class="calendar-day-btn"
              :class="{ 'is-selected': item.isSelected }"
              @click="selectCalendarDay(item.day)"
            >
              {{ item.day }}
            </button>
            <div v-else class="calendar-day-empty" />
          </template>
        </div>

        <!-- Popover 底部：快捷按钮 -->
        <div class="date-popover__footer">
          <button type="button" class="popover-footer-btn" @click="selectToday">今天</button>
          <button type="button" class="popover-footer-btn popover-footer-btn--close" @click="closePopover">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.p-date-input-container {
  position: relative;
  display: grid;
  gap: 0.5rem;
}

.field-label {
  color: var(--a-color-muted);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0;
}

.field-label-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.birth-date-field {
  display: flex;
  position: relative;
  align-items: center;
}

.birth-date-input {
  flex: 1;
  width: 100%;
  height: 44px;
  min-height: 44px;
  box-sizing: border-box;
  padding: 0.7rem 2.75rem 0.7rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font: inherit;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  border-radius: var(--a-radius-control);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.birth-date-input:focus {
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent);
  outline-offset: 1px;
  border-color: var(--a-color-primary);
}

.birth-date-input--invalid,
.birth-date-input--invalid:focus {
  border-color: var(--a-color-danger);
}

.birth-date-trigger {
  position: absolute;
  right: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.birth-date-trigger:hover {
  color: var(--a-color-text);
  background: var(--a-color-surface-muted);
}

/* 日历 Popover 面板 */
.date-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 120;
  width: 280px;
  padding: 0.85rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-md);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.date-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.popover-selectors {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.popover-select {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.25rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
}

.popover-select:focus {
  border-color: var(--a-color-primary);
}

.popover-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  border-radius: 4px;
}

.popover-nav-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.date-popover__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--a-color-muted);
  padding-bottom: 0.2rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.date-popover__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-day-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.1rem;
  border: none;
  background: transparent;
  color: var(--a-color-text);
  font-size: 0.82rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.calendar-day-btn:hover {
  background: var(--a-color-surface-muted);
}

.calendar-day-btn.is-selected {
  background: var(--a-color-primary);
  color: #ffffff;
  font-weight: 600;
}

.calendar-day-empty {
  height: 2.1rem;
}

.date-popover__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.4rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.popover-footer-btn {
  border: none;
  background: transparent;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--a-color-primary);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}

.popover-footer-btn--close {
  color: var(--a-color-muted);
}

:global(.dark) .date-popover {
  background: var(--a-color-bg, #0f172a);
  border-color: var(--a-color-border-soft, #334155);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
}

:global(.dark) .popover-select {
  background: var(--a-color-surface-muted, #1e293b);
  border-color: var(--a-color-border-soft, #334155);
  color: var(--a-color-text, #f8fafc);
}
</style>
