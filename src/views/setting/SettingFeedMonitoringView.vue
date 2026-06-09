<template>
  <section class="setting-feed-monitoring">
    <SettingFeedSourcePanel full-text-mode="disabled" />
  </section>
</template>

<script setup lang="ts">
import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'
</script>

<style scoped>
.setting-feed-monitoring {
  display: grid;
}
</style>
