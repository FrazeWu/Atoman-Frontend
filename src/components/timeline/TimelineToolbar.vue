<template>
  <div class="tl-toolbar">
    <div class="tl-filter-group">
      <label class="filter-label">起始年份</label>
      <PInput :model-value="yearStartValue ?? ''" type="number" placeholder="如 1800" style="width:120px" @update:model-value="updateYearStart" />
    </div>
    <div class="tl-filter-group">
      <label class="filter-label">结束年份</label>
      <PInput :model-value="yearEndValue ?? ''" type="number" placeholder="如 2000" style="width:120px" @update:model-value="updateYearEnd" />
    </div>
    <div class="tl-filter-group">
      <label class="filter-label">分类</label>
      <PInput :model-value="categoryValue" placeholder="政治 / 文化 / 科技…" style="width:160px" @update:model-value="updateCategory" />
    </div>
    <PButton variant="secondary" @click="emit('apply')">筛选</PButton>
    <PButton variant="secondary" @click="emit('reset')">重置</PButton>

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
  gap: 0.85rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-end;
  padding: 1rem 1.15rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.filter-label {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.tl-filter-group {
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
</style>
