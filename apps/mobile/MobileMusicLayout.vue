<template>
  <div class="mobile-music-layout">
    <RouterView v-slot="{ Component, route: viewRoute }">
      <Transition :name="routeMotion">
        <KeepAlive :max="2" :exclude="['MobilePlayerView']">
          <component :is="Component" :key="viewRoute.path" />
        </KeepAlive>
      </Transition>
    </RouterView>
    <MusicSheetStack />
  </div>
</template>

<script setup lang="ts">
import MusicSheetStack from '@/components/music/MusicSheetStack.vue'
import { useMobileRouteMotion } from './composables/useMobileRouteMotion'
const routeMotion = useMobileRouteMotion('/music')
</script>

<style scoped>
.mobile-music-layout {
  min-width: 0;
}
</style>
