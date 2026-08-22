<template>
  <div v-if="updatedAt" class="post-update-notice" role="note">
    <span class="post-update-notice__label">最近更新时间：</span>
    <span>{{ formatDate(updatedAt) }}，{{ freshnessMessage }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  updatedAt?: string
}>()

const elapsedWeeks = computed(() => {
  if (!props.updatedAt) return null
  const updatedAt = Date.parse(props.updatedAt)
  if (!Number.isFinite(updatedAt)) return null
  const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000
  return Math.floor(Math.max(0, Date.now() - updatedAt) / weekInMilliseconds)
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const freshnessMessage = computed(() => {
  if (elapsedWeeks.value === null) {
    return '距今已过去 0 周，请注意信息有效性。'
  }
  return `距今已过去 ${elapsedWeeks.value} 周，请注意信息有效性。`
})
</script>

<style scoped>
.post-update-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 0 0 1.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid color-mix(in srgb, var(--a-color-success) 28%, var(--a-color-border-soft));
  border-top: 3px solid var(--a-color-success);
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--a-color-success) 8%, var(--a-color-bg));
  color: var(--a-color-fg);
  font-size: 0.875rem;
  line-height: 1.6;
}

.post-update-notice__label {
  flex: 0 0 auto;
  color: var(--a-color-success);
  font-weight: 600;
  white-space: nowrap;
}
</style>
