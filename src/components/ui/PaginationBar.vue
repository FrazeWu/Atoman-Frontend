<template>
  <footer v-if="meta.total > 0" class="pagination-bar" aria-label="分页">
    <span class="pagination-summary">第 {{ meta.page }} 页，共 {{ meta.total }} 条</span>
    <nav class="pagination-controls" aria-label="页码">
      <button
        type="button"
        class="pagination-arrow"
        :disabled="meta.page <= 1 || loading"
        aria-label="上一页"
        title="上一页"
        @click="emit('change', meta.page - 1)"
      >
        <ChevronLeft :size="16" aria-hidden="true" />
      </button>
      <template v-for="item in pageItems" :key="item.key">
        <span v-if="item.kind === 'ellipsis'" class="pagination-ellipsis" aria-hidden="true">...</span>
        <button
          v-else
          type="button"
          class="pagination-page"
          :class="{ 'is-current': item.page === meta.page }"
          :disabled="loading"
          :aria-current="item.page === meta.page ? 'page' : undefined"
          :aria-label="`第 ${item.page} 页`"
          @click="emit('change', item.page)"
        >
          {{ item.page }}
        </button>
      </template>
      <button
        type="button"
        class="pagination-arrow"
        :disabled="!meta.has_more || loading"
        aria-label="下一页"
        title="下一页"
        @click="emit('change', meta.page + 1)"
      >
        <ChevronRight :size="16" aria-hidden="true" />
      </button>
    </nav>
    <form class="pagination-jump" @submit.prevent="jumpToPage">
      <label for="pagination-jump-input">跳转</label>
      <input
        id="pagination-jump-input"
        v-model="jumpPage"
        type="number"
        min="1"
        :max="totalPages"
        inputmode="numeric"
        :disabled="loading"
      >
      <PButton type="submit" variant="secondary" size="sm" :disabled="loading">跳转</PButton>
    </form>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight } from '@tabler/icons-vue'
import PButton from '@/components/ui/PButton.vue'

type PaginationMeta = { page: number; page_size: number; total: number; has_more: boolean }
type PageItem = { key: string; kind: 'page'; page: number } | { key: string; kind: 'ellipsis' }

const props = defineProps<{
  meta: PaginationMeta
  loading?: boolean
}>()
const emit = defineEmits<{ change: [page: number] }>()
const jumpPage = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(props.meta.total / Math.max(1, props.meta.page_size))))

const pageItems = computed<PageItem[]>(() => {
  const total = totalPages.value
  const current = Math.min(Math.max(1, props.meta.page), total)
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => ({ key: `page-${index + 1}`, kind: 'page' as const, page: index + 1 }))
  }

  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((left, right) => left - right)
  const items: PageItem[] = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      items.push({ key: `ellipsis-${page}`, kind: 'ellipsis' })
    }
    items.push({ key: `page-${page}`, kind: 'page', page })
  })
  return items
})

function jumpToPage() {
  const requested = Number.parseInt(jumpPage.value, 10)
  if (!Number.isInteger(requested)) return
  const target = Math.min(Math.max(1, requested), totalPages.value)
  jumpPage.value = ''
  if (target !== props.meta.page) emit('change', target)
}
</script>

<style scoped>
.pagination-bar,
.pagination-controls,
.pagination-jump {
  display: flex;
  align-items: center;
}

.pagination-bar {
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
  flex-wrap: wrap;
}

.pagination-controls,
.pagination-jump { gap: 0.25rem; }
.pagination-summary { white-space: nowrap; }
.pagination-arrow,
.pagination-page {
  display: grid;
  min-width: 2rem;
  height: 2rem;
  place-items: center;
  padding: 0 0.4rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
}
.pagination-arrow:hover:not(:disabled),
.pagination-page:hover:not(:disabled) { border-color: var(--a-color-border); }
.pagination-page.is-current { border-color: var(--a-color-fg); background: var(--a-color-fg); color: var(--a-color-bg); }
.pagination-arrow:disabled,
.pagination-page:disabled { cursor: default; opacity: 0.45; }
.pagination-ellipsis { padding: 0 0.2rem; }
.pagination-jump label { margin-right: 0.25rem; }
.pagination-jump input {
  width: 4.25rem;
  height: 2rem;
  padding: 0 0.45rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font: inherit;
}

@media (max-width: 680px) {
  .pagination-bar { justify-content: center; }
  .pagination-summary { flex-basis: 100%; text-align: center; }
}
</style>
