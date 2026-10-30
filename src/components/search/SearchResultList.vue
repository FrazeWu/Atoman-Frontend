<template>
  <ul class="search-results">
    <li v-for="item in items" :key="item.key" class="search-result-item">
      <RouterLink :to="safeSearchHref(item.href)" class="search-result-link">
        <div class="result-header">
          <span class="result-title">{{ item.title }}</span>
          <span v-if="item.module" class="result-module-tag">{{ getModuleLabel(item.module) }}</span>
        </div>
        <span v-if="item.subtitle" class="result-subtitle">{{ item.subtitle }}</span>
        <span v-if="item.snippet" class="result-snippet">{{ item.snippet }}</span>
      </RouterLink>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { SearchHit } from '@/api/search'
import { safeSearchHref } from '@/utils/searchUrl'

defineProps<{ items: SearchHit[] }>()

const MODULE_LABELS: Record<string, string> = {
  books: '图书',
  music: '音乐',
  blog: '博客',
  forum: '论坛',
  debate: '辩题',
  video: '视频',
  podcast: '播客',
  timeline: '时间线',
  feed: '动态',
}

function getModuleLabel(mod: string): string {
  return MODULE_LABELS[mod] || mod
}
</script>

<style scoped>
.search-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-result-item {
  background-color: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  box-shadow: none !important;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  overflow: hidden;
}

.search-result-item:hover {
  border-color: var(--a-color-border, #cbd5e1);
  background-color: var(--a-color-surface, #f8fafc);
}

.search-result-link {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 16px;
  color: inherit;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.search-result-link:focus-visible {
  outline: 2px solid var(--a-color-primary, #0ea5e9);
  outline-offset: -2px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.result-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
}

.result-module-tag {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text-secondary);
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border: none;
  border-radius: var(--a-radius-control, 4px);
  padding: 2px 7px;
  flex-shrink: 0;
}

.result-subtitle {
  font-size: 13px;
  color: var(--a-color-text-secondary);
  line-height: 1.4;
}

.result-snippet {
  font-size: 13px;
  color: var(--a-color-text-tertiary, #94a3b8);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
