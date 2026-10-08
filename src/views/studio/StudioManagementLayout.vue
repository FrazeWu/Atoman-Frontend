<template>
  <section class="studio-management">
    <nav class="studio-management__nav" aria-label="管理">
      <RouterLink to="/studio/manage/channel">频道</RouterLink>
      <RouterLink v-if="studio.currentChannel" to="/studio/manage/calendar">日历</RouterLink>
      <span v-else class="studio-management__nav-unavailable" aria-disabled="true">日历</span>
      <RouterLink v-if="studio.currentChannel" to="/studio/manage/goals">经营</RouterLink>
      <RouterLink v-if="studio.currentChannel" to="/studio/manage/collections">合集</RouterLink>
      <span v-else class="studio-management__nav-unavailable" aria-disabled="true">合集</span>
    </nav>
    <RouterView />
  </section>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
</script>

<style scoped>
.studio-management {
  display: grid;
  gap: 1.5rem;
}

.studio-management__nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  margin-inline: -0.25rem;
  padding-inline: 0.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  scrollbar-width: none;
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
