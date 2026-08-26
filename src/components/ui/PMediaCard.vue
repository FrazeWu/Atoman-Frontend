<template>
  <article
    v-bind="$attrs"
    class="p-media-card"
    :class="`p-media-card--${variant}`"
  >
    <slot />
  </article>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  variant: 'square' | 'landscape'
}>()
</script>

<style scoped>
.p-media-card {
  display: block;
  width: 100%;
  min-width: 0;
  color: inherit;
}

.p-media-card--square :deep(.cover-frame),
.p-media-card--square :deep(.avatar-frame) {
  aspect-ratio: 1 / 1;
}

.p-media-card--landscape :deep(.vc-thumb) {
  aspect-ratio: 16 / 9;
}

.p-media-card :deep(.cover-frame),
.p-media-card :deep(.avatar-frame),
.p-media-card :deep(.vc-thumb) {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  box-shadow: none;
}
</style>
