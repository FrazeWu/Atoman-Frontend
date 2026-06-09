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
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}

.a-card--interactive:hover {
  box-shadow: var(--a-shadow-paper-md);
  transform: translate(-2px, -2px);
}
</style>
