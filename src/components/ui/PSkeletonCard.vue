<template>
  <div
    class="p-skeleton-card"
    :class="{ 'p-skeleton-card--bordered': bordered }"
  >
    <div
      class="p-skeleton-card__media"
      :class="`p-skeleton-card__media--${aspectClass}`"
    >
      <PSkeleton variant="rect" width="100%" height="100%" :bordered="false" />
    </div>
    <div v-if="lines > 0" class="p-skeleton-card__body">
      <div
        v-for="i in lines"
        :key="i"
        class="p-skeleton-card__text"
      >
        <PSkeleton
          variant="text"
          :width="i === 1 ? '75%' : (i === lines && lines > 1) ? '45%' : '90%'"
          height="0.85rem"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PSkeleton from './PSkeleton.vue'

const props = withDefaults(defineProps<{
  aspect?: '3/4' | '1/1' | '16/9' | 'auto'
  lines?: number
  bordered?: boolean
}>(), {
  aspect: '3/4',
  lines: 2,
  bordered: false,
})

const aspectClass = computed(() => {
  if (props.aspect === '3/4') return '3-4'
  if (props.aspect === '1/1') return '1-1'
  if (props.aspect === '16/9') return '16-9'
  return 'auto'
})
</script>

<style scoped>
.p-skeleton-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
  box-shadow: none !important;
}

.p-skeleton-card--bordered {
  border: 1px solid var(--a-color-border-soft);
}

.p-skeleton-card__media {
  width: 100%;
  position: relative;
  overflow: hidden;
  border-radius: var(--a-radius-card, 4px);
}

.p-skeleton-card__media--3-4 {
  aspect-ratio: 3 / 4;
}

.p-skeleton-card__media--1-1 {
  aspect-ratio: 1 / 1;
}

.p-skeleton-card__media--16-9 {
  aspect-ratio: 16 / 9;
}

.p-skeleton-card__media--auto {
  min-height: 8rem;
}

.p-skeleton-card__body {
  padding-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.p-skeleton-card__text {
  width: 100%;
}
</style>
