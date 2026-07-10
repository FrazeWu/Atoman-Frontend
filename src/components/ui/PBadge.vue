<template>
  <span class="p-badge" :class="[`is-${type}`]">
    <span class="p-badge-dot" aria-hidden="true" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  type?: 'blog' | 'video' | 'podcast' | 'topic' | 'external' | 'internal' | 'success' | 'warning' | 'danger' | 'info'
  label?: string
  fill?: boolean
}>()
</script>

<style scoped>
.p-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--a-color-muted);
  line-height: 1.2;
}

.p-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--a-color-muted-soft);
  flex-shrink: 0;
  display: inline-block;
}

.p-badge.is-blog .p-badge-dot,
.p-badge.is-success .p-badge-dot {
  background-color: #22c55e;
}

.p-badge.is-video .p-badge-dot,
.p-badge.is-warning .p-badge-dot {
  background-color: #eab308;
}

.p-badge.is-podcast .p-badge-dot,
.p-badge.is-danger .p-badge-dot {
  background-color: #ef4444;
}

.p-badge.is-topic .p-badge-dot,
.p-badge.is-info .p-badge-dot,
.p-badge.is-internal .p-badge-dot,
.p-badge.is-external .p-badge-dot {
  background-color: var(--a-color-ink-soft);
}
</style>
