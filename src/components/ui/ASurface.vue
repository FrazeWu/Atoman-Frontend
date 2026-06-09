<template>
  <section class="a-surface" :class="[`a-surface--${tone}`, `a-surface--layer-${layer}`]">
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
.a-surface {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
}

.a-surface--soft {
  background: var(--a-color-paper-soft);
}

.a-surface--layer-0 {
  box-shadow: none;
}

.a-surface--layer-1 {
  box-shadow: var(--a-shadow-paper-sm);
}

.a-surface--layer-2 {
  box-shadow: var(--a-shadow-paper-lg);
}
</style>
