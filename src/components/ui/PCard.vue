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
  border-bottom: 1.5px dashed var(--a-color-line-soft);
  border-left: 3px solid transparent; /* Reserve left border */
  background: var(--a-color-paper);
  padding: 24px;
  border-radius: var(--a-radius-base);
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.p-card--interactive {
  cursor: pointer;
}

.p-card--interactive:hover {
  background-color: var(--a-color-paper-wash); /* #f3f4f6 */
  border-left-color: var(--a-color-ink); /* Left ink line */
}

/* Link underline hover linkage */
.p-card--interactive:hover :deep(a),
.p-card--interactive:hover :deep(.p-link-label) {
  text-decoration: underline !important;
  text-decoration-thickness: 1px;
}
</style>
