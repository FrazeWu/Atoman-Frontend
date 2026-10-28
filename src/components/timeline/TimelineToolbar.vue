<template>
  <div class="tl-toolbar">
    <div class="tl-filter-group">
      <label class="filter-label">起始年份</label>
      <PInput :model-value="yearStartValue ?? ''" type="number" placeholder="如 1800" class="tl-toolbar-input" @update:model-value="updateYearStart" />
    </div>
    <div class="tl-filter-group">
      <label class="filter-label">结束年份</label>
      <PInput :model-value="yearEndValue ?? ''" type="number" placeholder="如 2000" class="tl-toolbar-input" @update:model-value="updateYearEnd" />
    </div>
    <div class="tl-filter-group">
      <label class="filter-label">分类</label>
      <PInput :model-value="categoryValue" placeholder="政治 / 文化 / 科技…" class="tl-toolbar-input" @update:model-value="updateCategory" />
    </div>
    <PButton variant="secondary" size="sm" @click="emit('apply')">筛选</PButton>
    <PButton variant="secondary" size="sm" @click="emit('reset')">重置</PButton>

    <div v-if="batchSelectedCount" class="tl-toolbar-batch">
      <span class="tl-toolbar-batch-count">已勾选 {{ batchSelectedCount }} 条</span>
      <PButton class="tl-action-btn" size="sm" @click="emit('add-batch-to-compare')">加入对比池</PButton>
      <PButton class="tl-action-btn tl-action-btn-secondary" size="sm" variant="secondary" @click="emit('clear-batch-selection')">清空勾选</PButton>
    </div>

    <div class="tl-toolbar-mode" style="margin-left:auto">
      <PSegmentedControl
        :model-value="viewMode"
        :options="[
          { label: '泳道浏览', value: 'lanes' },
          { label: '地图在线查看', value: 'map' }
        ]"
        @update:model-value="emit('update:viewMode', $event as 'lanes' | 'map')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

const props = defineProps<{
  yearStart: number | null
  yearEnd: number | null
  category: string
  batchSelectedCount: number
  viewMode: 'lanes' | 'map'
}>()

const emit = defineEmits<{
  'update:yearStart': [value: number | null]
  'update:yearEnd': [value: number | null]
  'update:category': [value: string]
  'update:viewMode': [value: 'lanes' | 'map']
  apply: []
  reset: []
  'add-batch-to-compare': []
  'clear-batch-selection': []
}>()

const yearStartValue = computed({ get: () => props.yearStart, set: value => emit('update:yearStart', value) })
const yearEndValue = computed({ get: () => props.yearEnd, set: value => emit('update:yearEnd', value) })
const categoryValue = computed({ get: () => props.category, set: value => emit('update:category', value) })
const updateYearStart = (value: string) => emit('update:yearStart', value === '' ? null : Number(value))
const updateYearEnd = (value: string) => emit('update:yearEnd', value === '' ? null : Number(value))
const updateCategory = (value: string) => emit('update:category', value)
</script>

<style scoped>
.tl-toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-end;
  padding: 0.5rem 0;
}

.filter-label {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.tl-filter-group:nth-child(-n+2) .tl-toolbar-input { width: 120px; }
.tl-filter-group:nth-child(3) .tl-toolbar-input { width: 160px; }

.tl-toolbar-input :deep(.p-input) {
  height: var(--a-control-height-sm, 2.25rem);
  min-height: var(--a-control-height-sm, 2.25rem);
  padding: 0 0.75rem;
  font-size: 0.8125rem;
}

.tl-toolbar-input :deep(.p-field) {
  gap: 0;
}

.tl-filter-group {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tl-toolbar-batch {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.tl-toolbar-batch-count {
  display: inline-flex;
  align-items: center;
  height: var(--a-control-height-sm, 2.25rem);
  padding: 0 0.6rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.tl-action-btn {
  border-color: var(--a-color-border-soft);
  font-size: 0.72rem;
  font-weight: 500;
}

.tl-action-btn-secondary {
  color: var(--a-color-fg);
}
@media (max-width: 480px) {
  .tl-toolbar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    padding: 12px;
    gap: 12px;
  }
  .tl-filter-group:nth-child(3), .tl-toolbar-batch, .tl-toolbar-mode {
    grid-column: 1 / -1;
  }
  .tl-filter-group .tl-toolbar-input {
    width: 100%;
    min-width: 0;
  }
  .tl-toolbar > button, .tl-toolbar > :deep(.p-button) {
    width: 100%;
    min-height: 44px;
  }
  .tl-toolbar-mode {
    margin-left: 0 !important;
    min-width: 0;
  }
}

</style>
