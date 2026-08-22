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
        <PSidebar class="studio-sidebar" aria-label="创作中心">
          <PSidebarItem to="/studio" exact :icon="LayoutDashboard" @click="mobileNavOpen = false">
            概览
          </PSidebarItem>
          <PSidebarItem to="/studio/blog" :icon="FileText" @click="mobileNavOpen = false">
            博客
          </PSidebarItem>
          <PSidebarItem to="/studio/podcast" :icon="Mic2" @click="mobileNavOpen = false">
            播客
          </PSidebarItem>
          <PSidebarItem to="/studio/video" :icon="Video" @click="mobileNavOpen = false">
            视频
          </PSidebarItem>
          <PSidebarItem to="/studio/channel" :icon="RadioTower" @click="mobileNavOpen = false">
            频道管理
          </PSidebarItem>
        </PSidebar>
      </div>

      <main class="studio-main" tabindex="-1">
        <p v-if="studio.loading && !studio.loaded" class="studio-state">加载中...</p>
        <div v-else-if="studio.error && !studio.loaded" class="studio-state" role="alert">
          <p>{{ studio.error }}</p>
          <button type="button" @click="studio.loadState(true)">重试</button>
        </div>
        <section v-else-if="studio.loaded && !studio.currentChannel && !isChannelRoute" class="studio-empty">
          <h1>还没有频道</h1>
          <RouterLink to="/studio/channel">创建频道</RouterLink>
        </section>
        <RouterView v-else v-slot="{ Component }">
          <div v-if="Component" class="studio-route-surface">
            <component :is="Component" />
          </div>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { FileText, LayoutDashboard, Menu, Mic2, RadioTower, Video } from 'lucide-vue-next'

import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
import StudioChannelSelector from '@/components/studio/StudioChannelSelector.vue'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const route = useRoute()
const mobileNavOpen = ref(false)
const isChannelRoute = computed(() => route.path.startsWith('/studio/channel'))

onMounted(() => {
  void studio.loadState()
})
</script>

<style scoped>
.studio-layout {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
  background: var(--a-color-surface);
  color: var(--a-color-fg);
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
  grid-template-columns: 13rem minmax(0, 1fr);
  min-height: calc(100dvh - 7.25rem);
}

.studio-sidebar-shell {
  min-width: 0;
  border-right: 1px solid var(--a-color-border-soft);
}

.studio-sidebar {
  width: 100%;
  min-height: 100%;
  height: auto;
  position: static;
  padding: 1rem 0.75rem;
  overflow: visible;
  background: transparent;
}

.studio-sidebar :deep(.p-sidebar-nav) {
  position: sticky;
  top: 4.5rem;
}

.studio-sidebar :deep(.p-sidebar-item) {
  width: 100%;
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

.studio-main {
  min-width: 0;
  padding: clamp(1rem, 3vw, 2rem);
}

.studio-route-surface {
  width: 100%;
  max-width: 78rem;
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem) - 7.25rem);
  margin: 0 auto;
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

@media (min-width: 761px) and (max-width: 1023px) {
  .studio-sidebar { width: 100%; }
  .studio-sidebar :deep(.p-sidebar-nav) { position: static; }
  .studio-sidebar :deep(.p-sidebar-item) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    justify-content: initial;
    gap: 0.6rem;
    padding: 0 0.85rem;
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
  .studio-sidebar :deep(.p-sidebar-item-svg) {
    inline-size: 1.375rem;
    block-size: 1.375rem;
  }
}

@media (max-width: 760px) {
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
  .studio-main { padding: 1rem; }
}
</style>
