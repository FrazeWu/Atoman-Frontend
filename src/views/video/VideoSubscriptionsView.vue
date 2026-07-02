<script setup lang="ts">
import PPageHeader from '@/components/ui/PPageHeader.vue';
import PEmpty from '@/components/ui/PEmpty.vue';
import { moduleRooms } from '@/config/moduleRooms';
</script>

<template>
  <div class="a-page-xl video-subscriptions-view">
    <PPageHeader
      title="订阅"
      accent
    />
    
    <div style="margin-top: 1.5rem">
      <PEmpty
        title="尚未开放"
      />
    </div>
  </div>
</template>

<style scoped>
.video-subscriptions-view {
  min-height: 100%;
}
</style>
