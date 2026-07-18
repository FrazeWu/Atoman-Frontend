<script setup lang="ts">
import { CalendarClock } from 'lucide-vue-next'

defineProps<{ modelValue: string; busy?: boolean; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: string]; schedule: [] }>()
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
@media (max-width: 520px) { .schedule-control, .schedule-control label, .schedule-control input, .schedule-control button { width: 100%; } .schedule-control button { justify-content: center; } }
</style>
