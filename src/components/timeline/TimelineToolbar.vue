<template>
  <div class="tl-toolbar">
    <div class="tl-filter-group">
      <label class="filter-label">起始年份</label>
      <input v-model.number="yearStartValue" type="number" placeholder="如 1800" class="a-input" style="width:120px" />
    </div>
    <div class="tl-filter-group">
      <label class="filter-label">结束年份</label>
      <input v-model.number="yearEndValue" type="number" placeholder="如 2000" class="a-input" style="width:120px" />
    </div>
    <div class="tl-filter-group">
      <label class="filter-label">分类</label>
      <input v-model="categoryValue" type="text" placeholder="政治 / 文化 / 科技…" class="a-input" style="width:160px" />
    </div>
    <PButton outline @click="emit('apply')">筛选</PButton>
    <PButton outline @click="emit('reset')">重置</PButton>

    <div v-if="batchSelectedCount" class="tl-toolbar-batch">
      <span class="tl-toolbar-batch-count">已勾选 {{ batchSelectedCount }} 条</span>
      <button class="tl-action-btn" @click="emit('add-batch-to-compare')">加入对比池</button>
      <button class="tl-action-btn tl-action-btn-secondary" @click="emit('clear-batch-selection')">清空勾选</button>
    </div>

    <div class="tl-mode-switch" style="margin-left:auto">
      <button class="tl-mode-btn" :class="{ 'tl-mode-btn-active': viewMode === 'lanes' }" @click="emit('update:viewMode', 'lanes')">泳道浏览</button>
      <button class="tl-mode-btn" :class="{ 'tl-mode-btn-active': viewMode === 'map' }" @click="emit('update:viewMode', 'map')">地图在线查看</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PButton from '@/components/ui/PButton.vue'

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
</script>

<style scoped>
.tl-toolbar { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: flex-end; padding: 1.1rem 1.15rem 1.2rem; border: none; border-radius: var(--a-radius-card); background: var(--a-color-surface); }
.filter-label { font-size: 0.7rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0; color: var(--a-color-muted); }
.tl-filter-group { display: flex; flex-direction: column; gap: 4px; }
.tl-toolbar-batch { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.tl-toolbar-batch-count { font-size: 0.72rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0; color: var(--a-color-muted); }
.tl-mode-switch { display: inline-flex; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); }
.tl-mode-btn { border: none; border-right: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-fg); cursor: pointer; padding: 0.6rem 1.05rem; font-size: 0.7rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0; }
.tl-mode-btn:last-child { border-right: none; }
.tl-mode-btn-active, .tl-mode-btn:hover { background: var(--a-color-fg); color: var(--a-color-bg); }
.tl-action-btn { border: 1px solid var(--a-color-border-soft); background: var(--a-color-fg); color: var(--a-color-bg); cursor: pointer; font-size: 0.72rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0; padding: 0.55rem 0.8rem; }
.tl-action-btn-secondary { background: var(--a-color-bg); color: var(--a-color-fg); }
</style>
