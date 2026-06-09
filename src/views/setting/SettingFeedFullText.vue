<template>
  <main class="feed-fulltext-admin-page">
    <SettingFeedSourcePanel full-text-mode="per_source" />
  </main>
</template>

<script setup lang="ts">
import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'
</script>

<style scoped>
.feed-fulltext-admin-page {
  display: grid;
}
</style>
