<template>
  <section class="topbar-search-section">
    <header class="topbar-search-section__header">
      <h3>{{ section.label }}</h3>
      <button class="topbar-search-section__more" type="button" @click="$emit('openMore', section.moreHref)">查看更多</button>
    </header>

    <button
      v-for="item in section.items"
      :key="item.id"
      type="button"
      class="topbar-search-section__item"
      :class="{ 'is-active': activeId === item.id }"
      @click="$emit('openItem', item.href)"
    >
      <span class="topbar-search-section__title">{{ item.title }}</span>
      <span v-if="item.subtitle" class="topbar-search-section__subtitle">{{ item.subtitle }}</span>
      <span v-if="item.meta" class="topbar-search-section__meta">{{ item.meta }}</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import type { GlobalSearchSection } from '@/composables/useGlobalSearch'

defineProps<{
  section: GlobalSearchSection
  activeId: string
}>()

defineEmits<{
  openItem: [href: string]
  openMore: [href: string]
}>()
</script>

<style scoped>
.topbar-search-section {
  display: grid;
  gap: 0.45rem;
}

.topbar-search-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.topbar-search-section__header h3 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 500;
}

.topbar-search-section__more {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.76rem;
  font-weight: 500;
  cursor: pointer;
}

.topbar-search-section__item {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  text-align: left;
  padding: 0.7rem 0.8rem;
  display: grid;
  gap: 0.2rem;
  cursor: pointer;
}

.topbar-search-section__item.is-active,
.topbar-search-section__item:hover {
  border-color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.topbar-search-section__title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.topbar-search-section__subtitle,
.topbar-search-section__meta {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}
</style>
