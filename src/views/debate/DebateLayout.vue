<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PaperSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
    >
      <PaperSidebarItem
        to="/"
        :index="1"
        icon-char="全"
        :active="!$route.query.status"
        exact
      >
        全部辩论
      </PaperSidebarItem>
      <PaperSidebarItem
        to="/?status=open"
        :index="2"
        icon-char="行"
        :active="$route.query.status === 'open'"
      >
        进行中
      </PaperSidebarItem>
      <PaperSidebarItem
        to="/?status=concluded"
        :index="3"
        icon-char="结"
        :active="$route.query.status === 'concluded'"
      >
        已结题
      </PaperSidebarItem>
      <PaperSidebarItem
        to="/?status=archived"
        :index="4"
        icon-char="档"
        :active="$route.query.status === 'archived'"
      >
        已归档
      </PaperSidebarItem>
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { moduleRooms } from '@/config/moduleRooms'
import PaperSidebar from '@/components/ui/PaperSidebar.vue'
import PaperSidebarItem from '@/components/ui/PaperSidebarItem.vue'

const sidebarStorageKey = 'atoman.debate.sidebar.collapsed'
const sidebarCollapsed = ref(false)

onMounted(() => {
  sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === 'true'
})

watch(sidebarCollapsed, (collapsed) => {
  localStorage.setItem(sidebarStorageKey, String(collapsed))
})
</script>
