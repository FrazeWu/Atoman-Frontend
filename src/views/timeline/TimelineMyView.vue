<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Clock3, Map, Settings, UserRound } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useTimelineStore } from '@/stores/timeline'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const authStore = useAuthStore()
const store = useTimelineStore()
const { persons } = storeToRefs(store)
const myPersons = computed(() => persons.value.filter((person) => person.user_id === authStore.user?.uuid))

onMounted(() => {
  if (authStore.isAuthenticated && !persons.value.length) void store.fetchPersons({ page: 1, limit: 50 })
})
</script>

<template>
  <div class="a-page-md timeline-my-view">
    <PPageHeader title="我的" mb="1.25rem" />
    <PEmpty v-if="!authStore.isAuthenticated" title="登录后查看我的时间线内容" description="登录账号以查看创建的人物和事件。">
      <template #action><RouterLink to="/login" class="a-btn a-btn--primary">登录</RouterLink></template>
    </PEmpty>
    <template v-else>
      <nav class="timeline-my__links" aria-label="时间线个人入口">
        <RouterLink to="/timeline/persons"><UserRound :size="18" aria-hidden="true" /><span>人物志</span></RouterLink>
        <RouterLink to="/timeline"><Clock3 :size="18" aria-hidden="true" /><span>我的事件</span></RouterLink>
        <RouterLink to="/timeline?view=map"><Map :size="18" aria-hidden="true" /><span>地图工作区</span></RouterLink>
        <RouterLink :to="`/users/${authStore.user?.username}/settings`"><Settings :size="18" aria-hidden="true" /><span>账号设置</span></RouterLink>
      </nav>
      <section class="timeline-my__list">
        <h2>我创建的人物</h2>
        <PEmpty v-if="!myPersons.length" title="暂无人物档案" description="从人物志创建一个人物档案。" />
        <RouterLink v-for="person in myPersons" :key="person.id" :to="`/timeline/person/${person.id}`">{{ person.name }}</RouterLink>
      </section>
    </template>
  </div>
</template>

<style scoped>
.timeline-my-view { min-height: 100%; padding-bottom: 3rem; }
.timeline-my__links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin-bottom: 2rem; }
.timeline-my__links a { display: flex; min-height: 48px; align-items: center; gap: 0.65rem; padding: 0.75rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.timeline-my__links a:hover, .timeline-my__links a:focus-visible { border-color: var(--a-color-fg); }
.timeline-my__list { display: grid; gap: 0.75rem; }
.timeline-my__list h2 { margin: 0; font-size: 1rem; font-weight: 500; }
.timeline-my__list > a { color: var(--a-color-fg); text-decoration: none; }
.timeline-my__list > a:hover { text-decoration: underline; }
@media (max-width: 420px) { .timeline-my__links { grid-template-columns: 1fr; } }
</style>
