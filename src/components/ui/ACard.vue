<template>
  <article class="a-card" :class="{ 'a-card--interactive': interactive }">
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
.a-card {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  padding: 24px;
}

.a-card--interactive {
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.a-card--interactive:hover {
  border-color: var(--a-color-muted-soft);
  background-color: var(--a-color-paper-soft);
}
</style>
