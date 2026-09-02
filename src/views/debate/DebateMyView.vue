<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { IconBook2 as BookOpen, IconMessage as MessageSquare, IconSettings as Settings } from '@tabler/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const authStore = useAuthStore()
const store = useDebateStore()
const myDebates = computed(() => store.debates.filter((debate) => debate.user?.uuid === authStore.user?.uuid || debate.user?.id === authStore.user?.id))

onMounted(() => {
  if (authStore.isAuthenticated) void store.fetchDebates({ page: 1, pageSize: 50 })
})
</script>

<template>
  <div class="a-page-md debate-my-view">
    <PPageHeader title="我的" mb="1.25rem" />
    <PEmpty v-if="!authStore.isAuthenticated" title="登录后查看我的辩题" description="登录账号以查看发起的辩题和参与记录。">
      <template #action><RouterLink to="/login" class="a-btn a-btn--primary">登录</RouterLink></template>
    </PEmpty>
    <template v-else>
      <nav class="debate-my__links" aria-label="辩题个人入口">
        <RouterLink to="/debate/me"><MessageSquare :size="18" aria-hidden="true" /><span>我发起的辩题</span></RouterLink>
        <RouterLink to="/debate/rules"><BookOpen :size="18" aria-hidden="true" /><span>辩论规则</span></RouterLink>
        <RouterLink :to="`/users/${authStore.user?.username}/settings`"><Settings :size="18" aria-hidden="true" /><span>账号设置</span></RouterLink>
      </nav>
      <section class="debate-my__list">
        <h2>我发起的辩题</h2>
        <PEmpty v-if="!myDebates.length" title="暂无辩题" description="从辩题页发起一个新的讨论。" />
        <RouterLink v-for="debate in myDebates" :key="debate.id" :to="`/debate/${debate.id}`">{{ debate.title }}</RouterLink>
      </section>
    </template>
  </div>
</template>

<style scoped>
.debate-my-view { min-height: 100%; padding-bottom: 3rem; }
.debate-my__links { display: grid; gap: 0.5rem; margin-bottom: 2rem; }
.debate-my__links a { display: flex; min-height: 48px; align-items: center; gap: 0.65rem; padding: 0.75rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.debate-my__links a:hover, .debate-my__links a:focus-visible { border-color: var(--a-color-fg); }
.debate-my__list { display: grid; gap: 0.75rem; }
.debate-my__list h2 { margin: 0; font-size: 1rem; font-weight: 500; }
.debate-my__list > a { color: var(--a-color-fg); text-decoration: none; }
.debate-my__list > a:hover { text-decoration: underline; }
</style>
