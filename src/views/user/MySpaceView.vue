<template>
  <main class="my-space a-page-xl" aria-labelledby="my-space-title">
    <header class="my-space__header">
      <div>
        <p class="my-space__eyebrow">PERSONAL</p>
        <h1 id="my-space-title">我的</h1>
        <p class="my-space__subtitle">管理你的内容、资料和公开主页。</p>
      </div>

      <nav class="my-space__tabs" aria-label="我的页面" role="tablist">
        <RouterLink
          to="/me"
          data-testid="my-space-tab-workspace"
          class="my-space__tab"
          :class="{ 'is-active': activeView === 'workspace' }"
          :aria-selected="activeView === 'workspace'"
          :tabindex="activeView === 'workspace' ? 0 : -1"
          role="tab"
        >工作台</RouterLink>
        <RouterLink
          :to="{ path: '/me', query: { view: 'profile' } }"
          data-testid="my-space-tab-profile"
          class="my-space__tab"
          :class="{ 'is-active': activeView === 'profile' }"
          :aria-selected="activeView === 'profile'"
          :tabindex="activeView === 'profile' ? 0 : -1"
          role="tab"
        >公开主页</RouterLink>
      </nav>
    </header>

    <KeepAlive>
      <component :is="activeComponent" v-bind="activeProps" />
    </KeepAlive>
  </main>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import MyHubView from '@/views/user/MyHubView.vue'
import ProfileView from '@/views/blog/ProfileView.vue'
import { useAuthStore } from '@/stores/auth'

type MySpaceViewKey = 'workspace' | 'profile'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const requestedView = computed<MySpaceViewKey>(() => route.query.view === 'profile' ? 'profile' : 'workspace')
const activeView = computed(() => requestedView.value)
const username = computed(() => authStore.user?.username || '')
const activeComponent = computed(() => activeView.value === 'profile' ? ProfileView : MyHubView)
const activeProps = computed(() => activeView.value === 'profile'
  ? { handle: username.value, embedded: true }
  : {})

watch(
  () => route.query.view,
  (view) => {
    if (view === undefined || view === 'profile') return
    void router.replace({ path: '/me' })
  },
  { immediate: true },
)
</script>

<style scoped>
.my-space { padding-bottom: 8rem; }
.my-space :deep(.my-hub), .my-space :deep(.profile-page--embedded) { padding-bottom: 0; }
.my-space__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.5rem 0 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}
.my-space__eyebrow { margin: 0 0 0.35rem; color: var(--a-color-muted); font-size: 0.7rem; letter-spacing: 0.08em; }
.my-space h1 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 500; }
.my-space__subtitle { margin: 0.4rem 0 0; color: var(--a-color-muted); }
.my-space__tabs { display: flex; gap: 0.25rem; flex-shrink: 0; }
.my-space__tab {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  padding: 0 0.8rem;
  border-bottom: 2px solid transparent;
  color: var(--a-color-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}
.my-space__tab:hover, .my-space__tab:focus-visible { color: var(--a-color-fg); }
.my-space__tab.is-active { border-bottom-color: var(--a-color-fg); color: var(--a-color-fg); }
.my-space__tab:focus-visible { outline: 2px solid var(--a-color-fg); outline-offset: 2px; }
@media (max-width: 640px) {
  .my-space__header { align-items: flex-start; flex-direction: column; gap: 1rem; }
  .my-space__tabs { width: 100%; }
  .my-space__tab { flex: 1; justify-content: center; }
}
</style>
