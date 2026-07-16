<template>
  <main class="setting-layout a-page-xl">
    <header class="setting-layout__header">
      <p class="setting-layout__kicker">站点设置</p>
      <h1>管理</h1>
      <p class="setting-layout__description">控制站点开放范围、用户权限和音乐资料。</p>

      <nav class="setting-layout__tabs" aria-label="管理页面">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="setting-layout__tab"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>

    <section class="setting-layout__workspace" aria-label="管理内容">
      <RouterView />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole, isModeratorRole, isOwnerRole } from '@/utils/roles'

const authStore = useAuthStore()

const navItems = computed(() => {
  const items: Array<{ to: string; label: string }> = []

  if (isAdminRole(authStore.user?.role)) {
    items.push(
      { to: '/setting/access', label: '全站' },
      { to: '/setting/music-review', label: '音乐' },
    )
  }

  if (isModeratorRole(authStore.user?.role)) {
    items.push({ to: '/setting/comment-moderation', label: '评论' })
  }

  if (isOwnerRole(authStore.user?.role)) {
    items.splice(1, 0, { to: '/setting/roles', label: '用户' })
  }

  return items
})
</script>

<style scoped>
.setting-layout {
  display: grid;
  gap: 2rem;
}

.setting-layout__header {
  display: grid;
  gap: 0.4rem;
}

.setting-layout__kicker,
.setting-layout__description,
.setting-layout__header h1 {
  margin: 0;
}

.setting-layout__kicker {
  color: var(--a-color-ink-soft);
  font-size: var(--a-text-xs);
  font-weight: var(--a-font-weight-strong);
}

.setting-layout__header h1 {
  color: var(--a-color-ink);
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.1;
}

.setting-layout__description {
  color: var(--a-color-ink-muted);
}

.setting-layout__tabs {
  display: flex;
  margin-top: 1.25rem;
  border-bottom: 1px solid var(--a-color-line);
}

.setting-layout__tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 6rem;
  min-height: 2.75rem;
  padding: 0 1.25rem;
  border-bottom: 2px solid transparent;
  color: var(--a-color-ink-soft);
  font-weight: var(--a-font-weight-strong);
  text-decoration: none;
}

.setting-layout__tab:hover,
.setting-layout__tab:focus-visible {
  color: var(--a-color-ink);
}

.setting-layout__tab:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: -2px;
}

.setting-layout__tab.router-link-exact-active {
  border-bottom-color: var(--a-color-ink);
  color: var(--a-color-ink);
}

.setting-layout__workspace {
  min-width: 0;
}

@media (max-width: 720px) {
  .setting-layout {
    gap: 1.5rem;
  }

  .setting-layout__header h1 {
    font-size: 2rem;
  }

  .setting-layout__tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .setting-layout__tab {
    min-width: 0;
    padding: 0 0.75rem;
  }
}
</style>
