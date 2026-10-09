<template>
  <div class="a-module-layout studio-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <div id="studio-primary-navigation" data-testid="studio-primary-nav" class="studio-sidebar-wrapper">
      <AppSidebar module="studio" class="studio-sidebar" aria-label="创作中心" />
    </div>

    <main class="a-main-content studio-main-content" tabindex="-1">
      <div class="a-content-frame">
        <p v-if="studio.loading && !studio.loaded" class="studio-state">加载中...</p>
        <div v-else-if="studio.error && !studio.loaded" class="studio-state" role="alert">
          <p>{{ studio.error }}</p>
          <button type="button" @click="studio.loadState(true)">重试</button>
        </div>
        <section v-else-if="studio.loaded && !studio.currentChannel && !isManagementRoute" class="studio-empty">
          <h1>还没有频道</h1>
          <RouterLink :to="{ path: '/studio/manage/channel', query: { return_to: route.fullPath } }">创建频道</RouterLink>
        </section>
        <RouterView v-else v-slot="{ Component }">
          <component v-if="Component" :is="Component" />
        </RouterView>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import AppSidebar from '@/components/system/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const route = useRoute()
const { sidebarCollapsed } = useSidebar()

const isManagementRoute = computed(() => (
  route.path.startsWith('/studio/manage') || route.path.startsWith('/studio/channel')
))

onMounted(() => {
  void studio.loadState()
})
</script>

<style scoped>
.studio-layout {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
}

.studio-sidebar-wrapper {
  display: contents;
}

.studio-state,
.studio-empty {
  max-width: 42rem;
  margin: 2rem auto;
  text-align: center;
}

.studio-state button {
  margin-top: 0.75rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  cursor: pointer;
}

.studio-empty h1 {
  font-size: 1.25rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.studio-empty a {
  display: inline-flex;
  align-items: center;
  min-height: var(--a-control-height-sm, 2.25rem);
  padding: 0 0.875rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  text-decoration: none;
  font-size: 0.875rem;
}

.studio-empty a:hover {
  background: var(--a-color-primary-hover);
}
</style>
