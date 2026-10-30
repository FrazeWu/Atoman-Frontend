<template>
  <div class="mobile-feed-layout">
    <RouterView v-slot="{ Component, route: viewRoute }">
      <Transition :name="routeMotion">
        <KeepAlive :max="2">
          <component v-if="viewRoute.path === '/feed' && typeof viewRoute.query.source_id === 'string'" :is="sourceLanding" key="feed-source" />
          <component v-else :is="Component" :key="viewRoute.path" />
        </KeepAlive>
      </Transition>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useMobileRouteMotion } from './composables/useMobileRouteMotion'
const routeMotion = useMobileRouteMotion('/feed')

// 来源深链接复用公开来源面板；普通移动信息流保持原样。
const sourceLanding = defineAsyncComponent(() => import('@/views/feed/FeedRecommendedView.vue'))
</script>

<style scoped>
.mobile-feed-layout {
  min-width: 0;
}
</style>
