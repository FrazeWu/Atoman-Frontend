<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { getBirthDateDigits, formatBirthDateInput } from '@/components/music/birthDateMask'

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

const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const internalValue = ref('')
const showPopover = ref(false)

const now = new Date()
const currentYear = now.getFullYear()
const popoverYear = ref(currentYear)
const popoverMonth = ref(now.getMonth() + 1) // 1-12

// 年份快速选择选项 (1940 ~ 2035)
const yearOptions = Array.from({ length: 96 }, (_, i) => 2035 - i)
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`,
  value: i + 1,
}))

function normalizePart(val: string, len: number) {
  const trimmed = (val || '').trim()
  if (!trimmed) return ''
  return trimmed.padStart(len, '0')
}

function parseDateToParts(value: string) {
  const [year = '', month = '', day = ''] = value.trim().split(/[-/]/)
  return {
    year: year.replace(/\D/g, ''),
    month: month.replace(/\D/g, ''),
    day: day.replace(/\D/g, ''),
  }
}

function syncFromModel(val: { year: string; month: string; day: string }) {
  if (!val.year && !val.month && !val.day) {
    internalValue.value = ''
    return
  }
  const y = val.year.trim()
  const m = normalizePart(val.month, 2)
  const d = normalizePart(val.day, 2)

  const digits = `${y}${m}${d}`
  internalValue.value = formatBirthDateInput(digits)

  if (y && !isNaN(Number(y))) {
    popoverYear.value = Number(y)
  }
  if (m && !isNaN(Number(m)) && Number(m) >= 1 && Number(m) <= 12) {
    popoverMonth.value = Number(m)
  }
}

watch(
  () => props.modelValue,
  (newVal) => {
    syncFromModel(newVal)
  },
  { immediate: true, deep: true }
)

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  const rawValue = input.value
  const cursorPos = input.selectionStart ?? rawValue.length

  const digits = getBirthDateDigits(rawValue)
  const formatted = formatBirthDateInput(digits)

  internalValue.value = formatted

  // 平滑光标定位
  let newCursor = cursorPos
  if (formatted.length > rawValue.length && (formatted[cursorPos - 1] === '/' || formatted[cursorPos] === '/')) {
    newCursor = cursorPos + 1
  }

  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.setSelectionRange(newCursor, newCursor)
    }
  })

  // 解析并同步给父组件
  const parts = parseDateToParts(formatted)
  emit('update:modelValue', parts)
}

function togglePopover() {
  showPopover.value = !showPopover.value
}

function closePopover() {
  showPopover.value = false
}

// 快速按月份导航
function changeMonth(delta: number) {
  let m = popoverMonth.value + delta
  let y = popoverYear.value
  if (m < 1) {
    m = 12
    y -= 1
  } else if (m > 12) {
    m = 1
    y += 1
  }
  popoverMonth.value = m
  popoverYear.value = y
}

// 快捷点击天
function selectCalendarDay(d: number) {
  const yStr = String(popoverYear.value)
  const mStr = String(popoverMonth.value).padStart(2, '0')
  const dStr = String(d).padStart(2, '0')

  internalValue.value = `${yStr}/${mStr}/${dStr}`
  emit('update:modelValue', { year: yStr, month: mStr, day: dStr })
  showPopover.value = false
}

// 填充快捷“今天”
function selectToday() {
  const t = new Date()
  const yStr = String(t.getFullYear())
  const mStr = String(t.getMonth() + 1).padStart(2, '0')
  const dStr = String(t.getDate()).padStart(2, '0')

  internalValue.value = `${yStr}/${mStr}/${dStr}`
  emit('update:modelValue', { year: yStr, month: mStr, day: dStr })
  showPopover.value = false
}

// 计算当前选择年月的日历面板天数
const calendarDays = computed(() => {
  const y = popoverYear.value
  const m = popoverMonth.value - 1
  const firstDayOfWeek = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  const days: Array<{ day: number | null; isSelected?: boolean; key: string }> = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({ day: null, key: `empty-${i}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected =
      Number(props.modelValue.year) === y &&
      Number(props.modelValue.month) === popoverMonth.value &&
      Number(props.modelValue.day) === d
    days.push({ day: d, isSelected, key: `day-${d}` })
  }
  return days
})

// 点击外部关闭 Popover
function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    showPopover.value = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('click', handleClickOutside)
}

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})
</script>

<template>
  <div ref="containerRef" class="field-group p-date-input-container">
    <label v-if="label" class="field-label">
      {{ label }}{{ required ? '*' : '' }}
    </label>

    <div class="birth-date-field">
      <input
        ref="inputRef"
        :value="internalValue"
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
        @click.stop="togglePopover"
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
  gap: 0.45rem;
}

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
  padding: 0.6rem 2.2rem 0.6rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: 0.9rem;
  border-radius: var(--a-radius-control);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.birth-date-input:focus {
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent);
  outline-offset: 1px;
  border-color: var(--a-color-primary);
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
