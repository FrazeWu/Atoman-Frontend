<template>
  <div class="mobile-music-layout">
    <RouterView v-slot="{ Component, route: viewRoute }">
      <KeepAlive include="MobileSavedView" :max="2">
        <component :is="Component" :key="viewRoute.path" />
      </KeepAlive>
    </RouterView>
    <MusicSheetStack />
  </div>
</template>

<script setup lang="ts">
import MusicSheetStack from '@/components/music/MusicSheetStack.vue'
</script>

<style scoped>
.mobile-music-layout {
  min-width: 0;
}
</style>
