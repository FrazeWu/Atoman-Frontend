<template>
  <section class="p-surface" :class="[`p-surface--${tone}`, `p-surface--layer-${layer}`]">
    <slot />
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'paper' | 'soft'
  layer?: 0 | 1 | 2
}>(), {
  tone: 'paper',
  layer: 0,
})
</script>

<style scoped>
.p-surface {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  border-radius: 8px; /* 8px roundness */
}

.p-surface--soft {
  background: var(--a-color-paper-soft);
}

.p-surface--layer-0 {
  box-shadow: none;
}

.p-surface--layer-1 {
  box-shadow: var(--a-shadow-paper-sm);
}

.p-surface--layer-2 {
  box-shadow: var(--a-shadow-paper-lg);
}
</style>
