<template>
  <div class="studio-layout">
    <header class="studio-header">
      <RouterLink to="/studio" class="studio-title">创作中心</RouterLink>
      <div class="studio-header__actions">
        <StudioChannelSelector />
        <button
          class="studio-menu-button"
          type="button"
          :aria-expanded="mobileNavOpen"
          aria-controls="studio-primary-navigation"
          aria-label="打开创作中心导航"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <Menu :size="20" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div class="studio-frame">
      <div id="studio-primary-navigation" data-testid="studio-primary-nav" class="studio-sidebar-shell" :class="{ 'is-open': mobileNavOpen }">
        <AppSidebar module="studio" class="studio-sidebar" aria-label="创作中心" />
      </div>

      <main class="a-main-content" tabindex="-1">
        <p v-if="studio.loading && !studio.loaded" class="studio-state">加载中...</p>
        <div v-else-if="studio.error && !studio.loaded" class="studio-state" role="alert">
          <p>{{ studio.error }}</p>
          <button type="button" @click="studio.loadState(true)">重试</button>
        </div>
        <section v-else-if="studio.loaded && !studio.currentChannel && !isManagementRoute" class="studio-empty">
          <h1>还没有频道</h1>
          <RouterLink to="/studio/manage/channel">创建频道</RouterLink>
        </section>
        <RouterView v-else v-slot="{ Component }">
          <component v-if="Component" :is="Component" />
        </RouterView>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Menu } from 'lucide-vue-next'

import AppSidebar from '@/components/system/AppSidebar.vue'
import StudioChannelSelector from '@/components/studio/StudioChannelSelector.vue'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const route = useRoute()
const mobileNavOpen = ref(false)
const isManagementRoute = computed(() => (
  route.path.startsWith('/studio/manage') || route.path.startsWith('/studio/channel')
))

onMounted(() => {
  void studio.loadState()
})

watch(() => route.fullPath, () => {
  mobileNavOpen.value = false
})
</script>

<style scoped>
.studio-layout {
  --a-sidebar-width: 12rem;
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
}

.studio-header {
  min-height: 3.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem clamp(1rem, 3vw, 2rem);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.studio-title {
  color: inherit;
  font-size: 1rem;
  font-weight: 650;
  text-decoration: none;
}

.studio-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.studio-frame {
  display: grid;
  grid-template-columns: var(--a-sidebar-width) minmax(0, 1fr);
  min-height: calc(100dvh - 7.25rem);
}

.studio-sidebar-shell {
  min-width: 0;
  border-right: 1px solid var(--a-color-border-soft);
}

.studio-sidebar-shell .p-sidebar-item {
  text-decoration: none;
}

.studio-sidebar-shell .p-sidebar-item.active {
  text-decoration: none;
}


.studio-sidebar :deep(.p-sidebar-item:focus-visible),
.studio-menu-button:focus-visible,
.studio-state button:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

.studio-state,
.studio-empty {
  max-width: 42rem;
  margin: 2rem auto;
}

.studio-menu-button {
  display: none;
  width: 2.75rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .studio-layout { --a-sidebar-width: 4.5rem; }
}

@media (max-width: 767px) {
  .studio-layout { --a-sidebar-width: 0; }
  .studio-menu-button { display: inline-flex; }
  .studio-frame { display: block; }
  .studio-sidebar-shell {
    display: none;
    border-right: 0;
    border-bottom: 1px solid var(--a-color-border-soft);
  }
  .studio-sidebar-shell.is-open { display: block; }
  .studio-sidebar {
    display: flex;
    width: 100%;
    min-height: auto;
    padding: 0.75rem;
  }
  .studio-sidebar :deep(.p-sidebar-nav) {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .studio-sidebar :deep(.p-sidebar-item) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    justify-content: initial;
    gap: 0.6rem;
    padding: 0 0.75rem;
  }
  .studio-sidebar :deep(.p-sidebar-item-label) {
    position: static;
    width: auto;
    height: auto;
    padding: 0;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: nowrap;
    border: 0;
  }
}
</style>
