<template>
  <aside
    v-if="readerStore.activeBook"
    class="book-mini-bar"
    role="complementary"
    aria-label="正在阅读"
  >
    <!-- 左侧：微型封面与书名 -->
    <div class="book-mini-bar__left">
      <div class="book-mini-bar__cover">
        <img
          v-if="readerStore.activeBook.coverUrl"
          :src="readerStore.activeBook.coverUrl"
          :alt="readerStore.activeBook.title"
          class="book-mini-bar__cover-img"
        />
        <div v-else class="book-mini-bar__cover-placeholder">
          <BookOpen :size="16" aria-hidden="true" />
        </div>
      </div>
      <div class="book-mini-bar__info">
        <strong class="book-mini-bar__title">{{ readerStore.activeBook.title }}</strong>
        <span class="book-mini-bar__chapter">
          {{ readerStore.activeBook.chapterTitle || `${readerStore.activeBook.currentPage} / ${readerStore.activeBook.totalPages} 页` }}
        </span>
      </div>
    </div>

    <!-- 中部：微型进度指示条 -->
    <div class="book-mini-bar__center">
      <div class="book-mini-bar__progress-track" aria-hidden="true">
        <span
          class="book-mini-bar__progress-fill"
          :style="{ width: `${Math.round(readerStore.activeBook.percent * 100)}%` }"
        />
      </div>
      <span class="book-mini-bar__percent">
        {{ Math.round(readerStore.activeBook.percent * 100) }}%
      </span>
    </div>

    <!-- 右侧：展开阅读浮层与控制 -->
    <div class="book-mini-bar__right">
      <PButton
        variant="primary"
        size="sm"
        data-testid="expand-reader"
        @click="expandReader"
      >
        <BookOpen :size="14" aria-hidden="true" />
        <span>继续阅读</span>
      </PButton>
      <button
        type="button"
        class="book-mini-bar__close"
        title="关闭阅读栏"
        aria-label="关闭阅读栏"
        @click="closeReaderBar"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { BookOpen, X } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import { useBookReaderStore } from '@/stores/bookReader'

const router = useRouter()
const readerStore = useBookReaderStore()

function expandReader() {
  readerStore.toggleOverlay(true)
  if (readerStore.activeBook?.assetId && router) {
    void router.push(`/books/public-read/${readerStore.activeBook.assetId}`)
  }
}

function closeReaderBar() {
  readerStore.closeBook()
}
</script>

<style scoped>
.book-mini-bar {
  position: fixed;
  bottom: 0;
  left: var(--a-sidebar-width, 16rem);
  right: 0;
  height: 3.25rem;
  background: var(--a-color-bg);
  border-top: 1px solid var(--a-color-border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  gap: 1.5rem;
  z-index: 50;
  transition: left 0.2s ease;
}

@media (max-width: 768px) {
  .book-mini-bar {
    left: 0;
    bottom: var(--mobile-bottom-nav-height, 3.5rem);
  }
}

.book-mini-bar__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
}

.book-mini-bar__cover {
  width: 1.75rem;
  height: 2.35rem;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  background: var(--a-color-surface-muted);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-mini-bar__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-mini-bar__cover-placeholder {
  color: var(--a-color-muted);
}

.book-mini-bar__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.book-mini-bar__title {
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-mini-bar__chapter {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-mini-bar__center {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  max-width: 20rem;
}

@media (max-width: 640px) {
  .book-mini-bar__center {
    display: none;
  }
}

.book-mini-bar__progress-track {
  flex: 1;
  height: 4px;
  background: var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  overflow: hidden;
}

.book-mini-bar__progress-fill {
  display: block;
  height: 100%;
  background: var(--a-color-primary);
  border-radius: var(--a-radius-control);
  transition: width 0.3s ease;
}

.book-mini-bar__percent {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  font-variant-numeric: tabular-nums;
}

.book-mini-bar__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.book-mini-bar__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.book-mini-bar__close:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}
</style>
