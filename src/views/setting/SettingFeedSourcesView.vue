<template>
  <main class="setting-feed-sources-view">
    <SettingFeedSourcePanel full-text-mode="per_source" />
  </main>
</template>

<script setup lang="ts">
import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'
</script>

<style scoped>
.setting-feed-sources-view {
  display: grid;
}
</style>
