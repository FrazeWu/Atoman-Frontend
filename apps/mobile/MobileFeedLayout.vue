<template>
  <div class="mobile-feed-layout">
    <RouterView v-slot="{ Component, route: viewRoute }">
      <KeepAlive :max="2">
        <component :is="Component" :key="viewRoute.path" />
      </KeepAlive>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.mobile-feed-layout {
  min-width: 0;
}
</style>
