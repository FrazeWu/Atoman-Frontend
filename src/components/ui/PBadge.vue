<template>
  <span class="p-badge" :class="[`is-${type}`, { 'is-fill': fill }]">
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  type?: 'blog' | 'video' | 'podcast' | 'topic' | 'external' | 'internal'
  label?: string
  fill?: boolean
}>()
</script>

<style scoped>
.p-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 900;
  padding: 0.15rem 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid var(--a-color-line);
  color: var(--a-color-muted);
  line-height: 1.2;
}

.p-badge.is-fill {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
}

.p-badge.is-internal {
  border-style: solid;
}

.p-badge.is-external {
  border-style: dashed;
}

/* Specific type styles could be added here if needed */
</style>
