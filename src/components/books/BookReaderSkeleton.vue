<template>
  <div class="book-reader-skeleton" role="status" aria-busy="true" :aria-label="ariaLabel">
    <div class="book-reader-skeleton__card" :class="{ 'is-pdf': format === 'pdf' }">
      <div class="book-reader-skeleton__header">
        <div class="book-reader-skeleton__title" />
      </div>
      <div class="book-reader-skeleton__body">
        <div class="book-reader-skeleton__line is-w-full" />
        <div class="book-reader-skeleton__line is-w-90" />
        <div class="book-reader-skeleton__line is-w-95" />
        <div class="book-reader-skeleton__line is-w-85" />
        <div class="book-reader-skeleton__spacer" />
        <div class="book-reader-skeleton__line is-w-full" />
        <div class="book-reader-skeleton__line is-w-92" />
        <div class="book-reader-skeleton__line is-w-88" />
        <div class="book-reader-skeleton__line is-w-60" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    format?: string
    label?: string
  }>(),
  {
    format: '',
    label: '',
  }
)

const ariaLabel = computed(() => {
  if (props.label) return props.label
  if (props.format) return `正在加载 ${props.format.toUpperCase()} 页面...`
  return '正在加载阅读页面...'
})
</script>

<style scoped>
.book-reader-skeleton {
  width: 100%;
  height: 100%;
  min-height: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: var(--color-bg-surface, #ffffff);
  box-sizing: border-box;
}

.book-reader-skeleton__card {
  width: 100%;
  max-width: 580px;
  min-height: 440px;
  aspect-ratio: 1 / 1.414;
  border: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08));
  border-radius: 4px;
  box-shadow: none !important;
  background-color: var(--color-bg-surface, #ffffff);
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-sizing: border-box;
  animation: pulse 1.6s ease-in-out infinite;
}

.book-reader-skeleton__card.is-pdf {
  max-width: 620px;
}

.book-reader-skeleton__header {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.book-reader-skeleton__title {
  height: 1.25rem;
  width: 45%;
  background-color: var(--color-fill-muted, rgba(0, 0, 0, 0.06));
  border-radius: 4px;
}

.book-reader-skeleton__body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  flex: 1;
}

.book-reader-skeleton__line {
  height: 0.85rem;
  background-color: var(--color-fill-muted, rgba(0, 0, 0, 0.05));
  border-radius: 4px;
}

.book-reader-skeleton__spacer {
  height: 1rem;
}

.is-w-full { width: 100%; }
.is-w-95 { width: 95%; }
.is-w-92 { width: 92%; }
.is-w-90 { width: 90%; }
.is-w-88 { width: 88%; }
.is-w-85 { width: 85%; }
.is-w-60 { width: 60%; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
