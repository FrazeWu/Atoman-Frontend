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
      <aside id="studio-primary-navigation" class="studio-sidebar" :class="{ 'is-open': mobileNavOpen }">
        <nav data-testid="studio-primary-nav" aria-label="创作中心">
          <RouterLink to="/studio" exact-active-class="is-active" @click="mobileNavOpen = false">
            <LayoutDashboard :size="18" aria-hidden="true" />
            <span>Dashboard</span>
          </RouterLink>
          <RouterLink to="/studio/blog" active-class="is-active" @click="mobileNavOpen = false">
            <FileText :size="18" aria-hidden="true" />
            <span>博客</span>
          </RouterLink>
          <RouterLink to="/studio/podcast" active-class="is-active" @click="mobileNavOpen = false">
            <Mic2 :size="18" aria-hidden="true" />
            <span>播客</span>
          </RouterLink>
          <RouterLink to="/studio/video" active-class="is-active" @click="mobileNavOpen = false">
            <Video :size="18" aria-hidden="true" />
            <span>视频</span>
          </RouterLink>
          <RouterLink to="/studio/channel" active-class="is-active" @click="mobileNavOpen = false">
            <RadioTower :size="18" aria-hidden="true" />
            <span>频道设置</span>
          </RouterLink>
        </nav>
      </aside>

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
        <RouterView v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { FileText, LayoutDashboard, Menu, Mic2, RadioTower, Video } from 'lucide-vue-next'

import StudioChannelSelector from '@/components/studio/StudioChannelSelector.vue'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const route = useRoute()
const mobileNavOpen = ref(false)
const isChannelRoute = computed(() => route.path === '/studio/channel')

onMounted(() => {
  void studio.loadState()
})
</script>

<style scoped>
.studio-layout {
  min-height: calc(100dvh - var(--a-topbar-height, 3.5rem));
  background: var(--a-color-bg);
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

.studio-sidebar {
  border-right: 1px solid var(--a-color-border-soft);
  padding: 1rem 0.75rem;
}

.studio-sidebar nav {
  display: grid;
  gap: 0.25rem;
  position: sticky;
  top: 4.5rem;
}

.studio-sidebar a {
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  color: var(--a-color-muted);
  text-decoration: none;
  border-left: 2px solid transparent;
}

.studio-sidebar a:hover,
.studio-sidebar a:focus-visible,
.studio-sidebar a.is-active {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  border-left-color: currentColor;
}

.studio-sidebar a:focus-visible,
.studio-menu-button:focus-visible,
.studio-state button:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

.studio-main {
  min-width: 0;
  padding: clamp(1rem, 3vw, 2rem);
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

@media (max-width: 760px) {
  .studio-menu-button { display: inline-flex; }
  .studio-frame { display: block; }
  .studio-sidebar {
    display: none;
    border-right: 0;
    border-bottom: 1px solid var(--a-color-border-soft);
  }
  .studio-sidebar.is-open { display: block; }
  .studio-sidebar nav {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .studio-main { padding: 1rem; }
}
</style>
