<script setup lang="ts">
import APageHeader from '@/components/ui/APageHeader.vue';
import AEmpty from '@/components/ui/AEmpty.vue';
import { moduleRooms } from '@/config/moduleRooms';
</script>

<template>
  <div class="video-subscriptions-view">
    <APageHeader
      :title="moduleRooms.video.name"
      sub="查看你关注的频道更新"
      accent
    />
    
    <div class="p-4">
      <AEmpty
        title="订阅功能即将上线"
        description="我们将在这里展示你关注的视频动态"
      />
    </div>
  </div>
</template>

<style scoped>
.video-subscriptions-view {
  min-height: 100%;
}
</style>
