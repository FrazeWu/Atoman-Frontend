<template>
  <RouterLink
    to="/modules"
    class="mobile-module-switcher"
    data-testid="mobile-module-switcher"
    aria-label="打开模块"
  >
    <span class="mobile-module-switcher__label">{{ label }}</span>
    <ChevronDown :size="16" aria-hidden="true" />
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ChevronDown } from 'lucide-vue-next'
import type { ModuleRoomKey } from '@/config/moduleRooms'

defineProps<{
  label: string
  currentModule?: ModuleRoomKey | null
  availableModules?: ModuleRoomKey[]
  desktopBaseUrl?: string
  nativePersonalRoutes?: boolean
}>()
</script>

<style scoped>
.mobile-module-switcher {
  display: none;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.25rem;
  color: var(--a-color-fg);
  font: inherit;
  font-size: 1.0625rem;
  font-weight: 650;
  text-decoration: none;
}

.mobile-module-switcher__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-module-switcher:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 3px;
  border-radius: 4px;
}

@media (max-width: 720px) {
  .mobile-module-switcher {
    display: inline-flex;
    flex: 1;
  }
}
</style>
