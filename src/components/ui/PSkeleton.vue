<template>
  <div
    class="p-skeleton"
    :class="[
      `p-skeleton--${variant}`,
      {
        'p-skeleton--shimmer': animated,
        'p-skeleton--bordered': bordered,
      }
    ]"
    :style="{ width, height }"
  ></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'text' | 'rect' | 'circle'
  width?: string
  height?: string
  animated?: boolean
  bordered?: boolean
}>(), {
  variant: 'rect',
  width: '100%',
  height: '1rem',
  animated: true,
  bordered: false,
})
</script>

<style scoped>
.p-skeleton {
  background: var(--a-color-surface-muted, #f1f5f9);
  position: relative;
  overflow: hidden;
}

.p-skeleton--text {
  border-radius: var(--a-radius-control, 4px);
  height: 0.85em;
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

.p-skeleton--rect {
  border-radius: var(--a-radius-card, 4px);
}

.p-skeleton--circle {
  border-radius: 50%;
}

.p-skeleton--bordered {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.p-skeleton--shimmer::after {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.25) 30%,
    rgba(255, 255, 255, 0.45) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 1.6s infinite;
  content: '';
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .p-skeleton--shimmer::after {
    animation: none;
    display: none;
  }
}
</style>
