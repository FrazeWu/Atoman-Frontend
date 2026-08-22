<template>
  <section class="studio-module">
    <header v-if="matchedRoute" class="studio-module__header">
      <h1>{{ config.label }}</h1>
      <nav aria-label="模块管理">
        <RouterLink :to="`/studio/${module}/content`">内容</RouterLink>
        <RouterLink :to="`/studio/${module}/collections`">合集</RouterLink>
        <RouterLink v-if="module === 'video'" :to="`/studio/${module}/imports`">导入</RouterLink>
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
.studio-module { display: grid; gap: 1.5rem; }
.studio-module__header { display: grid; gap: 0.875rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-module__header h1 { margin: 0; font-size: clamp(1.5rem, 2vw, 1.75rem); line-height: 1.2; }
.studio-module__header nav { display: flex; gap: 0.25rem; overflow-x: auto; margin-inline: -0.25rem; padding-inline: 0.25rem; scrollbar-width: none; }
.studio-module__header nav::-webkit-scrollbar { display: none; }
.studio-module__header a { min-height: 2.75rem; display: inline-flex; align-items: center; padding: 0 0.75rem; border-radius: var(--a-radius-control) var(--a-radius-control) 0 0; color: var(--a-color-muted); text-decoration: none; white-space: nowrap; transition: color 0.18s ease, background-color 0.18s ease; }
.studio-module__header a:hover { color: var(--a-color-text); background: var(--a-color-surface-muted); }
.studio-module__header a.router-link-active { color: var(--a-color-primary); background: color-mix(in srgb, var(--a-color-primary) 8%, var(--a-color-bg)); box-shadow: inset 0 -2px 0 var(--a-color-primary); }
</style>
