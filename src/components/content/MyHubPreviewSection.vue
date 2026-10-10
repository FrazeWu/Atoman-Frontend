<script setup lang="ts">
import { IconArrowUpRight as ArrowUpRight, IconPhoto as Photo } from '@tabler/icons-vue'

export interface MyHubPreviewItem {
  id: string
  title: string
  subtitle?: string
  coverUrl?: string
  to: string
}

withDefaults(defineProps<{
  testId: string
  title: string
  viewAllTo: string
  items: MyHubPreviewItem[]
  loading?: boolean
  error?: boolean
  emptyText: string
}>(), {
  loading: false,
  error: false,
})
</script>

<template>
  <section :data-testid="testId" class="hub-preview" :aria-labelledby="`${testId}-title`">
    <header class="hub-preview__header">
      <h2 :id="`${testId}-title`">{{ title }}</h2>
      <RouterLink :to="viewAllTo" class="hub-preview__more">
        <span>查看全部</span>
        <ArrowUpRight :size="15" aria-hidden="true" />
      </RouterLink>
    </header>

    <p v-if="loading" class="hub-preview__state" role="status">加载中...</p>
    <p v-else-if="error" class="hub-preview__state" role="alert">暂时无法加载</p>
    <p v-else-if="!items.length" class="hub-preview__state">{{ emptyText }}</p>
    <div v-else class="hub-preview__grid">
      <RouterLink v-for="item in items" :key="item.id" :to="item.to" class="hub-preview__item">
        <div class="hub-preview__cover">
          <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" loading="lazy" />
          <Photo v-else :size="20" aria-hidden="true" />
        </div>
        <span class="hub-preview__copy">
          <strong>{{ item.title }}</strong>
          <small v-if="item.subtitle">{{ item.subtitle }}</small>
        </span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.hub-preview { margin-top: 1.25rem; border-block: 1px solid var(--a-color-border-soft); padding: 1rem 0; }
.hub-preview__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
.hub-preview__header h2 { margin: 0; font-size: 1rem; font-weight: 500; }
.hub-preview__more { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--a-color-muted); font-size: 0.8rem; text-decoration: none; }
.hub-preview__more:hover, .hub-preview__more:focus-visible { color: var(--a-color-fg); }
.hub-preview__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
.hub-preview__item { display: grid; min-width: 0; grid-template-columns: 3rem minmax(0, 1fr); gap: 0.7rem; align-items: center; color: var(--a-color-fg); text-decoration: none; }
.hub-preview__item:hover .hub-preview__copy strong, .hub-preview__item:focus-visible .hub-preview__copy strong { text-decoration: underline; }
.hub-preview__cover { display: grid; width: 3rem; aspect-ratio: 1; place-items: center; overflow: hidden; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-muted); }
.hub-preview__cover img { width: 100%; height: 100%; object-fit: cover; }
.hub-preview__copy { display: grid; min-width: 0; gap: 0.2rem; }
.hub-preview__copy strong, .hub-preview__copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hub-preview__copy strong { font-size: 0.875rem; font-weight: 500; }
.hub-preview__copy small { color: var(--a-color-muted); font-size: 0.75rem; }
.hub-preview__state { margin: 0; color: var(--a-color-muted); font-size: 0.85rem; }
@media (max-width: 768px) { .hub-preview__grid { grid-template-columns: 1fr; } }
</style>
