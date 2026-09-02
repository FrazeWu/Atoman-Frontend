<template>
  <section class="studio-calendar">
    <PPageHeader title="发布日历" sub="定时发布">
      <template #action>
        <div class="studio-calendar__month-actions">
          <PButton type="button" variant="secondary" aria-label="上个月" title="上个月" @click="changeMonth(-1)">
            <ChevronLeft :size="18" aria-hidden="true" />
          </PButton>
          <strong>{{ monthLabel }}</strong>
          <PButton type="button" variant="secondary" aria-label="下个月" title="下个月" @click="changeMonth(1)">
            <ChevronRight :size="18" aria-hidden="true" />
          </PButton>
        </div>
      </template>
    </PPageHeader>

    <p v-if="loading" class="studio-calendar__message">加载中...</p>
    <p v-else-if="error" class="studio-calendar__message studio-calendar__message--error" role="alert">{{ error }}</p>
    <PEmpty v-else-if="!studio.currentChannel" kicker="" title="请先创建频道" />
    <div v-else class="studio-calendar__grid-scroll">
      <div class="studio-calendar__weekdays" aria-hidden="true">
        <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
      </div>
      <ol class="studio-calendar__days" aria-label="发布日历">
        <li v-for="day in calendarDays" :key="day.key" :class="{ 'is-outside': !day.inCurrentMonth, 'is-today': day.key === todayKey }">
          <time :datetime="day.key">{{ day.date.getDate() }}</time>
          <ol v-if="itemsForDay(day.key).length" class="studio-calendar__items">
            <li v-for="item in itemsForDay(day.key)" :key="item.id">
              <RouterLink :to="`/studio/${item.module}/${item.id}/edit`">
                <time :datetime="item.scheduled_at">{{ formatTime(item.scheduled_at) }}</time>
                <strong>{{ item.title || '未命名内容' }}</strong>
              </RouterLink>
              <ul v-if="item.preflight.length" class="studio-calendar__issues" aria-label="发布前检查提示">
                <li v-for="issue in item.preflight" :key="issue.code" :title="preflightLabel(issue.code)">
                  <AlertTriangle :size="13" aria-hidden="true" />
                  <span>{{ preflightLabel(issue.code) }}</span>
                </li>
              </ul>
            </li>
          </ol>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IconAlertTriangle as AlertTriangle, IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight } from '@tabler/icons-vue'
import { RouterLink } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioCalendarItem } from '@/types'

const studio = useStudioStore()
const displayMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const loading = ref(true)
const error = ref('')
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const todayKey = localDateKey(new Date())
const preflightLabels: Record<string, string> = {
  missing_title: '缺少标题',
  missing_cover: '缺少封面',
  missing_collection: '未加入合集',
  missing_audio: '缺少音频',
  processing_failed: '处理失败',
  external_unplayable: '外链不可播放',
}

const monthLabel = computed(() => displayMonth.value.toLocaleDateString('zh-CN', {
  year: 'numeric', month: 'long',
}))
const calendarDays = computed(() => {
  const first = new Date(displayMonth.value.getFullYear(), displayMonth.value.getMonth(), 1)
  const last = new Date(displayMonth.value.getFullYear(), displayMonth.value.getMonth() + 1, 0)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  const end = new Date(last)
  end.setDate(last.getDate() + (6 - last.getDay()))
  const days: Array<{ key: string; date: Date; inCurrentMonth: boolean }> = []
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push({
      key: localDateKey(date),
      date: new Date(date),
      inCurrentMonth: date.getMonth() === displayMonth.value.getMonth(),
    })
  }
  return days
})
const itemsByDay = computed(() => {
  const grouped = new Map<string, StudioCalendarItem[]>()
  for (const item of studio.calendarItems) {
    const key = localDateKey(new Date(item.scheduled_at))
    const items = grouped.get(key) ?? []
    items.push(item)
    grouped.set(key, items)
  }
  return grouped
})

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function itemsForDay(key: string) {
  return itemsByDay.value.get(key) ?? []
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function preflightLabel(code: string) {
  return preflightLabels[code] || code
}

async function loadCalendar() {
  if (!studio.currentChannel) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  const from = new Date(displayMonth.value.getFullYear(), displayMonth.value.getMonth(), 1)
  const to = new Date(displayMonth.value.getFullYear(), displayMonth.value.getMonth() + 1, 1)
  try {
    await studio.loadCalendar(from.toISOString(), to.toISOString())
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function changeMonth(offset: number) {
  displayMonth.value = new Date(displayMonth.value.getFullYear(), displayMonth.value.getMonth() + offset, 1)
  void loadCalendar()
}

onMounted(async () => {
  try {
    await studio.loadState()
    await loadCalendar()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    loading.value = false
  }
})
</script>

<style scoped>
.studio-calendar { display: grid; gap: 1.25rem; }
.studio-calendar__month-actions { display: flex; align-items: center; gap: 0.5rem; }
.studio-calendar__month-actions strong { min-width: 7rem; text-align: center; font-size: 0.9rem; }
.studio-calendar__month-actions :deep(.p-button) { width: 2.75rem; min-height: 2.75rem; padding: 0; }
.studio-calendar__message { margin: 0; padding: 2rem 0; color: var(--a-color-muted); }
.studio-calendar__message--error { color: var(--a-color-danger); }
.studio-calendar__grid-scroll { overflow-x: auto; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); }
.studio-calendar__weekdays, .studio-calendar__days { min-width: 48rem; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
.studio-calendar__weekdays { border-bottom: 1px solid var(--a-color-border-soft); }
.studio-calendar__weekdays span { padding: 0.625rem 0.75rem; color: var(--a-color-muted); font-size: 0.75rem; text-align: right; }
.studio-calendar__days > li { min-width: 0; min-height: 10rem; padding: 0.5rem; border-right: 1px solid var(--a-color-border-soft); border-bottom: 1px solid var(--a-color-border-soft); }
.studio-calendar__days > li:nth-child(7n) { border-right: 0; }
.studio-calendar__days > li.is-outside { background: var(--a-color-surface-muted); }
.studio-calendar__days > li.is-today > time { color: var(--a-color-primary); font-weight: 700; }
.studio-calendar__days > li > time { display: block; color: var(--a-color-muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; text-align: right; }
.studio-calendar__items { display: grid; gap: 0.5rem; margin: 0.5rem 0 0; padding: 0; list-style: none; }
.studio-calendar__items > li { min-width: 0; display: grid; gap: 0.25rem; }
.studio-calendar__items a { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.4rem; color: var(--a-color-text); text-decoration: none; }
.studio-calendar__items a:hover { color: var(--a-color-primary); }
.studio-calendar__items a:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.studio-calendar__items a time { color: var(--a-color-muted); font-size: 0.7rem; font-variant-numeric: tabular-nums; }
.studio-calendar__items a strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.studio-calendar__issues { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.studio-calendar__issues li { display: inline-flex; align-items: center; gap: 0.2rem; max-width: 100%; color: var(--a-color-danger); font-size: 0.65rem; }
.studio-calendar__issues span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 560px) {
  .studio-calendar :deep(.p-page-header__action) { width: 100%; }
  .studio-calendar__month-actions { justify-content: space-between; width: 100%; }
}
</style>
