<template>
  <div class="feed-pagination">
    <button
      class="feed-page-control a-font-meta"
      type="button"
      :disabled="page <= 1 || loading"
      @click="emit('change-page', page - 1)"
    >
      上一页
    </button>

    <div class="feed-page-list" aria-label="分页">
      <button
        v-for="item in pageItems"
        :key="item.key"
        class="feed-page-number a-font-meta"
        :class="{ 'is-active': item.type === 'page' && item.value === page }"
        type="button"
        :disabled="item.type === 'ellipsis' || loading"
        @click="item.type === 'page' && emit('change-page', item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <button
      class="feed-page-control a-font-meta"
      type="button"
      :disabled="page >= totalPages || loading"
      @click="emit('change-page', page + 1)"
    >
      下一页
    </button>

    <form class="feed-jump" @submit.prevent="submitJump">
      <label class="feed-jump-label a-font-meta" for="feed-page-jump">跳至</label>
      <input
        id="feed-page-jump"
        v-model="jumpPage"
        class="feed-jump-input"
        inputmode="numeric"
        pattern="[0-9]*"
        :disabled="loading"
        aria-label="跳至页码"
      />
      <span class="feed-jump-total a-font-meta">/ {{ totalPages }} 页</span>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  page: number
  pageSize: number
  total: number
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'change-page', page: number): void
}>()

type PageItem =
  | { key: string; type: 'page'; value: number; label: string }
  | { key: string; type: 'ellipsis'; label: string }

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const jumpPage = ref(String(props.page))

watch(
  () => props.page,
  (page) => {
    jumpPage.value = String(page)
  },
  { immediate: true },
)

const pageItem = (value: number): PageItem => ({
  key: `page-${value}`,
  type: 'page',
  value,
  label: String(value),
})

const ellipsisItem = (key: string): PageItem => ({
  key,
  type: 'ellipsis',
  label: '…',
})

const buildPageItems = (page: number, pageCount: number): PageItem[] => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => pageItem(index + 1))
  }

  if (page <= 4) {
    return [pageItem(1), pageItem(2), pageItem(3), pageItem(4), ellipsisItem('ellipsis-tail'), pageItem(pageCount)]
  }

  if (page >= pageCount - 3) {
    return [
      pageItem(1),
      ellipsisItem('ellipsis-head'),
      pageItem(pageCount - 3),
      pageItem(pageCount - 2),
      pageItem(pageCount - 1),
      pageItem(pageCount),
    ]
  }

  return [
    pageItem(1),
    ellipsisItem('ellipsis-head'),
    pageItem(page - 1),
    pageItem(page),
    pageItem(page + 1),
    ellipsisItem('ellipsis-tail'),
    pageItem(pageCount),
  ]
}

const pageItems = computed(() => buildPageItems(props.page, totalPages.value))

const submitJump = () => {
  const nextPage = Number.parseInt(jumpPage.value, 10)
  if (!Number.isFinite(nextPage)) {
    jumpPage.value = String(props.page)
    return
  }

  const clampedPage = Math.min(Math.max(nextPage, 1), totalPages.value)
  jumpPage.value = String(clampedPage)
  if (clampedPage !== props.page) {
    emit('change-page', clampedPage)
  }
}
</script>

<style scoped>
.feed-pagination {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  overflow-x: auto;
  padding: 1.5rem 0;
  white-space: nowrap;
}

.feed-page-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.feed-page-control,
.feed-page-number {
  min-width: 2.2rem;
  min-height: 2.2rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  transition: all 0.15s ease;
}

.feed-page-control:hover:not(:disabled),
.feed-page-number:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--a-shadow-paper-sm);
}

.feed-page-number.is-active {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
}

.feed-page-number:disabled,
.feed-page-control:disabled {
  opacity: 0.45;
  cursor: default;
  box-shadow: none;
  transform: none;
}

.feed-page-number:disabled:not(.is-active) {
  border-style: dashed;
}

.feed-jump {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.feed-jump-label,
.feed-jump-total {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.feed-jump-input {
  display: inline-grid;
  width: 3.75rem;
  text-align: center;
  padding: 0.2rem 0.1rem 0.3rem;
  font-size: 0.875rem;
  border: 1px solid var(--a-color-line-soft);
  background: transparent;
  color: var(--a-color-ink);
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
</style>