<template>
  <section class="studio-module">
    <header v-if="matchedRoute" class="studio-module__header">
      <h1>{{ config.label }}</h1>
      <nav aria-label="模块管理">
        <RouterLink :to="`/studio/${module}/content`">内容</RouterLink>
        <RouterLink :to="`/studio/${module}/analytics`">数据</RouterLink>
        <RouterLink :to="`/studio/${module}/interactions`">互动</RouterLink>
        <RouterLink :to="`/studio/${module}/settings`">设置</RouterLink>
      </nav>
    </header>
    <RouterView />
  </section>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { matchedRouteKey, RouterLink, RouterView, useRoute } from 'vue-router'

import { studioModules } from '@/config/studioModules'
import type { StudioModule } from '@/types'

const route = useRoute()
const matchedRoute = inject(matchedRouteKey, undefined)
const module = computed(() => route.params.module as StudioModule)
const config = computed(() => studioModules[module.value])
</script>

<style scoped>
.studio-module { display: grid; gap: 1.25rem; }
.studio-module__header { display: grid; gap: 0.75rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-module__header h1 { margin: 0; font-size: 1.5rem; }
.studio-module__header nav { display: flex; gap: 1.25rem; overflow-x: auto; }
.studio-module__header a { min-height: 2.75rem; display: inline-flex; align-items: center; color: var(--a-color-muted); text-decoration: none; border-bottom: 2px solid transparent; white-space: nowrap; }
.studio-module__header a.router-link-active { color: var(--a-color-fg); border-bottom-color: currentColor; }
</style>
