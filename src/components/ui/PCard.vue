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
  border: none;
  background: var(--a-color-bg);
  padding: 24px;
  border-radius: var(--a-radius-card);
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.p-card--interactive {
  cursor: pointer;
}

.p-card--interactive:hover {
  background-color: var(--a-color-surface);
  box-shadow: var(--a-shadow-sm);
}
</style>
