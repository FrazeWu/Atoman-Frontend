<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.debate.sidebar.collapsed"
    >
      <PSidebarItem
        to="/"
        :index="1"
        icon-char="全"
        :active="!$route.query.status"
        exact
      >
        全部辩论
      </PSidebarItem>
      <PSidebarItem
        to="/?status=open"
        :index="2"
        icon-char="行"
        :active="$route.query.status === 'open'"
      >
        进行中
      </PSidebarItem>
      <PSidebarItem
        to="/?status=concluded"
        :index="3"
        icon-char="结"
        :active="$route.query.status === 'concluded'"
      >
        已结题
      </PSidebarItem>
      <PSidebarItem
        to="/?status=archived"
        :index="4"
        icon-char="档"
        :active="$route.query.status === 'archived'"
      >
        已归档
      </PSidebarItem>
    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { moduleRooms } from '@/config/moduleRooms'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

const sidebarCollapsed = ref(false)
</script>
