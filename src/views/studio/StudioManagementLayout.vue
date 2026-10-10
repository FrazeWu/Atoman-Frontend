<template>
  <section class="studio-management">
    <header class="studio-management__header">
      <div class="studio-management__title-row">
        <div>
          <p class="studio-management__kicker">Studio</p>
          <h1>管理</h1>
        </div>
        <StudioChannelSelector v-if="studio.channels.length" class="studio-management__channel-picker" />
      </div>
      <nav class="studio-management__nav" aria-label="管理">
        <RouterLink to="/studio/manage/channel">频道</RouterLink>
        <RouterLink v-if="studio.currentChannel" to="/studio/manage/calendar">日历</RouterLink>
        <span v-else class="studio-management__nav-unavailable" aria-disabled="true">日历</span>
        <RouterLink v-if="studio.currentChannel" to="/studio/manage/goals">经营</RouterLink>
        <RouterLink v-if="studio.currentChannel" to="/studio/manage/collections">合集</RouterLink>
        <span v-else class="studio-management__nav-unavailable" aria-disabled="true">合集</span>
      </nav>
    </header>
    <RouterView />
    <RouterView name="overlay" v-slot="{ Component }">
      <StudioRouteSheet
        v-if="Component"
        :title="overlayTitle"
        @close="closeOverlay"
      >
        <component :is="Component" />
      </StudioRouteSheet>
    </RouterView>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import StudioChannelSelector from '@/components/studio/StudioChannelSelector.vue'
import StudioRouteSheet from '@/components/studio/StudioRouteSheet.vue'
import { hasAppHistory } from '@/router/studioEditor'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const route = useRoute()
const router = useRouter()
const overlayTitle = ref('编辑内容')

function closeOverlay() {
  if (hasAppHistory()) router.back()
  else void router.replace('/studio/manage/calendar')
}

watch(() => route.fullPath, () => {
  const module = String(route.params.module || '')
  if (module) overlayTitle.value = `${route.meta.studioOverlayMode === 'new' ? '新建' : '编辑'}${module === 'blog' ? '文章' : module === 'podcast' ? '播客' : '视频'}`
}, { immediate: true })
</script>

<style scoped>
.studio-management {
  display: grid;
  gap: 1.25rem;
  min-width: 0;
}

.studio-management__header {
  display: grid;
  gap: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.studio-management__title-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.studio-management__kicker {
  margin: 0 0 0.25rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.studio-management__title-row h1 {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 2rem);
  font-weight: 600;
}

.studio-management__channel-picker {
  width: min(16rem, 45vw);
}

.studio-management__nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  margin-inline: -0.25rem;
  padding-inline: 0.25rem;
  scrollbar-width: none;
}

@media (max-width: 640px) {
  .studio-management__title-row {
    align-items: stretch;
    flex-direction: column;
  }

  .studio-management__channel-picker {
    width: 100%;
  }
}

.studio-management__nav::-webkit-scrollbar {
  display: none;
}

.studio-management__nav a,
.studio-management__nav-unavailable {
  min-height: 2.5rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.75rem;
  border-bottom: 2px solid transparent;
  color: var(--a-color-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.studio-management__nav-unavailable {
  cursor: not-allowed;
  opacity: 0.45;
}

.studio-management__nav a:hover {
  color: var(--a-color-text);
}

.studio-management__nav a.router-link-active {
  color: var(--a-color-text);
  font-weight: 600;
  border-bottom-color: var(--a-color-primary);
}
</style>
