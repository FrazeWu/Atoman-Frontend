<template>
  <section class="studio-module">
    <header v-if="matchedRoute" class="studio-module__header">
      <h1>{{ config.label }}</h1>
      <nav aria-label="模块管理">
        <RouterLink :to="`/studio/${module}/content`">内容</RouterLink>
        <RouterLink v-if="module === 'video'" :to="`/studio/${module}/imports`">导入</RouterLink>
        <RouterLink :to="`/studio/${module}/analytics`">数据</RouterLink>
        <RouterLink :to="`/studio/${module}/interactions`">互动</RouterLink>
        <RouterLink :to="`/studio/${module}/settings`">设置</RouterLink>
      </nav>
    </header>
    <RouterView />
    <RouterView name="overlay" v-slot="{ Component }">
      <StudioRouteSheet
        v-if="Component"
        :title="overlayTitle"
        @close="closeOverlay"
      >
        <component :is="Component" @title-change="setOverlayName" />
      </StudioRouteSheet>
    </RouterView>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { matchedRouteKey, RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import StudioRouteSheet from '@/components/studio/StudioRouteSheet.vue'
import { hasAppHistory, studioContentLocation } from '@/router/studioEditor'

import { studioModules } from '@/config/studioModules'
import type { StudioModule } from '@/types'

const route = useRoute()
const router = useRouter()
const matchedRoute = inject(matchedRouteKey, undefined)
const module = computed(() => (route.params.module ?? route.meta.studioModule) as StudioModule)
const config = computed(() => studioModules[module.value])
const overlayName = ref('')
const overlayTitle = computed(() => {
  const mode = route.meta.studioOverlayMode === 'new' ? '新建' : '编辑'
  const type = config.value?.itemLabel || '内容'
  return `${mode}-${overlayName.value.trim() || type}`
})
watch(() => route.fullPath, () => {
  overlayName.value = ''
})
function setOverlayName(name: string) {
  overlayName.value = name.trim()
}

function closeOverlay() {
  if (hasAppHistory()) {
    router.back()
    return
  }
  void router.replace(studioContentLocation(String(module.value), route.query))
}
</script>

<style scoped>
.studio-module {
  display: grid;
  gap: 1.5rem;
}

.studio-module__header {
  display: grid;
  gap: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.studio-module__header h1 {
  margin: 0;
  font-size: clamp(1.25rem, 1.8vw, 1.5rem);
  font-weight: 500;
  line-height: 1.2;
}

.studio-module__header nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  margin-inline: -0.25rem;
  padding-inline: 0.25rem;
  scrollbar-width: none;
}

.studio-module__header nav::-webkit-scrollbar {
  display: none;
}

.studio-module__header a {
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

.studio-module__header a:hover {
  color: var(--a-color-text);
}

.studio-module__header a.router-link-active {
  color: var(--a-color-text);
  font-weight: 600;
  border-bottom-color: var(--a-color-primary);
}
</style>
