<template>
  <footer class="site-footer">
    <div class="site-footer-inner">
      <RouterLink v-if="canAccessSettings" to="/setting" class="site-footer-brand">凹凸庵</RouterLink>
      <span v-else class="site-footer-brand site-footer-brand--disabled" title="需要管理员权限">凹凸庵</span>
      <nav class="site-footer-links" aria-label="站点信息">
        <a
          v-for="link in footbarLinks"
          :key="link.label"
          :href="link.href"
          class="site-footer-link"
        >{{ link.label }}</a>
      </nav>
      <span class="site-footer-version" aria-label="当前版本">{{ appVersion }}</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { appVersion } from '@/config/appVersion'
import { footbarLinks } from '@/config/moduleRooms'
import { useAuthStore } from '@/stores/auth'
import { isModeratorRole } from '@/utils/roles'

const authStore = useAuthStore()
const canAccessSettings = computed(() => isModeratorRole(authStore.user?.role))
</script>

<style scoped>
.site-footer {
  border-top: var(--a-border);
  background: var(--a-color-bg);
  margin-top: auto;
}
.site-footer-inner {
  max-width: 1152px;
  margin: 0 auto;
  padding: 1.25rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.site-footer-brand {
  color: var(--a-color-fg);
  font-weight: var(--a-font-weight-black);
  text-decoration: none;
}
.site-footer-brand:hover { text-decoration: underline; }
.site-footer-brand--disabled {
  color: var(--a-color-muted);
  cursor: not-allowed;
  opacity: 0.45;
}
.site-footer-brand--disabled:hover {
  text-decoration: none;
}
.site-footer-links {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.site-footer-link {
  color: var(--a-color-muted);
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
  text-decoration: none;
}
.site-footer-link:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}
.site-footer-version {
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-strong);
  white-space: nowrap;
}

@media (max-width: 767px) {
  .site-footer-inner {
    align-items: flex-start;
    padding: 1.25rem 2rem calc(1.25rem + 64px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
