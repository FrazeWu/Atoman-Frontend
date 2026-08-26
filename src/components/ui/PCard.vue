<template>
  <article class="p-card" :class="{ 'p-card--interactive': interactive }">
    <slot />
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
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  padding: 24px;
  border-radius: var(--a-radius-card);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.p-card--interactive {
  cursor: pointer;
}

.p-card--interactive:hover,
.p-card--interactive:focus-within {
  border-color: var(--a-color-border);
  background-color: var(--a-color-surface);
}
</style>
