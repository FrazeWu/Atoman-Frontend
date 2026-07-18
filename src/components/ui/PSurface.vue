<template>
  <section class="p-surface" :class="[`p-surface--${tone}`, `p-surface--layer-${layer}`]">
    <slot />
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'default' | 'soft'
  layer?: 0 | 1 | 2
}>(), {
  tone: 'default',
  layer: 0,
})
</script>

<style scoped>
.p-surface {
  border: none;
  background: var(--a-color-bg);
  border-radius: var(--a-radius-card);
}

.p-surface--soft {
  background: var(--a-color-surface);
}

.p-surface--layer-0,
.p-surface--layer-1 {
  box-shadow: none;
}

.p-surface--layer-2 {
  box-shadow: var(--a-shadow-md);
}
</style>
