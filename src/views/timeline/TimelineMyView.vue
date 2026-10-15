<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { IconClock as Clock3, IconMap as Map, IconSettings as Settings, IconUser as UserRound } from '@tabler/icons-vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useTimelineStore } from '@/stores/timeline'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModulePersonalHub, { type HubLink } from '@/components/ui/PModulePersonalHub.vue'

const authStore = useAuthStore()
const store = useTimelineStore()
const { persons } = storeToRefs(store)
const myPersons = computed(() => persons.value.filter((person) => person.user_id === authStore.user?.uuid))

const links = computed<HubLink[]>(() => [
  { label: '人物志', to: '/timeline/persons', icon: UserRound },
  { label: '我的事件', to: '/timeline', icon: Clock3 },
  { label: '地图工作区', to: '/timeline?view=map', icon: Map },
  { label: '账号设置', to: `/users/${authStore.user?.username}/settings`, icon: Settings },
])

onMounted(() => {
  if (authStore.isAuthenticated && !persons.value.length) void store.fetchPersons({ page: 1, limit: 50 })
})
</script>

<template>
  <PModulePersonalHub
    title="我的"
    :authenticated="authStore.isAuthenticated"
    unauth-title="登录后查看我的时间线内容"
    unauth-description="登录账号以查看创建的人物和事件。"
    :links="links"
    :columns="2"
  >
    <section class="timeline-my__list">
      <h2 class="timeline-my__section-title">我创建的人物</h2>
      <PEmpty v-if="!myPersons.length" title="暂无人物档案" description="从人物志创建一个人物档案。" />
      <div v-else class="timeline-my__items">
        <RouterLink v-for="person in myPersons" :key="person.id" :to="`/timeline/person/${person.id}`" class="timeline-my__item">
          {{ person.name }}
        </RouterLink>
      </div>
    </section>
  </PModulePersonalHub>
</template>

<style scoped>
.timeline-my__section-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 500;
}
.timeline-my__items {
  display: grid;
  gap: 0.5rem;
}
.timeline-my__item {
  display: block;
  padding: 0.75rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
  font-size: 0.875rem;
}
.timeline-my__item:hover {
  border-color: var(--a-color-fg);
}
</style>
