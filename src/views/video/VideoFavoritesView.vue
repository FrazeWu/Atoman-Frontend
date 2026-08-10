<script setup lang="ts">
import { ref } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const activeTab = ref<string>('video')
const tabOptions = [
  { label: '视频', value: 'video' },
  { label: '频道', value: 'channel' },
  { label: '合集', value: 'collection' },
  { label: '稍后看', value: 'watchLater' },
]
</script>

<template>
  <div class="a-page-xl video-favorites-view">
    <PPageHeader title="视频收藏" mb="1.25rem">
      <template #action>
        <PSegmentedControl v-model="activeTab" :options="tabOptions" />
      </template>
    </PPageHeader>

    <div v-if="!authStore.isAuthenticated" class="video-favorites-unauth">
      <PEmpty
        title="请登录后查看视频收藏"
        description="登录账号以同步你收藏的视频、频道与稍后看清单。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <PEmpty v-else title="暂无收藏内容" description="浏览视频页面，收藏你感兴趣的视频或频道。" />
  </div>
</template>

<style scoped>
.video-favorites-view {
  min-height: 100%;
  padding-bottom: 3rem;
}
.video-favorites-unauth {
  padding: 3rem 0;
}
</style>
