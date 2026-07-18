<script setup lang="ts">
import { ref } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const tabs = ['视频', '频道', '合集', '稍后看'] as const
const activeTab = ref<(typeof tabs)[number]>('视频')
</script>

<template>
  <div class="a-page-xl video-favorites-view">
    <PPageHeader title="收藏" accent />

    <div class="video-favorites-tabs" role="tablist" aria-label="视频收藏">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        class="video-favorites-tab"
        :class="{ 'video-favorites-tab--active': activeTab === tab }"
        role="tab"
        :aria-selected="activeTab === tab"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.video-favorites-view {
  min-height: 100%;
}

.video-favorites-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

.video-favorites-tab {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  font: inherit;
  font-weight: 500;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
}

.video-favorites-tab--active {
  border-color: var(--a-color-fg);
  color: var(--a-color-fg);
}
</style>
