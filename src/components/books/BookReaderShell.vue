<template>
  <section class="book-reader-shell" :aria-label="ariaLabel">
    <header class="book-reader-shell__header">
      <RouterLink class="book-reader-shell__back" :to="backTo" :aria-label="backLabel" :title="backLabel">
        <ArrowLeft :size="18" aria-hidden="true" />
      </RouterLink>
      <div class="book-reader-shell__heading">
        <div class="book-reader-shell__title-row">
          <h2>{{ title }}</h2>
          <span v-if="format" class="book-reader-shell__format">{{ format.toUpperCase() }}</span>
        </div>
        <p v-if="subtitle || $slots.subtitle">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="book-reader-shell__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot name="status" />

    <section v-if="showSurface" class="book-reader-shell__surface">
      <div class="book-reader-shell__toolbar">
        <span v-if="toolbarLabel">{{ toolbarLabel }}</span>
        <div class="book-reader-shell__progress" aria-live="polite">
          <span>阅读进度</span>
          <strong class="tabular-nums">{{ progressPercent }}%</strong>
        </div>
        <div v-if="pageLabel || showPagination" class="book-reader-shell__pagination tabular-nums">
          <button v-if="showPagination" type="button" aria-label="上一页" title="上一页" :disabled="!canPrev" @click="emit('previous')">
            <ChevronLeft :size="17" aria-hidden="true" />
          </button>
          <span>{{ pageLabel || format.toUpperCase() }}</span>
          <button v-if="showPagination" type="button" aria-label="下一页" title="下一页" :disabled="!canNext" @click="emit('next')">
            <ChevronRight :size="17" aria-hidden="true" />
          </button>
        </div>
      </div>

      <details v-if="toc.length" class="book-reader-shell__toc" open>
        <summary>目录</summary>
        <ol>
          <li v-for="(item, index) in toc" :key="item.id || `${item.href}-${index}`">
            <button type="button" :class="{ 'is-nested': (item.depth || 0) > 0 }" @click="emit('toc-select', item.href)">
              {{ item.label }}
            </button>
          </li>
        </ol>
      </details>

      <slot />
      <slot name="footer" />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconArrowLeft as ArrowLeft, IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight } from '@tabler/icons-vue'

export type BookReaderTocItem = {
  id?: string
  href: string
  label: string
  depth?: number
}

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  format?: string
  progress?: number
  pageLabel?: string
  toolbarLabel?: string
  backTo: string
  backLabel: string
  ariaLabel?: string
  canPrev?: boolean
  canNext?: boolean
  showPagination?: boolean
  showSurface?: boolean
  toc?: BookReaderTocItem[]
}>(), {
  subtitle: '',
  format: '',
  progress: 0,
  pageLabel: '',
  toolbarLabel: '',
  ariaLabel: '电子书阅读器',
  canPrev: true,
  canNext: true,
  showPagination: false,
  showSurface: true,
  toc: () => [],
})

const emit = defineEmits<{
  previous: []
  next: []
  'toc-select': [href: string]
}>()

const progressPercent = computed(() => Math.round(Math.max(0, Math.min(1, props.progress)) * 100))
</script>

<style scoped>
.book-reader-shell {
  display: grid;
  gap: 1.25rem;
}

.book-reader-shell__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
}

.book-reader-shell__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  transition: color 0.15s ease, background-color 0.15s ease;
}

.book-reader-shell__back:hover {
  background-color: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.book-reader-shell__back:focus-visible,
.book-reader-shell__pagination button:focus-visible,
.book-reader-shell__toc button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.book-reader-shell__heading {
  min-width: 0;
}

.book-reader-shell__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.book-reader-shell__title-row h2 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.book-reader-shell__format {
  display: inline-flex;
  align-items: center;
  min-height: 1.4rem;
  padding: 0 0.45rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 999px;
  color: var(--a-color-muted);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.book-reader-shell__heading p,
.book-reader-shell :deep(.book-reader-shell__feedback) {
  margin: 0.25rem 0 0;
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.book-reader-shell__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.book-reader-shell__surface {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
}

.book-reader-shell__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  min-height: 2.5rem;
  padding: 0.25rem 0.75rem;
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control);
  color: var(--a-color-muted);
  font-size: 0.88rem;
}

.book-reader-shell__progress,
.book-reader-shell__pagination {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-variant-numeric: tabular-nums;
}

.book-reader-shell__progress strong {
  color: var(--a-color-fg);
  font-weight: 600;
}

.book-reader-shell__pagination button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
}

.book-reader-shell__pagination button:hover:not(:disabled) {
  background-color: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.book-reader-shell__pagination button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.book-reader-shell__toc {
  background: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control);
  overflow: hidden;
}

.book-reader-shell__toc summary {
  padding: 0.65rem 0.85rem;
  color: var(--a-color-muted);
  cursor: pointer;
  font-weight: 500;
  user-select: none;
  transition: color 0.15s ease;
}

.book-reader-shell__toc summary:hover {
  color: var(--a-color-fg);
}

.book-reader-shell__toc[open] summary {
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.book-reader-shell__toc ol {
  display: grid;
  gap: 0.15rem;
  max-height: 16rem;
  margin: 0;
  padding: 0.5rem 0.85rem 0.75rem 2rem;
  overflow: auto;
  background: #ffffff;
}

.book-reader-shell__toc button {
  padding: 0.2rem 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.book-reader-shell__toc button:hover {
  text-decoration: underline;
}

.book-reader-shell__toc button.is-nested {
  padding-left: 1rem;
  color: var(--a-color-muted);
}

@media (max-width: 640px) {
  .book-reader-shell__header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .book-reader-shell__actions {
    grid-column: 2;
  }

  .book-reader-shell__toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding-block: 0.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-reader-shell__back,
  .book-reader-shell__pagination button,
  .book-reader-shell__toc summary {
    transition: none;
  }
}
</style>
