<template>
  <section class="forum-topic-filters">
    <div class="tab-bar">
      <div class="tab-bar-left">
        <ABtn
          v-for="(label, key) in tabOptions"
          :key="key"
          outline
          size="sm"
          class="forum-tab-btn"
          :class="{ 'forum-tab-btn-active': activeTab === key }"
          @click="$emit('update:activeTab', key as string)"
        >
          {{ label }}
        </ABtn>
      </div>
      <div class="tab-bar-right">
        <ABtn v-if="canCreateTopic" outline size="sm" @click="$emit('create-topic')">发新话题</ABtn>
        <ABtn v-if="canRequestCategory" outline size="sm" @click="$emit('request-category')">申请分类</ABtn>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-left">
        <div class="forum-category-select">
          <ASelect :model-value="selectedCategoryValue" :options="categoryOptions" placeholder="全部分类" @update:model-value="(value) => $emit('update:selectedCategoryValue', String(value))" />
        </div>

        <div v-if="activeTag" class="active-tag-chip a-badge a-badge-fill">
          # {{ activeTag }}
          <button @click="$emit('clear-tag')" class="tag-chip-close">×</button>
        </div>
      </div>

      <div class="filter-right">
        <div class="search-wrap">
          <AInput
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
import ABtn from '@/components/ui/ABtn.vue'
import AInput from '@/components/ui/AInput.vue'
import ASelect from '@/components/ui/ASelect.vue'

defineProps<{
  activeTab: string
  tabOptions: Record<string, string>
  canCreateTopic: boolean
  canRequestCategory: boolean
  selectedCategoryValue: string
  categoryOptions: Array<{ label: string; value: string | number }>
  activeTag: string
  searchQuery: string
}>()

defineEmits<{
  (e: 'update:activeTab', value: string): void
  (e: 'create-topic'): void
  (e: 'request-category'): void
  (e: 'update:selectedCategoryValue', value: string): void
  (e: 'clear-tag'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'submit-search'): void
  (e: 'clear-search'): void
}>()
</script>
