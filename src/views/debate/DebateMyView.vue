<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { BookOpen, Scale, Settings } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModulePersonalHub, { type HubLink } from '@/components/ui/PModulePersonalHub.vue'

const authStore = useAuthStore()
const store = useDebateStore()
const myDebates = computed(() => store.debates.filter((debate) => debate.user?.uuid === authStore.user?.uuid || debate.user?.id === authStore.user?.id))

const links = computed<HubLink[]>(() => [
  { label: '我发起的辩题', to: '/debate/me', icon: Scale },
  { label: '辩论规则', to: '/debate/rules', icon: BookOpen },
  { label: '账号设置', to: `/users/${authStore.user?.username}/settings`, icon: Settings },
])

onMounted(() => {
  if (authStore.isAuthenticated) void store.fetchDebates({ page: 1, pageSize: 50 })
})
</script>

<template>
  <PModulePersonalHub
    title="我的"
    :authenticated="authStore.isAuthenticated"
    unauth-title="登录后查看我的辩题"
    unauth-description="登录账号以查看发起的辩题和参与记录。"
    :links="links"
  >
    <section class="debate-my__list">
      <h2 class="debate-my__section-title">我发起的辩题</h2>
      <PEmpty v-if="!myDebates.length" title="暂无辩题" description="从辩题页发起一个新的讨论。" />
      <div v-else class="debate-my__items">
        <RouterLink v-for="debate in myDebates" :key="debate.id" :to="`/debate/${debate.id}`" class="debate-my__item">
          {{ debate.title }}
        </RouterLink>
      </div>
    </section>
  </PModulePersonalHub>
</template>

<style scoped>
.debate-my__section-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 500;
}
.debate-my__items {
  display: grid;
  gap: 0.5rem;
}
.debate-my__item {
  display: block;
  padding: 0.75rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
  font-size: 0.875rem;
}
.debate-my__item:hover {
  border-color: var(--a-color-fg);
}
</style>
