<template>
  <footer v-if="meta.total > 0" class="pagination-bar">
    <span>第 {{ meta.page }} 页，共 {{ meta.total }} 条</span>
    <div>
      <PButton
        variant="secondary"
        size="sm"
        :disabled="meta.page <= 1 || loading"
        aria-label="上一页"
        @click="emit('change', meta.page - 1)"
      ><ChevronLeft :size="16" aria-hidden="true" />上一页</PButton>
      <PButton
        variant="secondary"
        size="sm"
        :disabled="!meta.has_more || loading"
        aria-label="下一页"
        @click="emit('change', meta.page + 1)"
      >下一页<ChevronRight :size="16" aria-hidden="true" /></PButton>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

import PButton from '@/components/ui/PButton.vue'

defineProps<{
  meta: { page: number; page_size: number; total: number; has_more: boolean }
  loading?: boolean
}>()
const emit = defineEmits<{ change: [page: number] }>()
</script>

<style scoped>
.pagination-bar,
.pagination-bar > div {
  display: flex;
  align-items: center;
}

.pagination-bar {
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
}

.pagination-bar > div { gap: 0.4rem; }

@media (max-width: 520px) {
  .pagination-bar { align-items: stretch; flex-direction: column; }
  .pagination-bar > div { justify-content: space-between; }
}
</style>
