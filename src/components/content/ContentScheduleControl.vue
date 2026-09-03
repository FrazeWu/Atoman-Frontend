<script setup lang="ts">
import { computed } from 'vue'
import { IconCalendarClock as CalendarClock } from '@tabler/icons-vue'

import type { BlogScheduleStatus } from '@/composables/useContentLifecycle'

const props = defineProps<{ modelValue: string; busy?: boolean; disabled?: boolean; schedule?: BlogScheduleStatus | null }>()
defineEmits<{ 'update:modelValue': [value: string]; schedule: []; retry: [] }>()

const scheduleMessage = computed(() => {
  const schedule = props.schedule
  if (!schedule) return ''
  if (schedule.status === 'failed') return schedule.last_error ? `发布失败：${schedule.last_error}` : '发布失败，请重新尝试发布'
  if (schedule.status === 'processing') return '正在发布'
  if (schedule.status === 'pending') return `已排期，时区：${schedule.timezone}`
  if (schedule.status === 'published') return '已按计划发布'
  return '已取消定时发布'
})
</script>

<template>
  <div class="schedule-control">
    <label>
      <span>发布时间</span>
      <input
        type="datetime-local"
        :value="modelValue"
        :disabled="busy || disabled"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button type="button" :disabled="busy || disabled || !modelValue" @click="$emit('schedule')">
      <CalendarClock :size="16" aria-hidden="true" />
      {{ busy ? '设置中…' : '定时发布' }}
    </button>
    <p v-if="scheduleMessage" class="schedule-control__state" :class="{ 'schedule-control__state--failed': schedule?.status === 'failed' }" role="status">
      {{ scheduleMessage }}
    </p>
    <button v-if="schedule?.status === 'failed'" data-testid="retry-schedule" type="button" :disabled="busy || disabled" @click="$emit('retry')">
      重新尝试发布
    </button>
  </div>
</template>

<style scoped>
.schedule-control { display: flex; align-items: end; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap; padding-top: 1rem; border-top: 1px solid var(--a-color-border-soft); }
.schedule-control label { display: grid; gap: 0.35rem; }
.schedule-control label span { color: var(--a-color-muted); font-size: 0.75rem; }
.schedule-control input, .schedule-control button { min-height: 2.75rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-fg); font: inherit; }
.schedule-control input { padding: 0 0.75rem; }
.schedule-control button { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0 1rem; cursor: pointer; }
.schedule-control button:disabled, .schedule-control input:disabled { opacity: 0.5; cursor: not-allowed; }
.schedule-control button:focus-visible, .schedule-control input:focus-visible { outline: 2px solid var(--a-color-fg); outline-offset: 2px; }
.schedule-control__state { flex: 1 1 100%; margin: 0; color: var(--a-color-muted); font-size: 0.8rem; }
.schedule-control__state--failed { color: var(--a-color-danger); }
@media (max-width: 520px) { .schedule-control, .schedule-control label, .schedule-control input, .schedule-control button { width: 100%; } .schedule-control button { justify-content: center; } }
</style>
