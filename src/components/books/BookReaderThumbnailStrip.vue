<template>
  <aside class="book-thumbnail-strip" aria-label="页面缩略图">
    <header class="book-thumbnail-strip__header">
      <span class="book-thumbnail-strip__title">页面 ({{ totalPages }})</span>
    </header>
    <div class="book-thumbnail-strip__list" role="list">
      <button
        v-for="page in totalPages"
        :key="page"
        type="button"
        class="book-thumbnail-item"
        :class="{ 'is-active': page === currentPage }"
        :aria-current="page === currentPage ? 'page' : undefined"
        @click="$emit('select-page', page)"
      >
        <div class="book-thumbnail-item__page">
          <span class="book-thumbnail-item__indicator">{{ page }}</span>
        </div>
        <span class="book-thumbnail-item__label">第 {{ page }} 页</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  totalPages: number
  currentPage: number
}>()

defineEmits<{
  (e: 'select-page', page: number): void
}>()
</script>

<style scoped>
.book-thumbnail-strip {
  display: flex;
  flex-direction: column;
  width: 12rem;
  height: 100%;
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  overflow: hidden;
}

.book-thumbnail-strip__header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.book-thumbnail-strip__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.book-thumbnail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-card);
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.book-thumbnail-item:hover {
  background: var(--a-color-surface-muted);
}

.book-thumbnail-item.is-active {
  border-color: var(--a-color-primary);
  background: color-mix(in srgb, var(--a-color-primary) 8%, transparent);
}

.book-thumbnail-item__page {
  width: 100%;
  aspect-ratio: 1 / 1.414;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-thumbnail-item.is-active .book-thumbnail-item__page {
  border-color: var(--a-color-primary);
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
  box-shadow: none;
}

.book-thumbnail-item__indicator {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  font-variant-numeric: tabular-nums;
}

.book-thumbnail-item__label {
  font-size: 0.7rem;
  color: var(--a-color-muted);
}
</style>
