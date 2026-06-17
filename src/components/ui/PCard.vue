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
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  padding: 24px;
}

.p-card--interactive {
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.p-card--interactive:hover {
  border-color: var(--a-color-muted-soft);
  background-color: var(--a-color-paper-soft);
}
</style>
