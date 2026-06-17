<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.timeline.sidebar.collapsed"
    >
      <PSidebarItem
        to="/"
        :index="1"
        icon-char="轴"
        exact
      >
        时间轴首页
      </PSidebarItem>
      <PSidebarItem
        to="/persons"
        :index="2"
        icon-char="人"
      >
        人物志
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
