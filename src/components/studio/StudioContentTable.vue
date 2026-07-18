<template>
  <div class="studio-content-table">
    <PEmpty v-if="items.length === 0" kicker="" :title="`暂无${config.itemLabel}`" />
    <div v-else class="studio-content-table__scroll">
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>状态</th>
            <th>可见范围</th>
            <th>合集</th>
            <th>更新时间</th>
            <th><span class="sr-only">操作</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <strong>{{ item.title || `未命名${config.itemLabel}` }}</strong>
              <span v-if="item.processing_status && item.processing_status !== 'ready'">{{ item.processing_status }}</span>
            </td>
            <td>{{ statusLabel(item.status) }}</td>
            <td>{{ visibilityLabel(item.visibility) }}</td>
            <td>{{ item.collections.map(collection => collection.name).join('、') || '未加入合集' }}</td>
            <td><time :datetime="item.updated_at">{{ formatDate(item.updated_at) }}</time></td>
            <td><RouterLink :to="`/studio/${module}/${item.id}/edit`">编辑</RouterLink></td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="pagination && (pagination.page > 1 || pagination.has_more)" class="studio-content-table__pagination" aria-label="内容分页">
      <button type="button" :disabled="pagination.page <= 1" aria-label="上一页" title="上一页" @click="$emit('page', pagination.page - 1)">
        <ArrowLeft :size="17" aria-hidden="true" />
      </button>
      <span>第 {{ pagination.page }} 页</span>
      <button type="button" :disabled="!pagination.has_more" aria-label="下一页" title="下一页" @click="$emit('page', pagination.page + 1)">
        <ArrowRight :size="17" aria-hidden="true" />
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

import PEmpty from '@/components/ui/PEmpty.vue'
import { studioModules } from '@/config/studioModules'
import type { StudioContentItem, StudioModule, StudioPagination, StudioPublishStatus, StudioVisibility } from '@/types'

const props = defineProps<{
  items: StudioContentItem[]
  module: StudioModule
  pagination: StudioPagination | null
}>()

defineEmits<{ page: [page: number] }>()

const config = computed(() => studioModules[props.module])

function statusLabel(status: StudioPublishStatus) {
  return status === 'published' ? '已发布' : '草稿'
}

function visibilityLabel(visibility: StudioVisibility) {
  return { public: '公开', subscribers: '订阅者', private: '私密' }[visibility]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>

<style scoped>
.studio-content-table { display: grid; gap: 1rem; }
.studio-content-table__scroll { overflow-x: auto; border-top: 1px solid var(--a-color-border-soft); }
table { width: 100%; border-collapse: collapse; min-width: 760px; }
th, td { padding: 0.75rem 0.625rem; border-bottom: 1px solid var(--a-color-border-soft); text-align: left; vertical-align: middle; }
th { color: var(--a-color-muted); font-size: 0.75rem; font-weight: 600; }
td { font-size: 0.875rem; }
td:first-child { min-width: 14rem; }
td strong, td span { display: block; }
td span { margin-top: 0.2rem; color: var(--a-color-muted); font-size: 0.75rem; }
td a { color: var(--a-color-text); font-weight: 600; }
.studio-content-table__pagination { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; color: var(--a-color-muted); font-size: 0.8rem; }
.studio-content-table__pagination button { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-text); cursor: pointer; }
.studio-content-table__pagination button:disabled { opacity: 0.45; cursor: not-allowed; }
.studio-content-table__pagination button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
