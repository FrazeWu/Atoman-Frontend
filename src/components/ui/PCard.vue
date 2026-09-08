<template>
  <article class="p-card" :class="{ 'p-card--interactive': interactive }">
    <slot />
    <span v-if="interactive" class="p-card__arrow" aria-hidden="true">→</span>
  </article>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  interactive?: boolean
}>(), {
  interactive: false,
})
</script>

<style scoped>
.p-card {
  position: relative;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  padding: 24px;
  border-radius: var(--a-radius-card);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.p-card--interactive {
  cursor: pointer;
  padding-right: 3rem;
}

.p-card--interactive:hover,
.p-card--interactive:focus-within {
  border-color: var(--a-color-border);
  background-color: var(--a-color-surface);
}

.p-card__arrow {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  color: var(--a-color-muted);
  font-size: 1rem;
  line-height: 1;
  transition: color 0.15s ease, transform 0.15s ease;
}

.p-card--interactive:hover .p-card__arrow,
.p-card--interactive:focus-within .p-card__arrow {
  color: var(--a-color-primary-hover);
  transform: translateX(2px);
}
</style>
