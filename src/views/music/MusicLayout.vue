<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <PSidebar
      collapsible
      v-model:collapsed="sidebarCollapsed"
      storage-key="atoman.music.sidebar.collapsed"
    >
      <PSidebarItem to="/explore" :index="1" :icon="Compass">
        探索
      </PSidebarItem>
      <PSidebarItem to="/" :index="2" :icon="Users" exact>
        艺术家
      </PSidebarItem>
      <PSidebarItem to="/starred" :index="3" :icon="Star">
        我的收藏
      </PSidebarItem>
    </PSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Compass, Users, Star } from 'lucide-vue-next'
import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'

const sidebarCollapsed = ref(false)
</script>
