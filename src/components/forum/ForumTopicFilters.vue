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
          <PSelect :model-value="selectedCategoryValue" :options="categoryOptions" placeholder="全部分类" @update:model-value="(value) => $emit('update:selectedCategoryValue', String(value))" />
        </div>

        <div v-if="activeTag" class="active-tag-chip a-badge a-badge-fill">
          # {{ activeTag }}
          <button @click="$emit('clear-tag')" class="tag-chip-close">×</button>
        </div>
      </div>

      <div class="filter-right">
        <PButton
          v-if="activeFollowTarget"
          data-testid="forum-filter-follow"
          outline
          size="sm"
          :class="{ 'forum-tab-btn-active': following }"
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
          <button v-if="searchQuery" class="search-clear" @click="$emit('clear-search')">×</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
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
  gap: 1rem;
  margin-bottom: 1.25rem;
  border-bottom: 1.5px dashed var(--a-color-line-soft);
  padding-bottom: 1rem;
}

.tab-bar,
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tab-bar-left,
.filter-left,
.filter-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.forum-tab-btn {
  padding-inline: 0.25rem;
}

.forum-category-select {
  min-width: 12rem;
}

.forum-category-select :deep(.p-field),
.search-wrap :deep(.p-field) {
  gap: 0;
}

.search-wrap {
  position: relative;
}

.search-input {
  width: min(260px, 62vw);
}

.search-input :deep(.p-input) {
  padding-right: 2rem;
}

.search-clear {
  position: absolute;
  right: 0;
  top: 0.1rem;
  border: 0;
  background: transparent;
  color: var(--a-color-ink-soft);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.1rem 0;
}

.active-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.tag-chip-close {
  border: 0;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

@media (max-width: 720px) {
  .tab-bar,
  .filter-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .search-input,
  .forum-category-select {
    width: 100%;
  }
}
</style>
