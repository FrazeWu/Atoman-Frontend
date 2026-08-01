<template>
  <main class="setting-subscriptions">
    <div class="setting-subscriptions__heading">
      <PSectionHeader title="订阅源管理" description="管理站点 RSS 订阅源、推荐和抓取任务。" />
      <PButton variant="secondary" @click="feedPanel?.refresh()">刷新</PButton>
    </div>

    <SettingFeedSourcePanel ref="feedPanel" :full-text-mode="fullTextMode" :show-header="false" />
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import SettingFeedSourcePanel from '@/components/setting/SettingFeedSourcePanel.vue'
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import { mergeSiteAccess } from '@/config/siteAccess'
import { useSiteAccessStore } from '@/stores/siteAccess'

const siteAccessStore = useSiteAccessStore()
const fullTextMode = computed(() => mergeSiteAccess(siteAccessStore.access).settings.feed.full_text_mode)
const feedPanel = ref<InstanceType<typeof SettingFeedSourcePanel> | null>(null)
</script>

<style scoped>
.setting-subscriptions { display: grid; gap: 1.25rem; padding-bottom: 8rem; }
.setting-subscriptions__heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }

@media (max-width: 720px) {
  .setting-subscriptions__heading { align-items: stretch; flex-direction: column; }
}
</style>
