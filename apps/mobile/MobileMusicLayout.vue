<template>
  <div class="mobile-music-layout">
    <RouterView />
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
