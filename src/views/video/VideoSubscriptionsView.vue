<script setup lang="ts">
import PPageHeader from '@/components/ui/PPageHeader.vue';
import PEmpty from '@/components/ui/PEmpty.vue';
import { moduleRooms } from '@/config/moduleRooms';
</script>

<template>
  <div class="a-page-xl video-subscriptions-view">
    <PPageHeader
      title="订阅"
      sub="查看你关注的频道更新"
      accent
    />
    
    <div style="margin-top: 1.5rem">
      <PEmpty
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
