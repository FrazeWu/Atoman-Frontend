<template>
  <main class="setting-layout a-page-xl">
    <PSectionHeader
      title="设置"
      kicker="SETTING"
      description="管理站点模块开放状态与抓取策略。关闭模块后，对应模块入口与功能会在站内完全隐藏。"
      rule
    />

    <div v-if="isAccessHub" class="setting-layout__focus" aria-label="设置内容">
      <RouterView />
    </div>

    <div v-else class="setting-layout__shell">
      <aside class="setting-layout__sidebar" aria-label="设置导航">
        <PCard>
          <nav class="setting-layout__nav">
            <RouterLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="setting-layout__nav-link"
              :class="{ 'setting-layout__nav-link--active': isActive(item.to) }"
            >
              <span class="setting-layout__nav-kicker">{{ item.kicker }}</span>
              <strong>{{ item.label }}</strong>
              <small>{{ item.description }}</small>
            </RouterLink>
          </nav>
        </PCard>
      </aside>

      <section class="setting-layout__content" aria-label="设置内容">
        <RouterView />
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { RouterLink, RouterView } from 'vue-router'
import PCard from '@/components/ui/PCard.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { isOwnerRole } from '@/utils/roles'

const route = useRoute()
const authStore = useAuthStore()

const isAccessHub = computed(() => route.path === '/setting/access')

const navItems = computed(() => {
  const items = [
    {
      to: '/setting/access',
      kicker: '01 / ACCESS',
      label: '访问矩阵',
      description: '模块可见性与主要操作权限。',
    },
    {
      to: '/setting/music-review',
      kicker: '02 / MUSIC',
      label: '音乐管理',
      description: '审核音乐库编辑请求与条目管理。',
    },
  ]

  if (isOwnerRole(authStore.user?.role)) {
    items.push({
      to: '/setting/roles',
      kicker: '04 / ROLES',
      label: '用户权限',
      description: '给特定用户授予或撤销管理员权限。',
    })
  }

  return items
})

function isActive(target: string) {
  return route.path === target
}
</script>

<style scoped>
.setting-layout {
  display: grid;
  gap: 2rem;
}

.setting-layout__focus {
  min-width: 0;
}

.setting-layout__shell {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.setting-layout__sidebar {
  position: sticky;
  top: 2rem;
}

.setting-layout__nav {
  display: grid;
  gap: 0.75rem;
}

.setting-layout__nav-link {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  color: var(--a-color-ink);
  text-decoration: none;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.setting-layout__nav-link:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--a-shadow-paper-sm);
}

.setting-layout__nav-link--active {
  border-color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-md);
}

.setting-layout__nav-link--active strong {
  text-decoration: underline;
}

.setting-layout__nav-kicker {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.setting-layout__nav-link strong {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.2;
}

.setting-layout__nav-link small {
  color: var(--a-color-ink-muted);
  font-size: var(--a-text-sm);
  line-height: 1.5;
}

.setting-layout__content {
  min-width: 0;
}

@media (max-width: 900px) {
  .setting-layout__shell {
    grid-template-columns: 1fr;
  }

  .setting-layout__sidebar {
    position: static;
  }
}
</style>
