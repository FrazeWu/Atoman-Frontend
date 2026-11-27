<template>
  <section class="forum-topic-filters">
    <div class="tab-bar">
      <div class="tab-bar-left">
        <PTab
          v-for="(label, key) in tabOptions"
          :key="key"
          class="forum-tab-btn"
          :active="activeTab === key"
          @click="$emit('update:activeTab', key as string)"
        >
          {{ label }}
        </PTab>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-left">
        <div class="forum-category-select">
          <PSelect
            :model-value="selectedCategoryValue"
            :options="categoryOptions"
            size="sm"
            placeholder="全部分类"
            @update:model-value="(value) => $emit('update:selectedCategoryValue', String(value))"
          />
        </div>

        <div v-if="activeTag" class="active-tag-chip a-badge">
          # {{ activeTag }}
          <button type="button" aria-label="清除标签筛选" @click="$emit('clear-tag')" class="tag-chip-close">×</button>
        </div>
      </div>

      <div class="filter-right">
        <PButton
          v-if="activeFollowTarget"
          data-testid="forum-filter-follow"
          variant="secondary"
          size="sm"
          class="forum-follow-btn"
          :class="{ 'is-following': following }"
          @click="$emit('toggle-follow', activeFollowTarget)"
        >{{ following ? '已关注' : '关注' }}</PButton>
        <div class="search-wrap">
          <PInput
            :model-value="searchQuery"
            placeholder="搜索话题..."
            class="search-input"
            @update:model-value="(value) => $emit('update:searchQuery', value)"
            @keydown.enter="$emit('submit-search')"
          />
          <button v-if="searchQuery" type="button" aria-label="清空搜索" class="search-clear" @click="$emit('clear-search')">×</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTab from '@/components/ui/PTab.vue'

defineProps<{
  activeTab: string
  tabOptions: Record<string, string>
  selectedCategoryValue: string
  categoryOptions: Array<{ label: string; value: string | number }>
  activeTag: string
  searchQuery: string
  activeFollowTarget: { targetType: 'category' | 'tag'; targetKey: string } | null
  following: boolean
}>()

defineEmits<{
  (e: 'update:activeTab', value: string): void
  (e: 'update:selectedCategoryValue', value: string): void
  (e: 'clear-tag'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'submit-search'): void
  (e: 'clear-search'): void
  (e: 'toggle-follow', target: { targetType: 'category' | 'tag'; targetKey: string }): void
}>()
</script>

<style scoped>
.forum-topic-filters {
  display: grid;
  gap: 0.85rem;
  margin-bottom: 1rem;
  padding-bottom: 0;
}

.tab-bar,
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}

.tab-bar {
  border-bottom: 1px solid var(--a-color-border-soft);
}

.tab-bar-left,
.filter-left,
.filter-right {
  display: flex;
  align-items: center;
  gap: 0.5rem 0.75rem;
  flex-wrap: wrap;
}

.forum-tab-btn {
  padding-inline: 0.25rem;
  margin-bottom: -1px;
}

.forum-category-select {
  min-width: 11rem;
}

.forum-category-select :deep(.p-field),
.search-wrap :deep(.p-field) {
  gap: 0;
}

.forum-follow-btn.is-following {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.search-wrap {
  position: relative;
}

.search-wrap :deep(.p-input),
:deep(input.search-input) {
  width: min(240px, 62vw);
  min-height: var(--a-control-height-sm, 2.25rem);
  height: var(--a-control-height-sm, 2.25rem);
  padding: 0 2rem 0 0.75rem;
  font-size: var(--a-text-sm);
}

.search-clear {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

.search-clear:hover {
  color: var(--a-color-fg);
}

.active-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.tag-chip-close {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0;
}

.tag-chip-close:hover {
  color: var(--a-color-fg);
}

@media (max-width: 720px) {
  .tab-bar,
  .filter-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .search-wrap :deep(.p-input),
  :deep(input.search-input),
  .forum-category-select {
    width: 100%;
  }

  .search-wrap :deep(.p-input),
  :deep(input.search-input) {
    min-height: 44px;
    height: auto;
    font-size: 1rem;
  }
}
</style>
