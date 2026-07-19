<template>
  <div
    class="p-skeleton"
    :class="[`p-skeleton--${variant}`, { 'p-skeleton--shimmer': animated }]"
    :style="{ width, height }"
  ></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'text' | 'rect' | 'circle'
  width?: string
  height?: string
  animated?: boolean
}>(), {
  variant: 'rect',
  width: '100%',
  height: '1rem',
  animated: true
})
</script>

<style scoped>
.p-skeleton {
  background: var(--a-color-surface-muted, #f1f5f9);
  position: relative;
  overflow: hidden;
}

.p-skeleton--text {
  border-radius: 4px;
  height: 0.85em;
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

.p-skeleton--rect {
  border-radius: 6px;
}

.p-skeleton--circle {
  border-radius: 50%;
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
    rgba(255, 255, 255, 0.3) 20%,
    rgba(255, 255, 255, 0.5) 60%,
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
</style>
